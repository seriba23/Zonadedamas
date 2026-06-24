// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De NestJS:
//   - Injectable: marca la clase como servicio inyectable.
//   - NotFoundException: error que responde HTTP 404 (no encontrado).
//   - BadRequestException: error que responde HTTP 400 (petición inválida).
//   - ConflictException: error que responde HTTP 409 (conflicto, p. ej. duplicado).
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
// "Prisma" (el namespace del cliente) nos da tipos y utilidades, como los
// niveles de aislamiento de transacción (TransactionIsolationLevel).
import { Prisma } from '@prisma/client';
// PrismaService: el puente hacia la base de datos.
import { PrismaService } from '../../prisma/prisma.service';
// parseRangeBound: convierte una fecha texto en el límite inicio/fin de un rango.
import { parseRangeBound } from '../../common/utils/date-range.util';
// parseWallClock: interpreta una fecha-hora como "hora de pared" de la sucursal
// (sin desfase de zona horaria), igual que se hace con las citas.
import { parseWallClock } from '../../common/utils/parse-wall-clock';
// DTOs (formas de los datos de entrada) usados por los métodos del servicio:
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { SetSchedulesDto } from './dto/schedule.dto';
import { CreateTimeOffDto, ServiceConfigDto } from './dto/time-off.dto';
import { CreateReviewDto } from './dto/review.dto';
import { UpdatePersonalInfoDto } from './dto/personal-info.dto';
import { CreateDocumentDto } from './dto/document.dto';
import { CreateTrainingDto } from './dto/training.dto';
import { DeactivateEmployeeDto, DeactivateAction } from './dto/deactivate-employee.dto';
// PaginationDto: page/perPage. buildPaginatedResponse: arma la respuesta paginada
// estándar { data, meta }.
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';
// AuditService: registra acciones importantes en el log de auditoría.
import { AuditService } from '../audit/audit.service';
// EventsService: emite eventos de dominio (cita reasignada/cancelada, etc.).
import { EventsService } from '../events/events.service';
// AvailabilityService: calcula disponibilidad y permite invalidar su caché.
import { AvailabilityService } from '../availability/availability.service';
// PlanLimitsService: verifica límites del plan contratado (p. ej. nº de empleados).
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
// StripeService: ajusta la facturación (cantidad de empleados) en Stripe.
import { StripeService } from '../stripe/stripe.service';
// EventEmitter2: emisor de eventos genérico (aquí, para "review.created").
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable() // <- Servicio inyectable de NestJS.
export class EmployeesService {
  // CONSTRUCTOR: NestJS inyecta automáticamente todas estas dependencias y las
  // guardamos como propiedades de solo lectura (this.xxx) para usarlas abajo.
  constructor(
    private readonly prisma: PrismaService,                 // base de datos
    private readonly auditService: AuditService,            // auditoría
    private readonly eventsService: EventsService,          // eventos de dominio
    private readonly availabilityService: AvailabilityService, // disponibilidad
    private readonly planLimitsService: PlanLimitsService,  // límites de plan
    private readonly stripeService: StripeService,          // facturación Stripe
    private readonly eventEmitter: EventEmitter2,           // emisor de eventos
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // syncSubscriptionEmployeeCount(): mantiene sincronizado el número de empleados
  // con la suscripción/facturación. Es "private" (uso interno).
  // Parámetro employeeDeactivated = false: si se llamó por una desactivación.
  // ───────────────────────────────────────────────────────────────────────────
  private async syncSubscriptionEmployeeCount(tenantId: string, employeeDeactivated = false) {
    // try/catch para que si algo falla, NO rompa la operación principal (es
    // un efecto secundario "no bloqueante").
    try {
      // Buscamos la suscripción del negocio (única por tenant).
      const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
      // Si no hay suscripción, no hay nada que sincronizar -> salimos.
      if (!sub) return;

      // Si el plan es ANUAL, no se cambia la cantidad en Stripe; en su lugar se
      // gestionan "licencias disponibles".
      if (sub.planInterval === 'ANNUAL') {
        // Annual plan: license becomes available, no Stripe quantity change
        // Solo si fue por desactivación: liberamos una licencia (increment: 1).
        if (employeeDeactivated) {
          await this.prisma.subscription.update({
            where: { tenantId },
            data: { availableLicenses: { increment: 1 } }, // +1 licencia libre
          });
        }
      } else if (sub.stripeSubscriptionId) {
        // Plan mensual con Stripe: contamos los empleados ACTIVOS y le decimos a
        // Stripe la nueva cantidad para que ajuste la facturación.
        const count = await this.prisma.employee.count({ where: { tenantId, isActive: true } });
        await this.stripeService.updateSubscriptionEmployeeCount(tenantId, count);
      }
    } catch {
      // Non-blocking
      // Silenciamos el error a propósito: este ajuste no debe frenar el flujo.
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getDayOfWeek(): traduce un objeto Date al nombre del día en inglés/mayúsculas
  // que usa la base de datos. El tipo de retorno enumera los 7 valores posibles.
  // ───────────────────────────────────────────────────────────────────────────
  private getDayOfWeek(date: Date): 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY' {
    // Arreglo de nombres ordenados según getUTCDay(): 0=domingo ... 6=sábado.
    const days: ('SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY')[] = [
      'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
    ];
    // date.getUTCDay() devuelve 0-6; lo usamos como índice del arreglo.
    return days[date.getUTCDay()];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): lista paginada de empleados del negocio, con filtros opcionales y
  // enriquecida con su calificación promedio.
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, pagination: PaginationDto, locationId?: string, includeInactive?: boolean, workingDate?: string) {
    // "??" (nullish coalescing): usa el valor de la izquierda salvo que sea
    // null/undefined; en ese caso usa el de la derecha (valores por defecto).
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    // skip = cuántos registros saltar para llegar a la página pedida.
    const skip = (page - 1) * perPage;

    // "where" se va construyendo dinámicamente. Empezamos filtrando por tenant
    // (regla multi-tenant: SIEMPRE filtrar por negocio).
    const where: any = { tenantId };
    // Si NO se pidieron inactivos, restringimos a los activos.
    if (!includeInactive) where.isActive = true;
    // Si se pasó una sucursal, filtramos por ella.
    if (locationId) where.locationId = locationId;

    // Filter by employees who have a working schedule on the given date
    if (workingDate) {
      // Convertimos "YYYY-MM-DD" en una fecha a medianoche UTC.
      const dateObj = new Date(workingDate + 'T00:00:00Z');
      // Obtenemos el nombre del día (MONDAY, etc.) de esa fecha.
      const dayOfWeek = this.getDayOfWeek(dateObj);
      // Find employee IDs who work on this day
      // Buscamos los horarios que apliquen ese día y estén vigentes:
      const workingSchedules = await this.prisma.employeeSchedule.findMany({
        where: {
          dayOfWeek,                          // ese día de la semana
          isWorking: true,                    // y que ese día trabajen
          effectiveFrom: { lte: dateObj },    // que ya hayan entrado en vigor (<= fecha)
          // OR: el horario sigue vigente si NO tiene fin (null) o si su fin es
          // posterior o igual a la fecha (gte).
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: dateObj } }],
          employee: { tenantId },             // del mismo negocio
        },
        select: { employeeId: true },
        distinct: ['employeeId'],             // sin repetir empleados
      });
      // map() extrae solo los IDs de empleado de cada horario encontrado.
      const workingEmployeeIds = workingSchedules.map((s) => s.employeeId);
      // Restringimos el listado a esos IDs ("in" = "que esté en esta lista").
      where.id = { in: workingEmployeeIds };
    }

    // Promise.all ejecuta ambas consultas EN PARALELO y espera a las dos:
    //   - data: la página de empleados.
    //   - total: cuántos hay en total (para calcular el número de páginas).
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: perPage,                        // cuántos traer (tamaño de página)
        // Orden: por apellido y luego por nombre, ambos ascendentes (A→Z).
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          location: { select: { id: true, name: true } }, // sucursal (id+nombre)
          // Servicios del empleado, incluyendo datos del servicio relacionado.
          employeeServices: { include: { service: { select: { id: true, name: true, price: true, durationMinutes: true } } } },
          schedules: { select: { isWorking: true, dayOfWeek: true } }, // horario resumido
          _count: { select: { appointments: true } },     // nº de citas (contador)
        },
      }),
      this.prisma.employee.count({ where }),  // total con los mismos filtros
    ]);

    // Batch-fetch average ratings for returned employees
    // Sacamos los IDs de los empleados de esta página.
    const employeeIds = data.map((e) => e.id);
    // Operador ternario: si hay empleados, calculamos sus ratings agrupados;
    // si no hay ninguno, evitamos la consulta y usamos un arreglo vacío.
    const ratings = employeeIds.length > 0
      ? await this.prisma.employeeReview.groupBy({
          by: ['employeeId'],                            // agrupar por empleado
          where: { employeeId: { in: employeeIds }, isVisible: true }, // solo visibles
          _avg: { rating: true },                        // promedio de rating
          _count: { rating: true },                      // nº de reseñas
        })
      : [];

    // Construimos un Map (diccionario clave→valor) de employeeId -> {promedio, total}
    // para poder buscar el rating de cada empleado rápidamente por su id.
    const ratingMap = new Map(
      ratings.map((r) => [
        r.employeeId, // clave
        {
          // Si hay promedio, lo redondeamos a 1 decimal (*10, round, /10); si no, null.
          averageRating: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : null,
          totalReviews: r._count.rating,
        },
      ]),
    );

    // Enriquecemos cada empleado añadiéndole su rating. El "...emp" copia todas
    // sus propiedades; luego sobre-escribimos/añadimos averageRating y totalReviews.
    const enriched = data.map((emp) => ({
      ...emp,
      // ".get(emp.id)?.averageRating ?? null": busca el rating; el "?." evita
      // error si no existe; el "?? null" pone null si no hubiera dato.
      averageRating: ratingMap.get(emp.id)?.averageRating ?? null,
      totalReviews: ratingMap.get(emp.id)?.totalReviews ?? 0,
    }));

    // Devolvemos la respuesta paginada estándar (data + metadatos de paginación).
    return buildPaginatedResponse(enriched, total, pagination);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findByUserId(): localiza al empleado a partir del userId de su cuenta. Útil
  // en los endpoints "me" donde el usuario solo conoce su userId.
  // ───────────────────────────────────────────────────────────────────────────
  async findByUserId(userId: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    // "!employee" = "si no se encontró": lanzamos 404.
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    return employee;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): devuelve UN empleado por id (validando que sea del tenant) con
  // sus relaciones cargadas. Casi todos los métodos lo llaman primero para
  // garantizar que el empleado existe y pertenece al negocio.
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        location: true,                                  // sucursal completa
        employeeServices: { include: { service: true } }, // servicios + datos del servicio
        schedules: { orderBy: { dayOfWeek: 'asc' } },    // horarios ordenados
        // Contadores de elementos relacionados (fotos, reseñas, docs, formaciones).
        _count: { select: { portfolioImages: true, reviews: true, documents: true, trainings: true } },
      },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    return employee;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea un empleado, verifica límites de plan y sucursal, y le genera
  // un horario por defecto.
  // ───────────────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateEmployeeDto) {
    // Check plan employee limit
    // Comprueba que el plan contratado permita un empleado más (si no, lanza error).
    await this.planLimitsService.checkEmployeeLimit(tenantId);

    // Verify location belongs to tenant
    // Verificamos que la sucursal indicada exista y sea de este negocio.
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId },
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    // Creamos el registro del empleado.
    const employee = await this.prisma.employee.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        bio: dto.bio,
        // "dto.color ?? '#008080'": si no envían color, usa el teal por defecto.
        color: dto.color ?? '#008080',
        locationId: dto.locationId,
        tenantId,
        // "dto.isActive ?? true": activo por defecto si no se especifica.
        isActive: dto.isActive ?? true,
        userId: dto.userId,
      },
    });

    // Auto-create default schedule: Mon-Sat 09:00-18:00
    // "as const" hace que el arreglo sea de literales fijos (tipos exactos).
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
    // createMany inserta varias filas a la vez. map() genera un renglón por día.
    await this.prisma.employeeSchedule.createMany({
      data: days.map((day) => ({
        employeeId: employee.id,
        dayOfWeek: day,
        // "day !== 'SUNDAY'": trabaja todos los días MENOS el domingo (false).
        isWorking: day !== 'SUNDAY',
        startTime: '09:00',
        endTime: '18:00',
        effectiveFrom: new Date('2020-01-01'), // vigente desde una fecha lejana
      })),
    });

    // Ajustamos la facturación tras crear el empleado (sin await: efecto lateral).
    this.syncSubscriptionEmployeeCount(tenantId);
    return employee;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update(): actualiza datos de un empleado existente.
  // ───────────────────────────────────────────────────────────────────────────
  async update(id: string, tenantId: string, dto: UpdateEmployeeDto) {
    // Garantiza que existe y es del tenant (si no, findOne lanza 404).
    await this.findOne(id, tenantId);
    // Normalize managerId: empty string → null
    // Copiamos el dto. Si "managerId" vino pero está vacío/falsy, lo pasamos a
    // null para guardar "sin jefe" correctamente. ('managerId' in data comprueba
    // que la propiedad esté presente; "!data.managerId" que su valor sea falsy.)
    const data: any = { ...dto };
    if ('managerId' in data && !data.managerId) {
      data.managerId = null;
    }
    const employee = await this.prisma.employee.update({
      where: { id },
      data,
    });
    // Si el update tocó isActive, sincronizamos facturación. "=== false" detecta
    // específicamente que se está DESACTIVANDO (no solo que sea falsy).
    if (dto.isActive !== undefined) {
      const deactivating = dto.isActive === false;
      this.syncSubscriptionEmployeeCount(tenantId, deactivating);
    }
    return employee;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // remove(): "borrado" lógico → marca al empleado como inactivo.
  // ───────────────────────────────────────────────────────────────────────────
  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
    // true = fue una desactivación (para liberar licencia/ajustar facturación).
    this.syncSubscriptionEmployeeCount(tenantId, true);
    return { message: 'Empleado desactivado' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getSchedules(): devuelve los horarios de un empleado, ordenados por día.
  // ───────────────────────────────────────────────────────────────────────────
  async getSchedules(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeSchedule.findMany({
      where: { employeeId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // setSchedules(): reemplaza TODO el horario del empleado. Usa una transacción
  // ($transaction) para que el borrado + creación sea atómico (todo o nada).
  // ───────────────────────────────────────────────────────────────────────────
  async setSchedules(employeeId: string, tenantId: string, dto: SetSchedulesDto) {
    await this.findOne(employeeId, tenantId);

    // $transaction recibe una función con "tx" (cliente transaccional). Todo lo
    // que se haga con "tx" se confirma junto al final o se revierte si algo falla.
    return this.prisma.$transaction(async (tx) => {
      // Primero borramos los horarios actuales del empleado.
      await tx.employeeSchedule.deleteMany({
        where: { employeeId },
      });

      // Insertamos los nuevos. map() transforma cada renglón del DTO en una fila.
      const created = await tx.employeeSchedule.createMany({
        data: dto.schedules.map((s) => ({
          employeeId,
          dayOfWeek: s.dayOfWeek,
          isWorking: s.isWorking,
          // "s.startTime || '09:00'": si viene vacío/undefined, usa 09:00 por defecto.
          startTime: s.startTime || '09:00',
          endTime: s.endTime || '18:00',
          // Ternario: si hay fecha la convertimos a Date; si no, una fecha base.
          effectiveFrom: s.effectiveFrom ? new Date(s.effectiveFrom) : new Date('2020-01-01'),
          // Si hay fin, lo convertimos; si no, undefined (sin caducidad).
          effectiveUntil: s.effectiveUntil ? new Date(s.effectiveUntil) : undefined,
        })),
      });

      // Devolvemos el horario ya guardado, ordenado por día.
      return tx.employeeSchedule.findMany({
        where: { employeeId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getTimeOff(): lista los tiempos libres de un empleado, con filtro opcional
  // por estado (PENDING/APPROVED/REJECTED).
  // ───────────────────────────────────────────────────────────────────────────
  async getTimeOff(employeeId: string, tenantId: string, status?: string) {
    await this.findOne(employeeId, tenantId);
    const where: any = { employeeId };
    // Solo añadimos el filtro de estado si se proporcionó.
    if (status) where.status = status;
    return this.prisma.employeeTimeOff.findMany({
      where,
      orderBy: { startDatetime: 'asc' }, // del más próximo al más lejano
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // addTimeOff(): registra un nuevo tiempo libre para el empleado.
  // ───────────────────────────────────────────────────────────────────────────
  async addTimeOff(
    employeeId: string,
    tenantId: string,
    dto: CreateTimeOffDto,
  ) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeTimeOff.create({
      data: {
        employeeId,
        // parseWallClock: time-off datetimes son wall-clock de la sucursal,
        // mismo tratamiento que startTime de cita.
        startDatetime: parseWallClock(dto.startDatetime),
        endDatetime: parseWallClock(dto.endDatetime),
        reason: dto.reason,
        // "dto.status || 'APPROVED'": si no se indica estado, queda APROBADO
        // (lo añade un admin); cuando lo pide el propio empleado, el controller
        // ya forzó 'PENDING' antes de llamar aquí.
        status: dto.status || 'APPROVED',
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // removeTimeOff(): elimina un registro de tiempo libre concreto.
  // ───────────────────────────────────────────────────────────────────────────
  async removeTimeOff(
    employeeId: string,
    tenantId: string,
    timeOffId: string,
  ) {
    await this.findOne(employeeId, tenantId);
    // Buscamos el registro y comprobamos que pertenezca a ESE empleado.
    const timeOff = await this.prisma.employeeTimeOff.findFirst({
      where: { id: timeOffId, employeeId },
    });
    if (!timeOff) throw new NotFoundException('Registro de tiempo libre no encontrado');

    await this.prisma.employeeTimeOff.delete({ where: { id: timeOffId } });
    return { message: 'Tiempo libre eliminado' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // approveTimeOff(): aprueba una solicitud pendiente. Guarda quién y cuándo.
  // ───────────────────────────────────────────────────────────────────────────
  async approveTimeOff(tenantId: string, employeeId: string, timeOffId: string, userId: string) {
    await this.findOne(employeeId, tenantId);
    const timeOff = await this.prisma.employeeTimeOff.findFirst({
      where: { id: timeOffId, employeeId },
    });
    if (!timeOff) throw new NotFoundException('Registro de tiempo libre no encontrado');
    // "!== 'PENDING'": solo se aprueban las que están pendientes; otra cosa -> 400.
    if (timeOff.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden aprobar solicitudes pendientes');
    }
    return this.prisma.employeeTimeOff.update({
      where: { id: timeOffId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,        // quién aprobó
        approvedAt: new Date(),    // cuándo (ahora)
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // rejectTimeOff(): rechaza una solicitud pendiente, guardando el motivo.
  // ───────────────────────────────────────────────────────────────────────────
  async rejectTimeOff(tenantId: string, employeeId: string, timeOffId: string, userId: string, rejectionReason: string) {
    await this.findOne(employeeId, tenantId);
    const timeOff = await this.prisma.employeeTimeOff.findFirst({
      where: { id: timeOffId, employeeId },
    });
    if (!timeOff) throw new NotFoundException('Registro de tiempo libre no encontrado');
    if (timeOff.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden rechazar solicitudes pendientes');
    }
    return this.prisma.employeeTimeOff.update({
      where: { id: timeOffId },
      data: {
        status: 'REJECTED',
        approvedBy: userId,        // quién gestionó la solicitud
        approvedAt: new Date(),
        rejectionReason,           // motivo del rechazo
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getAllTimeOffs(): tiempos libres de TODO el negocio que se solapen con el
  // rango [startDate, endDate], con datos básicos del empleado.
  // ───────────────────────────────────────────────────────────────────────────
  async getAllTimeOffs(tenantId: string, startDate: string, endDate: string, status?: string) {
    const where: any = {
      employee: { tenantId },  // solo empleados de este negocio
      // SOLAPAMIENTO con el rango: empieza antes (o en) el fin del rango (lte)
      // Y termina después (o en) el inicio del rango (gte). parseRangeBound
      // calcula el límite exacto de inicio/fin del día indicado.
      startDatetime: { lte: parseRangeBound(endDate, 'end') },
      endDatetime: { gte: parseRangeBound(startDate, 'start') },
    };
    if (status) where.status = status;
    return this.prisma.employeeTimeOff.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, color: true },
        },
      },
      orderBy: { startDatetime: 'asc' },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getStats(): calcula un panel de estadísticas del empleado. Lanza muchas
  // consultas EN PARALELO con Promise.all y luego combina los resultados.
  // ───────────────────────────────────────────────────────────────────────────
  async getStats(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);

    const now = new Date(); // instante actual
    // Primer día del mes actual: año y mes de "now", día 1 (para filtrar "este mes").
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Desestructuramos en variables los 12 resultados, EN EL MISMO ORDEN que las
    // 12 consultas dentro del Promise.all de abajo.
    const [
      completedAllTime,      // total de citas completadas (histórico)
      completedThisMonth,    // completadas este mes
      cancelledCount,        // canceladas
      noShowCount,           // no-shows (cliente no asistió)
      totalAppointments,     // total de citas (cualquier estado)
      revenueResult,         // suma de ingresos
      commissionsResult,     // suma de comisiones (histórico)
      commissionsThisMonth,  // suma de comisiones del mes
      topServices,           // servicios más realizados
      upcomingAppointments,  // próximas citas
      ratingResult,          // promedio y nº de reseñas
      topClients,            // clientes que más vienen
    ] = await Promise.all([
      // 1) Citas COMPLETED (todas).
      this.prisma.appointment.count({
        where: { employeeId, tenantId, status: 'COMPLETED' },
      }),
      // 2) Citas COMPLETED de este mes (startTime >= inicio de mes).
      this.prisma.appointment.count({
        where: {
          employeeId,
          tenantId,
          status: 'COMPLETED',
          startTime: { gte: startOfMonth },
        },
      }),
      // 3) Citas CANCELLED.
      this.prisma.appointment.count({
        where: { employeeId, tenantId, status: 'CANCELLED' },
      }),
      // 4) Citas NO_SHOW.
      this.prisma.appointment.count({
        where: { employeeId, tenantId, status: 'NO_SHOW' },
      }),
      // 5) Total de citas (sin filtrar por estado).
      this.prisma.appointment.count({
        where: { employeeId, tenantId },
      }),
      // 6) Ingresos: suma (_sum) del precio snapshot de los items de citas
      //    completadas. "appointment: {...}" filtra por la cita relacionada.
      this.prisma.appointmentItem.aggregate({
        where: {
          employeeId,
          appointment: { tenantId, status: 'COMPLETED' },
        },
        _sum: { priceSnapshot: true },
      }),
      // 7) Comisiones totales: suma del commissionSnapshot (histórico).
      this.prisma.appointmentItem.aggregate({
        where: {
          employeeId,
          appointment: { tenantId, status: 'COMPLETED' },
        },
        _sum: { commissionSnapshot: true },
      }),
      // 8) Comisiones de este mes (añade el filtro startTime >= inicio de mes).
      this.prisma.appointmentItem.aggregate({
        where: {
          employeeId,
          appointment: { tenantId, status: 'COMPLETED', startTime: { gte: startOfMonth } },
        },
        _sum: { commissionSnapshot: true },
      }),
      // 9) Top servicios: agrupa por nombre de servicio, cuenta cuántas veces se
      //    hizo, ordena de mayor a menor (desc) y toma los 5 primeros (take: 5).
      this.prisma.appointmentItem.groupBy({
        by: ['serviceNameSnapshot'],
        where: {
          employeeId,
          appointment: { tenantId, status: 'COMPLETED' },
        },
        _count: { serviceNameSnapshot: true },
        orderBy: { _count: { serviceNameSnapshot: 'desc' } },
        take: 5,
      }),
      // 10) Próximas citas: estados activos (in [...]) y futuras (startTime >= now),
      //     ordenadas por fecha ascendente, las 5 más cercanas, con cliente e items.
      this.prisma.appointment.findMany({
        where: {
          employeeId,
          tenantId,
          status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
          startTime: { gte: now },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          items: {
            select: {
              serviceNameSnapshot: true,
              priceSnapshot: true,
              durationSnapshot: true,
            },
          },
        },
      }),
      // 11) Reseñas: promedio (_avg) y cantidad (_count) de las visibles.
      this.prisma.employeeReview.aggregate({
        where: { employeeId, tenantId, isVisible: true },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      // 12) Top clientes: agrupa por clientId entre citas completadas, cuenta y
      //     toma los 5 que más citas tuvieron.
      this.prisma.appointment.groupBy({
        by: ['clientId'],
        where: { employeeId, tenantId, status: 'COMPLETED' },
        _count: { clientId: true },
        orderBy: { _count: { clientId: 'desc' } },
        take: 5,
      }),
    ]);

    // Fetch top client names
    // El groupBy de clientes solo nos dio IDs; ahora buscamos sus nombres.
    const topClientIds = topClients.map((c) => c.clientId);
    const clientNames = topClientIds.length > 0
      ? await this.prisma.client.findMany({
          where: { id: { in: topClientIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    // Map clientId -> "Nombre Apellido", para resolver el nombre por id luego.
    const clientMap = new Map(clientNames.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));

    // Convertimos los sumatorios a número. "?? 0" cubre el caso de que la suma
    // sea null (cuando no hay filas). Number(...) por si vienen como Decimal.
    const revenue = Number(revenueResult._sum.priceSnapshot ?? 0);
    const totalCommissions = Number(commissionsResult._sum.commissionSnapshot ?? 0);
    const monthCommissions = Number(commissionsThisMonth._sum.commissionSnapshot ?? 0);
    // Tasa de cancelación (%): (canceladas + no-shows) / total * 100, redondeada.
    // Ternario para evitar dividir entre 0 cuando no hay citas (devuelve 0).
    const cancellationRate =
      totalAppointments > 0
        ? Math.round(((cancelledCount + noShowCount) / totalAppointments) * 100)
        : 0;

    // Construimos el objeto final con todas las métricas para el frontend.
    return {
      completedAllTime,
      completedThisMonth,
      cancelledCount,
      noShowCount,
      cancellationRate,
      totalRevenue: revenue,
      // Promedio de rating a 1 decimal; null si no hay reseñas.
      averageRating: ratingResult._avg.rating
        ? Math.round(ratingResult._avg.rating * 10) / 10
        : null,
      totalReviews: ratingResult._count.rating,
      totalCommissions,
      commissionsThisMonth: monthCommissions,
      // map(): transforma cada grupo de servicio a {serviceName, count}.
      topServices: topServices.map((s) => ({
        serviceName: s.serviceNameSnapshot,
        count: s._count.serviceNameSnapshot,
      })),
      // map(): convierte cada top-cliente a {clientName, count}. "|| 'Unknown'"
      // pone un texto por defecto si no encontramos el nombre en el Map.
      topClients: topClients.map((c) => ({
        clientName: clientMap.get(c.clientId) || 'Unknown',
        count: c._count.clientId,
      })),
      upcomingAppointments,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getServices(): lista los servicios asignados al empleado (con su detalle).
  // ───────────────────────────────────────────────────────────────────────────
  async getServices(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeService.findMany({
      where: { employeeId },
      include: { service: true },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // setServices(): sincroniza los servicios del empleado con la lista recibida.
  // Borra los que ya no están, y crea/actualiza (upsert) los enviados. Todo en
  // una transacción para mantener la consistencia.
  // ───────────────────────────────────────────────────────────────────────────
  async setServices(
    employeeId: string,
    tenantId: string,
    services: ServiceConfigDto[],
  ) {
    await this.findOne(employeeId, tenantId);

    return this.prisma.$transaction(async (tx) => {
      // IDs de los servicios que deben quedar asignados.
      const serviceIds = services.map((s) => s.serviceId);

      // Delete services no longer in the list
      // Borramos las asignaciones cuyo serviceId NO esté (notIn) en la lista.
      // El "...(condición ? {...} : {})" añade ese filtro SOLO si hay IDs; si la
      // lista viene vacía, no añade nada (y borra todas las asignaciones).
      await tx.employeeService.deleteMany({
        where: {
          employeeId,
          ...(serviceIds.length > 0
            ? { serviceId: { notIn: serviceIds } }
            : {}),
        },
      });

      // Solo procesamos altas/actualizaciones si llegaron servicios.
      if (services.length > 0) {
        // Validate all services belong to the tenant
        // Verificamos qué servicios de la lista existen y son del negocio.
        const validServices = await tx.service.findMany({
          where: { id: { in: serviceIds }, tenantId },
        });
        // Set de IDs válidos, para comprobar pertenencia rápidamente con .has().
        const validIds = new Set(validServices.map((s) => s.id));

        // Upsert each service with commission/customPrice
        // Recorremos cada servicio enviado.
        for (const svc of services) {
          // Si el servicio no es válido (no pertenece al negocio), lo saltamos.
          if (!validIds.has(svc.serviceId)) continue;
          // Normalizamos el tipo de comisión: solo 'PERCENT' o, por defecto, 'AMOUNT'.
          const commissionType =
            svc.commissionType === 'PERCENT' ? 'PERCENT' : 'AMOUNT';
          // upsert = "actualiza si existe, crea si no". La clave compuesta
          // employeeId_serviceId identifica de forma única la asignación.
          await tx.employeeService.upsert({
            where: {
              employeeId_serviceId: { employeeId, serviceId: svc.serviceId },
            },
            // Si ya existía, actualizamos comisión, tipo y precio personalizado.
            // "?? null" guarda null cuando el valor no vino.
            update: {
              commission: svc.commission ?? null,
              commissionType,
              customPrice: svc.customPrice ?? null,
            },
            // Si no existía, la creamos con los mismos datos.
            create: {
              employeeId,
              serviceId: svc.serviceId,
              commission: svc.commission ?? null,
              commissionType,
              customPrice: svc.customPrice ?? null,
            },
          });
        }
      }

      // Devolvemos la lista final de servicios del empleado, ya sincronizada.
      return tx.employeeService.findMany({
        where: { employeeId },
        include: { service: true },
      });
    });
  }

  // ─── AVATAR ────────────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // updateAvatar(): guarda la nueva URL del avatar del empleado.
  // ───────────────────────────────────────────────────────────────────────────
  async updateAvatar(employeeId: string, tenantId: string, avatarUrl: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { avatarUrl },
    });
  }

  // ─── PORTFOLIO ─────────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // getPortfolio(): devuelve las imágenes del portafolio. De paso, "rellena" el
  // portafolio con fotos de citas (AppointmentPhoto) que aún no estuvieran copiadas.
  // ───────────────────────────────────────────────────────────────────────────
  async getPortfolio(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);

    // Backfill on-the-fly: las fotos subidas en el wizard de cerrar cita
    // (AppointmentPhoto) tambien deben aparecer en el portafolio personal.
    // Para las viejas (subidas antes del auto-copy), o las que fallaron en
    // copiarse, las creamos ahora si no existen ya por imageUrl.
    // Traemos todas las fotos de citas de este empleado/negocio.
    const apptPhotos = await this.prisma.appointmentPhoto.findMany({
      where: { appointment: { employeeId, tenantId } },
      select: { imageUrl: true, caption: true, serviceId: true },
    });

    if (apptPhotos.length > 0) {
      // Lista de URLs de esas fotos.
      const urls = apptPhotos.map((p) => p.imageUrl);
      // Buscamos cuáles de esas URLs YA están en el portafolio.
      const existing = await this.prisma.employeePortfolioImage.findMany({
        where: { employeeId, imageUrl: { in: urls } },
        select: { imageUrl: true },
      });
      // Set con las URLs ya existentes, para comprobar rápido con .has().
      const existingSet = new Set(existing.map((e) => e.imageUrl));
      // filter(): nos quedamos solo con las fotos cuya URL NO existe todavía
      // (!existingSet.has(...) = "no está ya en el portafolio").
      const toCreate = apptPhotos.filter((p) => !existingSet.has(p.imageUrl));
      // Si hay fotos nuevas que copiar, las insertamos de golpe.
      if (toCreate.length > 0) {
        await this.prisma.employeePortfolioImage.createMany({
          data: toCreate.map((p) => ({
            employeeId,
            serviceId: p.serviceId,
            imageUrl: p.imageUrl,
            caption: p.caption,
            isHidden: false,
          })),
        });
      }
    }

    // Include service relation y transformar a shape `services[]` (mismo
    // que devuelve marketplace.getProfessionalProfile, asi el componente
    // de portafolio puede usar el mismo render para ambos contextos).
    // Traemos todas las imágenes del portafolio ya consolidado, ordenadas:
    //   1) destacadas primero (isFeatured desc),
    //   2) por orden manual (sortOrder asc),
    //   3) y por fecha de creación más reciente (createdAt desc).
    const images = await this.prisma.employeePortfolioImage.findMany({
      where: { employeeId },
      include: { service: { select: { id: true, name: true } } },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    // map(): transformamos cada imagen al "shape" que espera el frontend. El
    // servicio se devuelve dentro de un arreglo "services" (vacío si no hay
    // servicio asociado), para reutilizar el mismo componente del marketplace.
    return images.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      caption: img.caption,
      isHidden: img.isHidden,
      isFeatured: img.isFeatured,
      sortOrder: img.sortOrder,
      createdAt: img.createdAt,
      services: img.service ? [{ id: img.service.id, name: img.service.name }] : [],
    }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // addPortfolioImage(): crea una nueva imagen de portafolio.
  // ───────────────────────────────────────────────────────────────────────────
  async addPortfolioImage(
    employeeId: string,
    tenantId: string,
    imageUrl: string,
    caption?: string,
  ) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeePortfolioImage.create({
      data: { employeeId, imageUrl, caption },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // removePortfolioImage(): borra una imagen del portafolio y la devuelve (para
  // que el controller pueda borrar también el archivo físico).
  // ───────────────────────────────────────────────────────────────────────────
  async removePortfolioImage(
    employeeId: string,
    tenantId: string,
    imageId: string,
  ) {
    await this.findOne(employeeId, tenantId);
    const image = await this.prisma.employeePortfolioImage.findFirst({
      where: { id: imageId, employeeId },
    });
    if (!image) throw new NotFoundException('Imagen de portfolio no encontrada');

    await this.prisma.employeePortfolioImage.delete({ where: { id: imageId } });
    return image; // Return so controller can delete the file
  }

  /**
   * Cambia isHidden de una foto del portafolio. true = la foto sigue en
   * el portafolio del empleado pero no se muestra en su perfil publico
   * del marketplace.
   */
  // Cambia el flag isHidden de la imagen tras validar que pertenece al empleado.
  async togglePortfolioVisibility(
    employeeId: string,
    tenantId: string,
    imageId: string,
    isHidden: boolean,
  ) {
    await this.findOne(employeeId, tenantId);
    const image = await this.prisma.employeePortfolioImage.findFirst({
      where: { id: imageId, employeeId },
    });
    if (!image) throw new NotFoundException('Imagen de portafolio no encontrada');
    return this.prisma.employeePortfolioImage.update({
      where: { id: imageId },
      data: { isHidden },
    });
  }

  /**
   * Cambia isFeatured de una foto del portafolio. Las destacadas aparecen
   * primero tanto en el portafolio personal como en el perfil publico.
   */
  // Cambia el flag isFeatured (destacada) tras validar la pertenencia.
  async togglePortfolioFeatured(
    employeeId: string,
    tenantId: string,
    imageId: string,
    isFeatured: boolean,
  ) {
    await this.findOne(employeeId, tenantId);
    const image = await this.prisma.employeePortfolioImage.findFirst({
      where: { id: imageId, employeeId },
    });
    if (!image) throw new NotFoundException('Imagen de portafolio no encontrada');
    return this.prisma.employeePortfolioImage.update({
      where: { id: imageId },
      data: { isFeatured },
    });
  }

  // ─── REVIEWS ───────────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // getReviews(): devuelve las reseñas visibles del empleado + promedio y total.
  // ───────────────────────────────────────────────────────────────────────────
  async getReviews(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);

    // En paralelo: la lista de reseñas y los agregados (promedio/total).
    const [reviews, aggregate] = await Promise.all([
      this.prisma.employeeReview.findMany({
        where: { employeeId, tenantId, isVisible: true },
        orderBy: { createdAt: 'desc' }, // más recientes primero
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          appointment: {
            select: {
              id: true,
              startTime: true,
              items: {
                select: { serviceNameSnapshot: true }, // qué servicios fueron
              },
            },
          },
        },
      }),
      this.prisma.employeeReview.aggregate({
        where: { employeeId, tenantId, isVisible: true },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      reviews,
      // Promedio a 1 decimal; null si no hay reseñas.
      averageRating: aggregate._avg.rating
        ? Math.round(aggregate._avg.rating * 10) / 10
        : null,
      totalReviews: aggregate._count.rating,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // createReview(): crea una reseña validando que la cita exista, esté completada
  // y no tenga ya una reseña. Emite un evento "review.created".
  // ───────────────────────────────────────────────────────────────────────────
  async createReview(
    employeeId: string,
    tenantId: string,
    dto: CreateReviewDto,
  ) {
    await this.findOne(employeeId, tenantId);

    // Validate the appointment exists, belongs to this employee+tenant, and is COMPLETED
    // La cita debe existir, ser de este empleado+negocio+cliente y estar COMPLETED.
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: dto.appointmentId,
        employeeId,
        tenantId,
        clientId: dto.clientId,
        status: 'COMPLETED',
      },
    });

    // Si no cumple alguna de esas condiciones, no se puede reseñar -> 400.
    if (!appointment) {
      throw new BadRequestException(
        'La cita no existe, no está completada, o no pertenece a este empleado/cliente',
      );
    }

    // Check for duplicate review
    // Cada cita admite UNA sola reseña (appointmentId es único). Si ya existe -> 409.
    const existing = await this.prisma.employeeReview.findUnique({
      where: { appointmentId: dto.appointmentId },
    });
    if (existing) {
      throw new ConflictException('Ya existe una reseña para esta cita');
    }

    // Creamos la reseña e incluimos los datos del cliente (para el evento).
    const review = await this.prisma.employeeReview.create({
      data: {
        tenantId,
        employeeId,
        clientId: dto.clientId,
        appointmentId: dto.appointmentId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    // Emitimos un evento de dominio: otras partes del sistema (ej. notificaciones)
    // pueden reaccionar a la creación de la reseña sin acoplarse a este servicio.
    this.eventEmitter.emit('review.created', {
      tenantId,
      reviewId: review.id,
      employeeId,
      rating: review.rating,
      clientName: `${review.client.firstName} ${review.client.lastName}`,
    });
    return review;
  }

  // ─── PERSONAL INFO ──────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // updatePersonalInfo(): actualiza los datos personales/médicos del empleado.
  // ───────────────────────────────────────────────────────────────────────────
  async updatePersonalInfo(
    id: string,
    tenantId: string,
    dto: UpdatePersonalInfoDto,
  ) {
    await this.findOne(id, tenantId);
    return this.prisma.employee.update({
      where: { id },
      data: {
        bloodType: dto.bloodType,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactLastName: dto.emergencyContactLastName,
        emergencyContactPhone: dto.emergencyContactPhone,
        emergencyContactRelation: dto.emergencyContactRelation,
        allergies: dto.allergies,
      },
    });
  }

  // ─── DOCUMENTS ──────────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // getDocuments(): lista los documentos del empleado (más recientes primero).
  // ───────────────────────────────────────────────────────────────────────────
  async getDocuments(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.employeeDocument.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // addDocument(): añade un documento. Si ya hay uno del mismo tipo, lo reemplaza
  // y devuelve la URL antigua para que el controller borre el archivo viejo.
  // ───────────────────────────────────────────────────────────────────────────
  async addDocument(
    id: string,
    tenantId: string,
    fileUrl: string,
    dto: CreateDocumentDto,
  ) {
    await this.findOne(id, tenantId);

    // If a document of this type already exists, replace it
    // Buscamos por la clave compuesta (empleado + tipo de documento): solo puede
    // haber UN documento de cada tipo por empleado.
    const existing = await this.prisma.employeeDocument.findUnique({
      where: {
        employeeId_documentType: {
          employeeId: id,
          documentType: dto.documentType,
        },
      },
    });

    // Si ya existía, lo actualizamos con el nuevo archivo y devolvemos la URL
    // anterior (oldFileUrl) para que el controller la borre del disco.
    if (existing) {
      const updated = await this.prisma.employeeDocument.update({
        where: { id: existing.id },
        data: { fileUrl },
      });
      return { document: updated, oldFileUrl: existing.fileUrl };
    }

    // Si no existía, creamos uno nuevo. oldFileUrl: null = no hay nada que borrar.
    const document = await this.prisma.employeeDocument.create({
      data: {
        employeeId: id,
        documentType: dto.documentType,
        fileUrl,
      },
    });
    return { document, oldFileUrl: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // removeDocument(): borra un documento y lo devuelve (para borrar el archivo).
  // ───────────────────────────────────────────────────────────────────────────
  async removeDocument(id: string, tenantId: string, documentId: string) {
    await this.findOne(id, tenantId);
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, employeeId: id },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.prisma.employeeDocument.delete({ where: { id: documentId } });
    return doc; // Return so controller can delete the file
  }

  // ─── ROLES ──────────────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // getEmployeeRoles(): devuelve los roles del usuario del empleado, con sus
  // permisos aplanados. Si el empleado no tiene cuenta, devuelve listas vacías.
  // ───────────────────────────────────────────────────────────────────────────
  async getEmployeeRoles(id: string, tenantId: string) {
    const employee = await this.findOne(id, tenantId);

    // Sin cuenta de usuario no hay roles que mostrar.
    if (!employee.userId) {
      return { userId: null, roles: [] };
    }

    // Traemos los vínculos usuario↔rol, cargando el rol y, dentro, sus permisos.
    // Es un "include anidado": userRole → role → rolePermissions → permission.
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: employee.userId, tenantId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    return {
      userId: employee.userId,
      // map() externo: por cada rol asignado, construimos un objeto resumido.
      roles: userRoles.map((ur) => ({
        userRoleId: ur.id,
        roleId: ur.role.id,
        roleName: ur.role.name,
        roleSlug: ur.role.slug,
        isSystem: ur.role.isSystem,
        // map() interno: aplanamos cada rolePermission a los datos del permiso.
        permissions: ur.role.rolePermissions.map((rp) => ({
          id: rp.permission.id,
          module: rp.permission.module,
          action: rp.permission.action,
          description: rp.permission.description,
        })),
      })),
    };
  }

  // ─── TRAININGS ──────────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // getTrainings(): lista las formaciones del empleado (más recientes primero).
  // ───────────────────────────────────────────────────────────────────────────
  async getTrainings(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.employeeTraining.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // addTraining(): registra una formación. El archivo (certificado) es opcional.
  // ───────────────────────────────────────────────────────────────────────────
  async addTraining(
    id: string,
    tenantId: string,
    dto: CreateTrainingDto,
    fileUrl?: string,
  ) {
    await this.findOne(id, tenantId);
    return this.prisma.employeeTraining.create({
      data: {
        employeeId: id,
        title: dto.title,
        institution: dto.institution,
        // Ternario: si viene fecha la convertimos a Date; si no, undefined.
        dateCompleted: dto.dateCompleted ? new Date(dto.dateCompleted) : undefined,
        fileUrl,
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // removeTraining(): borra una formación y la devuelve (para borrar su archivo).
  // ───────────────────────────────────────────────────────────────────────────
  async removeTraining(id: string, tenantId: string, trainingId: string) {
    await this.findOne(id, tenantId);
    const training = await this.prisma.employeeTraining.findFirst({
      where: { id: trainingId, employeeId: id },
    });
    if (!training) throw new NotFoundException('Registro de formación no encontrado');

    await this.prisma.employeeTraining.delete({ where: { id: trainingId } });
    return training;
  }

  // ─── DEACTIVATION ────────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // countPendingAppointments(): cuenta las citas FUTURAS aún activas del empleado.
  // El tipo de retorno Promise<number> indica que resuelve a un número.
  // ───────────────────────────────────────────────────────────────────────────
  async countPendingAppointments(employeeId: string, tenantId: string): Promise<number> {
    await this.findOne(employeeId, tenantId);
    return this.prisma.appointment.count({
      where: {
        employeeId,
        tenantId,
        // Estados "vivos" (in [...]) y solo las que aún no han ocurrido (gte ahora).
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // deactivate(): punto de entrada de la desactivación. Según la "action" del
  // DTO, delega en el método especializado correspondiente.
  // ───────────────────────────────────────────────────────────────────────────
  async deactivate(
    employeeId: string,
    tenantId: string,
    dto: DeactivateEmployeeDto,
    userId: string,
  ) {
    const employee = await this.findOne(employeeId, tenantId);

    // Reasignación inteligente (el sistema busca otro empleado libre).
    if (dto.action === DeactivateAction.SMART_RESCHEDULE) {
      return this.deactivateWithSmartReschedule(employee, tenantId, userId);
    }

    // Reasignar a un empleado concreto. "dto.targetEmployeeId!" usa "!" porque
    // el DTO garantiza que viene cuando la acción es REASSIGN.
    if (dto.action === DeactivateAction.REASSIGN) {
      return this.deactivateWithReassign(employee, tenantId, dto.targetEmployeeId!, userId);
    }

    // Cancelar todas las citas pendientes.
    if (dto.action === DeactivateAction.CANCEL) {
      return this.deactivateWithCancel(employee, tenantId, dto.cancelReason, userId);
    }

    // KEEP — just deactivate
    // KEEP: no se toca ninguna cita; solo se marca al empleado como inactivo.
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: false },
    });

    // Registramos la acción en auditoría (quién, qué, sobre qué entidad).
    await this.auditService.log({
      tenantId,
      userId,
      action: 'employee.deactivated',
      entityType: 'employee',
      entityId: employeeId,
      newValues: { action: 'keep' },
    });

    return { message: 'Empleado desactivado', action: 'keep', affectedAppointments: 0 };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // deactivateWithReassign(): reasigna las citas pendientes a un empleado destino
  // concreto. Las que choquen con la agenda del destino quedan como "conflictos"
  // (no se reasignan). "employee: any" porque recibe el empleado ya cargado.
  // ───────────────────────────────────────────────────────────────────────────
  private async deactivateWithReassign(
    employee: any,
    tenantId: string,
    targetEmployeeId: string,
    userId: string,
  ) {
    // No tiene sentido reasignar al mismo empleado que se desactiva.
    if (targetEmployeeId === employee.id) {
      throw new BadRequestException('No se puede reasignar al mismo empleado');
    }

    // El destino debe existir, ser del negocio y estar ACTIVO.
    const target = await this.prisma.employee.findFirst({
      where: { id: targetEmployeeId, tenantId, isActive: true },
    });
    if (!target) {
      throw new NotFoundException('Empleado destino no encontrado o inactivo');
    }

    // Citas futuras activas del empleado que se desactiva (con items y cliente).
    const pendingAppointments = await this.prisma.appointment.findMany({
      where: {
        employeeId: employee.id,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
      include: {
        items: true,
        client: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Pre-fetch target's future appointments for in-memory overlap detection
    // Citas futuras del DESTINO: las traemos para detectar choques en memoria
    // (en vez de consultar la BD una y otra vez por cada cita).
    const targetAppointments = await this.prisma.appointment.findMany({
      where: {
        employeeId: targetEmployeeId,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
    });

    // Dos "cubos": las que se pueden reasignar y las que chocan.
    // "typeof pendingAppointments" reutiliza el tipo de la lista anterior.
    const nonConflicting: typeof pendingAppointments = [];
    const conflicting: Array<{
      appointment: (typeof pendingAppointments)[0];
      conflictsWith: { appointmentId: string; startTime: Date; endTime: Date };
    }> = [];

    // Recorremos cada cita pendiente y decidimos si choca con la agenda destino.
    for (const apt of pendingAppointments) {
      // find(): devuelve la PRIMERA cita del destino que se solape con "apt".
      // Solapamiento: el inicio del otro es antes del fin de apt Y su fin es
      // después del inicio de apt (los intervalos se cruzan).
      const overlap = targetAppointments.find(
        (ta) => ta.startTime < apt.endTime && ta.endTime > apt.startTime,
      );
      if (overlap) {
        // Si hubo choque, la guardamos como conflicto, anotando con qué choca.
        conflicting.push({
          appointment: apt,
          conflictsWith: {
            appointmentId: overlap.id,
            startTime: overlap.startTime,
            endTime: overlap.endTime,
          },
        });
      } else {
        // Si no choca, se puede reasignar.
        nonConflicting.push(apt);
      }
    }

    // Reassign non-conflicting in transaction
    // Reasignamos las no-conflictivas dentro de una transacción Serializable
    // (el nivel más estricto: evita condiciones de carrera al asignar horarios).
    if (nonConflicting.length > 0) {
      await this.prisma.$transaction(
        async (tx) => {
          for (const apt of nonConflicting) {
            // 1) Cambiamos el empleado de la cita al destino.
            await tx.appointment.update({
              where: { id: apt.id },
              data: { employeeId: targetEmployeeId },
            });
            // 2) También en sus items que apuntaban al empleado original.
            await tx.appointmentItem.updateMany({
              where: { appointmentId: apt.id, employeeId: employee.id },
              data: { employeeId: targetEmployeeId },
            });
            // 3) Dejamos rastro en el historial (mismo estado, solo cambia el
            //    empleado; por eso fromStatus === toStatus).
            await tx.appointmentStatusHistory.create({
              data: {
                appointmentId: apt.id,
                fromStatus: apt.status,
                toStatus: apt.status,
                changedBy: userId,
                notes: `Reasignada de ${employee.firstName} ${employee.lastName} a ${target.firstName} ${target.lastName} por desactivación de empleado`,
              },
            });
          }

          // Only deactivate if no conflicts remain
          // Solo desactivamos al empleado si NO quedaron conflictos sin resolver.
          if (conflicting.length === 0) {
            await tx.employee.update({
              where: { id: employee.id },
              data: { isActive: false },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } else if (conflicting.length === 0) {
      // No appointments at all — just deactivate
      // Caso especial: no había NINGUNA cita pendiente → solo desactivar.
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { isActive: false },
      });
    }

    // Post-transaction: audit + events + cache
    // Tras la transacción: auditoría, eventos e invalidación de caché.
    await this.auditService.log({
      tenantId,
      userId,
      action: 'employee.deactivated',
      entityType: 'employee',
      entityId: employee.id,
      newValues: {
        action: 'reassign',
        targetEmployeeId,
        reassignedCount: nonConflicting.length,
        conflictCount: conflicting.length,
      },
    });

    // Por cada cita reasignada, emitimos el evento "cita reagendada" (cambió de
    // empleado), indicando el motivo (desactivación).
    for (const apt of nonConflicting) {
      await this.eventsService.emitAppointmentRescheduled(tenantId, apt.id, {
        oldEmployeeId: employee.id,
        newEmployeeId: targetEmployeeId,
        reason: 'employee_deactivation',
      });
    }

    // Invalidamos la caché de disponibilidad de AMBOS empleados (origen y destino)
    // porque sus agendas cambiaron. Solo si conocemos la sucursal del empleado.
    if (employee.locationId) {
      await this.availabilityService.invalidateCacheForEmployee(tenantId, employee.locationId, employee.id);
      await this.availabilityService.invalidateCacheForEmployee(tenantId, employee.locationId, targetEmployeeId);
    }

    // Respuesta resumen. El mensaje cambia (ternario) según haya o no conflictos.
    return {
      message: conflicting.length === 0
        ? 'Empleado desactivado y citas reasignadas'
        : `${nonConflicting.length} citas reasignadas, ${conflicting.length} con conflicto`,
      action: 'reassign',
      reassignedCount: nonConflicting.length,
      targetEmployeeId,
      // deactivated: true solo si no quedaron conflictos (entonces sí se desactivó).
      deactivated: conflicting.length === 0,
      // map(): por cada conflicto, devolvemos un objeto con sus datos para que el
      // frontend pueda mostrarlos y pedir al admin que los resuelva.
      conflicts: conflicting.map((c) => ({
        id: c.appointment.id,
        // toISOString() convierte las fechas a texto estándar para enviarlas.
        startTime: c.appointment.startTime.toISOString(),
        endTime: c.appointment.endTime.toISOString(),
        status: c.appointment.status,
        clientName: `${c.appointment.client.firstName} ${c.appointment.client.lastName}`,
        // map() anidado: los servicios (items) de esa cita en conflicto.
        services: c.appointment.items.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceNameSnapshot,
          durationMinutes: item.durationSnapshot,
        })),
        // La cita del destino con la que choca.
        conflictsWith: {
          appointmentId: c.conflictsWith.appointmentId,
          startTime: c.conflictsWith.startTime.toISOString(),
          endTime: c.conflictsWith.endTime.toISOString(),
        },
      })),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // deactivateWithCancel(): cancela todas las citas pendientes y desactiva al
  // empleado, todo dentro de una transacción.
  // ───────────────────────────────────────────────────────────────────────────
  private async deactivateWithCancel(
    employee: any,
    tenantId: string,
    cancelReason: string | undefined,
    userId: string,
  ) {
    // Citas futuras activas del empleado.
    const pendingAppointments = await this.prisma.appointment.findMany({
      where: {
        employeeId: employee.id,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
    });

    // Transacción: cancelar cada cita + dejar historial + desactivar empleado.
    await this.prisma.$transaction(async (tx) => {
      for (const apt of pendingAppointments) {
        await tx.appointment.update({
          where: { id: apt.id },
          data: {
            status: 'CANCELLED',
            // "cancelReason || '...'": usa el motivo dado o uno por defecto.
            cancellationReason: cancelReason || 'Cancelada por desactivación de empleado',
            cancelledBy: userId,
          },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: apt.id,
            fromStatus: apt.status,
            toStatus: 'CANCELLED',
            changedBy: userId,
            notes: cancelReason || 'Cancelada por desactivación de empleado',
          },
        });
      }

      // Tras cancelar todo, desactivamos al empleado.
      await tx.employee.update({
        where: { id: employee.id },
        data: { isActive: false },
      });
    });

    // Post-transaction: audit + events + cache
    await this.auditService.log({
      tenantId,
      userId,
      action: 'employee.deactivated',
      entityType: 'employee',
      entityId: employee.id,
      newValues: {
        action: 'cancel',
        affectedAppointments: pendingAppointments.length,
        cancelReason,
      },
    });

    // Por cada cita cancelada, emitimos el evento "cita cancelada".
    for (const apt of pendingAppointments) {
      await this.eventsService.emitAppointmentCancelled(tenantId, apt.id, {
        reason: 'employee_deactivation',
        employeeId: employee.id,
      });
    }

    // Invalidamos la caché de disponibilidad del empleado (su agenda cambió).
    if (employee.locationId) {
      await this.availabilityService.invalidateCacheForEmployee(tenantId, employee.locationId, employee.id);
    }

    return {
      message: 'Empleado desactivado y citas canceladas',
      action: 'cancel',
      affectedAppointments: pendingAppointments.length,
    };
  }

  // ─── SMART RESCHEDULE ────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // deactivateWithSmartReschedule(): por cada cita pendiente, busca AUTOMÁTICAMENTE
  // otro empleado que pueda hacer TODOS sus servicios y esté libre a esa misma
  // hora, y le reasigna la cita. Lo que no logre reasignar queda como conflicto.
  // ───────────────────────────────────────────────────────────────────────────
  private async deactivateWithSmartReschedule(
    employee: any,
    tenantId: string,
    userId: string,
  ) {
    // Citas futuras activas del empleado (con items y cliente).
    const pendingAppointments = await this.prisma.appointment.findMany({
      where: {
        employeeId: employee.id,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
      include: {
        items: true,
        client: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Si no hay citas pendientes, simplemente desactivamos y salimos.
    if (pendingAppointments.length === 0) {
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { isActive: false },
      });
      await this.auditService.log({
        tenantId,
        userId,
        action: 'employee.deactivated',
        entityType: 'employee',
        entityId: employee.id,
        newValues: { action: 'smart_reschedule', total: 0 },
      });
      return {
        message: 'Empleado desactivado (sin citas pendientes)',
        action: 'smart_reschedule',
        reassignedCount: 0,
        deactivated: true,
        reassignments: [],
        conflicts: [],
      };
    }

    // Shadow bookings: track planned assignments to avoid double-assigning same slot
    // "Reservas fantasma": como aún no escribimos en la BD, llevamos en memoria
    // qué franjas ya hemos PLANEADO asignar a cada candidato, para no asignarle
    // dos citas que se solapen en la misma pasada. Map: candidatoId -> franjas.
    const shadowBookings = new Map<string, Array<{ start: Date; end: Date }>>();
    // Plan de reasignaciones: qué cita va a qué empleado destino.
    const reassignmentPlan: Array<{
      appointment: (typeof pendingAppointments)[0];
      targetEmployeeId: string;
      targetEmployeeName: string;
    }> = [];
    // Citas que no se pudieron reasignar (quedan en conflicto).
    const conflicts: Array<(typeof pendingAppointments)[0]> = [];

    // Recorremos cada cita pendiente buscándole un empleado destino.
    for (const apt of pendingAppointments) {
      // IDs de todos los servicios que incluye esta cita.
      const serviceIds = apt.items.map((item) => item.serviceId);

      // Find eligible employees (must have ALL services, active, not the one being deactivated)
      // Candidatos iniciales: activos, distintos del que se desactiva (not), y
      // que ofrezcan AL MENOS UNO de los servicios (some + in). Es un primer filtro.
      const candidates = await this.prisma.employee.findMany({
        where: {
          tenantId,
          isActive: true,
          id: { not: employee.id },
          employeeServices: { some: { serviceId: { in: serviceIds } } },
        },
        include: { employeeServices: true },
      });

      // Filtro estricto: el candidato debe poder hacer TODOS los servicios.
      // filter() recorre candidatos; every() exige que CADA serviceId esté entre
      // los servicios del candidato (some compara cada uno por igualdad ===).
      const eligible = candidates.filter((emp) =>
        serviceIds.every((sid) =>
          emp.employeeServices.some((es: any) => es.serviceId === sid),
        ),
      );

      // Bandera: ¿logramos asignar esta cita?
      let assigned = false;

      // Probamos candidatos en orden hasta encontrar uno libre.
      for (const candidate of eligible) {
        // Check shadow bookings first (planned but not yet in DB)
        // Primero miramos las reservas fantasma ya planeadas para este candidato.
        const shadowBlocks = shadowBookings.get(candidate.id) || [];
        // some(): ¿alguna franja planeada se solapa con esta cita? (mismo criterio
        // de solapamiento: inicio del bloque < fin de apt Y fin del bloque > inicio de apt).
        const hasShadowConflict = shadowBlocks.some(
          (b) => b.start < apt.endTime && b.end > apt.startTime,
        );
        // Si ya teníamos algo planeado que choca, probamos otro candidato.
        if (hasShadowConflict) continue;

        // Check real availability at the exact same time
        // Consultamos la disponibilidad REAL del candidato a esa misma hora.
        const isAvailable = await this.availabilityService.isAvailableAtTime(
          candidate.id,
          apt.startTime,
          apt.endTime,
          tenantId,
        );
        // Si no está libre, siguiente candidato.
        if (!isAvailable) continue;

        // Found a match — register shadow booking and plan assignment
        // ¡Encontramos destino! Registramos la franja en las reservas fantasma...
        const existing = shadowBookings.get(candidate.id) || [];
        existing.push({ start: apt.startTime, end: apt.endTime });
        shadowBookings.set(candidate.id, existing);

        // ...y añadimos la cita al plan de reasignación.
        reassignmentPlan.push({
          appointment: apt,
          targetEmployeeId: candidate.id,
          targetEmployeeName: `${candidate.firstName} ${candidate.lastName}`,
        });
        assigned = true;
        break; // dejamos de buscar candidatos para esta cita
      }

      // Si ningún candidato sirvió, la cita queda en conflicto.
      if (!assigned) {
        conflicts.push(apt);
      }
    }

    // Execute auto-assignments in Serializable transaction
    // Ejecutamos el plan en una transacción Serializable (anti-carrera).
    if (reassignmentPlan.length > 0) {
      await this.prisma.$transaction(
        async (tx) => {
          // Aplicamos cada reasignación planeada.
          for (const plan of reassignmentPlan) {
            const apt = plan.appointment;

            // 1) La cita pasa al destino y se marca como RESCHEDULED.
            await tx.appointment.update({
              where: { id: apt.id },
              data: {
                employeeId: plan.targetEmployeeId,
                status: 'RESCHEDULED',
              },
            });

            // 2) Sus items que apuntaban al empleado original pasan al destino.
            await tx.appointmentItem.updateMany({
              where: { appointmentId: apt.id, employeeId: employee.id },
              data: { employeeId: plan.targetEmployeeId },
            });

            // 3) Historial del cambio de estado.
            await tx.appointmentStatusHistory.create({
              data: {
                appointmentId: apt.id,
                fromStatus: apt.status,
                toStatus: 'RESCHEDULED',
                changedBy: userId,
                notes: `Reasignada automáticamente a ${plan.targetEmployeeName} (mismo horario)`,
              },
            });
          }

          // Only deactivate if no conflicts remain
          // Solo desactivamos si no quedaron conflictos sin resolver.
          if (conflicts.length === 0) {
            await tx.employee.update({
              where: { id: employee.id },
              data: { isActive: false },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } else if (conflicts.length === 0) {
      // No se planeó ninguna reasignación y tampoco hay conflictos → desactivar.
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { isActive: false },
      });
    }

    // Post-transaction: audit + events + cache
    await this.auditService.log({
      tenantId,
      userId,
      action: 'employee.deactivated',
      entityType: 'employee',
      entityId: employee.id,
      newValues: {
        action: 'smart_reschedule',
        reassigned: reassignmentPlan.length,
        conflicts: conflicts.length,
      },
    });

    // Set de IDs de empleados destino afectados (Set evita repetidos), para luego
    // invalidar la caché de disponibilidad de cada uno una sola vez.
    const affectedEmployeeIds = new Set<string>();
    for (const plan of reassignmentPlan) {
      // Evento "cita reagendada" por cada reasignación.
      await this.eventsService.emitAppointmentRescheduled(tenantId, plan.appointment.id, {
        oldEmployeeId: employee.id,
        newEmployeeId: plan.targetEmployeeId,
        reason: 'smart_reschedule',
      });
      affectedEmployeeIds.add(plan.targetEmployeeId);
    }

    // Invalidamos la caché del empleado desactivado y la de cada destino afectado.
    if (employee.locationId) {
      await this.availabilityService.invalidateCacheForEmployee(tenantId, employee.locationId, employee.id);
      for (const empId of affectedEmployeeIds) {
        await this.availabilityService.invalidateCacheForEmployee(tenantId, employee.locationId, empId);
      }
    }

    // Respuesta resumen. El mensaje cambia (ternario) según haya conflictos.
    return {
      message: conflicts.length === 0
        ? `Empleado desactivado. ${reassignmentPlan.length} citas reasignadas`
        : `${reassignmentPlan.length} citas reasignadas, ${conflicts.length} con conflicto`,
      action: 'smart_reschedule',
      reassignedCount: reassignmentPlan.length,
      deactivated: conflicts.length === 0,
      // map(): detalle de cada reasignación lograda (para mostrar al admin).
      reassignments: reassignmentPlan.map((p) => ({
        appointmentId: p.appointment.id,
        clientName: `${p.appointment.client.firstName} ${p.appointment.client.lastName}`,
        // map() anidado: solo los nombres de los servicios de la cita.
        services: p.appointment.items.map((i) => i.serviceNameSnapshot),
        startTime: p.appointment.startTime.toISOString(),
        endTime: p.appointment.endTime.toISOString(),
        newEmployeeId: p.targetEmployeeId,
        newEmployeeName: p.targetEmployeeName,
      })),
      // map(): detalle de las citas que quedaron en conflicto (sin reasignar).
      conflicts: conflicts.map((apt) => ({
        id: apt.id,
        startTime: apt.startTime.toISOString(),
        endTime: apt.endTime.toISOString(),
        status: apt.status,
        clientName: `${apt.client.firstName} ${apt.client.lastName}`,
        services: apt.items.map((i) => ({
          serviceId: i.serviceId,
          serviceName: i.serviceNameSnapshot,
          durationMinutes: i.durationSnapshot,
        })),
      })),
    };
  }

  // ─── FINALIZE DEACTIVATION ────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // finalizeDeactivation(): cierra una desactivación que había quedado pendiente
  // por conflictos (ya resueltos manualmente). Marca al empleado como inactivo.
  // ───────────────────────────────────────────────────────────────────────────
  async finalizeDeactivation(employeeId: string, tenantId: string, userId: string) {
    const employee = await this.findOne(employeeId, tenantId);

    // Si ya estaba inactivo, no hay nada que hacer (idempotente).
    if (!employee.isActive) {
      return { message: 'Empleado ya está desactivado', action: 'finalize' };
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: false },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'employee.deactivated',
      entityType: 'employee',
      entityId: employeeId,
      newValues: { action: 'finalize_after_conflict_resolution' },
    });

    return { message: 'Empleado desactivado', action: 'finalize' };
  }
}
