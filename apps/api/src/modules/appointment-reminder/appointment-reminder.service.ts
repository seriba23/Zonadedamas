import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
@Injectable()
export class AppointmentReminderService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(token: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      include: {
        client: { select: { firstName: true, lastName: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            color: true,
          },
        },
        items: {
          select: {
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
            serviceId: true,
          },
        },
        location: {
          select: {
            name: true,
            address: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
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
    if (!appointment) {
      throw new NotFoundException('Enlace invalido o expirado');
    }
    return appointment;
  }

  /** Cliente confirma la cita: status -> CONFIRMED, confirmedAt = now */
  async confirm(token: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: { id: true, tenantId: true, status: true, confirmedAt: true },
    });
    if (!appointment) {
      throw new NotFoundException('Enlace invalido o expirado');
    }
    if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede confirmar una cita ${appointment.status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: 'CONFIRMED',
        notes: 'Confirmada por cliente desde recordatorio',
      },
    });

    return { data: { confirmed: true, status: updated.status } };
  }

  /** Cliente cancela la cita: status -> CANCELLED */
  async cancel(token: string, reason?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: { id: true, tenantId: true, status: true },
    });
    if (!appointment) {
      throw new NotFoundException('Enlace invalido o expirado');
    }
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede cancelar una cita ${appointment.status.toLowerCase()}`,
      );
    }

    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED' },
    });

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
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede reagendar una cita ${appointment.status.toLowerCase()}`,
      );
    }

    // Duracion total de la cita (suma de durationSnapshot de items)
    const totalDuration = appointment.items.reduce(
      (sum, it) => sum + (it.durationSnapshot || 0),
      0,
    );
    if (totalDuration === 0) {
      throw new BadRequestException('La cita no tiene duracion valida');
    }

    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59Z`);

    // Horario laboral del empleado para ese dia
    const dayName = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ][dayStart.getUTCDay()];
    const schedule = await this.prisma.employeeSchedule.findFirst({
      where: {
        employeeId: appointment.employeeId,
        dayOfWeek: dayName as any,
        isWorking: true,
      },
    });
    if (!schedule) {
      return { data: { slots: [] } };
    }

    // Citas existentes del empleado ese dia (excepto la actual)
    const existing = await this.prisma.appointment.findMany({
      where: {
        employeeId: appointment.employeeId,
        tenantId: appointment.tenantId,
        startTime: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        id: { not: appointment.id },
      },
      select: { startTime: true, endTime: true },
    });

    // Genera slots cada 15 min dentro del horario y filtra los ocupados
    const slots: { startTime: string; available: boolean }[] = [];
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    for (let mins = startMin; mins + totalDuration <= endMin; mins += 15) {
      const slotStart = new Date(dayStart);
      slotStart.setUTCHours(Math.floor(mins / 60), mins % 60, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + totalDuration * 60000);

      const conflicts = existing.some((ap) => {
        const aStart = new Date(ap.startTime).getTime();
        const aEnd = new Date(ap.endTime).getTime();
        return slotStart.getTime() < aEnd && slotEnd.getTime() > aStart;
      });

      // Tampoco mostramos slots pasados
      const isPast = slotStart.getTime() < Date.now();

      slots.push({
        startTime: slotStart.toISOString(),
        available: !conflicts && !isPast,
      });
    }

    return { data: { slots } };
  }

  /** Cliente reagenda a un nuevo slot del mismo empleado/servicio. */
  async reschedule(token: string, newStartTime: string) {
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

    const totalDuration = appointment.items.reduce(
      (sum, it) => sum + (it.durationSnapshot || 0),
      0,
    );
    const newStart = new Date(newStartTime);
    if (isNaN(newStart.getTime())) {
      throw new BadRequestException('Fecha invalida');
    }
    if (newStart.getTime() < Date.now()) {
      throw new BadRequestException('No puedes reagendar a una fecha pasada');
    }
    const newEnd = new Date(newStart.getTime() + totalDuration * 60000);

    // Anti-conflicto: verificar que no haya otra cita del empleado en ese rango
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        employeeId: appointment.employeeId,
        tenantId: appointment.tenantId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        id: { not: appointment.id },
        OR: [
          { startTime: { gte: newStart, lt: newEnd } },
          { endTime: { gt: newStart, lte: newEnd } },
          { startTime: { lte: newStart }, endTime: { gte: newEnd } },
        ],
      },
      select: { id: true },
    });
    if (conflict) {
      throw new BadRequestException(
        'Ese horario ya esta ocupado, elige otro disponible',
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        startTime: newStart,
        endTime: newEnd,
        status: 'RESCHEDULED',
        // Reset confirmation flag (cliente debe confirmar el nuevo horario)
        confirmedAt: null,
      },
    });

    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: 'RESCHEDULED',
        notes: `Reagendada por cliente al ${newStart.toISOString()}`,
      },
    });

    return {
      data: {
        rescheduled: true,
        startTime: updated.startTime,
        endTime: updated.endTime,
      },
    };
  }
}
