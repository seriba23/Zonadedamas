// Injectable + Logger de NestJS (servicio inyectable + registro en consola).
import { Injectable, Logger } from '@nestjs/common';
// Puente a la base de datos.
import { PrismaService } from '../../prisma/prisma.service';
// Servicio que envía las notificaciones push reales (ya documentado).
import { WebPushService } from './web-push.service';

// Interfaz que describe TODO lo necesario para crear una notificación. Es el
// "contrato" que otros módulos rellenan al pedir notificar al staff.
export interface NotifyStaffInput {
  tenantId: string;   // a qué negocio (tenant) pertenece la notificación
  type: string;       // tipo/código del evento (ej. 'appointment.created')
  section: string;    // sección donde se agrupa (ej. 'appointments')
  title: string;      // título de la notificación
  body: string;       // texto del cuerpo
  link?: string;       // link por defecto (vista empleado)
  adminLink?: string;  // si esta presente, los admins usan este link en lugar de `link`
  entityType?: string; // tipo de entidad relacionada (ej. 'appointment')
  entityId?: string;   // id de esa entidad (para enlazar/agrupar)
  metadata?: Record<string, any>; // datos extra libres (objeto clave->valor)
  audience: NotifyAudience;        // a QUIÉN se le envía (ver tipo abajo)
}

// "type ... = A | B | C" es una "unión discriminada": el valor puede ser UNA de
// estas tres formas, y el campo "kind" dice cuál es. Así sabemos a quién va
// dirigida la notificación:
export type NotifyAudience =
  // al empleado de la cita Y a todos los admins (lleva el employeeId).
  | { kind: 'employee_and_admins'; employeeId: string }
  // solo a los admins del negocio.
  | { kind: 'admins' }
  // a una lista explícita de usuarios (por sus ids).
  | { kind: 'users'; userIds: string[] };

// Permiso que identifica a un "admin" del negocio (mismo discriminador
// que usa el sidebar). Module = 'employees', action = 'create'.
// Es decir: consideramos "admin" a quien pueda crear empleados.
const ADMIN_PERMISSION_MODULE = 'employees';
const ADMIN_PERMISSION_ACTION = 'create';

// Servicio central: crea las filas de notificación en BD y dispara el push.
@Injectable()
export class NotifyStaffService {
  private readonly logger = new Logger(NotifyStaffService.name);

  // Inyectamos DOS dependencias: la BD (prisma) y el enviador de push (webPush).
  constructor(
    private readonly prisma: PrismaService,
    private readonly webPush: WebPushService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // notify(): punto de entrada. Recibe el "input" completo, decide los
  // destinatarios, guarda una notificación por destinatario y lanza los push.
  // ───────────────────────────────────────────────────────────────────────────
  async notify(input: NotifyStaffInput): Promise<void> {
    // Resolvemos la lista de ids de usuario que deben recibir la notificación,
    // según el "audience" indicado.
    const recipientIds = await this.resolveAudience(
      input.tenantId,
      input.audience,
    );
    // Si no hay nadie a quien notificar, salimos.
    if (recipientIds.length === 0) return;

    // Para resolver el link correcto por destinatario: si es admin
    // (tiene permiso employees.create) y hay adminLink, usa adminLink;
    // si no, usa link.
    // Un "Set" es una colección sin duplicados con búsqueda rápida (.has()).
    // Operador ternario: si hay adminLink, calculamos el set de ids admin;
    // si no, dejamos un set vacío (no hace falta distinguir).
    const adminIdSet = input.adminLink
      ? new Set(await this.getAdminUserIds(input.tenantId))
      : new Set<string>();

    // Misma marca de tiempo para todas las notificaciones de esta tanda.
    const now = new Date();
    // Construimos un "registro" (objeto a insertar) por cada destinatario.
    const records = recipientIds.map((userId) => ({
      tenantId: input.tenantId,
      userId,
      type: input.type,
      section: input.section,
      title: input.title,
      body: input.body,
      // Elegimos el link: si este userId es admin Y hay adminLink, usamos
      // adminLink; si no, el link normal. "?? null" => si quedara undefined,
      // guardamos null (la BD necesita un valor concreto).
      link: (adminIdSet.has(userId) ? input.adminLink : input.link) ?? null,
      // "?? null": guarda null si el campo opcional no vino.
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      // "?? undefined": deja el campo como undefined (Prisma lo omite, MySQL no
      // admite default JSON, por eso no se fuerza a null aquí).
      metadata: input.metadata ?? undefined,
      createdAt: now,
    }));

    // createMany no devuelve los ids; los necesitamos para que el push
    // referencie la notificacion exacta. Iteramos uno a uno.
    // Promise.all crea todas las filas en paralelo y junta sus resultados
    // (cada uno YA trae su id generado) en el arreglo "created".
    const created = await Promise.all(
      records.map((r) => this.prisma.staffNotification.create({ data: r })),
    );

    // Disparar push en paralelo (no esperamos a que termine para no
    // bloquear el evento de dominio que nos llamo).
    // "void" delante de la promesa = "lánzala pero NO esperes su resultado"
    // (fire-and-forget). Así notify() responde rápido aunque el push tarde.
    void Promise.all(
      created.map((notif) =>
        this.webPush.sendToUser(notif.userId, {
          title: notif.title,
          body: notif.body,
          // El link puede ser null en BD; el push espera string|undefined.
          link: notif.link ?? undefined,
          // "tag" agrupa pushes relacionados: usamos sección + entidad. Si no
          // hay entityId, usamos el id de la notificación como respaldo.
          tag: `${notif.section}:${notif.entityId ?? notif.id}`,
          notificationId: notif.id,
        }),
      ),
      // Aunque no esperamos el resultado, sí capturamos un posible error global
      // del lote de push para registrarlo como advertencia (no romper nada).
    ).catch((err) =>
      this.logger.warn(`Push batch failed: ${err?.message ?? err}`),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // resolveAudience(): traduce el "audience" (a quién) en una lista de ids de
  // usuario reales. "private" = solo se usa dentro de esta clase.
  // ───────────────────────────────────────────────────────────────────────────
  private async resolveAudience(
    tenantId: string,
    audience: NotifyAudience,
  ): Promise<string[]> {
    // Caso 1: lista explícita de usuarios -> la devolvemos tal cual.
    if (audience.kind === 'users') {
      return audience.userIds;
    }

    // Caso 2: solo admins -> consultamos los ids de admin del negocio.
    if (audience.kind === 'admins') {
      return this.getAdminUserIds(tenantId);
    }

    // Caso 3 (el restante): employee_and_admins.
    // Buscamos EN PARALELO el userId del empleado y la lista de admins.
    const [employeeUserId, adminIds] = await Promise.all([
      this.getEmployeeUserId(tenantId, audience.employeeId),
      this.getAdminUserIds(tenantId),
    ]);

    // Usamos un Set para FUSIONAR sin duplicar (si el empleado también es admin,
    // no aparecerá dos veces).
    const set = new Set<string>(adminIds);
    // Solo añadimos al empleado si tiene userId (puede no estar enlazado a uno).
    if (employeeUserId) set.add(employeeUserId);
    // Array.from convierte el Set de vuelta a un arreglo normal de ids.
    return Array.from(set);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getEmployeeUserId(): dado un empleado, devuelve el id del USUARIO (cuenta
  // de login) asociado, o null si no tiene. Un empleado puede existir sin
  // cuenta de usuario, por eso puede devolver null.
  // ───────────────────────────────────────────────────────────────────────────
  private async getEmployeeUserId(
    tenantId: string,
    employeeId: string,
  ): Promise<string | null> {
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId }, // del empleado correcto y su tenant
      select: { userId: true },            // solo necesitamos el userId
    });
    // "emp?.userId ?? null": si no hay empleado (emp es null) o no tiene userId,
    // devolvemos null.
    return emp?.userId ?? null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getAdminUserIds(): devuelve los ids de usuario que son "admins" del negocio,
  // es decir, los que tienen un rol con el permiso employees.create y están activos.
  // ───────────────────────────────────────────────────────────────────────────
  private async getAdminUserIds(tenantId: string): Promise<string[]> {
    // Consultamos la tabla intermedia userRole (qué rol tiene cada usuario en
    // cada tenant), filtrando por roles que incluyan el permiso de admin.
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        tenantId,
        // Navegamos por relaciones: el rol -> sus permisos -> el permiso buscado.
        role: {
          rolePermissions: {
            // "some" = "al menos uno de los permisos del rol cumple esto".
            some: {
              permission: {
                module: ADMIN_PERMISSION_MODULE, // 'employees'
                action: ADMIN_PERMISSION_ACTION, // 'create'
              },
            },
          },
        },
        // Solo usuarios activos (no dados de baja).
        user: { isActive: true },
      },
      select: { userId: true },
      // "distinct" elimina duplicados: si un usuario tiene varios roles admin,
      // su userId aparece una sola vez.
      distinct: ['userId'],
    });
    // Convertimos la lista de filas {userId} en una lista simple de ids.
    return userRoles.map((ur) => ur.userId);
  }
}
