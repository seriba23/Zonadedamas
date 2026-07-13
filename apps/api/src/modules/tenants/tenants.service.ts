// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos errores HTTP listos para lanzar:
//   - BadRequestException: responde HTTP 400 (petición inválida).
//   - ConflictException: responde HTTP 409 (conflicto, ej. dato duplicado).
//   - Injectable: decorador que marca la clase como servicio inyectable.
//   - NotFoundException: responde HTTP 404 (no encontrado).
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// bcrypt: librería para "hashear" (cifrar de forma irreversible) contraseñas,
// para nunca guardarlas en texto plano. "* as bcrypt" importa todo el módulo.
import * as bcrypt from 'bcrypt';
// PrismaService: nuestro puente hacia la base de datos (this.prisma).
import { PrismaService } from '../../prisma/prisma.service';
// Los DTOs (formas válidas del JSON entrante) usados por los métodos de abajo.
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateLocationDto, UpdateLocationDto } from './dto/create-location.dto';
import { SetBusinessHoursDto } from './dto/business-hours.dto';
import { CreateBusinessClosureDto } from './dto/business-closure.dto';
// Utilidad propia que convierte una fecha "límite" de texto a un objeto Date
// ajustado al inicio o fin del día (para filtrar rangos correctamente).
import { parseRangeBound } from '../../common/utils/date-range.util';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';

// Lista (constante) con los 53 permisos de toda la plataforma. Cada permiso es
// un objeto { module, action }. Más abajo se combinan como "module.action".
const ALL_PERMISSIONS = [
  // Tenant & Settings
  { module: 'tenant', action: 'read' },
  { module: 'tenant', action: 'update' },
  // Locations
  { module: 'locations', action: 'read' },
  { module: 'locations', action: 'create' },
  { module: 'locations', action: 'update' },
  { module: 'locations', action: 'delete' },
  // Users
  { module: 'users', action: 'read' },
  { module: 'users', action: 'create' },
  { module: 'users', action: 'update' },
  { module: 'users', action: 'delete' },
  { module: 'users', action: 'manage' },
  // Roles
  { module: 'roles', action: 'read' },
  { module: 'roles', action: 'create' },
  { module: 'roles', action: 'update' },
  { module: 'roles', action: 'delete' },
  // Clients
  { module: 'clients', action: 'read' },
  { module: 'clients', action: 'create' },
  { module: 'clients', action: 'update' },
  { module: 'clients', action: 'delete' },
  // Services
  { module: 'services', action: 'read' },
  { module: 'services', action: 'create' },
  { module: 'services', action: 'update' },
  { module: 'services', action: 'delete' },
  // Employees
  { module: 'employees', action: 'read' },
  { module: 'employees', action: 'create' },
  { module: 'employees', action: 'update' },
  { module: 'employees', action: 'delete' },
  { module: 'employees', action: 'manage_schedule' },
  { module: 'employees', action: 'manage_time_off' },
  { module: 'employees', action: 'manage_services' },
  // Resources
  { module: 'resources', action: 'read' },
  { module: 'resources', action: 'create' },
  { module: 'resources', action: 'update' },
  { module: 'resources', action: 'delete' },
  // Availability
  { module: 'availability', action: 'read' },
  // Appointments
  { module: 'appointments', action: 'read' },
  { module: 'appointments', action: 'create' },
  { module: 'appointments', action: 'update' },
  { module: 'appointments', action: 'delete' },
  { module: 'appointments', action: 'reschedule' },
  { module: 'appointments', action: 'cancel' },
  { module: 'appointments', action: 'complete' },
  { module: 'appointments', action: 'no_show' },
  { module: 'appointments', action: 'remind' },
  // Payments
  { module: 'payments', action: 'read' },
  { module: 'payments', action: 'create' },
  { module: 'payments', action: 'refund' },
  { module: 'payments', action: 'void' },
  // Reports
  { module: 'reports', action: 'read' },
  { module: 'reports', action: 'export' },
  // Audit
  { module: 'audit', action: 'read' },
  // Automation
  { module: 'automation', action: 'read' },
  { module: 'automation', action: 'manage' },
];

// Lista (constante) de los 7 roles por defecto que recibe cada negocio nuevo,
// con los permisos que tiene cada uno. "isSystem: true" marca roles del sistema
// (no editables por el usuario); el rol "Custom" tiene isSystem: false.
const DEFAULT_ROLES = [
  {
    name: 'Owner',
    description: 'Full access to everything',
    isSystem: true,
    // El dueño tiene TODOS los permisos. ALL_PERMISSIONS.map(...) recorre cada
    // permiso y lo transforma en el texto "module.action" (ej. "tenant.read").
    permissions: ALL_PERMISSIONS.map((p) => `${p.module}.${p.action}`),
  },
  {
    name: 'Manager',
    description: 'Manages staff, services, and appointments',
    isSystem: true,
    permissions: [
      'locations.read', 'locations.update',
      'users.read', 'users.create', 'users.update', 'users.manage',
      'roles.read',
      'clients.read', 'clients.create', 'clients.update', 'clients.delete',
      'services.read', 'services.create', 'services.update',
      'employees.read', 'employees.create', 'employees.update',
      'employees.manage_schedule', 'employees.manage_time_off', 'employees.manage_services',
      'resources.read', 'resources.create', 'resources.update',
      'availability.read',
      'appointments.read', 'appointments.create', 'appointments.update',
      'appointments.reschedule', 'appointments.cancel', 'appointments.complete', 'appointments.no_show', 'appointments.remind',
      'payments.read', 'payments.create', 'payments.refund',
      'reports.read', 'reports.export',
      'audit.read',
    ],
  },
  {
    name: 'Receptionist',
    description: 'Manages bookings and clients',
    isSystem: true,
    permissions: [
      'clients.read', 'clients.create', 'clients.update',
      'services.read',
      'employees.read',
      'availability.read',
      'appointments.read', 'appointments.create', 'appointments.update',
      'appointments.reschedule', 'appointments.cancel', 'appointments.complete', 'appointments.no_show', 'appointments.remind',
      'payments.read', 'payments.create',
      'reports.read',
    ],
  },
  {
    name: 'Employee',
    description: 'Views own schedule and appointments',
    isSystem: true,
    permissions: [
      'clients.read',
      'services.read',
      'availability.read',
      'appointments.read', 'appointments.complete', 'appointments.no_show',
    ],
  },
  {
    name: 'Accountant',
    description: 'View and manage payments',
    isSystem: true,
    permissions: [
      'clients.read',
      'appointments.read',
      'payments.read', 'payments.create', 'payments.refund',
      'reports.read', 'reports.export',
    ],
  },
  {
    name: 'ReadOnly',
    description: 'View-only access',
    isSystem: true,
    permissions: [
      'clients.read', 'services.read', 'employees.read',
      'resources.read', 'availability.read', 'appointments.read',
      'payments.read', 'reports.read',
    ],
  },
  {
    name: 'Custom',
    description: 'Customizable role',
    isSystem: false,
    permissions: [],
  },
];

// @Injectable() marca la clase como servicio inyectable de NestJS.
@Injectable()
export class TenantsService {
  // El constructor recibe PrismaService (inyectado por NestJS) y lo guarda como
  // this.prisma (solo lectura) para usarlo en todos los métodos.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // onboard(): da de alta un negocio NUEVO completo: crea el negocio, sus
  // permisos, sus 7 roles con sus permisos, el usuario dueño y le asigna el rol
  // Owner. Recibe el DTO con esos datos y devuelve el negocio + el usuario.
  // ───────────────────────────────────────────────────────────────────────────
  async onboard(dto: CreateTenantDto) {
    // $transaction = "todo o nada": si CUALQUIER paso de adentro falla, se
    // deshace TODO (no queda un negocio a medio crear). "tx" es el cliente de
    // base de datos dentro de la transacción (se usa en lugar de this.prisma).
    return this.prisma.$transaction(async (tx) => {
      // 1) Crear el negocio (tenant). "dto.timezone || 'UTC'": si no vino zona
      //    horaria, usa "UTC" por defecto. Igual con la moneda ("MXN").
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          email: dto.email,
          timezone: dto.timezone || 'UTC',
          currency: dto.currency || 'MXN',
        },
      });

      // 2) Asegurar que existan los 53 permisos GLOBALES (compartidos por todos
      //    los negocios). "permissionRecords" es un diccionario que mapea
      //    "module.action" -> el registro del permiso (para usar su id luego).
      const permissionRecords: Record<string, { id: string }> = {};
      // Recorremos cada permiso de la lista ALL_PERMISSIONS.
      for (const perm of ALL_PERMISSIONS) {
        // upsert = "actualiza si existe, o crea si no existe". Buscamos por la
        // pareja única (module, action); si ya está, no cambiamos nada
        // (update: {}); si no, lo creamos con una descripción autogenerada.
        const record = await tx.permission.upsert({
          where: {
            module_action: { module: perm.module, action: perm.action },
          },
          update: {},
          create: {
            module: perm.module,
            action: perm.action,
            description: `${perm.action} access to ${perm.module}`,
          },
        });
        // Guardamos el registro indexado por su clave "module.action".
        permissionRecords[`${perm.module}.${perm.action}`] = record;
      }

      // 3) Crear los roles por defecto y asignarles sus permisos.
      //    "createdRoles" guarda cada rol creado por su nombre, para usarlo después.
      const createdRoles: Record<string, { id: string }> = {};
      // Recorremos cada definición de rol de DEFAULT_ROLES.
      for (const roleDef of DEFAULT_ROLES) {
        // El "slug" del rol: nombre en minúsculas y con espacios cambiados por
        // guiones. replace(/\s+/g, '-') reemplaza uno o más espacios (\s+) por
        // un guion, de forma GLOBAL (la "g" = todas las apariciones).
        const slug = roleDef.name.toLowerCase().replace(/\s+/g, '-');
        // Creamos el rol asociado a ESTE negocio (tenantId: tenant.id).
        const role = await tx.role.create({
          data: {
            name: roleDef.name,
            slug,
            description: roleDef.description,
            isSystem: roleDef.isSystem,
            tenantId: tenant.id,
          },
        });

        // Si el rol tiene permisos definidos (length > 0), los enlazamos.
        if (roleDef.permissions.length > 0) {
          // Construimos la lista de enlaces rol-permiso:
          //   - filter(...): nos quedamos solo con los permisos que SÍ existen
          //     en permissionRecords (descarta nombres desconocidos).
          //   - map(...): por cada permiso, creamos el par { roleId, permissionId }.
          const permIds = roleDef.permissions
            .filter((p) => permissionRecords[p])
            .map((p) => ({ roleId: role.id, permissionId: permissionRecords[p].id }));

          // createMany inserta TODOS los enlaces de una sola vez (más eficiente).
          // Solo si hay al menos uno.
          if (permIds.length > 0) {
            await tx.rolePermission.createMany({ data: permIds });
          }
        }

        // Guardamos el rol creado indexado por su nombre.
        createdRoles[roleDef.name] = role;
      }

      // 4) Crear el usuario DUEÑO. Antes ciframos su contraseña con bcrypt.
      //    El "12" es el "cost factor" (cuántas rondas de cifrado: a más alto,
      //    más seguro pero más lento).
      const passwordHash = await bcrypt.hash(dto.owner.password, 12);
      const ownerUser = await tx.user.create({
        data: {
          email: dto.owner.email,
          passwordHash,
          firstName: dto.owner.firstName,
          lastName: dto.owner.lastName,
          tenantId: tenant.id,
          isActive: true,
        },
      });

      // 5) Asignar el rol "Owner" al usuario dueño recién creado.
      await tx.userRole.create({
        data: {
          userId: ownerUser.id,
          roleId: createdRoles['Owner'].id,
          tenantId: tenant.id,
        },
      });

      // Devolvemos el negocio y un resumen del usuario (sin la contraseña).
      return {
        tenant,
        user: {
          id: ownerUser.id,
          email: ownerUser.email,
          firstName: ownerUser.firstName,
          lastName: ownerUser.lastName,
        },
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findBySlug(): busca un negocio por su "slug" (su nombre en la URL). Devuelve
  // datos básicos. Lanza 404 si no existe.
  // ───────────────────────────────────────────────────────────────────────────
  async findBySlug(slug: string) {
    // findUnique = "encuentra UN registro único" por el slug. "select" elige
    // solo los campos que queremos traer (más eficiente que traerlos todos).
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        timezone: true,
        currency: true,
      },
    });
    // Si no se encontró, "tenant" es null; "!tenant" = "si NO hay negocio" -> 404.
    if (!tenant) throw new NotFoundException('Negocio no encontrado');
    return tenant;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getCurrent(): trae el negocio del usuario logueado, con contadores y el
  // rating combinado (reseñas directas + reseñas de empleados sobre el negocio)
  // para que el panel muestre la misma tarjeta que ve el cliente.
  // ───────────────────────────────────────────────────────────────────────────
  async getCurrent(tenantId: string) {
    // Buscamos el negocio por id. "include._count" pide que Prisma cuente
    // automáticamente cuántos usuarios y cuántas sucursales (locations) tiene.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            locations: true,
          },
        },
      },
    });
    // Si no existe -> 404.
    if (!tenant) throw new NotFoundException('Negocio no encontrado');

    // Calculamos agregados (totales) de reseñas. Promise.all ejecuta las 3
    // consultas EN PARALELO (a la vez) y espera a que todas terminen; luego
    // desestructura los 3 resultados en estas 3 variables.
    const [tenantAgg, employeeBusinessAgg, completedAppointments] = await Promise.all([
      // a) Reseñas DIRECTAS al negocio: suma de ratings y cantidad de reseñas.
      this.prisma.tenantReview.aggregate({
        where: { tenantId },
        _sum: { rating: true },
        _count: { id: true },
      }),
      // b) Reseñas de EMPLEADOS que además calificaron al negocio. Filtramos
      //    visibles y con businessRating presente ("not: null" = distinto de null).
      this.prisma.employeeReview.aggregate({
        where: { tenantId, isVisible: true, businessRating: { not: null } },
        _sum: { businessRating: true },
        _count: { businessRating: true },
      }),
      // c) Cuántas citas COMPLETADAS tiene el negocio.
      this.prisma.appointment.count({
        where: { tenantId, status: 'COMPLETED' },
      }),
    ]);

    // Sumas y conteos. Number(... || 0): si la suma fuera null/undefined, usa 0,
    // y Number(...) lo asegura como número (las sumas pueden venir como Decimal).
    const tenantSum = Number(tenantAgg._sum.rating || 0);
    const tenantCount = tenantAgg._count.id;
    const empSum = Number(employeeBusinessAgg._sum.businessRating || 0);
    const empCount = employeeBusinessAgg._count.businessRating;
    // Totales combinando ambas fuentes de reseñas.
    const totalCount = tenantCount + empCount;
    const totalSum = tenantSum + empSum;
    // Promedio con 1 decimal. Ternario: si hay al menos una reseña (> 0),
    // calculamos suma/cantidad, lo multiplicamos por 10, redondeamos y dividimos
    // entre 10 (truco para redondear a 1 decimal). Si no hay reseñas -> null.
    const averageRating = totalCount > 0 ? Math.round((totalSum / totalCount) * 10) / 10 : null;

    // Devolvemos todos los campos del negocio ("...tenant" los copia) más los
    // calculados: rating promedio, total de reseñas y citas completadas.
    return {
      ...tenant,
      averageRating,
      totalReviews: totalCount,
      completedAppointments,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // updateProfile(): actualiza solo los campos del perfil que vinieron en el DTO.
  // ───────────────────────────────────────────────────────────────────────────
  async updateProfile(tenantId: string, dto: UpdateTenantProfileDto) {
    // PATRÓN IMPORTANTE: "...(condición && { campo: valor })".
    //   - Si la condición es VERDADERA, queda el objeto { campo: valor } y el
    //     "..." (spread) lo mezcla dentro de "data" (es decir, SÍ se actualiza).
    //   - Si es FALSA, "&&" devuelve false y "...false" no añade nada.
    // Así, "dto.x !== undefined" significa: "solo actualiza X si el cliente lo
    // mandó". (Mandar null SÍ cuenta como enviado y borra el valor.)
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.businessType !== undefined && { businessType: dto.businessType }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.businessPhone !== undefined && { businessPhone: dto.businessPhone }),
        ...(dto.isMarketplaceListed !== undefined && { isMarketplaceListed: dto.isMarketplaceListed }),
        ...(dto.cardColor !== undefined && { cardColor: dto.cardColor }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.depositEnabled !== undefined && { depositEnabled: dto.depositEnabled }),
        ...(dto.depositType !== undefined && { depositType: dto.depositType }),
        ...(dto.depositValue !== undefined && { depositValue: dto.depositValue }),
        ...(dto.depositInstructions !== undefined && { depositInstructions: dto.depositInstructions }),
        ...(dto.depositCancelPolicy !== undefined && { depositCancelPolicy: dto.depositCancelPolicy }),
        ...(dto.minBookingHoursAdvance !== undefined && { minBookingHoursAdvance: dto.minBookingHoursAdvance }),
        ...(dto.confettiEnabled !== undefined && { confettiEnabled: dto.confettiEnabled }),
        ...(dto.confettiStyle !== undefined && { confettiStyle: dto.confettiStyle }),
        // "as any" calla el chequeo de tipos de TypeScript (estos campos son
        // arreglos JSON y Prisma los acepta así).
        ...(dto.confettiStyles !== undefined && { confettiStyles: dto.confettiStyles as any }),
        ...(dto.confettiColors !== undefined && { confettiColors: dto.confettiColors as any }),
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // updateLogo(): guarda la nueva URL del logo y DEVUELVE la URL antigua (o null)
  // para que el controlador pueda borrar el archivo viejo.
  // ───────────────────────────────────────────────────────────────────────────
  async updateLogo(tenantId: string, imageUrl: string): Promise<string | null> {
    // 1) Leemos la URL del logo ACTUAL antes de pisarla.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true },
    });
    // 2) Guardamos la nueva URL del logo.
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: imageUrl },
    });
    // 3) Devolvemos la URL antigua. "tenant?.logoUrl" usa "?." (optional
    //    chaining): si tenant fuera null, no rompe y da undefined; el "|| null"
    //    convierte undefined/vacío en null.
    return tenant?.logoUrl || null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // updateCover(): igual que updateLogo pero para la imagen de portada.
  // ───────────────────────────────────────────────────────────────────────────
  async updateCover(tenantId: string, imageUrl: string): Promise<string | null> {
    // Leemos la portada actual antes de reemplazarla.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { coverImageUrl: true },
    });
    // Guardamos la nueva portada.
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { coverImageUrl: imageUrl },
    });
    // Devolvemos la portada antigua (o null si no había).
    return tenant?.coverImageUrl || null;
  }

  // ─── Sucursales (Locations) ──────────────────────────────────────────────
  // createLocation(): crea una sucursal del negocio.
  async createLocation(tenantId: string, dto: CreateLocationDto) {
    return this.prisma.location.create({
      data: {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        timezone: dto.timezone,
        // "??" (nullish coalescing): si latitude es null O undefined, usa null.
        // (A diferencia de "||", el "??" NO trata el 0 como vacío, importante
        // porque la latitud 0 es una coordenada válida.)
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        tenantId,
        isActive: true,
      },
    });
  }

  // findAllLocations(): lista todas las sucursales del negocio, ordenadas por
  // nombre de la A a la Z ("asc" = ascendente).
  async findAllLocations(tenantId: string) {
    return this.prisma.location.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  // updateLocation(): edita una sucursal, verificando primero que pertenezca al
  // negocio (seguridad multi-tenant).
  async updateLocation(id: string, tenantId: string, dto: UpdateLocationDto) {
    // findFirst busca la PRIMERA que coincida por id Y tenantId. Si la sucursal
    // fuera de otro negocio, no la encontrará (no se puede editar lo ajeno).
    const location = await this.prisma.location.findFirst({
      where: { id, tenantId },
    });
    // Si no existe (o no es de este negocio) -> 404.
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    // Actualizamos con los campos del DTO (solo trae los que se quieren cambiar).
    return this.prisma.location.update({
      where: { id },
      data: dto,
    });
  }

  // deleteLocation(): elimina una sucursal, pero de forma "suave" (soft delete).
  async deleteLocation(id: string, tenantId: string) {
    // Verificamos que la sucursal sea de este negocio.
    const location = await this.prisma.location.findFirst({
      where: { id, tenantId },
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    // SOFT DELETE: en vez de borrar el registro (lo que rompería empleados y
    // citas relacionadas), solo lo marcamos como inactivo (isActive: false).
    await this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Ubicación eliminada' };
  }

  // ─── Áreas de cobertura (servicio a domicilio) ───────────────────────────
  // getCoverageAreas(): lista las áreas de una sucursal, ordenadas por radio
  // ascendente (el anillo más pequeño primero — el cliente cae en el menor que
  // lo contenga).
  async getCoverageAreas(tenantId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');
    const areas = await this.prisma.coverageArea.findMany({
      where: { tenantId, locationId },
      orderBy: { radiusKm: 'asc' },
    });
    return areas;
  }

  // replaceCoverageAreas(): reemplaza TODO el conjunto de áreas de la sucursal
  // (el editor de anillos maneja la lista completa). Borra las existentes y crea
  // las nuevas dentro de una transacción. El cargo aplicado a citas ya creadas
  // queda como snapshot (homeServiceFee), así que perder el id del área no afecta
  // el histórico.
  async replaceCoverageAreas(
    tenantId: string,
    locationId: string,
    areas: {
      name: string;
      radiusKm: number;
      price: number;
      color?: string;
      sortOrder?: number;
    }[],
  ) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    await this.prisma.$transaction([
      this.prisma.coverageArea.deleteMany({ where: { tenantId, locationId } }),
      ...(areas.length > 0
        ? [
            this.prisma.coverageArea.createMany({
              data: areas.map((a, i) => ({
                tenantId,
                locationId,
                name: a.name,
                radiusKm: a.radiusKm,
                price: a.price,
                color: a.color || '#008080',
                sortOrder: a.sortOrder ?? i,
              })),
            }),
          ]
        : []),
    ]);

    return this.getCoverageAreas(tenantId, locationId);
  }

  // ─── Horarios del negocio (Business Hours) ───────────────────────────────
  // Horarios POR DEFECTO (constante privada): 09:00-18:00 de lunes a sábado,
  // domingo cerrado. "as const" fija el texto exacto del día como tipo literal
  // (no como "string genérico"), lo que ayuda a TypeScript.
  private readonly DEFAULT_BUSINESS_HOURS = [
    { dayOfWeek: 'MONDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'TUESDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'WEDNESDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'THURSDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'FRIDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'SATURDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'SUNDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: false },
  ];

  // getBusinessHours(): devuelve SIEMPRE los 7 días en orden. Si un día no está
  // guardado en la base de datos, rellena con el horario por defecto.
  async getBusinessHours(tenantId: string) {
    // Traemos los horarios guardados de este negocio (puede que falten días).
    const existing = await this.prisma.businessHours.findMany({
      where: { tenantId },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Orden deseado de los días (lunes primero).
    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    // Creamos un Map (diccionario) para buscar rápido por día. existing.map(...)
    // convierte cada horario "h" en una pareja [día, h]; el Map usa el día como
    // clave y el horario como valor.
    const existingMap = new Map(existing.map((h) => [h.dayOfWeek, h]));

    // Recorremos los 7 días en orden y devolvemos uno por uno:
    return dayOrder.map((day) => {
      // Buscamos si ese día existe en la base de datos.
      const found = existingMap.get(day as any);
      // Si existe, lo devolvemos tal cual.
      if (found) return found;
      // Si no, buscamos el valor por defecto de ese día. find(...) recorre la
      // lista por defecto y devuelve el primero cuyo dayOfWeek coincida ("==="
      // = igualdad estricta). El "!" final le promete a TypeScript que sí existe.
      const def = this.DEFAULT_BUSINESS_HOURS.find((d) => d.dayOfWeek === day)!;
      // Devolvemos un horario "virtual" con id null (no está guardado) más los
      // valores por defecto ("...def" los copia).
      return { id: null, tenantId, ...def };
    });
  }

  // setBusinessHours(): REEMPLAZA todos los horarios del negocio por los nuevos.
  async setBusinessHours(tenantId: string, dto: SetBusinessHoursDto) {
    // Todo dentro de una transacción (todo o nada).
    await this.prisma.$transaction(async (tx) => {
      // 1) Borramos TODOS los horarios actuales de este negocio.
      await tx.businessHours.deleteMany({ where: { tenantId } });
      // 2) Insertamos los nuevos. dto.hours.map(...) transforma cada renglón del
      //    DTO en la forma que espera la base de datos (añadiendo el tenantId).
      await tx.businessHours.createMany({
        data: dto.hours.map((h) => ({
          tenantId,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isOpen: h.isOpen,
        })),
      });
    });
    // Devolvemos los horarios ya completos (con los 7 días) leyéndolos de nuevo.
    return this.getBusinessHours(tenantId);
  }

  // ─── Cierres del negocio (Business Closures) ─────────────────────────────
  // getClosures(): lista los cierres del negocio, opcionalmente filtrados a un
  // rango de fechas (devolviendo los que se SOLAPAN con ese rango).
  async getClosures(tenantId: string, startDate?: string, endDate?: string) {
    // "where" arranca filtrando por negocio. ": any" relaja el tipo para poder
    // añadirle más condiciones abajo.
    const where: any = { tenantId };
    // Solo aplicamos filtro de fechas si vinieron AMBAS (startDate Y endDate).
    if (startDate && endDate) {
      // Un cierre se SOLAPA con el rango [startDate, endDate] si:
      //   - empieza ANTES o el mismo día que el fin del rango (lte = <=), Y
      //   - termina DESPUÉS o el mismo día que el inicio del rango (gte = >=).
      // parseRangeBound ajusta la fecha al inicio/fin del día según corresponda.
      where.startDate = { lte: parseRangeBound(endDate, 'end') };
      where.endDate = { gte: parseRangeBound(startDate, 'start') };
    }
    // Devolvemos los cierres ordenados por fecha de inicio ascendente.
    return this.prisma.businessClosure.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  // createClosure(): crea un cierre validando que el inicio no sea posterior al fin.
  async createClosure(tenantId: string, dto: CreateBusinessClosureDto) {
    // Convertimos las fechas de texto a Date, fijándolas a medianoche UTC
    // ("T00:00:00Z"). El "+" aquí concatena texto (une los dos strings).
    const start = new Date(dto.startDate + 'T00:00:00Z');
    const end = new Date(dto.endDate + 'T00:00:00Z');
    // Si la fecha de inicio es MAYOR (posterior) a la de fin, es inválido -> 400.
    if (start > end) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha de fin');
    }
    // Creamos el cierre.
    return this.prisma.businessClosure.create({
      data: {
        tenantId,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
    });
  }

  // deleteClosure(): borra un cierre, validando que sea de este negocio.
  async deleteClosure(id: string, tenantId: string) {
    const closure = await this.prisma.businessClosure.findFirst({
      where: { id, tenantId },
    });
    if (!closure) throw new NotFoundException('Cierre no encontrado');
    // Aquí SÍ borramos de verdad (delete), no es soft delete.
    await this.prisma.businessClosure.delete({ where: { id } });
    return { message: 'Cierre eliminado' };
  }

  // ─── Galería (Gallery) ───────────────────────────────────────────────────
  // getGallery(): lista las imágenes de la galería del negocio.
  async getGallery(tenantId: string) {
    // orderBy con DOS criterios: primero por sortOrder ascendente (el orden que
    // eligió el dueño) y, en caso de empate, por createdAt descendente (las más
    // nuevas primero).
    return this.prisma.tenantGalleryImage.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // addGalleryImage(): agrega una imagen a la galería, con tope de 10 fotos.
  async addGalleryImage(tenantId: string, imageUrl: string, caption?: string) {
    // Contamos cuántas imágenes tiene ya el negocio.
    const count = await this.prisma.tenantGalleryImage.count({ where: { tenantId } });
    // Si ya hay 10 o más (>=), no dejamos agregar más -> 400.
    if (count >= 10) {
      throw new BadRequestException('Máximo 10 fotos en la galería');
    }
    // Creamos la imagen. "sortOrder: count" la coloca al final (si había 3, la
    // nueva queda en la posición 3, ya que se cuenta desde 0).
    return this.prisma.tenantGalleryImage.create({
      data: { tenantId, imageUrl, caption, sortOrder: count },
    });
  }

  // removeGalleryImage(): borra una imagen de la galería y devuelve el registro
  // borrado (para que el controlador pueda eliminar también el archivo físico).
  async removeGalleryImage(tenantId: string, imageId: string) {
    // Verificamos que la imagen exista y sea de este negocio.
    const image = await this.prisma.tenantGalleryImage.findFirst({
      where: { id: imageId, tenantId },
    });
    if (!image) throw new NotFoundException('Imagen no encontrada');
    // Borramos el registro de la base de datos.
    await this.prisma.tenantGalleryImage.delete({ where: { id: imageId } });
    // Devolvemos la imagen (su imageUrl la usa el controlador para borrar el archivo).
    return image;
  }

  // ─── Shop Settings ───────────────────────────────

  // getShopSettings(): lee solo los campos de configuración de la tienda.
  async getShopSettings(tenantId: string) {
    // Traemos únicamente los campos "shop*" del negocio.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        shopEnabled: true,
        shopPickupEnabled: true,
        shopShippingEnabled: true,
        shopShippingCost: true,
        shopPaymentCash: true,
        shopPaymentSpei: true,
        shopPaymentCard: true,
        shopSpeiBankName: true,
        shopSpeiHolderName: true,
        shopSpeiClabe: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  // updateShopSettings(): actualiza solo los ajustes de tienda que vinieron.
  async updateShopSettings(tenantId: string, dto: any) {
    // "data" empieza vacío y le vamos agregando SOLO los campos enviados.
    const data: any = {};
    // Para cada campo: si NO es undefined (es decir, el cliente lo mandó), lo
    // copiamos a "data". Así no pisamos con undefined los valores existentes.
    if (dto.shopEnabled !== undefined) data.shopEnabled = dto.shopEnabled;
    if (dto.shopPickupEnabled !== undefined) data.shopPickupEnabled = dto.shopPickupEnabled;
    if (dto.shopShippingEnabled !== undefined) data.shopShippingEnabled = dto.shopShippingEnabled;
    if (dto.shopShippingCost !== undefined) data.shopShippingCost = dto.shopShippingCost;
    if (dto.shopPaymentCash !== undefined) data.shopPaymentCash = dto.shopPaymentCash;
    if (dto.shopPaymentSpei !== undefined) data.shopPaymentSpei = dto.shopPaymentSpei;
    if (dto.shopPaymentCard !== undefined) data.shopPaymentCard = dto.shopPaymentCard;
    if (dto.shopSpeiBankName !== undefined) data.shopSpeiBankName = dto.shopSpeiBankName;
    if (dto.shopSpeiHolderName !== undefined) data.shopSpeiHolderName = dto.shopSpeiHolderName;
    if (dto.shopSpeiClabe !== undefined) data.shopSpeiClabe = dto.shopSpeiClabe;

    // Guardamos los cambios y devolvemos solo los campos de tienda actualizados.
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        shopEnabled: true,
        shopPickupEnabled: true,
        shopShippingEnabled: true,
        shopShippingCost: true,
        shopPaymentCash: true,
        shopPaymentSpei: true,
        shopPaymentCard: true,
        shopSpeiBankName: true,
        shopSpeiHolderName: true,
        shopSpeiClabe: true,
      },
    });
    return tenant;
  }

  // ─── REVIEWS ─────────────────────────────────────────
  // Vista agregada para el owner. Devuelve:
  //  - tenantReviews: reseñas directas al negocio (modelo TenantReview).
  //  - employeeReviews: reseñas dejadas por cita en cada empleado
  //    (modelo EmployeeReview), que pueden incluir businessRating/Comment.
  //  - resumen: rating promedio combinado y totales.
  async getReviewsForOwner(tenantId: string) {
    // Lanzamos las dos consultas EN PARALELO con Promise.all y desestructuramos
    // sus resultados en tenantReviews (reseñas directas) y employeeReviews.
    const [tenantReviews, employeeReviews] = await Promise.all([
      // 1) Reseñas DIRECTAS al negocio, de la más nueva a la más vieja ("desc").
      //    "include.user" trae datos básicos del autor (para mostrar su avatar).
      this.prisma.tenantReview.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      }),
      // 2) Reseñas a EMPLEADOS (visibles), que pueden incluir calificación al
      //    negocio. Traemos empleado, cliente y datos de la cita relacionada.
      this.prisma.employeeReview.findMany({
        where: { tenantId, isVisible: true },
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true },
          },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              // Algunos clientes vinieron del marketplace y guardaron su
              // avatar real en el User; lo traemos como fallback.
              user: { select: { avatarUrl: true } },
            },
          },
          appointment: {
            select: {
              id: true,
              startTime: true,
              // De la cita, solo el nombre (snapshot) de cada servicio.
              items: { select: { serviceNameSnapshot: true } },
            },
          },
        },
      }),
    ]);

    // Rating del NEGOCIO: combinamos dos fuentes en una sola lista de números.
    //   - "...tenantReviews.map((r) => r.rating)": todos los ratings directos.
    //   - "...employeeReviews.map(...).filter(...)": los businessRating de las
    //     reseñas de empleados, descartando los null/undefined. El filtro
    //     "(r): r is number => ..." además le DICE a TypeScript que lo que queda
    //     son números (predicado de tipo).
    const businessRatings: number[] = [
      ...tenantReviews.map((r) => r.rating),
      ...employeeReviews
        .map((r) => r.businessRating)
        .filter((r): r is number => r !== null && r !== undefined),
    ];
    // Promedio del negocio. Ternario: si la lista tiene elementos (length es un
    // número distinto de 0, que cuenta como verdadero), sumamos todos con reduce
    // (acumulador "a" + cada valor "b", empezando en 0) y dividimos entre la
    // cantidad. Si está vacía -> null.
    const businessAvg = businessRatings.length
      ? businessRatings.reduce((a, b) => a + b, 0) / businessRatings.length
      : null;

    // Rating de los EMPLEADOS: solo los ratings de las reseñas de empleados.
    const employeeRatings = employeeReviews.map((r) => r.rating);
    // Su promedio, con la misma lógica (suma/cantidad, o null si no hay).
    const employeeAvg = employeeRatings.length
      ? employeeRatings.reduce((a, b) => a + b, 0) / employeeRatings.length
      : null;

    // Devolvemos un resumen + las dos listas ya "limpias" (solo los campos
    // útiles para el frontend).
    return {
      summary: {
        // Redondeo a 1 decimal (truco *10, redondear, /10). Si era null, queda null.
        businessAverage: businessAvg !== null ? Math.round(businessAvg * 10) / 10 : null,
        businessTotal: businessRatings.length,
        employeeAverage: employeeAvg !== null ? Math.round(employeeAvg * 10) / 10 : null,
        employeeTotal: employeeRatings.length,
      },
      // Reseñas directas, mapeadas a un objeto con solo lo necesario.
      tenantReviews: tenantReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: r.user,
      })),
      // Reseñas de empleados, mapeadas igualmente a lo esencial.
      employeeReviews: employeeReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        businessRating: r.businessRating,
        businessComment: r.businessComment,
        createdAt: r.createdAt,
        employee: r.employee,
        client: r.client,
        appointment: r.appointment,
      })),
    };
  }
}
