// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos tres cosas:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un
//     "servicio" que NestJS puede crear e inyectar en otras clases.
//   - NotFoundException: error listo para usar que, al lanzarse, hace que la
//     API responda con código HTTP 404 (no encontrado).
//   - BadRequestException: error que responde con HTTP 400 (petición inválida).
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

// PrismaService es nuestro "puente" hacia la base de datos. Prisma es la
// herramienta (ORM) que convierte llamadas de JavaScript en consultas SQL.
// A través de this.prisma podremos leer/escribir tablas como appointment,
// employeeSchedule, etc.
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servicio para el flujo "Recordatorio pre-cita" del cliente.
 *
 * Disparador: admin del negocio pulsa el boton de WhatsApp en el dashboard.
 * Se genera (o reusa) un token corto y se le envia al cliente por wa.me.
 * El cliente abre /c/:token y puede: confirmar la cita, reagendar a otro
 * horario disponible del mismo empleado, o cancelar.
 *
 * Distinto del modulo confirm-payment (que sirve para la post-cita: cobrar
 * y resenar). Aqui no se cobra ni se resena, solo se gestiona asistencia.
 */
@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class AppointmentReminderService {
  // El constructor recibe el PrismaService que NestJS inyecta automáticamente.
  // "private readonly prisma" lo guarda como propiedad (this.prisma) de solo
  // lectura, para usarlo en todos los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // resolve(): busca la cita a partir del token y devuelve sus datos completos
  // para mostrarlos en la página que abre el cliente.
  // ───────────────────────────────────────────────────────────────────────────
  async resolve(token: string) {
    // findUnique = "encuentra UN registro único". Buscamos la cita cuyo
    // confirmationToken sea igual al token recibido.
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token }, // condición de búsqueda
      // "include" = además de la cita, trae datos de tablas relacionadas.
      include: {
        // Del cliente solo queremos su nombre (select elige campos puntuales).
        client: { select: { firstName: true, lastName: true } },
        // Del empleado: id, nombre, foto y color (para pintar su avatar).
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            color: true,
          },
        },
        // items = los servicios de la cita. "Snapshot" significa que se guardó
        // una copia del nombre/precio/duración tal como estaban al reservar,
        // para que no cambien si luego editas el servicio.
        items: {
          select: {
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
            serviceId: true,
          },
        },
        // location = la sucursal: nombre, dirección, teléfono y coordenadas
        // (latitude/longitude) para poder abrir Google Maps.
        location: {
          select: {
            name: true,
            address: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
        // tenant = el negocio: nombre, slug (su nombre en la URL), logo,
        // imagen de portada y tipo (freelancer o negocio).
        tenant: {
          select: {
            name: true,
            slug: true,
            logoUrl: true,
            coverImageUrl: true,
            tenantType: true,
          },
        },
      },
    });

    // Si no se encontró ninguna cita con ese token, "appointment" será null.
    // "!appointment" se lee como "si NO hay cita". En ese caso lanzamos un
    // error 404 con un mensaje para el usuario.
    if (!appointment) {
      throw new NotFoundException('Enlace invalido o expirado');
    }

    // Si todo salió bien, devolvemos la cita con todos sus datos relacionados.
    return appointment;
  }

  /** Cliente confirma la cita: status -> CONFIRMED, confirmedAt = now */
  async confirm(token: string) {
    // Buscamos la cita por su token, pero esta vez solo traemos los campos
    // mínimos que necesitamos para decidir (id, negocio, estado y si ya estaba
    // confirmada). Traer menos campos hace la consulta más rápida.
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: { id: true, tenantId: true, status: true, confirmedAt: true },
    });
    // Si no existe la cita -> error 404.
    if (!appointment) {
      throw new NotFoundException('Enlace invalido o expirado');
    }

    // VALIDACIÓN: no se puede confirmar una cita ya cerrada.
    // [..].includes(x) devuelve true si "x" está dentro de la lista. Aquí
    // preguntamos: ¿el estado actual es CANCELLED, NO_SHOW o COMPLETED?
    // Si es así, no tiene sentido confirmarla -> error 400.
    if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(appointment.status)) {
      throw new BadRequestException(
        // toLowerCase() convierte "CANCELLED" en "cancelled" para el mensaje.
        `No se puede confirmar una cita ${appointment.status.toLowerCase()}`,
      );
    }

    // Actualizamos la cita: cambiamos su estado a CONFIRMED y guardamos la
    // fecha/hora exacta de confirmación. new Date() = el momento actual.
    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id }, // qué registro actualizar
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // Guardamos también un registro en el "historial de estados" de la cita,
    // para tener una bitácora de qué pasó y cuándo (de qué estado a cuál).
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        fromStatus: appointment.status, // estado anterior
        toStatus: 'CONFIRMED',          // estado nuevo
        notes: 'Confirmada por cliente desde recordatorio',
      },
    });

    // Devolvemos un objeto simple confirmando el éxito y el nuevo estado.
    return { data: { confirmed: true, status: updated.status } };
  }

  /** Cliente cancela la cita: status -> CANCELLED */
  async cancel(token: string, reason?: string) {
    // (Mismo patrón que confirm): buscar la cita por token con campos mínimos.
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: { id: true, tenantId: true, status: true },
    });
    if (!appointment) {
      throw new NotFoundException('Enlace invalido o expirado');
    }
    // No se puede cancelar algo que ya está cancelado/completado/sin asistencia.
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede cancelar una cita ${appointment.status.toLowerCase()}`,
      );
    }

    // Cambiamos el estado a CANCELLED.
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED' },
    });

    // Registramos el cambio en el historial. Aquí usamos un "operador ternario":
    //   condición ? valorSiVerdadero : valorSiFalso
    // Si el cliente escribió un motivo (reason), lo incluimos en la nota; si no,
    // ponemos una nota genérica.
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: 'CANCELLED',
        notes: reason
          ? `Cancelada por cliente: ${reason}`
          : 'Cancelada por cliente desde recordatorio',
      },
    });

    return { data: { cancelled: true } };
  }

  /**
   * Slots disponibles para reagendar. Solo mismo empleado, mismo servicio.
   * Si el cliente quiere cambiar empleado o servicio, debe contactar al
   * negocio (mantiene simple el flujo publico).
   */
  async availability(token: string, date: string) {
    // Buscamos la cita y traemos lo necesario para calcular horarios:
    // el empleado, la sucursal, el estado y la duración de sus servicios.
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: {
        id: true,
        tenantId: true,
        locationId: true,
        employeeId: true,
        status: true,
        items: { select: { serviceId: true, durationSnapshot: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Enlace invalido o expirado');
    }
    // No se reagenda una cita ya cerrada.
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede reagendar una cita ${appointment.status.toLowerCase()}`,
      );
    }

    // ── DURACIÓN TOTAL DE LA CITA ──
    // reduce() recorre una lista y la "reduce" a un solo valor acumulado.
    //   - "sum" es el acumulador (empieza en 0, ver el 0 del final).
    //   - "it" es cada item (servicio) de la cita en cada vuelta.
    //   - En cada vuelta sumamos la duración del item al acumulador.
    //   - "(it.durationSnapshot || 0)": si la duración fuera null/undefined,
    //     el "|| 0" usa 0 en su lugar (evita sumar "nada" y romper el cálculo).
    const totalDuration = appointment.items.reduce(
      (sum, it) => sum + (it.durationSnapshot || 0),
      0, // valor inicial del acumulador
    );
    // Si la duración total es 0, no podemos calcular slots -> error.
    if (totalDuration === 0) {
      throw new BadRequestException('La cita no tiene duracion valida');
    }

    // Convertimos la fecha (texto "2026-06-23") en el inicio y el fin de ese
    // día, en formato Date. La "Z" al final significa zona horaria UTC.
    const dayStart = new Date(`${date}T00:00:00Z`); // 00:00:00 de ese día
    const dayEnd = new Date(`${date}T23:59:59Z`);   // 23:59:59 de ese día

    // ── HORARIO LABORAL DEL EMPLEADO ESE DÍA ──
    // getUTCDay() devuelve un número de 0 a 6 (0=domingo ... 6=sábado).
    // Usamos ese número como índice del arreglo para obtener el nombre del día
    // que la base de datos espera (en mayúsculas e inglés).
    const dayName = [
      'SUNDAY',    // índice 0
      'MONDAY',    // índice 1
      'TUESDAY',   // índice 2
      'WEDNESDAY', // índice 3
      'THURSDAY',  // índice 4
      'FRIDAY',    // índice 5
      'SATURDAY',  // índice 6
    ][dayStart.getUTCDay()];
    // Buscamos la fila del horario del empleado para ese día de la semana,
    // pero solo si ese día trabaja (isWorking: true).
    const schedule = await this.prisma.employeeSchedule.findFirst({
      where: {
        employeeId: appointment.employeeId,
        dayOfWeek: dayName as any, // "as any" evita un choque de tipos con el enum
        isWorking: true,
      },
    });
    // Si no hay horario ese día, el empleado no trabaja -> devolvemos lista vacía.
    if (!schedule) {
      return { data: { slots: [] } };
    }

    // ── CITAS YA EXISTENTES DEL EMPLEADO ESE DÍA ──
    // Las necesitamos para no ofrecer horarios que choquen con otra cita.
    const existing = await this.prisma.appointment.findMany({
      where: {
        employeeId: appointment.employeeId,
        tenantId: appointment.tenantId,
        // startTime entre el inicio y el fin del día (gte=>=, lte=<=).
        startTime: { gte: dayStart, lte: dayEnd },
        // notIn = "que NO esté en esta lista": ignoramos canceladas y no-shows.
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        // not = "distinto de": excluimos la propia cita que se va a reagendar.
        id: { not: appointment.id },
      },
      select: { startTime: true, endTime: true },
    });

    // ── GENERAR LOS SLOTS (huecos de horario) cada 15 minutos ──
    // slots será la lista de resultados: cada elemento dice a qué hora empieza
    // y si está disponible o no.
    const slots: { startTime: string; available: boolean }[] = [];

    // schedule.startTime es un texto tipo "09:30". Lo partimos por ":" en dos
    // trozos ["09","30"] y con .map(Number) los convertimos a números [9, 30].
    // Luego, con desestructuración, guardamos el primero en startH y el segundo
    // en startM.
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    // Pasamos las horas a "minutos desde la medianoche" para poder iterar fácil.
    // Ej.: 09:30 -> 9*60 + 30 = 570 minutos.
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    // BUCLE FOR: recorre el horario en pasos de 15 minutos.
    //   - "mins" empieza en startMin (apertura).
    //   - Condición para seguir: que la cita (mins + duración) quepa antes del
    //     cierre (endMin). Si ya no cabe, el bucle termina.
    //   - "mins += 15": en cada vuelta avanzamos 15 minutos.
    for (let mins = startMin; mins + totalDuration <= endMin; mins += 15) {
      // Construimos la fecha/hora exacta de inicio de este slot.
      const slotStart = new Date(dayStart);
      // setUTCHours(horas, minutos, segundos, milisegundos).
      //   - Math.floor(mins / 60): la parte entera de los minutos => las horas.
      //   - mins % 60: el resto de dividir entre 60 => los minutos sueltos.
      slotStart.setUTCHours(Math.floor(mins / 60), mins % 60, 0, 0);
      // El fin del slot = inicio + duración. Multiplicamos por 60000 porque la
      // duración está en minutos y getTime() trabaja en milisegundos
      // (1 minuto = 60000 ms).
      const slotEnd = new Date(slotStart.getTime() + totalDuration * 60000);

      // ¿Este slot choca con alguna cita existente?
      // some() recorre la lista "existing" y devuelve true en cuanto UNA cita
      // cumpla la condición (es decir, "¿hay alguna que choque?").
      const conflicts = existing.some((ap) => {
        const aStart = new Date(ap.startTime).getTime(); // inicio de la otra cita (ms)
        const aEnd = new Date(ap.endTime).getTime();     // fin de la otra cita (ms)
        // REGLA DE SOLAPAMIENTO de dos intervalos de tiempo:
        // se solapan si "mi inicio es antes del fin del otro" Y
        // "mi fin es después del inicio del otro". Si ambas son verdad, chocan.
        return slotStart.getTime() < aEnd && slotEnd.getTime() > aStart;
      });

      // Tampoco mostramos slots pasados.
      // Date.now() = el instante actual en milisegundos. Si el slot empieza
      // antes de "ahora", ya pasó.
      const isPast = slotStart.getTime() < Date.now();

      // Agregamos el slot a la lista. Está disponible solo si NO choca con otra
      // cita (!conflicts) Y NO está en el pasado (!isPast).
      // toISOString() convierte la fecha a un texto estándar (ej. "2026-06-23T15:30:00.000Z").
      slots.push({
        startTime: slotStart.toISOString(),
        available: !conflicts && !isPast,
      });
    }

    // Devolvemos todos los slots calculados.
    return { data: { slots } };
  }

  /** Cliente reagenda a un nuevo slot del mismo empleado/servicio. */
  async reschedule(token: string, newStartTime: string) {
    // Buscamos la cita y traemos lo necesario para validar y mover el horario.
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: {
        id: true,
        tenantId: true,
        employeeId: true,
        status: true,
        items: { select: { durationSnapshot: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Enlace invalido o expirado');
    }
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede reagendar una cita ${appointment.status.toLowerCase()}`,
      );
    }

    // Duración total (mismo cálculo con reduce que en availability()).
    const totalDuration = appointment.items.reduce(
      (sum, it) => sum + (it.durationSnapshot || 0),
      0,
    );
    // Convertimos el texto de la nueva hora a un objeto Date.
    const newStart = new Date(newStartTime);
    // isNaN(...getTime()) detecta una fecha inválida: si el texto no era una
    // fecha real, getTime() da NaN ("Not a Number") y aquí lo rechazamos.
    if (isNaN(newStart.getTime())) {
      throw new BadRequestException('Fecha invalida');
    }
    // No permitimos reagendar a una fecha que ya pasó.
    if (newStart.getTime() < Date.now()) {
      throw new BadRequestException('No puedes reagendar a una fecha pasada');
    }
    // Calculamos el fin del nuevo horario (inicio + duración en milisegundos).
    const newEnd = new Date(newStart.getTime() + totalDuration * 60000);

    // ── ANTI-CONFLICTO: verificar que el empleado no tenga otra cita encima ──
    // findFirst busca la PRIMERA cita que cumpla las condiciones (si la hay).
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        employeeId: appointment.employeeId,
        tenantId: appointment.tenantId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        id: { not: appointment.id }, // ignorar la propia cita
        // OR = se cumple si CUALQUIERA de estas 3 situaciones de choque ocurre:
        OR: [
          // 1) Otra cita EMPIEZA dentro de mi nuevo rango.
          { startTime: { gte: newStart, lt: newEnd } },
          // 2) Otra cita TERMINA dentro de mi nuevo rango.
          { endTime: { gt: newStart, lte: newEnd } },
          // 3) Otra cita me ENVUELVE por completo (empieza antes y termina después).
          { startTime: { lte: newStart }, endTime: { gte: newEnd } },
        ],
      },
      select: { id: true },
    });
    // Si encontró un conflicto, ese horario está ocupado -> error.
    if (conflict) {
      throw new BadRequestException(
        'Ese horario ya esta ocupado, elige otro disponible',
      );
    }

    // Movemos la cita al nuevo horario y la marcamos como RESCHEDULED.
    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        startTime: newStart,
        endTime: newEnd,
        status: 'RESCHEDULED',
        // Borramos la confirmación previa (confirmedAt = null) porque el cliente
        // debe volver a confirmar el NUEVO horario.
        confirmedAt: null,
      },
    });

    // Bitácora del cambio en el historial de estados.
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: 'RESCHEDULED',
        notes: `Reagendada por cliente al ${newStart.toISOString()}`,
      },
    });

    // Devolvemos el resultado con el nuevo inicio y fin.
    return {
      data: {
        rescheduled: true,
        startTime: updated.startTime,
        endTime: updated.endTime,
      },
    };
  }
}
