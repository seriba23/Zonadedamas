// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: marca la clase como servicio inyectable.
//   - Logger: utilidad para escribir mensajes en la consola/registro del servidor
//     (info, advertencias, errores) de forma ordenada y con etiqueta.
//   - NotFoundException: error listo que responde con HTTP 404 (no encontrado).
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
// PrismaService: nuestro puente a la base de datos (ORM Prisma). Con this.prisma
// leemos/escribimos tablas (service, employee, appointment, etc.).
import { PrismaService } from '../../prisma/prisma.service';
// RedisService: capa de caché. Aquí guarda resultados ya calculados de
// disponibilidad para no recalcularlos en cada petición (más rápido).
import { RedisService } from '../../redis/redis.service';
// DTOs que describen la forma de cada consulta (ya validados por el controlador).
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { BundleAvailabilityQueryDto } from './dto/bundle-availability-query.dto';
import { CompositeAvailabilityQueryDto } from './dto/composite-availability-query.dto';
import { CheckAfterDto } from './dto/check-after.dto';
// parseWallClock: utilidad que interpreta una hora "de reloj de pared" (la hora
// tal como la ve el usuario) y la convierte a un objeto Date de forma consistente.
import { parseWallClock } from '../../common/utils/parse-wall-clock';
// crypto: librería de Node para criptografía. Aquí solo se usa para generar un
// "hash" (huella corta) a partir de las asignaciones y construir una clave de caché.
import * as crypto from 'crypto';

// TimeBlock = un "bloque de tiempo" ocupado: tiene un inicio (start) y un fin
// (end), ambos como objetos Date. Se usa para representar citas, descansos, etc.
type TimeBlock = { start: Date; end: Date };

// @Injectable() => marca esta clase como un servicio que NestJS puede inyectar.
@Injectable()
export class AvailabilityService {
  // logger = instancia de Logger etiquetada con el nombre de esta clase, para
  // que los mensajes en consola salgan identificados como "AvailabilityService".
  private readonly logger = new Logger(AvailabilityService.name);

  // INYECCIÓN DE DEPENDENCIAS: NestJS nos pasa automáticamente el acceso a la BD
  // (prisma) y a la caché (redis). Los guardamos como propiedades de solo lectura.
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // getAvailableSlots(): método principal. Dada una consulta (servicios, rango de
  // fechas, opcionalmente empleado y sucursal) y el negocio (tenantId), devuelve
  // los huecos LIBRES agrupados por día y por empleado.
  // Recibe: query (los filtros) y tenantId (el negocio). Devuelve { data: [...] }.
  // ───────────────────────────────────────────────────────────────────────────
  async getAvailableSlots(query: AvailabilityQueryDto, tenantId: string) {
    // 1. Fetch services and calculate total duration
    // Traemos de la BD los servicios pedidos. "id: { in: query.serviceIds }"
    // significa "cuyo id esté DENTRO de esta lista". Además filtramos por tenantId.
    const services = await this.prisma.service.findMany({
      where: { id: { in: query.serviceIds }, tenantId },
    });
    // CRÍTICO: incluir bufferAfterMinutes. El create de appointments lo
    // suma para calcular endTime y validar overlap. Si availability lo
    // omite, un slot puede aparecer libre y al crear caer en conflicto
    // contra la siguiente cita.
    // reduce() recorre la lista de servicios y la "reduce" a un único número:
    //   - "sum" es el acumulador (empieza en 0, ver el 0 del final).
    //   - "s" es cada servicio en cada vuelta.
    //   - En cada vuelta sumamos duración + buffer posterior del servicio.
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );

    // Si la duración total es 0 (no había servicios válidos), no hay nada que
    // calcular: devolvemos lista vacía.
    if (totalDuration === 0) {
      return { data: [] };
    }

    // 2. Resolve employees
    // employees contendrá la lista final de empleados a evaluar.
    let employees: any[];

    // employeeWhere = condiciones base comunes: del negocio y que estén activos.
    const employeeWhere: any = {
      tenantId,
      isActive: true,
    };
    // Si la consulta trae sucursal, añadimos ese filtro al "where".
    if (query.locationId) {
      employeeWhere.locationId = query.locationId;
    }

    if (query.employeeId) {
      // CASO A: pidieron un empleado concreto. Buscamos solo a ese (y que cumpla
      // las condiciones base). "...employeeWhere" copia (spread) esas condiciones.
      const emp = await this.prisma.employee.findFirst({
        where: {
          id: query.employeeId,
          ...employeeWhere,
        },
      });
      // Si no existe o no cumple, devolvemos vacío. Si existe, lista con uno.
      if (!emp) return { data: [] };
      employees = [emp];
    } else {
      // CASO B: no pidieron empleado concreto. Buscamos empleados que ofrezcan
      // TODOS los servicios pedidos.
      // Find employees who offer ALL requested services
      // Primero traemos "candidatos": los que ofrecen AL MENOS UNO de los
      // servicios. "some" en Prisma = "que exista alguna relación que cumpla".
      const candidates = await this.prisma.employee.findMany({
        where: {
          ...employeeWhere,
          employeeServices: {
            some: { serviceId: { in: query.serviceIds } },
          },
        },
        include: { employeeServices: true },
      });

      // Ahora filtramos los candidatos para quedarnos solo con los que ofrecen
      // TODOS los servicios (no solo alguno):
      //   - filter() conserva los empleados que cumplan la condición.
      //   - every() => true solo si CADA serviceId pedido (sid) tiene...
      //   - some()  => ...alguna fila employeeServices (es) cuyo serviceId
      //     coincida (=== compara igualdad exacta de ids).
      employees = candidates.filter((emp) =>
        query.serviceIds.every((sid) =>
          emp.employeeServices.some((es: any) => es.serviceId === sid),
        ),
      );
    }

    // Si tras resolver no quedó ningún empleado, devolvemos vacío.
    if (employees.length === 0) {
      return { data: [] };
    }

    // 3. Fetch tenant, business hours and closures.
    // Para FREELANCER no aplican los businessHours del "negocio" — el
    // freelancer controla su disponibilidad solo con su employeeSchedule.
    // Saltar dias enteros por businessHours haria desaparecer dias en los
    // que el freelancer si trabaja (ej. viernes cerrado por default).
    // Promise.all([...]) lanza las 3 consultas EN PARALELO y espera a que las 3
    // terminen. Con desestructuración guardamos los resultados en tenant,
    // businessHours y closures (en ese orden).
    const [tenant, businessHours, closures] = await Promise.all([
      // tenant: solo necesitamos su tipo (FREELANCER o negocio).
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { tenantType: true },
      }),
      // businessHours: el horario semanal del negocio (qué días abre/cierra).
      this.prisma.businessHours.findMany({
        where: { tenantId },
      }),
      // closures: cierres temporales (vacaciones, feriados) que SOLAPEN el rango.
      // "lte" = menor o igual, "gte" = mayor o igual. La condición busca cierres
      // cuyo inicio sea <= al fin del rango y cuyo fin sea >= al inicio del rango
      // (es decir, que se crucen con el rango consultado).
      this.prisma.businessClosure.findMany({
        where: {
          tenantId,
          startDate: { lte: new Date(query.endDate + 'T23:59:59Z') },
          endDate: { gte: new Date(query.startDate + 'T00:00:00Z') },
        },
      }),
    ]);

    // Build set of days the business is closed. Vacio para freelancer.
    // Un Set es una colección sin duplicados con búsqueda rápida (.has()).
    // Operador ternario "condición ? a : b":
    //   - Si el tenant es FREELANCER, usamos lista vacía [] (no aplican horarios
    //     del negocio: el freelancer manda con su propio employeeSchedule).
    //   - Si no, tomamos los días que NO abren: filter(!h.isOpen) los conserva,
    //     y .map(h => h.dayOfWeek) extrae solo el nombre del día.
    const businessClosedDays = new Set(
      tenant?.tenantType === 'FREELANCER'
        ? []
        : businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek),
    );

    // 4. Iterate over date range
    // results = lista final: un elemento por día con empleados y sus slots.
    const results: Array<{
      date: string;
      employees: Array<{
        id: string;
        name: string;
        slots: Array<{ startTime: string; endTime: string }>;
      }>;
    }> = [];

    // Convertimos los textos de fecha a Date (a medianoche UTC).
    const startDate = new Date(query.startDate + 'T00:00:00Z');
    const endDate = new Date(query.endDate + 'T00:00:00Z');

    // BUCLE FOR sobre cada día del rango:
    //   - "date" empieza en startDate.
    //   - sigue mientras date <= endDate.
    //   - date.setDate(date.getDate() + 1) avanza un día en cada vuelta.
    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      // dateStr = la fecha en texto "YYYY-MM-DD". toISOString() da algo como
      // "2026-06-23T00:00:00.000Z" y .split('T')[0] toma la parte antes de la "T".
      const dateStr = date.toISOString().split('T')[0];

      // Skip days the business is closed (weekly schedule)
      // Saltamos los días que el negocio cierra según su horario semanal.
      // "continue" salta al siguiente día del bucle sin procesar este.
      const dayOfWeekForDate = this.getDayOfWeek(date);
      if (businessClosedDays.has(dayOfWeekForDate)) continue;

      // Skip temporary closure days
      // ¿Este día cae dentro de algún cierre temporal?
      // some() => true si ALGÚN cierre (c) cumple la condición. Comparamos las
      // fechas como texto "YYYY-MM-DD" (>= y <= funcionan bien en ese formato).
      const isClosed = closures.some((c) => {
        const cStart = c.startDate.toISOString().split('T')[0];
        const cEnd = c.endDate.toISOString().split('T')[0];
        return dateStr >= cStart && dateStr <= cEnd;
      });
      if (isClosed) continue;
      // dayEmployees = empleados (con slots) disponibles ESTE día concreto.
      const dayEmployees: Array<{
        id: string;
        name: string;
        slots: Array<{ startTime: string; endTime: string }>;
      }> = [];

      // Recorremos cada empleado para calcular sus slots de este día.
      for (const employee of employees) {
        // IMPORTANTE: la duracion total entra a la cache key. Antes faltaba
        // y causaba que slots cacheados con 1 servicio (ej. 30min) se
        // devolvieran al pedir 2 servicios (ej. 90min), mostrando slots
        // que no caben en el horario real.
        // cacheKey = clave única para guardar/leer en caché el resultado de
        // ESTE empleado, ESTE día y ESTA duración. "query.locationId || 'all'":
        // si no hay sucursal usa el texto 'all'.
        const cacheKey = `avail:${tenantId}:${query.locationId || 'all'}:${employee.id}:${dateStr}:${totalDuration}`;

        try {
          // Intentamos leer de caché. Si hay algo (cached !== null), lo usamos.
          const cached = await this.redis.get(cacheKey);
          if (cached !== null) {
            // JSON.parse convierte el texto guardado de vuelta a un arreglo.
            const slots = JSON.parse(cached) as Array<{
              startTime: string;
              endTime: string;
            }>;
            // Solo añadimos el empleado si tiene al menos un slot.
            if (slots.length > 0) {
              dayEmployees.push({
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName}`,
                slots,
              });
            }
            // "continue" pasa al siguiente empleado (ya resolvimos por caché).
            continue;
          }
        } catch (err) {
          // Si la caché falla, no rompemos: solo dejamos una advertencia en log
          // y seguimos calculando a mano más abajo.
          this.logger.warn(`Redis cache miss for ${cacheKey}`);
        }

        // Get schedule for this specific day
        // Buscamos el horario laboral del empleado para este día de la semana.
        const dayOfWeek = this.getDayOfWeek(date);
        const schedule = await this.prisma.employeeSchedule.findFirst({
          where: {
            employeeId: employee.id,
            dayOfWeek,
            isWorking: true,
            // effectiveFrom <= date: el horario ya está vigente en esta fecha.
            effectiveFrom: { lte: date },
            // OR: el horario aún no expiró. Vale si effectiveUntil es null (sin
            // fecha de fin) O si su fin es >= a la fecha consultada.
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
          },
        });

        // Si no trabaja ese día, cacheamos "[]" (5 min) y pasamos al siguiente.
        // .catch(() => {}) ignora cualquier error de la caché silenciosamente.
        if (!schedule) {
          await this.redis.set(cacheKey, '[]', 300).catch(() => {});
          continue;
        }

        // Get occupied blocks for this day
        // Límites del día (00:00:00 a 23:59:59) para buscar lo que lo ocupa.
        const dayStart = new Date(`${dateStr}T00:00:00Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59Z`);

        // En paralelo, traemos: las citas del empleado ese día y sus permisos/
        // ausencias (time-offs).
        const [appointments, timeOffs] = await Promise.all([
          this.prisma.appointment.findMany({
            where: {
              employeeId: employee.id,
              tenantId,
              // startTime entre el inicio (>=) y el fin (<) del día.
              startTime: { gte: dayStart, lt: dayEnd },
              // notIn = "que NO esté en esta lista": ignoramos canceladas/no-show.
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
            // Ordenadas por hora de inicio ascendente (de antes a después).
            orderBy: { startTime: 'asc' },
          }),
          this.prisma.employeeTimeOff.findMany({
            where: {
              employeeId: employee.id,
              // Una ausencia cuenta si EMPIEZA antes del fin del día y TERMINA
              // después del inicio del día (es decir, solapa el día).
              startDatetime: { lt: dayEnd },
              endDatetime: { gt: dayStart },
            },
          }),
        ]);

        // Build occupied blocks with buffers
        // occupiedBlocks = bloques de tiempo "ocupados" que hay que evitar.
        const occupiedBlocks: TimeBlock[] = [];

        // Por cada cita, creamos un bloque ocupado ampliado con los "buffers"
        // (tiempo de margen antes/después). getTime() da milisegundos; restamos/
        // sumamos minutos * 60000 (1 minuto = 60000 ms).
        for (const appt of appointments) {
          occupiedBlocks.push({
            start: new Date(
              appt.startTime.getTime() -
                employee.bufferBeforeMinutes * 60000,
            ),
            end: new Date(
              appt.endTime.getTime() + employee.bufferAfterMinutes * 60000,
            ),
          });
        }

        // Por cada ausencia, agregamos su intervalo tal cual como bloque ocupado.
        for (const to of timeOffs) {
          occupiedBlocks.push({
            start: to.startDatetime,
            end: to.endDatetime,
          });
        }

        // Sort and merge blocks
        // Ordenamos los bloques por inicio. sort con (a,b) => a-b: si el
        // resultado es negativo, "a" va antes que "b" (orden ascendente).
        occupiedBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
        // Fusionamos bloques que se solapan/tocan en uno solo (ver mergeBlocks).
        const merged = this.mergeBlocks(occupiedBlocks);

        // Generate time slots
        // Generamos los huecos libres entre el horario y los bloques ocupados.
        // El último argumento (30) es la granularidad: pasos de 30 minutos.
        const slots = this.generateSlots(
          schedule.startTime as string,
          schedule.endTime as string,
          dateStr,
          merged,
          totalDuration,
          30, // granularity in minutes
        );

        // Cache result (5 minutes TTL)
        // Guardamos el resultado en caché por 300 segundos (5 minutos).
        await this.redis.set(cacheKey, JSON.stringify(slots), 300).catch(() => {});

        // Solo añadimos el empleado al día si tiene algún slot libre.
        if (slots.length > 0) {
          dayEmployees.push({
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            slots,
          });
        }
      }

      // Solo añadimos el día al resultado si algún empleado tiene disponibilidad.
      if (dayEmployees.length > 0) {
        results.push({ date: dateStr, employees: dayEmployees });
      }
    }

    // Devolvemos todos los días con disponibilidad.
    return { data: results };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // invalidateCache(): borra de la caché los resultados de disponibilidad
  // afectados cuando una cita cambia (se crea/cancela/mueve). Así la próxima
  // consulta recalcula con datos frescos. Devuelve Promise<void> (no devuelve dato).
  // ───────────────────────────────────────────────────────────────────────────
  async invalidateCache(
    tenantId: string,
    locationId: string,
    employeeId: string,
    date: string,
  ): Promise<void> {
    // El cache key usa locationId real cuando se filtra por location, o
    // "all" cuando no. Para invalidar correctamente desde el create de
    // appointment (que pasa locationId real), usamos wildcard tambien en
    // la posicion de location, asi matcheamos la key con "all" ademas de
    // la del propio locationId. Tambien wildcard al final por totalDuration.
    // El "*" es un comodín (wildcard): coincide con cualquier valor en esa parte.
    const pattern = `avail:${tenantId}:*:${employeeId}:${date}:*`;
    // delPattern borra todas las claves que coincidan con el patrón. .catch
    // ignora errores de caché silenciosamente.
    await this.redis.delPattern(pattern).catch(() => {});
    // Composite no incluye employeeId en el key (incluye un hash del
    // mapping), asi que cuando cualquier cita del tenant cambia tenemos
    // que limpiar todas las composites del tenant para ser conservadores.
    await this.redis.delPattern(`composite:${tenantId}:*`).catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // invalidateCacheForEmployee(): variante que borra TODA la caché de un
  // empleado (todas sus fechas). Se usa cuando cambia su horario, por ejemplo.
  // ───────────────────────────────────────────────────────────────────────────
  async invalidateCacheForEmployee(
    tenantId: string,
    locationId: string,
    employeeId: string,
  ): Promise<void> {
    // Patrón con "*" al final: todas las fechas/duraciones de ese empleado.
    const pattern = `avail:${tenantId}:${locationId}:${employeeId}:*`;
    await this.redis.delPattern(pattern).catch(() => {});
    await this.redis.delPattern(`composite:${tenantId}:*`).catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getDayOfWeek(): traduce un objeto Date al NOMBRE del día de la semana en
  // mayúsculas e inglés (como lo espera la BD). Es "private" (solo uso interno).
  // ───────────────────────────────────────────────────────────────────────────
  private getDayOfWeek(date: Date): 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY' {
    // Arreglo donde el índice coincide con lo que devuelve getUTCDay():
    // 0=SUNDAY, 1=MONDAY ... 6=SATURDAY.
    const days: ('SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY')[] = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    // getUTCDay() devuelve 0-6; lo usamos como índice del arreglo.
    return days[date.getUTCDay()];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // mergeBlocks(): recibe una lista de bloques ocupados YA ORDENADA por inicio
  // y fusiona los que se solapan o se tocan en bloques únicos más grandes.
  // Ej.: [9:00-10:00] y [9:30-11:00] se convierten en [9:00-11:00].
  // ───────────────────────────────────────────────────────────────────────────
  private mergeBlocks(blocks: TimeBlock[]): TimeBlock[] {
    // Sin bloques, no hay nada que fusionar.
    if (blocks.length === 0) return [];

    // merged empieza con una COPIA del primer bloque. "{ ...blocks[0] }" copia
    // sus propiedades (spread) para no modificar el original por accidente.
    const merged: TimeBlock[] = [{ ...blocks[0] }];

    // Recorremos desde el segundo bloque (i=1) en adelante.
    for (let i = 1; i < blocks.length; i++) {
      const current = blocks[i];           // bloque actual
      const last = merged[merged.length - 1]; // último bloque ya fusionado

      // Si el actual EMPIEZA antes o justo al terminar el último, se solapan/tocan.
      if (current.start <= last.end) {
        // Extendemos el fin del último solo si el actual termina más tarde.
        if (current.end > last.end) {
          last.end = current.end;
        }
        // (Si current.end <= last.end, el actual está contenido: no hacemos nada.)
      } else {
        // No se solapan: el actual es un bloque nuevo e independiente.
        merged.push({ ...current });
      }
    }

    return merged;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getAllSlotsForEmployee(): devuelve TODOS los slots de un empleado en un día
  // (libres y ocupados), cada uno marcado con available: true/false. A diferencia
  // de getAvailableSlots, aquí la granularidad es de 15 min y NO se cachea.
  // Recibe: empleado, fecha, servicios y negocio. Devuelve { scheduleStart,
  // scheduleEnd, slots, [closureReason] }.
  // ───────────────────────────────────────────────────────────────────────────
  async getAllSlotsForEmployee(
    employeeId: string,
    date: string,
    serviceIds: string[],
    tenantId: string,
  ) {
    // 1a. Check if business is closed on this day of the week
    // ¿El negocio cierra ese día de la semana según su horario semanal?
    const dateObj2 = new Date(date + 'T00:00:00Z');
    const dayOfWeekForDate = this.getDayOfWeek(dateObj2);
    const businessHour = await this.prisma.businessHours.findFirst({
      where: { tenantId, dayOfWeek: dayOfWeekForDate },
    });
    // Si hay registro de horario para ese día Y marca cerrado (!isOpen),
    // devolvemos sin slots y con un motivo de cierre.
    if (businessHour && !businessHour.isOpen) {
      return { scheduleStart: null, scheduleEnd: null, slots: [], closureReason: 'Negocio cerrado este día' };
    }

    // 1b. Check if business has a temporary closure on this date
    // ¿Hay un cierre temporal (vacaciones/feriado) que cubra esta fecha?
    const closure = await this.prisma.businessClosure.findFirst({
      where: {
        tenantId,
        startDate: { lte: new Date(date + 'T23:59:59Z') },
        endDate: { gte: new Date(date + 'T00:00:00Z') },
      },
    });
    if (closure) {
      // Devolvemos el motivo del cierre que escribió el negocio.
      return { scheduleStart: null, scheduleEnd: null, slots: [], closureReason: closure.reason };
    }

    // 2. Fetch services and calculate total duration
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });
    // CRÍTICO: incluir bufferAfterMinutes para mantener paridad con el
    // cálculo de endTime en appointments.service.create. Sin esto, un
    // slot puede aparecer libre y al confirmar entrar en conflicto.
    // (Mismo reduce que en getAvailableSlots: suma duración + buffer.)
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );

    if (totalDuration === 0) {
      return { scheduleStart: null, scheduleEnd: null, slots: [] };
    }

    // 3. Get employee
    // Traemos al empleado (debe existir, ser del negocio y estar activo).
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, isActive: true },
    });
    if (!employee) {
      return { scheduleStart: null, scheduleEnd: null, slots: [] };
    }

    // 4. Get schedule for this day
    // Horario del empleado para este día (vigente y trabajando).
    const dateObj = new Date(date + 'T00:00:00Z');
    const dayOfWeek = this.getDayOfWeek(dateObj);
    const schedule = await this.prisma.employeeSchedule.findFirst({
      where: {
        employeeId,
        dayOfWeek,
        isWorking: true,
        effectiveFrom: { lte: dateObj },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: dateObj } }],
      },
    });

    // Si no trabaja ese día, no hay slots.
    if (!schedule) {
      return { scheduleStart: null, scheduleEnd: null, slots: [] };
    }

    // 4. Get occupied blocks
    // Límites del día y consulta paralela de citas y ausencias (igual que antes).
    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59Z`);

    const [appointments, timeOffs] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          employeeId,
          tenantId,
          startTime: { gte: dayStart, lt: dayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.employeeTimeOff.findMany({
        where: {
          employeeId,
          startDatetime: { lt: dayEnd },
          endDatetime: { gt: dayStart },
        },
      }),
    ]);

    // Construimos bloques ocupados: citas (con buffers) + ausencias.
    const occupiedBlocks: TimeBlock[] = [];
    for (const appt of appointments) {
      occupiedBlocks.push({
        start: new Date(appt.startTime.getTime() - employee.bufferBeforeMinutes * 60000),
        end: new Date(appt.endTime.getTime() + employee.bufferAfterMinutes * 60000),
      });
    }
    for (const to of timeOffs) {
      occupiedBlocks.push({ start: to.startDatetime, end: to.endDatetime });
    }

    // Ordenar por inicio y fusionar solapados.
    occupiedBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
    const merged = this.mergeBlocks(occupiedBlocks);

    // 5. Generate ALL slots marking availability
    // granularity = paso entre slots (15 minutos).
    const granularity = 15;
    // scheduleStart/End = horas del horario en texto ("09:00", "18:00").
    const scheduleStart = schedule.startTime as string;
    const scheduleEnd = schedule.endTime as string;
    // windowStart/End = esas horas como Date dentro de este día.
    const windowStart = new Date(`${date}T${scheduleStart}:00Z`);
    const windowEnd = new Date(`${date}T${scheduleEnd}:00Z`);

    // slots = lista de TODOS los huecos (libres y ocupados).
    const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
    // current = hora de inicio del slot que estamos evaluando.
    let current = new Date(windowStart);

    // BUCLE WHILE: avanza mientras el slot (current + duración) quepa antes del
    // cierre (windowEnd). Comparamos en milisegundos.
    while (current.getTime() + totalDuration * 60000 <= windowEnd.getTime()) {
      // slotEnd = fin de este slot (inicio + duración).
      const slotEnd = new Date(current.getTime() + totalDuration * 60000);
      // conflict = ¿este slot pisa algún bloque ocupado?
      let conflict = false;

      // Revisamos cada bloque ocupado. Regla de solapamiento de intervalos:
      // chocan si "mi inicio < su fin" Y "mi fin > su inicio".
      for (const block of merged) {
        if (current < block.end && slotEnd > block.start) {
          conflict = true;
          break; // basta un choque; salimos del bucle interno.
        }
      }

      // Agregamos el slot SIEMPRE (también los ocupados), con su estado.
      // .substring(11, 16) de "2026-06-23T09:30:00.000Z" toma "09:30" (la hora).
      slots.push({
        startTime: current.toISOString().substring(11, 16),
        endTime: slotEnd.toISOString().substring(11, 16),
        available: !conflict, // disponible solo si NO hubo conflicto.
      });

      // Avanzamos 15 minutos para el siguiente slot.
      current = new Date(current.getTime() + granularity * 60000);
    }

    return { scheduleStart, scheduleEnd, slots };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // checkAfterTime(): dado un empleado, unos servicios y una hora (afterTime),
  // responde si puede atender JUSTO a esa hora (immediatelyAvailable) y, si no,
  // cuál es el siguiente hueco disponible (nextAvailable). Busca hoy y, si hace
  // falta, en los próximos 14 días. Se usa para "añadir un servicio después".
  // ───────────────────────────────────────────────────────────────────────────
  async checkAfterTime(dto: CheckAfterDto, tenantId: string) {
    // 1. Calculate total duration of requested services
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds }, tenantId },
    });
    // Incluye buffer para coincidir con el cálculo de endTime en create.
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );
    // Sin duración válida, no hay nada disponible.
    if (totalDuration === 0) {
      return {
        immediatelyAvailable: false,
        immediateSlot: null,
        nextAvailable: null,
      };
    }

    // afterTime = la hora a partir de la cual buscamos (interpretada como hora
    // de reloj de pared). afterDateStr = solo la fecha "YYYY-MM-DD" de esa hora.
    const afterTime = parseWallClock(dto.afterTime);
    const afterDateStr = afterTime.toISOString().split('T')[0];

    // 2. Direct conflict check: see if the slot right after the appointment is free
    //    This works even if the employee has no formal schedule (e.g., admin-created appointment).
    // proposedEnd = fin del servicio si empezara justo a afterTime.
    const proposedEnd = new Date(afterTime.getTime() + totalDuration * 60000);
    const dayStart = new Date(`${afterDateStr}T00:00:00Z`);
    const dayEnd = new Date(`${afterDateStr}T23:59:59Z`);

    // Traemos las citas activas del empleado ese día (posibles conflictos).
    const conflictingAppointments = await this.prisma.appointment.findMany({
      where: {
        employeeId: dto.employeeId,
        tenantId,
        startTime: { gte: dayStart, lt: dayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      orderBy: { startTime: 'asc' },
    });

    // Buscamos al empleado para conocer sus buffers. Si no existe, usamos 0.
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, isActive: true },
    });
    // "employee?.bufferAfterMinutes || 0": el "?." evita error si employee es
    // null; el "|| 0" usa 0 si el buffer fuera null/undefined/0.
    const bufferAfter = employee?.bufferAfterMinutes || 0;
    const bufferBefore = employee?.bufferBeforeMinutes || 0;

    // Build occupied blocks — exclude any appointment that ends at or before afterTime
    // (i.e., the appointment we're extending). Only FUTURE appointments can conflict.
    const occupiedBlocks: TimeBlock[] = [];
    for (const appt of conflictingAppointments) {
      // Si la cita TERMINA antes o justo cuando empezamos, no estorba: la saltamos.
      if (new Date(appt.endTime) <= afterTime) continue; // ends before/at our start → no conflict
      occupiedBlocks.push({
        start: new Date(appt.startTime.getTime() - bufferBefore * 60000),
        end: new Date(appt.endTime.getTime() + bufferAfter * 60000),
      });
    }
    const merged = this.mergeBlocks(occupiedBlocks);

    // Check if the slot [afterTime, afterTime + totalDuration] is free of conflicts
    // ¿Choca el rango propuesto con algún bloque ocupado?
    const directSlotStart = afterTime;
    const directSlotEnd = proposedEnd;
    let directConflict = false;
    for (const block of merged) {
      if (directSlotStart < block.end && directSlotEnd > block.start) {
        directConflict = true;
        break;
      }
    }

    // Si NO hay conflicto directo: está disponible inmediatamente a afterTime.
    if (!directConflict) {
      const startStr = afterTime.toISOString().substring(11, 16);
      const endStr = proposedEnd.toISOString().substring(11, 16);
      return {
        immediatelyAvailable: true,
        immediateSlot: {
          startTime: `${afterDateStr}T${startStr}:00Z`,
          endTime: `${afterDateStr}T${endStr}:00Z`,
        },
        nextAvailable: null,
      };
    }

    // 3. Try schedule-based slot search for same day (finds next gap)
    // Había conflicto: buscamos el siguiente hueco del MISMO día usando el
    // método que respeta el horario formal.
    const sameDayResult = await this.getAllSlotsForEmployee(
      dto.employeeId,
      afterDateStr,
      dto.serviceIds,
      tenantId,
    );

    if (sameDayResult.slots && sameDayResult.slots.length > 0) {
      const afterTimeStr = afterTime.toISOString().substring(11, 16);
      // Find a slot that starts at or after the requested time
      // find() devuelve el PRIMER slot que cumpla: que esté libre (s.available)
      // Y empiece a la hora pedida o después (s.startTime >= afterTimeStr).
      const immediateSlot = sameDayResult.slots.find(
        (s) => s.available && s.startTime >= afterTimeStr,
      );
      if (immediateSlot) {
        // isImmediate = ¿ese hueco empieza EXACTAMENTE a la hora pedida?
        const isImmediate = immediateSlot.startTime === afterTimeStr;
        return {
          immediatelyAvailable: isImmediate,
          immediateSlot: {
            startTime: `${afterDateStr}T${immediateSlot.startTime}:00Z`,
            endTime: `${afterDateStr}T${immediateSlot.endTime}:00Z`,
          },
          // Ternario: si era inmediato no hace falta "siguiente"; si no, damos el
          // siguiente hueco encontrado como nextAvailable.
          nextAvailable: isImmediate
            ? null
            : {
                date: afterDateStr,
                startTime: immediateSlot.startTime,
                endTime: immediateSlot.endTime,
              },
        };
      }
    }

    // 4. Search next 14 days for first available slot
    // No había hueco hoy: empezamos a buscar desde el día siguiente.
    const searchStart = new Date(afterTime);
    searchStart.setUTCDate(searchStart.getUTCDate() + 1);

    // Recorremos hasta 14 días buscando el primer hueco libre.
    for (let i = 0; i < 14; i++) {
      const searchDate = new Date(searchStart);
      searchDate.setUTCDate(searchDate.getUTCDate() + i);
      const searchDateStr = searchDate.toISOString().split('T')[0];

      const dayResult = await this.getAllSlotsForEmployee(
        dto.employeeId,
        searchDateStr,
        dto.serviceIds,
        tenantId,
      );

      if (dayResult.slots && dayResult.slots.length > 0) {
        // find() => el primer slot libre de ese día (s.available === true).
        const firstAvailable = dayResult.slots.find((s) => s.available);
        if (firstAvailable) {
          return {
            immediatelyAvailable: false,
            immediateSlot: null,
            nextAvailable: {
              date: searchDateStr,
              startTime: firstAvailable.startTime,
              endTime: firstAvailable.endTime,
            },
          };
        }
      }
    }

    // 5. Nothing found in 14 days
    // Ni hoy ni en 14 días: no hay disponibilidad.
    return {
      immediatelyAvailable: false,
      immediateSlot: null,
      nextAvailable: null,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // isAvailableAtTime(): comprueba si un empleado está libre en un intervalo
  // exacto [startTime, endTime]. Devuelve Promise<boolean>: true si está libre,
  // false si no. Hace 3 chequeos: horario, citas que solapan, ausencias.
  // ───────────────────────────────────────────────────────────────────────────
  async isAvailableAtTime(
    employeeId: string,
    startTime: Date,
    endTime: Date,
    tenantId: string,
  ): Promise<boolean> {
    // Fecha (texto) y día de la semana del inicio.
    const dateStr = startTime.toISOString().split('T')[0];
    const dayOfWeek = this.getDayOfWeek(new Date(dateStr + 'T00:00:00Z'));

    // Check employee works this day
    // 1) ¿Trabaja ese día? (horario vigente y isWorking).
    const schedule = await this.prisma.employeeSchedule.findFirst({
      where: {
        employeeId,
        dayOfWeek,
        isWorking: true,
        effectiveFrom: { lte: new Date(dateStr + 'T00:00:00Z') },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date(dateStr + 'T00:00:00Z') } }],
      },
    });
    // Si no trabaja, no está disponible.
    if (!schedule) return false;

    // Check time is within schedule window
    // 2) ¿El intervalo pedido cabe dentro de su horario? Si empieza antes de la
    // apertura O termina después del cierre, no cabe.
    const schedStart = new Date(`${dateStr}T${schedule.startTime}:00Z`);
    const schedEnd = new Date(`${dateStr}T${schedule.endTime}:00Z`);
    if (startTime < schedStart || endTime > schedEnd) return false;

    // Check no overlapping appointments
    // 3a) ¿Hay alguna cita que solape? Solapa si empieza antes de mi fin (lt:
    // endTime) y termina después de mi inicio (gt: startTime).
    const overlap = await this.prisma.appointment.findFirst({
      where: {
        employeeId,
        tenantId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (overlap) return false;

    // Check no time-offs
    // 3b) ¿Hay alguna ausencia (time-off) que solape el intervalo?
    const timeOff = await this.prisma.employeeTimeOff.findFirst({
      where: {
        employeeId,
        startDatetime: { lt: endTime },
        endDatetime: { gt: startTime },
      },
    });
    if (timeOff) return false;

    // Pasó los 3 chequeos: está disponible.
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findEarliestSlot(): busca el PRIMER hueco libre de un empleado a partir de
  // afterTime, durante hasta maxDays días. Devuelve {startTime, endTime} o null
  // si no encuentra nada. Parámetros opcionales:
  //   - extraOccupied: bloques extra a considerar ocupados (ej. reservas
  //     "fantasma" que aún no están en BD, en un proceso de reserva en curso).
  //   - maxDays: cuántos días buscar hacia adelante (por defecto 30).
  // ───────────────────────────────────────────────────────────────────────────
  async findEarliestSlot(
    employeeId: string,
    totalDuration: number,
    afterTime: Date,
    tenantId: string,
    extraOccupied?: Array<{ start: Date; end: Date }>,
    maxDays: number = 30,
  ): Promise<{ startTime: Date; endTime: Date } | null> {
    // Sin duración no hay slot que buscar.
    if (totalDuration === 0) return null;

    // El empleado debe existir y estar activo.
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, isActive: true },
    });
    if (!employee) return null;

    // now = instante actual (usado para no devolver slots en el pasado).
    const now = new Date();

    // En paralelo: tipo de tenant, horario semanal y cierres futuros.
    const [tenant, businessHours, closures] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { tenantType: true },
      }),
      this.prisma.businessHours.findMany({ where: { tenantId } }),
      // Cierres cuyo fin sea >= al día de afterTime (los que aún pueden aplicar).
      this.prisma.businessClosure.findMany({
        where: {
          tenantId,
          endDate: { gte: new Date(afterTime.toISOString().split('T')[0] + 'T00:00:00Z') },
        },
      }),
    ]);

    // Para FREELANCER no aplican businessHours del negocio.
    // (Mismo patrón ternario de antes: lista vacía si freelancer; si no, los
    // días cerrados.)
    const closedDays = new Set(
      tenant?.tenantType === 'FREELANCER'
        ? []
        : businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek),
    );

    // Recorremos día a día desde afterTime (i=0) hasta maxDays.
    for (let i = 0; i < maxDays; i++) {
      // searchDate = afterTime + i días.
      const searchDate = new Date(afterTime);
      searchDate.setUTCDate(searchDate.getUTCDate() + i);
      const dateStr = searchDate.toISOString().split('T')[0];

      // Saltamos días que el negocio cierra semanalmente.
      const dayOfWeek = this.getDayOfWeek(new Date(dateStr + 'T00:00:00Z'));
      if (closedDays.has(dayOfWeek)) continue;

      // Saltamos días dentro de un cierre temporal.
      const isClosed = closures.some((c) => {
        const cStart = c.startDate.toISOString().split('T')[0];
        const cEnd = c.endDate.toISOString().split('T')[0];
        return dateStr >= cStart && dateStr <= cEnd;
      });
      if (isClosed) continue;

      // Horario del empleado ese día; si no trabaja, saltamos.
      const schedule = await this.prisma.employeeSchedule.findFirst({
        where: {
          employeeId,
          dayOfWeek,
          isWorking: true,
          effectiveFrom: { lte: new Date(dateStr + 'T00:00:00Z') },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date(dateStr + 'T00:00:00Z') } }],
        },
      });
      if (!schedule) continue;

      // Citas y ausencias del día (igual que en los otros métodos).
      const dayStart = new Date(`${dateStr}T00:00:00Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59Z`);

      const [appointments, timeOffs] = await Promise.all([
        this.prisma.appointment.findMany({
          where: {
            employeeId,
            tenantId,
            startTime: { gte: dayStart, lt: dayEnd },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          },
          orderBy: { startTime: 'asc' },
        }),
        this.prisma.employeeTimeOff.findMany({
          where: {
            employeeId,
            startDatetime: { lt: dayEnd },
            endDatetime: { gt: dayStart },
          },
        }),
      ]);

      // Construimos bloques ocupados (citas con buffers + ausencias).
      const occupiedBlocks: TimeBlock[] = [];
      for (const appt of appointments) {
        occupiedBlocks.push({
          start: new Date(appt.startTime.getTime() - employee.bufferBeforeMinutes * 60000),
          end: new Date(appt.endTime.getTime() + employee.bufferAfterMinutes * 60000),
        });
      }
      for (const to of timeOffs) {
        occupiedBlocks.push({ start: to.startDatetime, end: to.endDatetime });
      }

      // Add shadow bookings for this employee on this day
      // Si nos pasaron reservas "fantasma" (extraOccupied), añadimos solo las
      // que caigan en ESTE día (su inicio dentro de [dayStart, dayEnd)).
      if (extraOccupied) {
        for (const block of extraOccupied) {
          if (block.start >= dayStart && block.start < dayEnd) {
            occupiedBlocks.push(block);
          }
        }
      }

      // Ordenar y fusionar.
      occupiedBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
      const merged = this.mergeBlocks(occupiedBlocks);

      // Ventana del horario laboral y paso de 15 min.
      const windowStart = new Date(`${dateStr}T${schedule.startTime}:00Z`);
      const windowEnd = new Date(`${dateStr}T${schedule.endTime}:00Z`);
      const granularity = 15;

      // Always start from schedule start, but never in the past
      // nowMs = el "ahora" redondeado HACIA ARRIBA al múltiplo de 15 min más
      // cercano (Math.ceil). Así el primer slot empieza en una marca de 15 min.
      const nowMs = Math.ceil(now.getTime() / (granularity * 60000)) * (granularity * 60000);
      // Empezamos en el MAYOR de: ese "ahora" redondeado o la apertura del
      // horario (Math.max). Nunca antes de "ahora" ni antes de abrir.
      const current = new Date(Math.max(nowMs, windowStart.getTime()));

      // Avanzamos mientras el slot quepa antes del cierre.
      while (current.getTime() + totalDuration * 60000 <= windowEnd.getTime()) {
        const slotEnd = new Date(current.getTime() + totalDuration * 60000);
        let conflict = false;

        // Si choca con un bloque ocupado, SALTAMOS current hasta justo después
        // del fin de ese bloque (redondeado hacia arriba a 15 min) — así no
        // probamos slots que sabemos que también chocarían.
        for (const block of merged) {
          if (current < block.end && slotEnd > block.start) {
            conflict = true;
            current.setTime(
              Math.ceil(block.end.getTime() / (granularity * 60000)) * (granularity * 60000),
            );
            break;
          }
        }

        // Sin conflicto: encontramos el primer hueco. Lo devolvemos y terminamos.
        if (!conflict) {
          return { startTime: new Date(current), endTime: slotEnd };
        }
      }
    }

    // Recorrimos todos los días sin encontrar hueco.
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // generateSlots(): genera SOLO los huecos LIBRES (no los ocupados) entre el
  // horario [scheduleStart, scheduleEnd] de un día, evitando los occupiedBlocks.
  // Recibe horas (texto), la fecha, los bloques ocupados, la duración del
  // servicio y la granularidad (paso). Devuelve lista de {startTime, endTime}.
  // ───────────────────────────────────────────────────────────────────────────
  private generateSlots(
    scheduleStart: string,
    scheduleEnd: string,
    dateStr: string,
    occupiedBlocks: TimeBlock[],
    durationMinutes: number,
    granularity: number,
  ): Array<{ startTime: string; endTime: string }> {
    // slots = lista de huecos libres a devolver.
    const slots: Array<{ startTime: string; endTime: string }> = [];

    // Ventana del horario como Date.
    const windowStart = new Date(`${dateStr}T${scheduleStart}:00Z`);
    const windowEnd = new Date(`${dateStr}T${scheduleEnd}:00Z`);

    // current = hora del slot que evaluamos; empieza en la apertura.
    let current = new Date(windowStart);

    // Mientras el slot (current + duración) quepa antes del cierre:
    while (
      current.getTime() + durationMinutes * 60000 <=
      windowEnd.getTime()
    ) {
      const slotEnd = new Date(current.getTime() + durationMinutes * 60000);
      let conflict = false;

      for (const block of occupiedBlocks) {
        // Si el slot solapa un bloque ocupado:
        if (current < block.end && slotEnd > block.start) {
          conflict = true;
          // Jump to after the block end, rounded up to granularity
          // Saltamos current justo después del fin del bloque, redondeado HACIA
          // ARRIBA al múltiplo de granularidad (no probamos huecos imposibles).
          current = new Date(
            Math.ceil(block.end.getTime() / (granularity * 60000)) *
              (granularity * 60000),
          );
          break;
        }
      }

      // Si no hubo conflicto, este hueco es libre: lo guardamos y avanzamos un paso.
      if (!conflict) {
        slots.push({
          startTime: current.toISOString().substring(11, 16),
          endTime: slotEnd.toISOString().substring(11, 16),
        });
        current = new Date(current.getTime() + granularity * 60000);
      }
      // (Si hubo conflicto, "current" ya saltó arriba; no avanzamos otro paso.)
    }

    return slots;
  }

  /**
   * Multi-employee bundle availability.
   * Finds time slots where each service in the bundle can be handled back-to-back
   * by different employees (respecting the configured order).
   */
  // ───────────────────────────────────────────────────────────────────────────
  // getBundleAvailability(): disponibilidad de un "paquete" (bundle) de varios
  // servicios que se atienden encadenados, posiblemente por DISTINTOS empleados.
  // Busca slots donde todos los servicios del paquete encajen uno tras otro.
  // Si el paquete permite orden flexible, prueba permutaciones del orden.
  // ───────────────────────────────────────────────────────────────────────────
  async getBundleAvailability(
    query: BundleAvailabilityQueryDto,
    tenantId: string,
  ) {
    // 1. Fetch bundle
    // Traemos el paquete (debe existir, ser del negocio y estar activo).
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id: query.bundleId, tenantId, isActive: true },
    });
    // Si no existe, lanzamos 404.
    if (!bundle) throw new NotFoundException('Paquete no encontrado');

    // serviceIds = ids de los servicios del paquete (guardados como JSON).
    const serviceIds = bundle.serviceIds as string[];
    // flexibleOrder = ¿se pueden hacer los servicios en cualquier orden?
    const flexibleOrder = bundle.flexibleOrder;

    // 2. Fetch services in bundle order
    const allServices = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });
    // serviceMap = un Map (diccionario) id -> servicio, para buscar rápido por id.
    // .map((s) => [s.id, s]) crea pares [clave, valor] que el Map usa.
    const serviceMap = new Map(allServices.map((s) => [s.id, s]));
    // orderedServices = los servicios EN EL ORDEN del paquete. Recorremos
    // serviceIds, buscamos cada uno en el map y filtramos los que existan.
    // filter(Boolean) elimina los undefined (servicios no encontrados).
    const orderedServices = serviceIds.map((id) => serviceMap.get(id)).filter(Boolean) as any[];

    // Sin servicios válidos, no hay disponibilidad.
    if (orderedServices.length === 0) return { data: [] };

    // 3. Fetch employees who can do each service
    // Traemos las relaciones empleado-servicio: qué empleados ofrecen cada
    // servicio del paquete. El filtro anidado en "employee" exige que sean del
    // negocio, activos y (si se pidió) de la sucursal. "...(cond && {campo})"
    // añade el filtro de location SOLO si query.locationId existe.
    const employeeServices = await this.prisma.employeeService.findMany({
      where: {
        serviceId: { in: serviceIds },
        employee: { tenantId, isActive: true, ...(query.locationId && { locationId: query.locationId }) },
      },
      include: { employee: true },
    });

    // Map: serviceId -> employee[]
    // employeesByService = diccionario serviceId -> lista de empleados que lo hacen.
    const employeesByService = new Map<string, any[]>();
    for (const es of employeeServices) {
      // Tomamos la lista actual del servicio (o [] si aún no hay) y le añadimos
      // este empleado; luego volvemos a guardar la lista en el map.
      const list = employeesByService.get(es.serviceId) || [];
      list.push(es.employee);
      employeesByService.set(es.serviceId, list);
    }

    // Check all services have at least one employee
    // Si ALGÚN servicio del paquete no tiene empleados que lo ofrezcan, el
    // paquete completo es imposible: devolvemos vacío. El "!" en .get(svc.id)!
    // le dice a TypeScript "confía, aquí no es null" (ya comprobamos con .has).
    for (const svc of orderedServices) {
      if (!employeesByService.has(svc.id) || employeesByService.get(svc.id)!.length === 0) {
        return { data: [] };
      }
    }

    // 4. For each date in range, find valid combinations
    const results: Array<{
      date: string;
      slots: Array<{
        startTime: string;
        endTime: string;
        assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }>;
      }>;
    }> = [];

    const startDate = new Date(query.startDate + 'T00:00:00Z');
    const endDate = new Date(query.endDate + 'T00:00:00Z');
    // granularity = paso de 30 min entre slots de inicio del paquete.
    const granularity = 30;

    // Get business hours and closures
    const [businessHours, closures] = await Promise.all([
      this.prisma.businessHours.findMany({ where: { tenantId } }),
      this.prisma.businessClosure.findMany({
        where: {
          tenantId,
          startDate: { lte: new Date(query.endDate + 'T23:59:59Z') },
          endDate: { gte: new Date(query.startDate + 'T00:00:00Z') },
        },
      }),
    ]);
    // Días que el negocio cierra (los que NO abren).
    const closedDays = new Set(businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek));

    // Recorremos día a día el rango pedido.
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = this.getDayOfWeek(date);
      // Saltar días cerrados (horario semanal).
      if (closedDays.has(dayOfWeek)) continue;

      // Saltar días dentro de un cierre temporal.
      const isClosed = closures.some((c) => {
        const cStart = c.startDate.toISOString().split('T')[0];
        const cEnd = c.endDate.toISOString().split('T')[0];
        return dateStr >= cStart && dateStr <= cEnd;
      });
      if (isClosed) continue;

      // Pre-load schedules and occupied blocks for all relevant employees
      // allRelevantEmployees = todos los empleados que aparecen en CUALQUIER
      // servicio del paquete, sin duplicados (un Map por id evita repetidos).
      const allRelevantEmployees = new Map<string, any>();
      // for (const [, emps] of ...): el "[," ignora la clave (serviceId) y solo
      // toma el valor (la lista de empleados de ese servicio).
      for (const [, emps] of employeesByService) {
        for (const emp of emps) {
          allRelevantEmployees.set(emp.id, emp);
        }
      }

      // employeeAvailability = por empleado, su horario del día y sus bloques
      // ocupados ya fusionados. Se precalcula una vez por día.
      const employeeAvailability = new Map<string, { schedule: any; occupied: TimeBlock[] }>();

      for (const [empId, emp] of allRelevantEmployees) {
        // Horario del empleado ese día; si no trabaja, lo saltamos.
        const schedule = await this.prisma.employeeSchedule.findFirst({
          where: {
            employeeId: empId,
            dayOfWeek,
            isWorking: true,
            effectiveFrom: { lte: date },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
          },
        });
        if (!schedule) continue;

        const dayStart = new Date(`${dateStr}T00:00:00Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59Z`);

        // Citas y ausencias del empleado ese día.
        const [appointments, timeOffs] = await Promise.all([
          this.prisma.appointment.findMany({
            where: {
              employeeId: empId,
              tenantId,
              startTime: { gte: dayStart, lt: dayEnd },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
            orderBy: { startTime: 'asc' },
          }),
          this.prisma.employeeTimeOff.findMany({
            where: { employeeId: empId, startDatetime: { lt: dayEnd }, endDatetime: { gt: dayStart } },
          }),
        ]);

        // Bloques ocupados (citas con buffers + ausencias), ordenados.
        const occupied: TimeBlock[] = [];
        for (const appt of appointments) {
          occupied.push({
            start: new Date(appt.startTime.getTime() - emp.bufferBeforeMinutes * 60000),
            end: new Date(appt.endTime.getTime() + emp.bufferAfterMinutes * 60000),
          });
        }
        for (const to of timeOffs) {
          occupied.push({ start: to.startDatetime, end: to.endDatetime });
        }
        occupied.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Guardamos horario + bloques fusionados para este empleado.
        employeeAvailability.set(empId, { schedule, occupied: this.mergeBlocks(occupied) });
      }

      // Helper: check if employee is free in [start, end)
      // Función auxiliar (definida dentro del día) que dice si un empleado está
      // libre en [start, end): debe tener horario, caber dentro de él y no pisar
      // ningún bloque ocupado. Devuelve true/false.
      const isEmployeeFree = (empId: string, start: Date, end: Date): boolean => {
        const avail = employeeAvailability.get(empId);
        if (!avail) return false; // sin datos => no disponible.
        const schedStart = new Date(`${dateStr}T${avail.schedule.startTime}:00Z`);
        const schedEnd = new Date(`${dateStr}T${avail.schedule.endTime}:00Z`);
        // Fuera de su horario => no libre.
        if (start < schedStart || end > schedEnd) return false;
        // Si solapa algún bloque ocupado => no libre.
        for (const block of avail.occupied) {
          if (start < block.end && end > block.start) return false;
        }
        return true;
      };

      // Find earliest business hour start as window
      // Ventana del día = del horario MÁS TEMPRANO al MÁS TARDÍO entre todos los
      // empleados relevantes (la unión de sus jornadas).
      let windowStart: Date | null = null;
      let windowEnd: Date | null = null;
      for (const [, avail] of employeeAvailability) {
        const s = new Date(`${dateStr}T${avail.schedule.startTime}:00Z`);
        const e = new Date(`${dateStr}T${avail.schedule.endTime}:00Z`);
        // windowStart = el inicio más temprano; windowEnd = el fin más tardío.
        if (!windowStart || s < windowStart) windowStart = s;
        if (!windowEnd || e > windowEnd) windowEnd = e;
      }
      // Si ningún empleado tenía horario, no hay ventana: saltamos el día.
      if (!windowStart || !windowEnd) continue;

      // Incluye buffer para paridad con appointments.service.create.
      // Duración total del paquete (suma de todos los servicios + buffers).
      const totalDuration = orderedServices.reduce(
        (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
        0,
      );
      // daySlots = slots válidos de este día (con sus asignaciones por servicio).
      const daySlots: Array<{
        startTime: string;
        endTime: string;
        assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }>;
      }> = [];

      // Probamos cada posible hora de inicio del paquete, de 30 en 30 min.
      let currentSlotStart = new Date(windowStart);

      while (currentSlotStart.getTime() + totalDuration * 60000 <= windowEnd.getTime()) {
        // Try to assign all services sequentially starting from currentSlotStart
        // serviceOrder: si el paquete permite orden flexible, buscamos el mejor
        // orden (findBestOrder); si no, usamos el orden fijo del paquete.
        const serviceOrder = flexibleOrder
          ? this.findBestOrder(orderedServices, currentSlotStart, dateStr, employeesByService, isEmployeeFree)
          : orderedServices;

        // Intentamos asignar todos los servicios uno tras otro desde esta hora.
        const assignments = this.tryAssignSequential(
          serviceOrder,
          currentSlotStart,
          dateStr,
          employeesByService,
          isEmployeeFree,
        );

        // Si se pudo asignar todo, este es un slot válido del paquete.
        if (assignments) {
          const slotEnd = new Date(currentSlotStart.getTime() + totalDuration * 60000);
          daySlots.push({
            startTime: currentSlotStart.toISOString().substring(11, 16),
            endTime: slotEnd.toISOString().substring(11, 16),
            assignments,
          });
        }

        // Avanzamos 30 min para la siguiente hora de inicio candidata.
        currentSlotStart = new Date(currentSlotStart.getTime() + granularity * 60000);
      }

      if (daySlots.length > 0) {
        results.push({ date: dateStr, slots: daySlots });
      }
    }

    return { data: results };
  }

  /**
   * Composite availability — variante restringida de bundle donde cada
   * servicio tiene un empleado fijo (asignado por el cliente en el flow de
   * booking del marketplace cuando varios profesionales pueden hacer un
   * mismo servicio).
   *
   * Resuelve el bug donde el frontend hacia N queries separadas + merge
   * manual y fallaba con duraciones no multiplos de 30 minutos: aqui usamos
   * granularidad fina (5 min) y reusamos `tryAssignSequential` que ya
   * verifica disponibilidad real (schedule + appointments + buffers).
   */
  async getCompositeAvailability(
    query: CompositeAvailabilityQueryDto,
    tenantId: string,
  ) {
    // assignments = lista de pares {servicio, empleado} elegidos por el cliente.
    const assignments = query.serviceAssignments;

    // Caso trivial: 1 servicio → delegamos al endpoint normal
    // Si solo hay una asignación, no hay nada que "componer": reutilizamos
    // getAvailableSlots pasándole ese único servicio y empleado.
    if (assignments.length === 1) {
      return this.getAvailableSlots(
        {
          serviceIds: [assignments[0].serviceId],
          employeeId: assignments[0].employeeId,
          startDate: query.startDate,
          endDate: query.endDate,
          locationId: query.locationId,
        },
        tenantId,
      );
    }

    // Cache key
    // assignmentsKey = huella corta (hash) de las asignaciones. Convertimos las
    // asignaciones a texto (JSON.stringify), las pasamos por SHA-1, lo
    // expresamos en hexadecimal y tomamos los primeros 16 caracteres. Así dos
    // consultas con las MISMAS asignaciones generan la misma clave de caché.
    const assignmentsKey = crypto
      .createHash('sha1')
      .update(JSON.stringify(assignments))
      .digest('hex')
      .substring(0, 16);
    const cacheKey = `composite:${tenantId}:${query.locationId || 'all'}:${query.startDate}:${query.endDate}:${assignmentsKey}`;

    try {
      // Si ya está en caché, devolvemos el resultado guardado (parseado).
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return JSON.parse(cached);
      }
    } catch {
      // Si la caché falla, solo avisamos en log y seguimos calculando.
      this.logger.warn(`Redis cache miss for ${cacheKey}`);
    }

    // 1. Fetch services + validar que cada empleado pueda hacer su servicio asignado
    // serviceIds = ids únicos de servicios. "new Set(...)" elimina duplicados y
    // "[...set]" lo vuelve a convertir en arreglo.
    const serviceIds = [...new Set(assignments.map((a) => a.serviceId))];
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // Ordered list of {service, employeeId} respetando el orden del cliente
    // Por cada asignación buscamos su objeto de servicio y conservamos el orden.
    // filter((x) => !!x.service) descarta las que no encontraron servicio
    // ("!!" convierte el valor a booleano: true si hay servicio, false si no).
    const orderedAssignments = assignments
      .map((a) => ({ service: serviceMap.get(a.serviceId), employeeId: a.employeeId }))
      .filter((x) => !!x.service);
    // Si se perdió alguna (un servicio no existía), abortamos con vacío.
    if (orderedAssignments.length !== assignments.length) {
      return { data: [] };
    }
    // Solo los objetos de servicio, en orden. El "!" afirma que no es null.
    const orderedServices = orderedAssignments.map((a) => a.service!);

    // Cargar empleados unicos y validar que ofrezcan su servicio asignado
    const uniqueEmpIds = [...new Set(assignments.map((a) => a.employeeId))];
    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: uniqueEmpIds },
        tenantId,
        isActive: true,
        ...(query.locationId && { locationId: query.locationId }),
      },
      include: { employeeServices: true },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    // Validamos cada asignación: el empleado debe existir Y ofrecer ese servicio.
    for (const a of assignments) {
      const emp = employeeMap.get(a.employeeId);
      if (!emp) return { data: [] };
      // some() => true si el empleado tiene alguna relación employeeServices con
      // ese serviceId. Si NO la tiene, no puede hacerlo: abortamos.
      if (!emp.employeeServices.some((es) => es.serviceId === a.serviceId)) {
        return { data: [] };
      }
    }

    // employeesByService con EXACTAMENTE 1 candidato por servicio (el asignado)
    // Nota: si el mismo serviceId aparece dos veces en assignments con
    // empleados distintos, esto solo guarda el ultimo — pero el flow del
    // marketplace nunca asigna el mismo servicio dos veces.
    // A diferencia del bundle (varios candidatos), aquí cada servicio tiene UN
    // único empleado fijo (el que eligió el cliente).
    const employeesByService = new Map<string, any[]>();
    for (const a of orderedAssignments) {
      employeesByService.set(a.service!.id, [employeeMap.get(a.employeeId)]);
    }

    // 2. Iterar dias en el rango
    const results: Array<{
      date: string;
      slots: Array<{
        startTime: string;
        endTime: string;
        assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }>;
      }>;
    }> = [];

    // Rango de fechas a recorrer.
    const startDate = new Date(query.startDate + 'T00:00:00Z');
    const endDate = new Date(query.endDate + 'T00:00:00Z');
    // Granularidad 30 min para alinear con el grid del frontend (SlotGrid
    // muestra slots cada 30 min entre apertura y cierre). Antes usaba 5 min
    // pensando que era necesario para duraciones no multiplo de 30, pero
    // isEmployeeFree verifica rangos arbitrarios sin necesitar grilla fina:
    // un slot a las 9:00 con limpieza 45min + masaje 60min checa
    // [9:45, 10:45] para Renata directamente, sin importar que 9:45 no sea
    // multiplo de 30. La grilla fina generaba slots redundantes (9:00,
    // 9:05, 9:10...) que el frontend ignoraba pero contaba en el total.
    const granularity = 30;

    const [businessHours, closures] = await Promise.all([
      this.prisma.businessHours.findMany({ where: { tenantId } }),
      this.prisma.businessClosure.findMany({
        where: {
          tenantId,
          startDate: { lte: new Date(query.endDate + 'T23:59:59Z') },
          endDate: { gte: new Date(query.startDate + 'T00:00:00Z') },
        },
      }),
    ]);
    const closedDays = new Set(businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek));

    // Incluye buffer para paridad con appointments.service.create.
    // Duración total = suma de todos los servicios compuestos + sus buffers.
    const totalDuration = orderedServices.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );

    // Recorremos día a día el rango.
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = this.getDayOfWeek(date);
      if (closedDays.has(dayOfWeek)) continue; // negocio cerrado ese día.

      const isClosed = closures.some((c) => {
        const cStart = c.startDate.toISOString().split('T')[0];
        const cEnd = c.endDate.toISOString().split('T')[0];
        return dateStr >= cStart && dateStr <= cEnd;
      });
      if (isClosed) continue; // cierre temporal.

      // Pre-cargar schedule + occupied blocks de los empleados requeridos
      const employeeAvailability = new Map<string, { schedule: any; occupied: TimeBlock[] }>();
      // missingEmployee = bandera: si algún empleado requerido no trabaja ese
      // día, no hay slot posible (todos son obligatorios en composite).
      let missingEmployee = false;

      for (const empId of uniqueEmpIds) {
        const emp = employeeMap.get(empId)!;
        const schedule = await this.prisma.employeeSchedule.findFirst({
          where: {
            employeeId: empId,
            dayOfWeek,
            isWorking: true,
            effectiveFrom: { lte: date },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
          },
        });
        if (!schedule) {
          // Cualquier empleado requerido sin schedule ese dia → no hay slot
          missingEmployee = true;
          break; // dejamos de mirar empleados; este día no sirve.
        }

        const dayStart = new Date(`${dateStr}T00:00:00Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59Z`);

        // Citas y ausencias del empleado ese día.
        const [appointments, timeOffs] = await Promise.all([
          this.prisma.appointment.findMany({
            where: {
              employeeId: empId,
              tenantId,
              startTime: { gte: dayStart, lt: dayEnd },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
            orderBy: { startTime: 'asc' },
          }),
          this.prisma.employeeTimeOff.findMany({
            where: { employeeId: empId, startDatetime: { lt: dayEnd }, endDatetime: { gt: dayStart } },
          }),
        ]);

        // Bloques ocupados (citas con buffers + ausencias), ordenados.
        const occupied: TimeBlock[] = [];
        for (const appt of appointments) {
          occupied.push({
            start: new Date(appt.startTime.getTime() - emp.bufferBeforeMinutes * 60000),
            end: new Date(appt.endTime.getTime() + emp.bufferAfterMinutes * 60000),
          });
        }
        for (const to of timeOffs) {
          occupied.push({ start: to.startDatetime, end: to.endDatetime });
        }
        occupied.sort((a, b) => a.start.getTime() - b.start.getTime());

        employeeAvailability.set(empId, { schedule, occupied: this.mergeBlocks(occupied) });
      }

      // Si faltó algún empleado requerido ese día, saltamos el día completo.
      if (missingEmployee) continue;

      // Misma función auxiliar que en bundle: ¿está libre este empleado en
      // [start, end)? (dentro de su horario y sin pisar bloques ocupados).
      const isEmployeeFree = (empId: string, start: Date, end: Date): boolean => {
        const avail = employeeAvailability.get(empId);
        if (!avail) return false;
        const schedStart = new Date(`${dateStr}T${avail.schedule.startTime}:00Z`);
        const schedEnd = new Date(`${dateStr}T${avail.schedule.endTime}:00Z`);
        if (start < schedStart || end > schedEnd) return false;
        for (const block of avail.occupied) {
          if (start < block.end && end > block.start) return false;
        }
        return true;
      };

      // Ventana = interseccion de:
      //  - horarios de TODOS los empleados requeridos (max starts, min ends)
      //  - horario del negocio para este dia (businessHours)
      // Sin la interseccion con businessHours, un empleado que trabaja
      // antes/despues del horario del negocio (ej. emp 8-19 con negocio
      // 9-18) generaba slots que el frontend ignoraba pero contaba en el
      // total, causando que el contador no coincidiera con el grid.
      // A diferencia del bundle (unión de jornadas), aquí la ventana es la
      // INTERSECCIÓN: el inicio MÁS TARDÍO y el fin MÁS TEMPRANO de todos los
      // empleados requeridos (todos deben estar disponibles a la vez).
      let windowStart: Date | null = null;
      let windowEnd: Date | null = null;
      for (const [, avail] of employeeAvailability) {
        const s = new Date(`${dateStr}T${avail.schedule.startTime}:00Z`);
        const e = new Date(`${dateStr}T${avail.schedule.endTime}:00Z`);
        // windowStart = el MAYOR de los inicios; windowEnd = el MENOR de los fines.
        if (!windowStart || s > windowStart) windowStart = s;
        if (!windowEnd || e < windowEnd) windowEnd = e;
      }

      // También intersectamos con el horario del NEGOCIO para este día.
      // find() => el horario del día que esté abierto (h.isOpen).
      const dayHours = businessHours.find((h) => h.dayOfWeek === dayOfWeek && h.isOpen);
      if (dayHours && dayHours.openTime && dayHours.closeTime) {
        const bizOpen = new Date(`${dateStr}T${dayHours.openTime}:00Z`);
        const bizClose = new Date(`${dateStr}T${dayHours.closeTime}:00Z`);
        // Recortamos la ventana a la apertura/cierre del negocio si es más estrecha.
        if (!windowStart || bizOpen > windowStart) windowStart = bizOpen;
        if (!windowEnd || bizClose < windowEnd) windowEnd = bizClose;
      }

      // Sin ventana válida, saltamos el día.
      if (!windowStart || !windowEnd) continue;

      const daySlots: Array<{
        startTime: string;
        endTime: string;
        assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }>;
      }> = [];

      // Probamos cada hora de inicio candidata, de 30 en 30 min.
      let currentSlotStart = new Date(windowStart);

      while (currentSlotStart.getTime() + totalDuration * 60000 <= windowEnd.getTime()) {
        // Intentamos encadenar todos los servicios (cada uno con su empleado fijo).
        const slotAssignments = this.tryAssignSequential(
          orderedServices,
          currentSlotStart,
          dateStr,
          employeesByService,
          isEmployeeFree,
        );

        // Si se logró, es un slot válido.
        if (slotAssignments) {
          const slotEnd = new Date(currentSlotStart.getTime() + totalDuration * 60000);
          daySlots.push({
            startTime: currentSlotStart.toISOString().substring(11, 16),
            endTime: slotEnd.toISOString().substring(11, 16),
            assignments: slotAssignments,
          });
        }

        currentSlotStart = new Date(currentSlotStart.getTime() + granularity * 60000);
      }

      if (daySlots.length > 0) {
        results.push({ date: dateStr, slots: daySlots });
      }
    }

    // Guardamos el resultado en caché (5 min) y lo devolvemos.
    const response = { data: results };
    await this.redis.set(cacheKey, JSON.stringify(response), 300).catch(() => {});
    return response;
  }

  /**
   * Try to assign each service sequentially to an available employee.
   * Returns assignments array or null if no valid combination found.
   */
  // ───────────────────────────────────────────────────────────────────────────
  // tryAssignSequential(): intenta encajar TODOS los servicios uno tras otro,
  // empezando en startTime, asignando a cada uno un empleado libre. Devuelve la
  // lista de asignaciones si lo logra, o null si algún servicio no se pudo colocar.
  // Recibe la función isEmployeeFree para consultar disponibilidad real.
  // ───────────────────────────────────────────────────────────────────────────
  private tryAssignSequential(
    services: any[],
    startTime: Date,
    dateStr: string,
    employeesByService: Map<string, any[]>,
    isEmployeeFree: (empId: string, start: Date, end: Date) => boolean,
  ): Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }> | null {
    // assignments = resultado en construcción (un objeto por servicio asignado).
    const assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }> = [];
    // currentStart = hora de inicio del servicio que toca colocar; avanza tras cada uno.
    let currentStart = new Date(startTime);
    // Track which employee is busy in which time window (for same-slot double-assignment prevention)
    // employeeBusy = registro de qué empleado quedó ocupado en qué franja DENTRO
    // de este mismo paquete (para no asignar al mismo empleado dos servicios que
    // se solapan en el mismo slot).
    const employeeBusy: Array<{ empId: string; start: Date; end: Date }> = [];

    // Recorremos los servicios en orden.
    for (const svc of services) {
      // svcEnd = fin de ESTE servicio (inicio + su duración).
      const svcEnd = new Date(currentStart.getTime() + svc.durationMinutes * 60000);
      // candidates = empleados que pueden hacer este servicio (o [] si ninguno).
      const candidates = employeesByService.get(svc.id) || [];
      // assigned = ¿logramos asignar este servicio a algún candidato?
      let assigned = false;

      for (const emp of candidates) {
        // Check employee is free in the real calendar
        // 1) ¿Está libre en el calendario real? Si no, probamos otro candidato.
        if (!isEmployeeFree(emp.id, currentStart, svcEnd)) continue;

        // Check employee is not already assigned in an overlapping window within this same bundle slot
        // 2) ¿Ya está ocupado por OTRO servicio de este mismo paquete que solape?
        // some() => true si existe un registro de este empleado cuya franja se
        // cruce con [currentStart, svcEnd).
        const doubleBooked = employeeBusy.some(
          (b) => b.empId === emp.id && currentStart < b.end && svcEnd > b.start,
        );
        if (doubleBooked) continue; // doble reserva: probamos otro candidato.

        // Asignamos el servicio a este empleado.
        assignments.push({
          serviceId: svc.id,
          serviceName: svc.name,
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          startTime: currentStart.toISOString().substring(11, 16),
          endTime: svcEnd.toISOString().substring(11, 16),
        });
        // Marcamos al empleado como ocupado en esa franja dentro del paquete.
        employeeBusy.push({ empId: emp.id, start: new Date(currentStart), end: new Date(svcEnd) });
        assigned = true;
        break; // pasamos al siguiente servicio.
      }

      // Si NINGÚN candidato pudo tomar este servicio, el paquete entero falla.
      if (!assigned) return null;
      // El siguiente servicio empieza justo cuando termina el actual (encadenado).
      currentStart = new Date(svcEnd);
    }

    // Todos los servicios quedaron asignados: devolvemos la combinación.
    return assignments;
  }

  /**
   * For flexible order bundles, try permutations to find one that works.
   * Uses a greedy approach: try the default order first, then swap services that fail.
   */
  // ───────────────────────────────────────────────────────────────────────────
  // findBestOrder(): para paquetes con orden flexible, busca UN orden de los
  // servicios que sí encaje a partir de startTime. Estrategia "voraz": prueba el
  // orden original primero; si falla, prueba permutaciones (solo si hay pocos
  // servicios). Devuelve el orden que funciona (o el original si ninguno sirve).
  // ───────────────────────────────────────────────────────────────────────────
  private findBestOrder(
    services: any[],
    startTime: Date,
    dateStr: string,
    employeesByService: Map<string, any[]>,
    isEmployeeFree: (empId: string, start: Date, end: Date) => boolean,
  ): any[] {
    // Try original order first
    // 1) Intentamos con el orden tal cual viene. Si funciona, lo devolvemos.
    const result = this.tryAssignSequential(services, startTime, dateStr, employeesByService, isEmployeeFree);
    if (result) return services;

    // For small bundles (<=5 services), try permutations with early exit
    // 2) Si son pocos servicios (<=5), probamos reordenamientos (permutaciones)
    // hasta encontrar uno que encaje. "Early exit": devolvemos en cuanto uno sirva.
    if (services.length <= 5) {
      const permutations = this.getPermutations(services);
      for (const perm of permutations) {
        const attempt = this.tryAssignSequential(perm, startTime, dateStr, employeesByService, isEmployeeFree);
        if (attempt) return perm;
      }
    }

    // 3) Nada funcionó: devolvemos el orden original (el llamador reintentará
    // tryAssignSequential, que devolverá null y este slot se descartará).
    return services;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getPermutations(): genera todas las ordenaciones posibles de un arreglo,
  // limitadas a 120 para no explotar en cantidad. Es genérico (<T>): sirve para
  // arreglos de cualquier tipo. Es recursivo (se llama a sí mismo).
  // ───────────────────────────────────────────────────────────────────────────
  private getPermutations<T>(arr: T[]): T[][] {
    // Caso base: con 0 o 1 elementos solo hay una ordenación (el propio arreglo).
    if (arr.length <= 1) return [arr];
    // result = lista de todas las permutaciones encontradas.
    const result: T[][] = [];
    // Recorremos cada posición "i" como primer elemento, hasta llegar al tope (120).
    for (let i = 0; i < arr.length && result.length < 120; i++) {
      // rest = el arreglo sin el elemento "i". slice(0,i) toma lo de antes y
      // slice(i+1) lo de después; el spread "..." los une en un nuevo arreglo.
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      // Permutamos el resto recursivamente y, a cada permutación, le ponemos
      // arr[i] al frente.
      for (const perm of this.getPermutations(rest)) {
        result.push([arr[i], ...perm]);
        if (result.length >= 120) break; // Cap permutations
      }
    }
    return result;
  }
}
