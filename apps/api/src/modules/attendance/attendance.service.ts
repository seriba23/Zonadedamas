// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: decorador que marca esta clase como "servicio" inyectable.
//   - BadRequestException: error que responde con HTTP 400 (petición inválida).
//   - NotFoundException: error que responde con HTTP 404 (no encontrado).
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

// PrismaService = el "puente" hacia la base de datos (lee/escribe tablas).
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servicio de Asistencia. Contiene toda la lógica del registro de jornada de los
 * empleados: marcar entrada/salida con verificación de ubicación (GPS), calcular
 * horas trabajadas, generar estadísticas y permitir al admin aprobar/rechazar.
 */
@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class AttendanceService {
  // El constructor recibe el PrismaService que NestJS inyecta. Queda guardado
  // como this.prisma (solo lectura) para usarlo en todos los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // findByDateRange(): lista los registros de asistencia de un rango de fechas,
  // con filtros opcionales, y ENRIQUECE cada registro con el horario PROGRAMADO
  // (entrada/salida según el turno) para que el frontend detecte tardanzas.
  // ───────────────────────────────────────────────────────────────────────────
  async findByDateRange(
    tenantId: string,   // id del negocio (multi-tenant)
    startDate: string,  // fecha inicio "YYYY-MM-DD"
    endDate: string,    // fecha fin "YYYY-MM-DD"
    filters?: { employeeId?: string; status?: string }, // filtros opcionales
  ) {
    // Construimos el objeto "where" (condiciones de la consulta) por partes.
    // "any" evita conflictos de tipos al ir agregando propiedades condicionales.
    const where: any = {
      tenantId, // solo registros de este negocio
      date: {
        // gte = ">=" (desde el inicio del día startDate, en UTC).
        gte: new Date(startDate + 'T00:00:00Z'),
        // lte = "<=" (hasta el inicio del día endDate, en UTC).
        lte: new Date(endDate + 'T00:00:00Z'),
      },
    };
    // "filters?.employeeId": el "?." evita romper si "filters" llega undefined.
    // Si vino un employeeId, lo añadimos como condición extra al where.
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    // Lo mismo para el estado (PENDING_REVIEW, APPROVED, REJECTED...).
    if (filters?.status) where.status = filters.status;

    // Traemos los registros que cumplan el where, incluyendo datos del empleado.
    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        // Del empleado solo traemos lo necesario para pintarlo (avatar, color...).
        employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
      },
      // Ordenamos por fecha descendente (más reciente primero) y, dentro de la
      // misma fecha, por hora de entrada ascendente (quién llegó antes, arriba).
      orderBy: [{ date: 'desc' }, { checkInTime: 'asc' }],
    });

    // Adjunta el horario programado de entrada/salida de cada registro para que
    // el frontend pueda detectar tardanzas. Devolvemos el string "HH:mm" tal cual
    // (hora local del negocio); la comparación con la hora de check-in se hace en
    // el cliente con la hora local del navegador para evitar líos de zona horaria.
    //
    // PASO 1: lista de empleados ÚNICOS presentes en los registros.
    //   - records.map((r) => r.employeeId): saca SOLO los employeeId de cada
    //     registro (puede haber repetidos: el mismo empleado en varios días).
    //   - new Set(...): un Set NO admite duplicados, así que los elimina.
    //   - [...]: el "spread" convierte ese Set de nuevo en un arreglo normal.
    const employeeIds = [...new Set(records.map((r) => r.employeeId))];
    // PASO 2: traer los horarios (turnos) de esos empleados.
    // "employeeIds.length" es la cantidad: si es > 0 (truthy) consultamos; si es
    // 0 (no hay empleados) usamos [] directamente para no hacer una consulta vacía.
    // Es un ternario: condición ? siVerdadero : siFalso.
    const schedules = employeeIds.length
      ? await this.prisma.employeeSchedule.findMany({
          // in = "que esté dentro de esta lista". isWorking: true = solo días que
          // el empleado SÍ trabaja.
          where: { employeeId: { in: employeeIds }, isWorking: true },
        })
      : [];
    // Tabla para traducir el número del día de la semana al nombre que usa la BD.
    // getUTCDay() devuelve 0=domingo ... 6=sábado, que usamos como índice aquí.
    const DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    // PASO 3: recorrer cada registro y pegarle su horario programado.
    // map() recorre "records" y DEVUELVE un nuevo arreglo con cada registro
    // transformado (con campos extra). "r" es cada registro de asistencia.
    const data = records.map((r) => {
      // Fecha del registro como objeto Date.
      const recDate = new Date(r.date);
      // Nombre del día de la semana de ese registro (ej. "MONDAY").
      const dow = DOW[recDate.getUTCDay()];
      // Buscamos el turno (schedule) que aplica a ESE empleado, ESE día y que
      // esté VIGENTE en la fecha del registro. Los turnos pueden tener una
      // ventana de validez (effectiveFrom .. effectiveUntil).
      const sched = schedules
        .filter(
          // filter() deja pasar solo los turnos que cumplan TODO lo siguiente:
          (s) =>
            // mismo empleado que el registro (=== compara valor y tipo exactos).
            s.employeeId === r.employeeId &&
            // mismo día de la semana.
            s.dayOfWeek === dow &&
            // que el turno ya hubiera empezado a estar vigente en o antes de la
            // fecha del registro (effectiveFrom <= recDate).
            new Date(s.effectiveFrom) <= recDate &&
            // y que NO haya caducado: o no tiene fecha de fin (!s.effectiveUntil),
            // o su fin es en o después de la fecha del registro. El "||" hace que
            // baste con que UNA de las dos sea verdad.
            (!s.effectiveUntil || new Date(s.effectiveUntil) >= recDate),
        )
        // Puede haber varios turnos válidos (uno antiguo y uno nuevo). Ordenamos
        // por effectiveFrom DESCENDENTE para quedarnos con el MÁS RECIENTE.
        //   - sort((a,b) => b - a): orden descendente.
        //   - getTime() pasa la fecha a milisegundos para poder restarlas.
        .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0];
        // El [0] toma el primero del arreglo ya ordenado: el turno vigente más nuevo
        // (o undefined si filter() no dejó ninguno).
      // Devolvemos una COPIA del registro (...r = "esparce" todos sus campos) más
      // dos campos nuevos con el horario programado.
      return {
        ...r,
        // "sched?.startTime ?? null": si hubo turno toma su hora de entrada; el
        // "?." evita romper si sched es undefined, y "?? null" pone null si no hay
        // valor (?? solo reemplaza null/undefined, no un "" o un 0 válidos).
        scheduledStartTime: sched?.startTime ?? null,
        scheduledEndTime: sched?.endTime ?? null,
      };
    });

    // Devolvemos los registros enriquecidos en el formato estándar { data }.
    return { data };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getStats(): calcula estadísticas agregadas del rango (cuántos presentes,
  // completados, pendientes, rechazados, minutos/horas totales y top empleados
  // por horas trabajadas). Pensado para el dashboard de reportes del admin.
  // ───────────────────────────────────────────────────────────────────────────
  async getStats(tenantId: string, startDate: string, endDate: string) {
    // Mismo filtro de rango por fecha que en findByDateRange (gte/lte en UTC).
    const where = {
      tenantId,
      date: {
        gte: new Date(startDate + 'T00:00:00Z'),
        lte: new Date(endDate + 'T00:00:00Z'),
      },
    };
    // Traemos todos los registros del rango con datos del empleado.
    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
      },
    });

    // Contadores que iremos sumando al recorrer los registros. "let" = variables
    // que cambian de valor (a diferencia de "const", que no se reasigna).
    let inShiftCount = 0;    // en turno: marcó entrada pero aún no salida
    let completedCount = 0;  // jornada completa: marcó entrada Y salida
    let pendingCount = 0;    // pendientes de revisión del admin
    let rejectedCount = 0;   // rechazados por el admin
    let totalMinutes = 0;    // suma de minutos trabajados de todos
    // Map = una especie de "diccionario" clave->valor. Aquí la clave es el
    // employeeId y el valor acumula sus minutos y días trabajados.
    const minutesByEmployee = new Map<
      string,
      { employee: any; minutes: number; days: number }
    >();

    // BUCLE FOR...OF: recorre uno a uno los registros. "r" es cada registro.
    for (const r of records) {
      // CLASIFICACIÓN POR ESTADO (cadena if/else: solo entra en UNA rama):
      // === compara exactamente. ++ suma 1 al contador.
      if (r.status === 'PENDING_REVIEW') pendingCount++;
      else if (r.status === 'REJECTED') rejectedCount++;
      // Si no es pendiente ni rechazado: ¿ya marcó salida? -> jornada completa.
      else if (r.checkOutTime) completedCount++;
      // Si no, pero ya marcó entrada -> sigue en turno.
      else if (r.checkInTime) inShiftCount++;

      // CÁLCULO DE HORAS TRABAJADAS: solo si tiene entrada Y salida ("&&" = ambas).
      if (r.checkInTime && r.checkOutTime) {
        // Minutos trabajados = (salida - entrada) en ms, dividido entre 60000
        // (1 minuto = 60000 ms). Math.round redondea al entero más cercano.
        const mins = Math.round(
          (new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000,
        );
        // Acumulamos al total global.
        totalMinutes += mins;
        // Acumulamos por empleado. "key" = el id del empleado de este registro.
        const key = r.employeeId;
        // ¿Ya teníamos una entrada para este empleado en el Map?
        const prev = minutesByEmployee.get(key);
        if (prev) {
          // Sí: sumamos los minutos de hoy y contamos un día más trabajado.
          prev.minutes += mins;
          prev.days += 1;
        } else {
          // No: creamos su primera entrada en el Map (1 día, sus minutos).
          minutesByEmployee.set(key, { employee: r.employee, minutes: mins, days: 1 });
        }
      }
    }

    // TOP EMPLEADOS por minutos trabajados:
    //   - Array.from(...values()): convierte los valores del Map en un arreglo.
    //   - sort((a,b) => b.minutes - a.minutes): orden DESCENDENTE (más minutos
    //     primero). Si el resultado es negativo, "a" va antes que "b".
    //   - slice(0, 5): toma los primeros 5 (el top 5).
    const topEmployees = Array.from(minutesByEmployee.values())
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);

    // Devolvemos todas las cifras en el formato estándar { data }.
    return {
      data: {
        totalRecords: records.length, // total de registros del rango
        inShift: inShiftCount,
        completed: completedCount,
        pending: pendingCount,
        rejected: rejectedCount,
        totalMinutes,
        // Horas totales con 1 decimal: dividimos minutos/60, multiplicamos por 10,
        // redondeamos y volvemos a dividir entre 10 (truco para dejar 1 decimal).
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        topEmployees,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // checkIn(): registra la ENTRADA del empleado. Verifica con GPS que está
  // dentro del radio permitido del negocio; si está fuera y no fuerza, rechaza;
  // si fuerza, lo registra como PENDING_REVIEW (pendiente de aprobación).
  // ───────────────────────────────────────────────────────────────────────────
  async checkIn(
    tenantId: string,
    employeeId: string,
    latitude: number,   // latitud GPS del empleado al marcar
    longitude: number,  // longitud GPS del empleado al marcar
    forceOutOfRange = false, // si true, registra aunque esté fuera de rango
  ) {
    // Buscamos al empleado (activo, de este negocio) e incluimos su sucursal
    // (location) para conocer las coordenadas del negocio.
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, isActive: true },
      include: { location: true },
    });
    // Si no existe -> error 404.
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    // Calculate distance
    const location = employee.location; // la sucursal del empleado
    let distance: number | null = null; // distancia calculada (o null si no aplica)
    let outOfRange = false;              // ¿quedó fuera del radio permitido?

    // Solo validamos ubicación si la sucursal tiene coordenadas guardadas.
    // "!= null" descarta tanto null como undefined (con un solo signo, a propósito).
    if (location?.latitude != null && location?.longitude != null) {
      // Distancia en metros entre el empleado y el negocio (fórmula de Haversine).
      distance = this.haversineDistance(latitude, longitude, location.latitude, location.longitude);
      const minRadius = 50; // radio mínimo permitido: 50 metros
      // Radio permitido final = el MAYOR entre 50 y el configurado en la sucursal.
      //   - (location.settings as any)?.attendanceRadius: lee el radio de los
      //     ajustes (settings es Json; "as any" para poder acceder al campo).
      //   - "|| minRadius": si no hay valor configurado (0/null/undefined), usa 50.
      //   - Math.max(...): nos aseguramos de nunca bajar de 50.
      const allowedRadius = Math.max(minRadius, (location.settings as any)?.attendanceRadius || minRadius);

      // Si está FUERA del radio y NO está forzando (!forceOutOfRange) -> error.
      // Devolvemos un JSON dentro del mensaje para que el frontend sepa el código,
      // la distancia y el radio, y pueda ofrecer "forzar registro".
      if (distance > allowedRadius && !forceOutOfRange) {
        throw new BadRequestException(
          JSON.stringify({
            code: 'OUT_OF_RANGE',
            distance: Math.round(distance), // metros redondeados
            allowedRadius,
            message: `Estás a ${Math.round(distance)}m del negocio. Debes estar dentro de ${allowedRadius}m.`,
          }),
        );
      }
      // Si llegamos aquí estando fuera, significa que SÍ forzó: lo marcamos como
      // fuera de rango para que el registro quede pendiente de revisión.
      if (distance > allowedRadius) {
        outOfRange = true;
      }
    }

    // "today" = momento exacto del check-in (fecha y hora).
    const today = new Date();
    // "dateOnly" = solo el DÍA a medianoche UTC (sin hora). Sirve como clave única
    // por empleado/día. split('T')[0] toma la parte "YYYY-MM-DD".
    const dateOnly = new Date(today.toISOString().split('T')[0] + 'T00:00:00Z');

    // ¿Ya existe un registro de hoy para este empleado? La clave compuesta
    // "employeeId_date" garantiza un único registro por empleado y día.
    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dateOnly } },
    });
    // Si ya marcó entrada hoy, no puede volver a marcar -> error.
    if (existing) {
      throw new BadRequestException('Ya registraste tu entrada hoy.');
    }

    // Creamos el registro de asistencia con la entrada.
    const record = await this.prisma.attendance.create({
      data: {
        tenantId,
        employeeId,
        date: dateOnly,
        checkInTime: today,       // hora exacta de entrada
        checkInLat: latitude,     // ubicación de entrada
        checkInLng: longitude,
        // Distancia redondeada, o null si no se pudo calcular. Ternario:
        // "distance ? ... : null" (si distance tiene valor, redondea; si no, null).
        checkInDistance: distance ? Math.round(distance) : null,
        // Estado inicial: si quedó fuera de rango -> pendiente de revisión;
        // si todo bien -> aprobado automáticamente.
        status: outOfRange ? 'PENDING_REVIEW' : 'APPROVED',
      },
    });

    return { data: record };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // checkOut(): registra la SALIDA del empleado sobre el registro de hoy. Mismo
  // control de ubicación que checkIn(). Requiere que ya exista una entrada hoy.
  // ───────────────────────────────────────────────────────────────────────────
  async checkOut(
    tenantId: string,
    employeeId: string,
    latitude: number,
    longitude: number,
    forceOutOfRange = false,
  ) {
    // (Mismo patrón que checkIn): buscar empleado activo + su sucursal.
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, isActive: true },
      include: { location: true },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    const location = employee.location;
    let distance: number | null = null;
    let outOfRange = false;

    // Misma verificación de distancia/rango que en check-in.
    if (location?.latitude != null && location?.longitude != null) {
      distance = this.haversineDistance(latitude, longitude, location.latitude, location.longitude);
      const minRadius = 50;
      const allowedRadius = Math.max(minRadius, (location.settings as any)?.attendanceRadius || minRadius);

      if (distance > allowedRadius && !forceOutOfRange) {
        throw new BadRequestException(
          JSON.stringify({
            code: 'OUT_OF_RANGE',
            distance: Math.round(distance),
            allowedRadius,
            message: `Estás a ${Math.round(distance)}m del negocio. Debes estar dentro de ${allowedRadius}m.`,
          }),
        );
      }
      if (distance > allowedRadius) {
        outOfRange = true;
      }
    }

    // Momento de la salida y día (a medianoche UTC) para localizar el registro.
    const today = new Date();
    const dateOnly = new Date(today.toISOString().split('T')[0] + 'T00:00:00Z');

    // Buscamos el registro de hoy (debe existir porque debió marcar entrada antes).
    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dateOnly } },
    });
    // Si no marcó entrada hoy, no puede marcar salida.
    if (!existing) throw new BadRequestException('No tienes registro de entrada hoy.');
    // Si ya tenía hora de salida, no puede volver a marcar salida.
    if (existing.checkOutTime) throw new BadRequestException('Ya registraste tu salida hoy.');

    // Nuevo estado: si la salida fue fuera de rango -> PENDING_REVIEW; si no,
    // conservamos el estado que ya tenía el registro (existing.status).
    const newStatus = outOfRange ? 'PENDING_REVIEW' : existing.status;

    // Actualizamos el registro con los datos de salida.
    const record = await this.prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOutTime: today,        // hora exacta de salida
        checkOutLat: latitude,      // ubicación de salida
        checkOutLng: longitude,
        checkOutDistance: distance ? Math.round(distance) : null,
        status: newStatus,
      },
    });

    return { data: record };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getMyAttendanceToday(): devuelve el registro de HOY del empleado (o null si
  // todavía no ha marcado nada). Lo usa el frontend para saber qué botón mostrar.
  // ───────────────────────────────────────────────────────────────────────────
  async getMyAttendanceToday(tenantId: string, employeeId: string) {
    const today = new Date();
    // Día de hoy a medianoche UTC (clave del registro del día).
    const dateOnly = new Date(today.toISOString().split('T')[0] + 'T00:00:00Z');

    // Buscamos el registro único de hoy por la clave compuesta empleado+fecha.
    const record = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dateOnly } },
    });

    // "record || null": si no hay registro, findUnique ya devuelve null, pero el
    // "|| null" deja explícito que devolvemos null cuando no existe.
    return { data: record || null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // reviewAttendance(): el admin APRUEBA o RECHAZA un registro. Guarda quién y
  // cuándo lo revisó.
  // ───────────────────────────────────────────────────────────────────────────
  async reviewAttendance(id: string, tenantId: string, status: 'APPROVED' | 'REJECTED', userId: string) {
    // Buscamos el registro asegurándonos de que pertenece a este negocio (tenantId).
    const record = await this.prisma.attendance.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Registro no encontrado');

    // Actualizamos: nuevo estado, quién lo revisó (userId) y la fecha/hora actual.
    const updated = await this.prisma.attendance.update({
      where: { id },
      data: { status, reviewedBy: userId, reviewedAt: new Date() },
    });

    return { data: updated };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getPendingCount(): cuenta cuántos registros del negocio están pendientes de
  // revisión (PENDING_REVIEW). Para mostrar un badge con el número en el panel.
  // ───────────────────────────────────────────────────────────────────────────
  async getPendingCount(tenantId: string) {
    // count = cuenta cuántos registros cumplen la condición (sin traerlos todos).
    const count = await this.prisma.attendance.count({
      where: { tenantId, status: 'PENDING_REVIEW' },
    });
    return { data: { count } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // haversineDistance(): calcula la distancia EN METROS entre dos puntos GPS
  // (lat/lng) usando la fórmula de Haversine, que tiene en cuenta la curvatura
  // de la Tierra. Es "private" porque solo se usa dentro de este servicio.
  // ───────────────────────────────────────────────────────────────────────────
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // radio de la Tierra en metros (~6.371 km)
    // toRad: convierte grados a radianes (las funciones trigonométricas usan
    // radianes). Fórmula: grados * PI / 180.
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1); // diferencia de latitud, en radianes
    const dLng = toRad(lng2 - lng1); // diferencia de longitud, en radianes
    // "a" es un término intermedio de la fórmula de Haversine.
    //   - Math.sin(x) ** 2: el seno de x elevado al cuadrado (** = potencia).
    //   - combina las diferencias de latitud y longitud ponderadas por los
    //     cosenos de las latitudes.
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    // Distancia final = R * 2 * atan2(√a, √(1-a)). atan2 da el ángulo central; al
    // multiplicarlo por el radio obtenemos la distancia sobre la superficie.
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
