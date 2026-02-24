import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';
import { AvailabilityService } from '../availability/availability.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleDto, CancelDto } from './dto/reschedule.dto';
import { FilterAppointmentsDto } from './dto/filter-appointments.dto';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async create(dto: CreateAppointmentDto, tenantId: string, userId?: string) {
    // Validate employee belongs to tenant
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, isActive: true },
    });
    if (!employee) {
      throw new NotFoundException('Empleado no encontrado o inactivo');
    }

    // Validate client belongs to tenant
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId, isActive: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado o inactivo');
    }

    // Fetch services for snapshot data
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds }, tenantId },
    });

    if (services.length !== dto.serviceIds.length) {
      throw new NotFoundException('Uno o más servicios no encontrados');
    }

    // Fetch employee-specific pricing (customPrice, commission)
    const employeeServices = await this.prisma.employeeService.findMany({
      where: {
        employeeId: dto.employeeId,
        serviceId: { in: dto.serviceIds },
      },
    });
    const empServiceMap = new Map(
      employeeServices.map((es) => [es.serviceId, es]),
    );

    // Calculate total duration and end time
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );
    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + totalDuration * 60000);

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Check for overlapping appointments (double-booking prevention)
          const overlap = await tx.appointment.findFirst({
            where: {
              employeeId: dto.employeeId,
              tenantId,
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          });
          if (overlap) {
            throw new ConflictException(
              'Este horario ya está reservado. Por favor selecciona otro horario.',
            );
          }

          // Create the appointment
          const appointment = await tx.appointment.create({
            data: {
              tenantId,
              locationId: dto.locationId,
              clientId: dto.clientId,
              employeeId: dto.employeeId,
              startTime,
              endTime,
              notes: dto.notes,
              internalNotes: dto.internalNotes,
              source: dto.source || 'MANUAL',
              createdBy: userId,
              status: 'PENDING',
            },
          });

          // Create appointment items with price/duration snapshots
          let currentStart = new Date(startTime);
          const items = [];
          for (const service of services) {
            const empSvc = empServiceMap.get(service.id);
            const price = empSvc?.customPrice ?? service.price;
            const commission = empSvc?.commission ?? null;
            const itemEnd = new Date(
              currentStart.getTime() + service.durationMinutes * 60000,
            );
            items.push({
              appointmentId: appointment.id,
              serviceId: service.id,
              employeeId: dto.employeeId,
              startTime: currentStart,
              endTime: itemEnd,
              priceSnapshot: price,
              commissionSnapshot: commission,
              durationSnapshot: service.durationMinutes,
              serviceNameSnapshot: service.name,
            });
            currentStart = new Date(
              itemEnd.getTime() + service.bufferAfterMinutes * 60000,
            );
          }

          await tx.appointmentItem.createMany({ data: items });

          // Create initial status history
          await tx.appointmentStatusHistory.create({
            data: {
              appointmentId: appointment.id,
              fromStatus: null,
              toStatus: 'PENDING',
              changedBy: userId,
            },
          });

          return appointment;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Audit + Events (outside transaction, non-blocking)
      await this.auditService.log({
        tenantId,
        userId,
        action: 'appointment.created',
        entityType: 'appointment',
        entityId: result.id,
        newValues: result as any,
      });

      await this.eventsService.emitAppointmentCreated(tenantId, result.id, {
        locationId: dto.locationId,
        employeeId: dto.employeeId,
        startTime: startTime.toISOString(),
        date: startTime.toISOString().split('T')[0],
      });

      // Invalidate availability cache
      await this.availabilityService.invalidateCache(
        tenantId,
        dto.locationId,
        dto.employeeId,
        startTime.toISOString().split('T')[0],
      );

      return { data: result };
    } catch (error: any) {
      if (error.code === 'P2002' || error.message?.includes('no_employee_overlap')) {
        throw new ConflictException(
          'Este horario ya está reservado. Por favor selecciona otro horario.',
        );
      }
      throw error;
    }
  }

  async findAll(tenantId: string, filters: FilterAppointmentsDto) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.status) where.status = filters.status;

    if (filters.startDate || filters.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = new Date(filters.startDate);
      if (filters.endDate) where.startTime.lte = new Date(filters.endDate + 'T23:59:59Z');
    }

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { startTime: 'asc' },
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          employee: { select: { id: true, firstName: true, lastName: true, color: true } },
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true, durationSnapshot: true } },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, filters);
  }

  async findOne(id: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        employee: true,
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        payments: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    return { data: appointment };
  }

  async update(id: string, dto: UpdateAppointmentDto, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        notes: dto.notes ?? appointment.notes,
        internalNotes: dto.internalNotes ?? appointment.internalNotes,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.updated',
      entityType: 'appointment',
      entityId: id,
      oldValues: appointment as any,
      newValues: updated as any,
    });

    return { data: updated };
  }

  async reschedule(id: string, dto: RescheduleDto, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede reagendar una cita con estado: ${appointment.status}`,
      );
    }

    // Fetch original services to include bufferAfterMinutes (matching create behavior)
    const serviceIds = appointment.items.map((item) => item.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });
    const serviceBufferMap = new Map(
      services.map((s) => [s.id, s.bufferAfterMinutes]),
    );

    const totalDuration = appointment.items.reduce(
      (sum, item) =>
        sum + item.durationSnapshot + (serviceBufferMap.get(item.serviceId) ?? 0),
      0,
    );
    const newStartTime = new Date(dto.startTime);
    const newEndTime = new Date(newStartTime.getTime() + totalDuration * 60000);
    const employeeId = dto.employeeId || appointment.employeeId;
    const oldDate = appointment.startTime.toISOString().split('T')[0];
    const newDate = newStartTime.toISOString().split('T')[0];

    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          // Check for overlapping appointments (exclude current appointment)
          const overlap = await tx.appointment.findFirst({
            where: {
              employeeId,
              tenantId,
              id: { not: id },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
              startTime: { lt: newEndTime },
              endTime: { gt: newStartTime },
            },
          });
          if (overlap) {
            throw new ConflictException(
              'Este horario ya está reservado.',
            );
          }

          const result = await tx.appointment.update({
            where: { id },
            data: {
              employeeId,
              startTime: newStartTime,
              endTime: newEndTime,
              status: 'PENDING',
            },
          });

          // Update individual item start/end times to match new schedule
          let itemStart = new Date(newStartTime);
          for (const item of appointment.items) {
            const buffer = serviceBufferMap.get(item.serviceId) ?? 0;
            const itemEnd = new Date(
              itemStart.getTime() + item.durationSnapshot * 60000,
            );
            await tx.appointmentItem.update({
              where: { id: item.id },
              data: {
                employeeId,
                startTime: itemStart,
                endTime: itemEnd,
              },
            });
            itemStart = new Date(itemEnd.getTime() + buffer * 60000);
          }

          await tx.appointmentStatusHistory.create({
            data: {
              appointmentId: id,
              fromStatus: appointment.status,
              toStatus: 'PENDING',
              changedBy: userId,
              notes: `Rescheduled to ${newStartTime.toISOString()}`,
            },
          });

          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.auditService.log({
        tenantId,
        userId,
        action: 'appointment.rescheduled',
        entityType: 'appointment',
        entityId: id,
        oldValues: { startTime: appointment.startTime, endTime: appointment.endTime },
        newValues: { startTime: newStartTime, endTime: newEndTime },
      });

      await this.eventsService.emitAppointmentRescheduled(tenantId, id, {
        locationId: appointment.locationId,
        employeeId,
        oldStartTime: appointment.startTime.toISOString(),
        newStartTime: newStartTime.toISOString(),
      });

      // Invalidate cache for both old and new dates
      await this.availabilityService.invalidateCache(
        tenantId, appointment.locationId, appointment.employeeId, oldDate,
      );
      await this.availabilityService.invalidateCache(
        tenantId, appointment.locationId, employeeId, newDate,
      );

      return { data: updated };
    } catch (error: any) {
      if (error.code === 'P2002' || error.message?.includes('no_employee_overlap')) {
        throw new ConflictException('Este horario ya está reservado.');
      }
      throw error;
    }
  }

  async cancel(id: string, dto: CancelDto, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede cancelar una cita con estado: ${appointment.status}`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason: dto.reason,
        cancelledBy: userId,
      },
    });

    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        fromStatus: appointment.status,
        toStatus: 'CANCELLED',
        changedBy: userId,
        notes: dto.reason,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.cancelled',
      entityType: 'appointment',
      entityId: id,
      oldValues: { status: appointment.status },
      newValues: { status: 'CANCELLED', reason: dto.reason },
    });

    await this.eventsService.emitAppointmentCancelled(tenantId, id, {
      locationId: appointment.locationId,
      employeeId: appointment.employeeId,
      date: appointment.startTime.toISOString().split('T')[0],
    });

    await this.availabilityService.invalidateCache(
      tenantId,
      appointment.locationId,
      appointment.employeeId,
      appointment.startTime.toISOString().split('T')[0],
    );

    return { data: updated };
  }

  async complete(id: string, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.status === 'COMPLETED') {
      throw new BadRequestException('La cita ya está completada');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('No se puede completar una cita cancelada');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        fromStatus: appointment.status,
        toStatus: 'COMPLETED',
        changedBy: userId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.completed',
      entityType: 'appointment',
      entityId: id,
      oldValues: { status: appointment.status },
      newValues: { status: 'COMPLETED' },
    });

    await this.eventsService.emitAppointmentCompleted(tenantId, id, {
      locationId: appointment.locationId,
      employeeId: appointment.employeeId,
    });

    return { data: updated };
  }

  async confirm(id: string, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (!['PENDING', 'RESCHEDULED'].includes(appointment.status)) {
      throw new BadRequestException('Solo se pueden confirmar citas pendientes o reagendadas');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });

    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        fromStatus: appointment.status,
        toStatus: 'CONFIRMED',
        changedBy: userId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.confirmed',
      entityType: 'appointment',
      entityId: id,
      oldValues: { status: appointment.status },
      newValues: { status: 'CONFIRMED' },
    });

    return { data: updated };
  }
}
