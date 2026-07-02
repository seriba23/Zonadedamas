// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador que marca esta clase como un "servicio" inyectable
//     (NestJS lo crea y lo entrega a quien lo pida, ej. el controlador).
//   - NotFoundException: error listo para usar que, al lanzarse, hace que la API
//     responda con código HTTP 404 (no encontrado).
import { Injectable, NotFoundException } from '@nestjs/common';

// PrismaService es nuestro "puente" hacia la base de datos. Prisma es el ORM que
// convierte llamadas de JavaScript en consultas SQL. A través de this.prisma
// leemos/escribimos tablas como service, tenant, employee, etc.
import { PrismaService } from '../../prisma/prisma.service';

// DTOs que describen la forma de los datos para crear/actualizar un servicio.
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';

// Utilidades de paginación:
//   - PaginationDto: tipo con los parámetros page/perPage.
//   - buildPaginatedResponse: función que arma la respuesta paginada estándar
//     ({ data, meta }) a partir de los datos, el total y la paginación.
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class ServicesService {
  // El constructor recibe el PrismaService que NestJS inyecta automáticamente.
  // "private readonly prisma" lo guarda como propiedad de solo lectura
  // (this.prisma) para usarlo en todos los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  // Map business types to professions
  // Tabla de correspondencia: para cada TIPO de negocio, qué PROFESIONES aplican.
  //   - "private readonly": propiedad interna de solo lectura (no se reasigna).
  //   - "Record<string, string[]>": un objeto cuyas claves son textos (el tipo
  //     de negocio) y cuyos valores son listas de textos (las profesiones).
  // Se usa más abajo para decidir qué servicios de catálogo crear.
  private readonly TYPE_PROFESSIONS: Record<string, string[]> = {
    BARBERIA: ['Barbero/a'],
    SALON: ['Estilista', 'Colorista'],
    SPA: ['Masajista', 'Esteticista', 'Cosmetólogo/a', 'Terapeuta'],
    CLINICA: ['Cosmetólogo/a', 'Esteticista'],
    TATUAJES: ['Tatuador/a', 'Piercer'],
  };

  // ───────────────────────────────────────────────────────────────────────────
  // autoPopulateFromCatalog(): crea automáticamente servicios "de catálogo"
  // según el tipo de negocio del tenant. Devuelve cuántos se crearon.
  // ───────────────────────────────────────────────────────────────────────────
  async autoPopulateFromCatalog(tenantId: string) {
    // Get tenant business type
    // Buscamos el negocio (tenant) por su id y solo traemos su businessType.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true },
    });
    // "tenant?.businessType": si "tenant" es null (no existe) o no tiene
    // businessType, "?." evita el error y la condición "!..." se cumple.
    // En ese caso no hay nada que poblar -> devolvemos { created: 0 }.
    if (!tenant?.businessType) return { created: 0 };

    // Get professions for this business type
    // businessType puede traer VARIOS tipos separados por coma (ej. "SALON,SPA").
    //   - split(',') => parte el texto en un array por cada coma.
    //   - .map((t) => t.trim()) => recorre cada trozo "t" y le quita espacios
    //     sobrantes al inicio/fin (trim). Devuelve un array de tipos limpios.
    const types = tenant.businessType.split(',').map((t) => t.trim());
    // Set = colección que NO admite duplicados. La usamos para juntar todas las
    // profesiones sin repetir (varios tipos pueden compartir profesión).
    const professions = new Set<string>();
    // Recorremos cada tipo de negocio.
    for (const type of types) {
      // Buscamos sus profesiones en la tabla TYPE_PROFESSIONS. Si el tipo no
      // existe ahí, "|| []" usa un array vacío para no romper el forEach.
      const profs = this.TYPE_PROFESSIONS[type] || [];
      // forEach recorre cada profesión "p" y la agrega al Set (los duplicados
      // se ignoran automáticamente).
      profs.forEach((p) => professions.add(p));
    }
    // Si no juntamos ninguna profesión (size = cantidad de elementos del Set),
    // no hay servicios que crear.
    if (professions.size === 0) return { created: 0 };

    // Get catalog services for these professions
    // Traemos del catálogo global los servicios cuya categoría esté entre las
    // profesiones encontradas y que estén activos.
    const catalogServices = await this.prisma.serviceCatalog.findMany({
      where: {
        // "in": el valor debe estar DENTRO de esta lista. Array.from convierte
        // el Set de profesiones en un array normal (lo que "in" espera).
        category: { in: Array.from(professions) },
        isActive: true,
      },
      // Ordenamos: primero por categoría (asc = A→Z) y dentro de cada categoría
      // por sortOrder (asc = de menor a mayor) para un orden predecible.
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    // Get existing service names for this tenant
    // Traemos los nombres de los servicios que el tenant YA tiene, para no crear
    // duplicados.
    const existing = await this.prisma.service.findMany({
      where: { tenantId },
      select: { name: true },
    });
    // Convertimos esos nombres en un Set para poder consultar rápido si un nombre
    // ya existe. .map((s) => s.name) recorre cada servicio y extrae su nombre.
    const existingNames = new Set(existing.map((s) => s.name));

    // Create missing services
    // De los servicios del catálogo, nos quedamos solo con los que FALTAN.
    //   - filter recorre cada servicio de catálogo "cs".
    //   - "!existingNames.has(cs.name)": deja pasar (true) solo si su nombre NO
    //     está ya entre los existentes. "!" niega; .has comprueba pertenencia.
    const toCreate = catalogServices.filter((cs) => !existingNames.has(cs.name));
    // Si no falta ninguno, no hay nada que crear.
    if (toCreate.length === 0) return { created: 0 };

    // Insertamos todos los servicios faltantes de una sola vez (createMany).
    await this.prisma.service.createMany({
      // .map transforma cada servicio de catálogo "cs" en el objeto que la tabla
      // service espera (con valores por defecto: 30 min, precio 0, activo).
      data: toCreate.map((cs) => ({
        tenantId,
        name: cs.name,
        durationMinutes: 30,
        price: 0,
        category: cs.category,
        subcategory: cs.category,
        isActive: true,
      })),
      // skipDuplicates: si hubiera un choque por índice único, lo salta en vez
      // de fallar (red de seguridad extra contra duplicados).
      skipDuplicates: true,
    });

    // Devolvemos cuántos servicios se crearon (la cantidad de la lista toCreate).
    return { created: toCreate.length };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): devuelve la lista paginada de servicios activos del tenant.
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, pagination: PaginationDto) {
    // "pagination.page ?? 1": si page viene null/undefined, usa 1 (primera
    // página) por defecto. Lo mismo con perPage (20 por defecto).
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    // skip = cuántos registros saltar para llegar a la página pedida.
    // Ej.: página 3 con 20 por página => saltar (3-1)*20 = 40 registros.
    const skip = (page - 1) * perPage;

    // Condición común de búsqueda: del tenant actual y solo los activos.
    const where = { tenantId, isActive: true };

    // Promise.all ejecuta DOS consultas EN PARALELO y espera a que ambas
    // terminen. Devuelve sus resultados en orden: [data, total].
    //   - data: la página de servicios.
    //   - total: el conteo total (para saber cuántas páginas hay).
    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,            // saltar los de páginas anteriores
        take: perPage,   // tomar solo "perPage" registros
        orderBy: { name: 'asc' }, // ordenar por nombre A→Z
        include: {
          // addons: los complementos/extras del servicio.
          addons: true,
          // serviceResources: recursos que el servicio necesita (ej. una sala);
          // anidamos "resource: true" para traer también los datos del recurso.
          serviceResources: { include: { resource: true } },
          // _count: en vez de traer la lista, traemos solo el NÚMERO de empleados
          // asignados (employeeServices). Útil para mostrar "N profesionales".
          _count: { select: { employeeServices: true } },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    // Armamos la respuesta paginada estándar ({ data, meta }) con la utilidad.
    return buildPaginatedResponse(data, total, pagination);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): devuelve UN servicio del tenant por su id, con todo su detalle.
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(
    id: string,
    tenantId: string,
    // Usuario que hace la petición. Sirve para decidir cuánta info de comisiones
    // devolvemos. Opcional para llamadas internas (que ven todo por defecto).
    user?: { userId: string; permissions?: string[] },
  ) {
    // findFirst busca el PRIMER servicio que cumpla ambas condiciones: ese id Y
    // que pertenezca a este tenant (seguridad multi-tenant: no ver lo ajeno).
    const service = await this.prisma.service.findFirst({
      where: { id, tenantId },
      include: {
        addons: true,
        serviceResources: { include: { resource: true } },
        // employeeServices: la relación servicio↔empleado. Para cada una traemos
        // los datos del empleado (solo los campos del select, no todo).
        employeeServices: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true, jobTitle: true, isActive: true } },
          },
        },
      },
    });

    // Si no se encontró (service es null), lanzamos 404.
    if (!service) throw new NotFoundException('Servicio no encontrado');

    // PRIVACIDAD DE COMISIONES: solo quien puede GESTIONAR servicios
    // (permiso 'services.update' = perfil admin/manager) ve las comisiones de
    // TODOS los empleados y, con ello, la ganancia del negocio. Un empleado sin
    // ese permiso solo debe ver SU PROPIA comisión, nunca la de los demás.
    const canSeeAll = !user || (user.permissions || []).includes('services.update');
    if (!canSeeAll) {
      // Ubicamos al empleado ligado a este usuario dentro del tenant.
      const me = await this.prisma.employee.findFirst({
        where: { tenantId, userId: user!.userId },
        select: { id: true },
      });
      // Dejamos únicamente su fila (si no es empleado, queda vacío).
      service.employeeServices = (service.employeeServices || []).filter(
        (es) => es.employee.id === me?.id,
      );
    }

    // Devolvemos el servicio (con las comisiones ya filtradas si procede).
    return service;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea un servicio nuevo para el tenant.
  // ───────────────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateServiceDto) {
    const service = await this.prisma.service.create({
      data: {
        // "...dto" (spread): copia TODOS los campos del dto dentro de data.
        ...dto,
        tenantId,
        // "dto.isActive ?? true": si el dto no trae isActive, lo creamos activo.
        isActive: dto.isActive ?? true,
      },
    });

    // Auto-asignacion para FREELANCER: el flujo de "asignar empleados"
    // no aplica cuando solo hay 1 persona (el dueno=empleado). El servicio
    // se asigna automaticamente al unico empleado activo del tenant para
    // que aparezca disponible para reservar de inmediato.
    //
    // Cuando el tenant migre a BUSINESS (upgrade Pro -> Plus) la
    // asignacion del freelancer se conserva: solo agrega a los empleados
    // nuevos al servicio, sin volver a marcarse a si mismo.
    // Traemos el tipo de tenant para saber si es FREELANCER (1 persona) o no.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantType: true },
    });
    // "tenant?.tenantType === 'FREELANCER'": "?." evita romper si tenant es null;
    // "===" compara estrictamente (mismo valor y mismo tipo).
    if (tenant?.tenantType === 'FREELANCER') {
      // Buscamos el primer empleado activo del tenant (que será el dueño).
      const employee = await this.prisma.employee.findFirst({
        where: { tenantId, isActive: true },
        select: { id: true },
      });
      // Si lo hay, creamos la relación servicio↔empleado para que el dueño quede
      // ya asignado a este servicio nuevo.
      if (employee) {
        await this.prisma.employeeService.create({
          data: { employeeId: employee.id, serviceId: service.id },
        });
      }
    }

    // Devolvemos el servicio creado.
    return service;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update(): actualiza un servicio existente.
  // ───────────────────────────────────────────────────────────────────────────
  async update(id: string, tenantId: string, dto: UpdateServiceDto) {
    // Reusamos findOne: si el servicio no existe (o es de otro tenant) lanzará
    // 404 y cortará aquí, evitando actualizar algo ajeno o inexistente.
    await this.findOne(id, tenantId);
    // Aplicamos los cambios del dto al servicio identificado por id.
    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // remove(): borrado LÓGICO. No elimina la fila, solo la marca inactiva, para
  // preservar el historial (citas pasadas que referencian este servicio).
  // ───────────────────────────────────────────────────────────────────────────
  async remove(id: string, tenantId: string) {
    // Verifica existencia/pertenencia (lanza 404 si no procede).
    await this.findOne(id, tenantId);
    // Marca el servicio como inactivo (isActive: false) en vez de borrarlo.
    await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
    // Mensaje de confirmación para el cliente.
    return { message: 'Servicio desactivado' };
  }

  /**
   * Reemplaza el set de empleados asignados a un servicio. Espejo de
   * EmployeesService.setServices. Cada item del array trae employeeId y
   * commission opcional. Empleados que no estan en la lista se eliminan;
   * los que estan se upsertean con el commission actualizado.
   */
  async setEmployees(
    serviceId: string,
    tenantId: string,
    // Lista de empleados a asignar (con su comisión opcional). Ver tipos arriba.
    employees: {
      employeeId: string;
      commission?: number | null;
      commissionType?: 'AMOUNT' | 'PERCENT';
    }[],
  ) {
    // Verifica que el servicio exista y sea de este tenant (lanza 404 si no).
    await this.findOne(serviceId, tenantId);

    // $transaction: ejecuta TODO lo de adentro como una sola operación atómica.
    // Si algo falla a mitad, se deshace todo (no quedan datos a medias). "tx" es
    // el cliente de Prisma DENTRO de la transacción (se usa en vez de this.prisma).
    return this.prisma.$transaction(async (tx) => {
      // Lista de ids de empleados que SÍ deben quedar asignados.
      // .map recorre cada elemento "e" y extrae su employeeId.
      const employeeIds = employees.map((e) => e.employeeId);

      // PASO 1: eliminar las asignaciones que ya NO están en la lista nueva.
      await tx.employeeService.deleteMany({
        where: {
          serviceId,
          // Spread condicional con ternario:
          //   - Si hay ids en la lista (length > 0): borra solo los que NO estén
          //     entre ellos (notIn = "que no esté en esta lista").
          //   - Si la lista está vacía ({}): no añade filtro extra, así borra
          //     TODAS las asignaciones del servicio.
          ...(employeeIds.length > 0
            ? { employeeId: { notIn: employeeIds } }
            : {}),
        },
      });

      // PASO 2: si llegaron empleados, crear/actualizar sus asignaciones.
      if (employees.length > 0) {
        // Validamos que los empleados pertenezcan al tenant antes de
        // upsertear; un employeeId de otro tenant se ignora silenciosamente.
        // Traemos solo los ids de empleados que de verdad son de este tenant.
        const validEmployees = await tx.employee.findMany({
          where: { id: { in: employeeIds }, tenantId },
          select: { id: true },
        });
        // Set con esos ids válidos, para comprobar pertenencia rápido más abajo.
        const validIds = new Set(validEmployees.map((e) => e.id));

        // Recorremos cada empleado solicitado.
        for (const emp of employees) {
          // Si su id NO está entre los válidos (otro tenant), lo saltamos
          // ("continue" pasa a la siguiente vuelta sin hacer nada).
          if (!validIds.has(emp.employeeId)) continue;
          // Normalizamos el tipo de comisión: solo 'PERCENT' se respeta; cualquier
          // otro valor (incluido undefined) cae en 'AMOUNT' por defecto.
          const commissionType =
            emp.commissionType === 'PERCENT' ? 'PERCENT' : 'AMOUNT';
          // upsert = "update OR insert": si ya existe la relación la actualiza,
          // si no, la crea. Evita duplicados y maneja ambos casos de una vez.
          await tx.employeeService.upsert({
            where: {
              // Clave compuesta única empleado+servicio (así Prisma sabe si ya
              // existe esa relación exacta).
              employeeId_serviceId: {
                employeeId: emp.employeeId,
                serviceId,
              },
            },
            // Qué actualizar si YA existe. "emp.commission ?? null": si no vino
            // comisión, guarda null (sin comisión).
            update: {
              commission: emp.commission ?? null,
              commissionType,
            },
            // Qué insertar si NO existe.
            create: {
              employeeId: emp.employeeId,
              serviceId,
              commission: emp.commission ?? null,
              commissionType,
            },
          });
        }
      }

      // Devolvemos la lista final de asignaciones del servicio, incluyendo
      // nombre del empleado, para que el frontend muestre el estado actualizado.
      return tx.employeeService.findMany({
        where: { serviceId },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      });
    });
  }
}
