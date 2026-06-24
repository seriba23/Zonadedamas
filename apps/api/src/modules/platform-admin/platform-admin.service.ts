// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: marca esta clase como servicio inyectable.
//   - NotFoundException: error que responde con HTTP 404 (no encontrado).
//   - BadRequestException: error que responde con HTTP 400 (petición inválida).
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

// Tipos generados por Prisma: los planes y estados de suscripción válidos.
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

// PrismaService: puente hacia la base de datos.
import { PrismaService } from '../../prisma/prisma.service';

// PLAN_LIMITS: tabla de configuración con los límites y precios de cada plan
// (cuánto cuesta al mes, cuántos empleados permite, etc.).
import { PLAN_LIMITS } from '../subscriptions/plan-limits.config';

// EmployeesService: lógica de empleados; lo reutilizamos para desactivar empleados.
import { EmployeesService } from '../employees/employees.service';

// DeactivateAction: enum con las acciones posibles al desactivar un empleado.
import { DeactivateAction } from '../employees/dto/deactivate-employee.dto';

// @Injectable() registra esta clase como servicio en NestJS.
@Injectable()
export class PlatformAdminService {
  // Inyectamos Prisma (BD) y EmployeesService (lógica de empleados), guardados
  // como propiedades de solo lectura para usarlos en los métodos de abajo.
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // getDashboard(): calcula los KPIs (indicadores) generales de la plataforma.
  // ───────────────────────────────────────────────────────────────────────────
  async getDashboard() {
    // "now" = el instante actual.
    const now = new Date();
    // Primer día de ESTE mes a las 00:00. new Date(año, mes, día): el mes va de 0
    // a 11 (0=enero). El día 1 es el primero del mes.
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // Primer día del mes PASADO. "now.getMonth() - 1" resta un mes (JavaScript
    // ajusta solo si cruza el cambio de año, ej. enero -> diciembre anterior).
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Último instante del mes PASADO. El "día 0" del mes actual significa "el último
    // día del mes anterior"; 23,59,59 lo lleva al final de ese día.
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Promise.all ejecuta TODAS estas consultas a la vez (en paralelo) y espera a
    // que todas terminen. Es más rápido que hacerlas una por una. El resultado se
    // "desestructura" en estas variables, en el MISMO orden que las consultas.
    const [
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      pastDueTenants,
      newTenantsThisMonth,
      totalRevenue,
      revenueThisMonth,
      subscriptionsByPlan,
    ] = await Promise.all([
      // Total de negocios (count() cuenta filas; sin "where" cuenta todas).
      this.prisma.tenant.count(),
      // Suscripciones por estado: activas, en prueba, suspendidas y morosas.
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { status: 'TRIAL' } }),
      this.prisma.subscription.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
      // Negocios creados este mes: "gte" = "mayor o igual que" el inicio del mes.
      this.prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
      // Ingresos totales: aggregate con "_sum" SUMA el campo amountUsd de las
      // facturas pagadas (status: 'PAID').
      this.prisma.invoice.aggregate({
        where: { status: 'PAID' },
        _sum: { amountUsd: true },
      }),
      // Ingresos de ESTE mes: facturas pagadas cuyo paidAt es >= inicio del mes.
      this.prisma.invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { amountUsd: true },
      }),
      // groupBy agrupa las suscripciones por "plan" y cuenta cuántas hay de cada
      // plan (_count). Devuelve una fila por cada plan distinto.
      this.prisma.subscription.groupBy({
        by: ['plan'],
        _count: { plan: true },
      }),
    ]);

    // Últimos 5 negocios registrados, para mostrarlos en el panel.
    const recentRegistrations = await this.prisma.tenant.findMany({
      take: 5,                          // como máximo 5 resultados.
      orderBy: { createdAt: 'desc' },   // 'desc' = del más nuevo al más antiguo.
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        businessType: true,
        createdAt: true,
        // De la suscripción relacionada solo traemos su plan y estado.
        subscription: { select: { plan: true, status: true } },
      },
    });

    // Armamos la respuesta final con tres bloques: KPIs, reparto por plan y recientes.
    return {
      kpis: {
        totalTenants,
        activeTenants,
        trialTenants,
        suspendedTenants,
        pastDueTenants,
        newTenantsThisMonth,
        // Number(...) convierte el resultado (que Prisma da como Decimal) a número.
        // "?? 0" (nullish coalescing): si la suma fuera null/undefined, usa 0. Esto
        // ocurre cuando NO hay facturas que sumar (aggregate devuelve null).
        totalRevenue: Number(totalRevenue._sum.amountUsd ?? 0),
        revenueThisMonth: Number(revenueThisMonth._sum.amountUsd ?? 0),
      },
      // map() recorre cada grupo "s" (un plan) y lo transforma en un objeto simple
      // { plan, count }, donde count viene del conteo agrupado (_count.plan).
      subscriptionsByPlan: subscriptionsByPlan.map((s) => ({
        plan: s.plan,
        count: s._count.plan,
      })),
      recentRegistrations,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getTenants(): lista paginada de negocios con búsqueda, filtros y orden.
  // Recibe un objeto "filters" con todos los parámetros opcionales (los "?").
  // ───────────────────────────────────────────────────────────────────────────
  async getTenants(filters: {
    page?: number;
    perPage?: number;
    plan?: string;
    status?: string;
    search?: string;
    sortBy?: string;
    tenantType?: string;
  }) {
    // "filters.page || 1": si no viene página (o es 0), usamos la 1 por defecto.
    const page = filters.page || 1;
    // Math.min(a, 100) limita el tamaño de página a 100 como máximo (evita pedir
    // demasiados registros). Si no viene perPage, usamos 20.
    const perPage = Math.min(filters.perPage || 20, 100);
    // "skip" = cuántos registros saltar para llegar a la página pedida.
    // Ej.: página 3 con 20 por página => saltar (3-1)*20 = 40.
    const skip = (page - 1) * perPage;

    // "where" será el filtro que pasamos a Prisma. ": any" relaja el tipado para
    // poder irle añadiendo propiedades dinámicamente. Empieza vacío.
    const where: any = {};
    // Si el usuario escribió algo en el buscador...
    if (filters.search) {
      // OR = coincide si CUALQUIERA de estas condiciones se cumple. "contains"
      // busca el texto DENTRO del campo (búsqueda parcial), en nombre, email o slug.
      where.OR = [
        { name: { contains: filters.search } },
        { email: { contains: filters.search } },
        { slug: { contains: filters.search } },
      ];
    }

    // Filtro por tipo de negocio: solo si es uno de los dos valores válidos.
    // "||" = O lógico: aceptamos FREELANCER o BUSINESS.
    if (filters.tenantType === 'FREELANCER' || filters.tenantType === 'BUSINESS') {
      where.tenantType = filters.tenantType;
    }

    // Construimos un sub-filtro para la suscripción relacionada.
    const subscriptionWhere: any = {};
    if (filters.plan) subscriptionWhere.plan = filters.plan;       // por plan.
    if (filters.status) subscriptionWhere.status = filters.status; // por estado.

    // Object.keys(obj).length cuenta cuántas propiedades tiene el objeto. Si hay
    // al menos una (> 0), aplicamos el filtro de suscripción al "where" principal.
    if (Object.keys(subscriptionWhere).length > 0) {
      where.subscription = subscriptionWhere;
    }

    // Orden por defecto: más nuevos primero. "let" porque puede reasignarse abajo.
    let orderBy: any = { createdAt: 'desc' };
    // Si piden ordenar por expiración de prueba: por trialEndsAt ascendente (los
    // que expiran antes, primero). Si piden por nombre: alfabético ascendente.
    if (filters.sortBy === 'trial_expiry') {
      orderBy = { subscription: { trialEndsAt: 'asc' } };
    } else if (filters.sortBy === 'name') {
      orderBy = { name: 'asc' };
    }

    // En paralelo: traemos la página de datos Y el total de registros (para paginar).
    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,            // el filtro construido arriba.
        skip,             // cuántos saltar (paginación).
        take: perPage,    // cuántos traer (tamaño de página).
        orderBy,          // el orden elegido.
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          businessType: true,
          tenantType: true,
          createdAt: true,
          // Datos clave de la suscripción.
          subscription: {
            select: { plan: true, status: true, monthlyAmountUsd: true, nextBillingDate: true, trialEndsAt: true },
          },
          // Traemos SOLO al dueño del negocio: "some" = "existe alguno" de sus
          // roles cuyo slug sea 'owner'. take: 1 limita a un usuario.
          users: {
            where: { userRoles: { some: { role: { slug: 'owner' } } } },
            take: 1,
            select: { firstName: true, lastName: true },
          },
          // _count cuenta registros relacionados: nº de usuarios, empleados y citas.
          _count: { select: { users: true, employees: true, appointments: true } },
        },
      }),
      // Segunda consulta del Promise.all: total de negocios que cumplen el filtro.
      this.prisma.tenant.count({ where }),
    ]);

    // Devolvemos los datos + "meta" con la info de paginación.
    return {
      data,
      meta: {
        total,
        page,
        perPage,
        // Math.ceil redondea hacia ARRIBA: ej. 21 registros / 20 = 1.05 -> 2 páginas.
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // grantFreeMonths(): regala "months" meses gratis a un negocio, extendiendo su
  // periodo de prueba y aplazando el próximo cobro.
  // ───────────────────────────────────────────────────────────────────────────
  async grantFreeMonths(tenantId: string, months: number) {
    // Validación defensiva (además de la del DTO):
    //   - Number.isFinite(months): que sea un número real (no NaN ni Infinity).
    //   - "!...": negamos; si NO es finito, error.
    //   - "months <= 0": cero o negativo no vale.   - "months > 60": tope 60.
    // El "||" hace que con que UNA condición sea verdadera, se lance el error.
    if (!Number.isFinite(months) || months <= 0 || months > 60) {
      throw new BadRequestException('La cantidad de meses debe ser un número entre 1 y 60');
    }

    // Buscamos la suscripción del negocio (única por tenantId).
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    // Si no existe, 404.
    if (!subscription) throw new NotFoundException('Suscripción no encontrada');

    const now = new Date();
    // Función auxiliar: dada una fecha y un número n, devuelve esa fecha + n meses.
    // Copiamos la fecha (new Date(date)) para NO modificar la original.
    const addMonths = (date: Date, n: number) => {
      const d = new Date(date);
      d.setMonth(d.getMonth() + n);
      return d;
    };

    // Base para extender: la fecha futura más lejana entre trialEndsAt,
    // nextBillingDate y "ahora". Así nunca acortamos un beneficio existente.
    // Empezamos con "ahora" y añadimos las otras fechas SOLO si existen.
    const candidates = [now];
    if (subscription.trialEndsAt) candidates.push(subscription.trialEndsAt);
    if (subscription.nextBillingDate) candidates.push(subscription.nextBillingDate);
    // reduce recorre el array comparando de dos en dos (a = acumulado, b = actual)
    // y se queda con la fecha MAYOR. El ternario "(a > b ? a : b)" devuelve la más
    // grande. Resultado: la fecha más lejana en el futuro.
    const base = candidates.reduce((a, b) => (a > b ? a : b));
    // La nueva fecha de fin = base + los meses regalados.
    const newEnd = addMonths(base, months);

    // El usuario quiere "regalar meses": independientemente del estado actual,
    // dejamos la cuenta activa y movemos el próximo cobro y trial.
    // Ponemos en null gracePeriodEndsAt y cancelledAt para limpiar avisos previos.
    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: 'TRIAL',
        trialEndsAt: newEnd,
        nextBillingDate: newEnd,
        gracePeriodEndsAt: null,
        cancelledAt: null,
      },
    });

    // Actualizamos también la copia "denormalizada" del estado en el propio tenant
    // (se guarda en minúsculas: 'trial').
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'trial' },
    });

    return {
      data: {
        // Mensaje legible. Detalles de los operadores usados aquí:
        //   - "mes${months !== 1 ? 'es' : ''}": ternario para pluralizar. Si months
        //     NO es 1 (!== es "distinto de"), añade "es" => "meses"; si es 1, "mes".
        //   - newEnd.toISOString() => texto ISO (ej. "2026-12-31T00:00:00.000Z");
        //     .slice(0, 10) toma los primeros 10 caracteres => solo la fecha "AAAA-MM-DD".
        message: `Se regalaron ${months} mes${months !== 1 ? 'es' : ''} hasta ${newEnd.toISOString().slice(0, 10)}`,
        trialEndsAt: updated.trialEndsAt,
        nextBillingDate: updated.nextBillingDate,
        status: updated.status,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getTenantDetail(): ficha completa de un negocio (suscripción, conteos, uso,
  // facturas recientes, usuarios y empleados).
  // ───────────────────────────────────────────────────────────────────────────
  async getTenantDetail(tenantId: string) {
    // Traemos el negocio con su suscripción y un bloque de conteos relacionados.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: true,   // toda la suscripción.
        _count: {
          // Número de registros en cada relación: usuarios, empleados, citas,
          // clientes, servicios y sucursales.
          select: {
            users: true,
            employees: true,
            appointments: true,
            clients: true,
            services: true,
            locations: true,
          },
        },
      },
    });

    // Si no existe el negocio, 404.
    if (!tenant) throw new NotFoundException('Negocio no encontrado');

    // ── Estadísticas de uso ──
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Citas de este mes, EXCLUYENDO las canceladas. "notIn" = "que NO esté en esta
    // lista". "gte" = creadas a partir del inicio del mes.
    const appointmentsThisMonth = await this.prisma.appointment.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
        status: { notIn: ['CANCELLED'] },
      },
    });

    // Empleados activos del negocio.
    const activeEmployees = await this.prisma.employee.count({
      where: { tenantId, isActive: true },
    });

    // Sucursales activas del negocio.
    const activeLocations = await this.prisma.location.count({
      where: { tenantId, isActive: true },
    });

    // Últimas 5 facturas del negocio (más recientes primero).
    const recentInvoices = await this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Usuarios del negocio, con sus roles y si tienen ficha de empleado asociada.
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        avatarUrl: true,
        lastLoginAt: true,
        // Sus roles, y de cada rol solo el nombre.
        userRoles: { include: { role: { select: { name: true } } } },
        // Si tiene empleado vinculado, solo su id (para saber si existe).
        employee: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },   // del más antiguo al más nuevo.
    });

    // Empleados del negocio, con su sucursal y nº de citas.
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        color: true,
        avatarUrl: true,
        jobTitle: true,
        // Su sucursal (id y nombre).
        location: { select: { id: true, name: true } },
        // Conteo de citas del empleado.
        _count: { select: { appointments: true } },
      },
      // Orden por DOS criterios: primero los activos (isActive 'desc' pone true
      // antes que false) y, dentro de cada grupo, por nombre alfabético.
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
    });

    // Componemos la respuesta:
    return {
      // "...tenant" copia todos los campos del negocio (incluida la suscripción y _count).
      ...tenant,
      // Bloque de uso resumido.
      usage: {
        activeEmployees,
        appointmentsThisMonth,
        activeLocations,
      },
      recentInvoices,
      // Transformamos cada usuario (u) a una forma limpia para el frontend.
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        isActive: u.isActive,
        // "?? null": si avatarUrl es null/undefined, devolvemos null explícito.
        avatarUrl: u.avatarUrl ?? null,
        lastLoginAt: u.lastLoginAt,
        // De cada relación userRoles (ur) sacamos el nombre del rol => lista de nombres.
        roles: u.userRoles.map((ur) => ur.role.name),
        // "!!u.employee" convierte el objeto employee (o null) a booleano:
        // doble "!" => true si existe empleado, false si es null/undefined.
        hasEmployee: !!u.employee,
      })),
      // Igual para empleados (e): forma limpia para el frontend.
      employees: employees.map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        isActive: e.isActive,
        color: e.color,
        avatarUrl: e.avatarUrl ?? null,
        jobTitle: e.jobTitle ?? null,
        // "e.location?.name": el "?." (optional chaining) evita error si location
        // es null; en ese caso, "?? null" devuelve null.
        locationName: e.location?.name ?? null,
        appointmentsCount: e._count.appointments,
      })),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // updateTenantStatus(): cambia el estado de la suscripción de un negocio.
  // ───────────────────────────────────────────────────────────────────────────
  async updateTenantStatus(tenantId: string, status: SubscriptionStatus) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) throw new NotFoundException('Suscripción no encontrada');

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status,
        // "...(condición ? {campo} : {})" es un patrón para AÑADIR un campo solo si
        // se cumple la condición. Si el estado pasa a SUSPENDED o ACTIVE, limpiamos
        // el periodo de gracia (gracePeriodEndsAt = null); si no, no añade nada ({}).
        ...(status === 'SUSPENDED' ? { gracePeriodEndsAt: null } : {}),
        ...(status === 'ACTIVE' ? { gracePeriodEndsAt: null } : {}),
      },
    });

    // Actualizamos la copia denormalizada del estado en el tenant.
    // toLowerCase() lo guarda en minúsculas (ej. 'ACTIVE' -> 'active').
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: status.toLowerCase() },
    });

    return updated;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // updateTenantPlan(): cambia el plan de la suscripción y su precio mensual.
  // ───────────────────────────────────────────────────────────────────────────
  async updateTenantPlan(tenantId: string, plan: SubscriptionPlan) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) throw new NotFoundException('Suscripción no encontrada');

    // Buscamos en la tabla de configuración los límites/precio del plan elegido.
    // PLAN_LIMITS[plan] accede a la entrada correspondiente a ese plan.
    const limits = PLAN_LIMITS[plan];

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        plan,
        // Ponemos el precio mensual según el plan (desde la configuración).
        monthlyAmountUsd: limits.monthlyPriceUsd,
      },
    });

    // Copia denormalizada del plan en el tenant.
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionPlan: plan },
    });

    return updated;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getAllInvoices(): lista paginada de todas las facturas (con su negocio).
  // ───────────────────────────────────────────────────────────────────────────
  async getAllInvoices(filters: {
    page?: number;
    perPage?: number;
    status?: string;
  }) {
    // Misma lógica de paginación que en getTenants.
    const page = filters.page || 1;
    const perPage = Math.min(filters.perPage || 20, 100);
    const skip = (page - 1) * perPage;

    const where: any = {};
    // Filtro opcional por estado de factura (PAID, OVERDUE, etc.).
    if (filters.status) where.status = filters.status;

    // En paralelo: la página de facturas + el total.
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          // De cada factura traemos el negocio (id, nombre, slug).
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // markInvoicePaid(): marca una factura como pagada y, si el negocio estaba
  // moroso/suspendido, lo reactiva.
  // ───────────────────────────────────────────────────────────────────────────
  async markInvoicePaid(invoiceId: string) {
    // Buscamos la factura junto con su suscripción asociada.
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');

    const now = new Date();

    // Marcamos la factura como pagada y registramos cuándo (paidAt).
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: now },
    });

    // Si la suscripción estaba morosa (PAST_DUE) O suspendida (SUSPENDED), al pagar
    // la reactivamos (volvemos a ACTIVE), anotamos la fecha de pago y limpiamos la
    // gracia. El "||" hace que entre si cumple cualquiera de los dos estados.
    if (invoice.subscription.status === 'PAST_DUE' || invoice.subscription.status === 'SUSPENDED') {
      await this.prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: 'ACTIVE',
          lastPaymentDate: now,
          gracePeriodEndsAt: null,
        },
      });
      // Y actualizamos la copia denormalizada del estado en el tenant.
      await this.prisma.tenant.update({
        where: { id: invoice.tenantId },
        data: { subscriptionStatus: 'active' },
      });
    }

    return { message: 'Factura marcada como pagada' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // markInvoiceOverdue(): marca una factura como vencida y pone el negocio en
  // periodo de gracia de 24 horas (estado moroso).
  // ───────────────────────────────────────────────────────────────────────────
  async markInvoiceOverdue(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');

    // Marcamos la factura como vencida.
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'OVERDUE' },
    });

    // Calculamos el fin del periodo de gracia: ahora + 24 horas.
    const gracePeriodEnds = new Date();
    // setHours(hora actual + 24) suma 24 horas (gestiona el cambio de día solo).
    gracePeriodEnds.setHours(gracePeriodEnds.getHours() + 24);

    // Pasamos la suscripción a morosa (PAST_DUE) y guardamos hasta cuándo dura la gracia.
    await this.prisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        status: 'PAST_DUE',
        gracePeriodEndsAt: gracePeriodEnds,
      },
    });

    // Copia denormalizada del estado en el tenant ('past_due').
    await this.prisma.tenant.update({
      where: { id: invoice.tenantId },
      data: { subscriptionStatus: 'past_due' },
    });

    return { message: 'Factura marcada como vencida, negocio en período de gracia de 24h' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getEmployeePendingCount(): cuenta las citas futuras "vivas" de un empleado.
  // Útil para avisar antes de desactivarlo.
  // ───────────────────────────────────────────────────────────────────────────
  async getEmployeePendingCount(tenantId: string, employeeId: string) {
    // Comprobamos que el empleado pertenece a ESE negocio (seguridad multi-tenant).
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado en este negocio');

    // Contamos sus citas: "in" = el estado debe ser uno de la lista (pendiente,
    // confirmada o reagendada) y "gte: new Date()" = que empiecen de ahora en adelante.
    const count = await this.prisma.appointment.count({
      where: {
        employeeId,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
    });

    // Devolvemos el id, el nombre completo (plantilla de texto) y el conteo.
    return { employeeId, employeeName: `${employee.firstName} ${employee.lastName}`, pendingCount: count };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // deactivateEmployee(): desactiva un empleado aplicando la estrategia elegida
  // para sus citas. Delega el trabajo real en EmployeesService.
  // ───────────────────────────────────────────────────────────────────────────
  async deactivateEmployee(
    tenantId: string,
    employeeId: string,
    strategy: 'KEEP' | 'CANCEL' | 'SMART_RESCHEDULE',
  ) {
    // Verificamos que el empleado pertenezca al negocio.
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado en este negocio');
    // Si ya está inactivo, no tiene sentido volver a desactivarlo -> error 400.
    if (!employee.isActive) throw new BadRequestException('El empleado ya está desactivado');

    // "Record<string, DeactivateAction>" = un objeto cuyas claves son textos y sus
    // valores son del enum DeactivateAction. Traduce la estrategia (texto recibido)
    // al valor del enum que entiende EmployeesService.
    const actionMap: Record<string, DeactivateAction> = {
      KEEP: DeactivateAction.KEEP,
      CANCEL: DeactivateAction.CANCEL,
      SMART_RESCHEDULE: DeactivateAction.SMART_RESCHEDULE,
    };

    // Llamamos al servicio de empleados. "actionMap[strategy]" obtiene el valor del
    // enum correspondiente a la estrategia. El último argumento 'platform-admin' se
    // usa como autor del cambio en la auditoría (no es un usuario normal).
    return this.employeesService.deactivate(
      employeeId,
      tenantId,
      { action: actionMap[strategy] },
      'platform-admin',
    );
  }

  // ─── NOTIFICATION LOGS (registros globales de notificaciones) ───────────────

  // ───────────────────────────────────────────────────────────────────────────
  // getNotificationLogs(): historial paginado de notificaciones de todos los negocios.
  // ───────────────────────────────────────────────────────────────────────────
  async getNotificationLogs(filters: { page?: number; perPage?: number; status?: string }) {
    const page = filters.page || 1;
    const perPage = Math.min(filters.perPage || 20, 100);
    const skip = (page - 1) * perPage;

    const where: any = {};
    // Solo filtramos si el estado es uno de los dos valores válidos: SENT o FAILED.
    if (filters.status === 'SENT' || filters.status === 'FAILED') {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        // De cada log traemos el negocio relacionado (id, nombre, slug).
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  }

  // ─── BUSINESS TYPES (catálogo de tipos de negocio) ──────────────────────────

  // getBusinessTypes(): devuelve todos los tipos ordenados por sortOrder ascendente.
  async getBusinessTypes() {
    const types = await this.prisma.businessTypeCatalog.findMany({ orderBy: { sortOrder: 'asc' } });
    return { data: types };
  }

  // createBusinessType(): crea un tipo. "value" se normaliza a MAYÚSCULAS y se le
  // quitan espacios sobrantes (trim); "label" solo se recorta con trim.
  async createBusinessType(value: string, label: string) {
    const item = await this.prisma.businessTypeCatalog.create({
      data: { value: value.toUpperCase().trim(), label: label.trim() },
    });
    return { data: item };
  }

  // updateBusinessType(): edita un tipo de negocio (value y/o label son opcionales).
  async updateBusinessType(id: string, body: { value?: string; label?: string }) {
    // Buscamos el registro actual ("old") para asegurarnos de que existe.
    const old = await this.prisma.businessTypeCatalog.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Tipo de negocio no encontrado');

    const updated = await this.prisma.businessTypeCatalog.update({
      where: { id },
      data: {
        // "...(cond && { campo })": si la condición es verdadera, el "&&" devuelve
        // el objeto { campo } y el spread lo añade; si es falsa, devuelve false y no
        // añade nada. Así solo actualizamos los campos que SÍ vinieron (!== undefined).
        ...(body.value !== undefined && { value: body.value.toUpperCase().trim() }),
        ...(body.label !== undefined && { label: body.label.trim() }),
      },
    });

    // Si cambió el "value" respecto al anterior, habría que propagarlo a los tenants.
    // De momento es solo una nota pendiente para una versión futura (V2).
    if (body.value && body.value.toUpperCase().trim() !== old.value) {
      // Note: businessType can be comma-separated, complex update needed for V2
    }

    return { data: updated };
  }

  // deleteBusinessType(): borra un tipo de negocio por su id.
  async deleteBusinessType(id: string) {
    await this.prisma.businessTypeCatalog.delete({ where: { id } });
    return { data: { message: 'Tipo de negocio eliminado' } };
  }

  // ─── SERVICE CATALOG (catálogo maestro de servicios) ────────────────────────

  // getServiceCatalog(): lista todos los servicios del catálogo, alfabéticamente.
  async getServiceCatalog() {
    const items = await this.prisma.serviceCatalog.findMany({ orderBy: { name: 'asc' } });
    return { data: items };
  }

  // createServiceCatalogItem(): crea un servicio. "category" es opcional.
  async createServiceCatalogItem(name: string, category?: string) {
    const item = await this.prisma.serviceCatalog.create({
      data: {
        name: name.trim(),
        // "category?.trim() || null": si category existe, le quitamos espacios; si el
        // resultado fuera vacío "" (que es "falso"), o category era undefined,
        // guardamos null. El "?." evita error si category es undefined.
        category: category?.trim() || null,
      },
    });
    return { data: item };
  }

  // updateServiceCatalogItem(): edita nombre y/o categoría de un servicio.
  async updateServiceCatalogItem(id: string, body: { name?: string; category?: string }) {
    const item = await this.prisma.serviceCatalog.update({
      where: { id },
      data: {
        // Solo actualizamos los campos que llegaron (!== undefined).
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.category !== undefined && { category: body.category?.trim() || null }),
      },
    });
    return { data: item };
  }

  // renameServiceCategory(): renombra una categoría en cascada por TODA la app.
  async renameServiceCategory(oldName: string, newName: string) {
    const trimmed = newName.trim();   // nombre nuevo sin espacios sobrantes.
    // updateMany actualiza VARIAS filas a la vez: todos los servicios cuya categoría
    // sea el nombre antiguo pasan a tener el nombre nuevo. "result.count" = cuántos.
    const result = await this.prisma.serviceCatalog.updateMany({
      where: { category: oldName },
      data: { category: trimmed },
    });
    // También renombramos la profesión que coincida con ese nombre (si existe).
    await this.prisma.profession.updateMany({
      where: { name: oldName },
      data: { name: trimmed },
    });
    // Y los empleados cuyo jobTitle (puesto) era el nombre antiguo.
    await this.prisma.employee.updateMany({
      where: { jobTitle: oldName },
      data: { jobTitle: trimmed },
    });
    // Devolvemos un mensaje y cuántos servicios se actualizaron.
    return { data: { message: `Categoría renombrada: ${oldName} → ${trimmed}`, servicesUpdated: result.count } };
  }

  // deleteServiceCategory(): borra TODOS los servicios de una categoría.
  async deleteServiceCategory(name: string) {
    // deleteMany borra varias filas: todas las que tengan esa categoría.
    const result = await this.prisma.serviceCatalog.deleteMany({
      where: { category: name },
    });
    return { data: { message: `Categoría "${name}" eliminada`, servicesDeleted: result.count } };
  }

  // deleteServiceCatalogItem(): borra un único servicio del catálogo por id.
  async deleteServiceCatalogItem(id: string) {
    await this.prisma.serviceCatalog.delete({ where: { id } });
    return { data: { message: 'Servicio eliminado del catalogo' } };
  }

  // ─── PROFESSIONS CATALOG (catálogo de profesiones / oficios) ────────────────

  // getProfessions(): lista todas las profesiones, alfabéticamente.
  async getProfessions() {
    const professions = await this.prisma.profession.findMany({
      orderBy: { name: 'asc' },
    });
    return { data: professions };
  }

  // createProfession(): crea una profesión con su nombre (sin espacios sobrantes).
  async createProfession(name: string) {
    const profession = await this.prisma.profession.create({
      data: { name: name.trim() },
    });
    return { data: profession };
  }

  // updateProfession(): renombra una profesión y propaga el cambio a los empleados.
  async updateProfession(id: string, newName: string) {
    // Comprobamos que la profesión existe.
    const profession = await this.prisma.profession.findUnique({ where: { id } });
    if (!profession) throw new NotFoundException('Profesion no encontrada');

    const oldName = profession.name;   // guardamos el nombre antiguo.
    const trimmed = newName.trim();     // nombre nuevo recortado.

    // Actualizamos el catálogo de profesiones.
    const updated = await this.prisma.profession.update({
      where: { id },
      data: { name: trimmed },
    });

    // Y todos los empleados cuyo puesto (jobTitle) era el nombre antiguo.
    // "result.count" indica a cuántos empleados afectó el cambio.
    const result = await this.prisma.employee.updateMany({
      where: { jobTitle: oldName },
      data: { jobTitle: trimmed },
    });

    return { data: updated, employeesUpdated: result.count };
  }

  // deleteProfession(): borra una profesión del catálogo por su id.
  async deleteProfession(id: string) {
    await this.prisma.profession.delete({ where: { id } });
    return { data: { message: 'Profesion eliminada' } };
  }
}
