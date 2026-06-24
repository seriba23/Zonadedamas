// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de NestJS para declarar endpoints HTTP:
//   - Body: lee el cuerpo (JSON) de un POST.
//   - Controller: marca la clase como grupo de endpoints (con un prefijo de ruta).
//   - Get / Post: marcan un método como endpoint GET o POST.
//   - Param: lee un trozo variable de la URL (ej. el :tenantSlug).
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

// Throttle: limitador de peticiones (anti-abuso). Se usa abajo en /book.
import { Throttle } from '@nestjs/throttler';

// El servicio con la lógica del módulo (resolver negocio, servicios, reservar...).
import { PublicBookingService } from './public-booking.service';

// DTO de entrada (forma + validación) para disponibilidad y reserva.
import { PublicAvailabilityQueryDto, PublicBookDto } from './dto/public-booking.dto';

// DTO para la disponibilidad "compuesta" (varios servicios con un profesional
// asignado a cada uno). Vive en el módulo de availability y lo reutilizamos.
import { CompositeAvailabilityQueryDto } from '../availability/dto/composite-availability-query.dto';

// PrismaService: acceso directo a la base de datos (lo usa el endpoint de
// reputación para hacer agregados de reseñas).
import { PrismaService } from '../../prisma/prisma.service';

// AvailabilityService: lo inyectamos directo aquí para los endpoints de
// disponibilidad de paquetes y compuesta.
import { AvailabilityService } from '../availability/availability.service';

// @Controller('public/:tenantSlug') => todas las rutas de esta clase empiezan
// con "/api/public/<slug-del-negocio>". El ":tenantSlug" es una parte variable
// de la URL: identifica de qué negocio se trata (no hay auth, el slug manda).
@Controller('public/:tenantSlug')
export class PublicBookingController {
  // CONSTRUCTOR + INYECCIÓN: NestJS pasa estas dependencias automáticamente.
  // "private readonly" las guarda como propiedades de solo lectura.
  constructor(
    private readonly publicBookingService: PublicBookingService, // lógica del módulo
    private readonly prisma: PrismaService,                       // DB (reputación)
    private readonly availabilityService: AvailabilityService,    // slots paquete/compuesta
  ) {}

  // ── GET /api/public/:tenantSlug/services ──────────────────────────────────
  // Devuelve la lista de servicios reservables del negocio.
  @Get('services')
  async getServices(@Param('tenantSlug') tenantSlug: string) {
    // Primero resolvemos el negocio a partir del slug (lanza 404 si no existe).
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    // Luego pedimos sus servicios usando el id ya resuelto del negocio.
    const services = await this.publicBookingService.getServices(tenant.id);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: services };
  }

  // ── GET /api/public/:tenantSlug/employees ─────────────────────────────────
  // Devuelve la lista de profesionales activos del negocio.
  @Get('employees')
  async getEmployees(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    const employees = await this.publicBookingService.getEmployees(tenant.id);
    return { data: employees };
  }

  // ── POST /api/public/:tenantSlug/availability ─────────────────────────────
  // Devuelve los huecos libres. El servicio los entrega anidados (por día y por
  // empleado); aquí los "aplanamos" a una lista simple para el frontend.
  @Post('availability')
  async getAvailability(
    @Param('tenantSlug') tenantSlug: string,
    // @Body() con el DTO: NestJS valida el JSON antes de entrar al método.
    @Body() query: PublicAvailabilityQueryDto,
  ) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    // "result.data" es una estructura anidada: días -> empleados -> slots.
    const result = await this.publicBookingService.getAvailability(query, tenant.id);

    // Flatten nested response into array of slots with employeeId
    // flatSlots: la lista PLANA de salida. Cada elemento es un hueco concreto
    // con su hora de inicio/fin y a qué empleado pertenece. Empieza vacía.
    const flatSlots: Array<{
      startTime: string;
      endTime: string;
      employeeId: string;
      employeeName: string;
    }> = [];

    // TRIPLE BUCLE para "desanidar":
    // 1) recorremos cada "day" (día) del resultado;
    for (const day of result.data) {
      // 2) dentro de cada día, recorremos cada "emp" (empleado);
      for (const emp of day.employees) {
        // 3) dentro de cada empleado, recorremos cada "slot" (hueco libre).
        for (const slot of emp.slots) {
          // Empujamos a la lista plana un objeto con los datos combinados.
          flatSlots.push({
            // Construimos la fecha-hora completa juntando el día y la hora del
            // slot (ej. "2026-06-24" + "T" + "15:30" + ":00").
            startTime: `${day.date}T${slot.startTime}:00`,
            endTime: `${day.date}T${slot.endTime}:00`,
            employeeId: emp.id,     // a qué empleado pertenece el hueco
            employeeName: emp.name, // su nombre, para mostrarlo
          });
        }
      }
    }

    // Devolvemos la lista plana ya lista para el frontend.
    return { data: flatSlots };
  }

  // ── POST /api/public/:tenantSlug/bundle-availability ──────────────────────
  // Disponibilidad para un "bundle" (paquete de servicios vendido junto).
  // Delega directamente en AvailabilityService.getBundleAvailability.
  @Post('bundle-availability')
  async getBundleAvailability(
    @Param('tenantSlug') tenantSlug: string,
    // El cuerpo trae el id del paquete, el rango de fechas y, opcionalmente,
    // la sucursal. "locationId?" lleva "?" porque es opcional.
    @Body() body: { bundleId: string; startDate: string; endDate: string; locationId?: string },
  ) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    // Reempaquetamos los campos del body y los pasamos al servicio + el id del
    // negocio. Devolvemos directamente lo que el servicio responda.
    return this.availabilityService.getBundleAvailability(
      { bundleId: body.bundleId, startDate: body.startDate, endDate: body.endDate, locationId: body.locationId },
      tenant.id,
    );
  }

  // ── POST /api/public/:tenantSlug/composite-availability ───────────────────
  // Composite availability: cuando el cliente seleccionó N servicios y asignó
  // un profesional especifico a cada uno (porque varios podian hacerlo).
  // Devuelve slots donde la cadena completa cabe respetando schedules,
  // citas y buffers de cada empleado. Mismo shape de output que /availability.
  @Post('composite-availability')
  async getCompositeAvailability(
    @Param('tenantSlug') tenantSlug: string,
    @Body() query: CompositeAvailabilityQueryDto,
  ) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    // Pedimos la disponibilidad compuesta. El resultado puede venir en DOS
    // formas distintas (con "slots" directos o anidado por "employees"), por
    // eso abajo distinguimos ambos casos.
    const result = await this.availabilityService.getCompositeAvailability(query, tenant.id);

    // Lista plana de salida. Aquí cada slot ADEMÁS puede llevar "assignments"
    // (qué empleado hace cada servicio del paquete). "assignments?" es opcional.
    const flatSlots: Array<{
      startTime: string;
      endTime: string;
      employeeId: string;
      employeeName: string;
      assignments?: any[];
    }> = [];

    // Recorremos los días. "(result.data || [])" => si data fuera null/undefined,
    // el "|| []" usa un arreglo vacío para no romper el bucle. "as any[]" relaja
    // el tipo porque la forma del día varía según el caso.
    for (const day of (result.data || []) as any[]) {
      // CASO A: el día trae "slots" ya calculados (formato compuesto).
      if (day.slots) {
        for (const slot of day.slots) {
          // "slot.assignments?.[0]" => primer asignación del slot, si existe.
          // El "?." evita error si assignments fuese undefined.
          const first = slot.assignments?.[0];
          flatSlots.push({
            startTime: `${day.date}T${slot.startTime}:00`,
            endTime: `${day.date}T${slot.endTime}:00`,
            // "first?.employeeId || ''" => el id del primer empleado; si no hay
            // (first undefined o sin id), usamos cadena vacía como respaldo.
            employeeId: first?.employeeId || '',
            employeeName: first?.employeeName || '',
            assignments: slot.assignments, // detalle de quién hace cada servicio
          });
        }
      // CASO B: el día NO trae "slots" pero sí "employees" (el servicio delegó
      // al cálculo normal porque al final solo había 1 asignación).
      } else if (day.employees) {
        // Delegacion al endpoint normal (1 solo assignment): mismo shape
        // que /availability. Mismo triple recorrido que en getAvailability().
        for (const emp of day.employees) {
          for (const slot of emp.slots) {
            flatSlots.push({
              startTime: `${day.date}T${slot.startTime}:00`,
              endTime: `${day.date}T${slot.endTime}:00`,
              employeeId: emp.id,
              employeeName: emp.name,
            });
          }
        }
      }
    }

    return { data: flatSlots };
  }

  // ── POST /api/public/:tenantSlug/book ─────────────────────────────────────
  // Crea la reserva real. Es el endpoint más sensible (escribe en la DB).
  @Post('book')
  // @Throttle: máximo 5 reservas por minuto (ttl = 60000 ms) desde la misma IP.
  // Protege contra abuso/spam de reservas. Si se supera, responde HTTP 429.
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async book(
    @Param('tenantSlug') tenantSlug: string,
    // El cuerpo es el DTO de reserva (validado automáticamente por NestJS).
    @Body() dto: PublicBookDto,
  ) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    // Delegamos en el servicio (find-or-create cliente + transacción anti-doble
    // reserva). Devolvemos directamente lo que el servicio responda.
    return this.publicBookingService.book(dto, tenant.id);
  }

  // ── GET /api/public/:tenantSlug/reputation ────────────────────────────────
  // Calcula y devuelve la reputación pública del negocio: nota media global y
  // por cada profesional, junto al conteo de reseñas.
  @Get('reputation')
  async getReputation(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);

    // ── AGREGADO GLOBAL: media y conteo de TODAS las reseñas visibles ──
    // aggregate() calcula totales sobre las filas que cumplan el "where".
    //   - _avg.rating: promedio de la columna "rating".
    //   - _count.id: cuántas reseñas hay.
    const overallAgg = await this.prisma.employeeReview.aggregate({
      where: { tenantId: tenant.id, isVisible: true }, // del negocio y visibles
      _avg: { rating: true },
      _count: { id: true },
    });

    // ── AGREGADO POR EMPLEADO: agrupamos las reseñas por "employeeId" ──
    // groupBy junta las filas por empleado y calcula media y conteo de cada grupo.
    const employeeRatings = await this.prisma.employeeReview.groupBy({
      by: ['employeeId'], // agrupar por este campo
      where: { tenantId: tenant.id, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    // map() recorre cada grupo "r" y extrae solo su employeeId, dando una lista
    // con los ids de empleados que tienen reseñas.
    const employeeIds = employeeRatings.map((r) => r.employeeId);
    // OPERADOR TERNARIO (condición ? A : B): si HAY ids (length distinto de 0,
    // que cuenta como verdadero), buscamos esos empleados; si no, lista vacía
    // (evita una consulta innecesaria con "in: []").
    const employees = employeeIds.length
      ? await this.prisma.employee.findMany({
          // "id: { in: employeeIds }" => empleados cuyo id ESTÉ EN esa lista.
          where: { id: { in: employeeIds } },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    // Creamos un Map (diccionario) id -> empleado para buscar por id en O(1).
    // employees.map(e => [e.id, e]) produce los pares [clave, valor] del Map.
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    // Devolvemos el objeto de reputación.
    return {
      data: {
        business: {
          id: tenant.id,
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          // Redondeo a 1 decimal: si hay media (truthy), "*10, redondear, /10"
          // deja un solo decimal (ej. 4.27 -> 4.3). Si no hay reseñas, null.
          averageRating: overallAgg._avg.rating
            ? Math.round(overallAgg._avg.rating * 10) / 10
            : null,
          totalReviews: overallAgg._count.id, // total de reseñas del negocio
        },
        // Para cada grupo de reseñas (un empleado), construimos su resumen.
        employees: employeeRatings.map((r) => {
          // Buscamos sus datos básicos en el Map por su employeeId.
          const emp = employeeMap.get(r.employeeId);
          return {
            id: r.employeeId,
            // "emp?.firstName || ''" => nombre si existe; si emp es undefined o
            // el campo es vacío, usamos cadena vacía como respaldo.
            firstName: emp?.firstName || '',
            lastName: emp?.lastName || '',
            avatarUrl: emp?.avatarUrl || null,
            // Media del empleado redondeada a 1 decimal, o null si no aplica.
            averageRating: r._avg.rating
              ? Math.round(r._avg.rating * 10) / 10
              : null,
            totalReviews: r._count.id, // nº de reseñas de este empleado
          };
        }),
      },
    };
  }
}
