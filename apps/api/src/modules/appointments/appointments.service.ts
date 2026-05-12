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
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
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
    private readonly planLimitsService: PlanLimitsService,
  ) {}

  async create(dto: CreateAppointmentDto, tenantId: string, userId?: string) {
    // Check plan appointment limit
    await this.planLimitsService.checkAppointmentLimit(tenantId);

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

    // Determine if this is a multi-employee bundle booking
    const isMultiEmployee = dto.serviceAssignments && dto.serviceAssignments.length > 0;

    // Build assignment map: serviceId -> employeeId
    const assignmentMap = new Map<string, string>();
    if (isMultiEmployee) {
      for (const a of dto.serviceAssignments!) {
        assignmentMap.set(a.serviceId, a.employeeId);
      }
    }

    // Fetch employee-specific pricing for all involved employees
    const involvedEmployeeIds = isMultiEmployee
      ? [...new Set(dto.serviceAssignments!.map((a) => a.employeeId))]
      : [dto.employeeId];

    const employeeServices = await this.prisma.employeeService.findMany({
      where: {
        employeeId: { in: involvedEmployeeIds },
        serviceId: { in: dto.serviceIds },
      },
    });

    // Validate: each service has an assigned employee that can do it
    if (!isMultiEmployee) {
      if (employeeServices.filter((es) => es.employeeId === dto.employeeId).length !== dto.serviceIds.length) {
        const empES = employeeServices.filter((es) => es.employeeId === dto.employeeId);
        const missing = dto.serviceIds.filter(
          (id) => !empES.some((es) => es.serviceId === id),
        );
        const missingNames = services
          .filter((s) => missing.includes(s.id))
          .map((s) => s.name);
        throw new NotFoundException(
          `El empleado no tiene asignado(s): ${missingNames.join(', ')}`,
        );
      }
    } else {
      for (const a of dto.serviceAssignments!) {
        const has = employeeServices.some(
          (es) => es.employeeId === a.employeeId && es.serviceId === a.serviceId,
        );
        if (!has) {
          const svc = services.find((s) => s.id === a.serviceId);
          throw new NotFoundException(
            `El empleado asignado no tiene el servicio: ${svc?.name || a.serviceId}`,
          );
        }
      }
    }

    // Build empServiceMap keyed by `${employeeId}:${serviceId}`
    const empServiceMap = new Map(
      employeeServices.map((es) => [`${es.employeeId}:${es.serviceId}`, es]),
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
          // Check for overlapping appointments for all involved employees
          for (const empId of involvedEmployeeIds) {
            // Determine the time window this employee is involved in
            let empStart = startTime;
            let empEnd = endTime;

            if (isMultiEmployee) {
              // Calculate exact window for this employee
              let currentMs = startTime.getTime();
              let first: number | null = null;
              let last: number | null = null;
              for (const service of services) {
                const assignedEmp = assignmentMap.get(service.id) || dto.employeeId;
                const itemEndMs = currentMs + service.durationMinutes * 60000;
                if (assignedEmp === empId) {
                  if (first === null) first = currentMs;
                  last = itemEndMs;
                }
                currentMs = itemEndMs + service.bufferAfterMinutes * 60000;
              }
              if (first !== null && last !== null) {
                empStart = new Date(first);
                empEnd = new Date(last);
              } else {
                continue; // Employee not involved
              }
            }

            const overlap = await tx.appointment.findFirst({
              where: {
                employeeId: empId,
                tenantId,
                status: { notIn: ['CANCELLED', 'NO_SHOW'] },
                startTime: { lt: empEnd },
                endTime: { gt: empStart },
              },
            });
            if (overlap) {
              throw new ConflictException(
                'Este horario ya está reservado. Por favor selecciona otro horario.',
              );
            }
          }

          // Create the appointment
          const appointment = await tx.appointment.create({
            data: {
              tenantId,
              locationId: dto.locationId,
              clientId: dto.clientId,
              employeeId: dto.employeeId,
              bundleId: dto.bundleId || null,
              startTime,
              endTime,
              notes: dto.notes,
              internalNotes: dto.internalNotes,
              source: dto.source || 'MANUAL',
              createdBy: userId,
              status: 'CONFIRMED',
            },
          });

          // Create appointment items with price/duration snapshots
          let currentStart = new Date(startTime);
          const items = [];
          for (const service of services) {
            const itemEmployeeId = assignmentMap.get(service.id) || dto.employeeId;
            const empSvc = empServiceMap.get(`${itemEmployeeId}:${service.id}`);
            const price = empSvc?.customPrice ?? service.price;
            const commission = empSvc?.commission ?? null;
            const itemEnd = new Date(
              currentStart.getTime() + service.durationMinutes * 60000,
            );
            items.push({
              appointmentId: appointment.id,
              serviceId: service.id,
              employeeId: itemEmployeeId,
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
              toStatus: 'CONFIRMED',
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

      // Invalidate availability cache for all involved employees
      const dateStr = startTime.toISOString().split('T')[0];
      for (const empId of involvedEmployeeIds) {
        await this.availabilityService.invalidateCache(
          tenantId,
          dto.locationId,
          empId,
          dateStr,
        );
      }

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

  /**
   * Create appointment from POS sale. Calculates startTime = now - totalDuration.
   * Skips overlap validation (POS exception). Links to payment.
   */
  async createFromPos(
    tenantId: string,
    data: {
      clientId: string;
      locationId: string;
      serviceAssignments: Array<{ serviceId: string; employeeId: string }>;
      notes?: string;
    },
    userId?: string,
  ) {
    const services = await this.prisma.service.findMany({
      where: { id: { in: data.serviceAssignments.map((a) => a.serviceId) }, tenantId },
    });

    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const now = new Date();
    const startTime = new Date(now.getTime() - totalDuration * 60000);
    const endTime = now;
    const primaryEmployeeId = data.serviceAssignments[0]?.employeeId;

    // Check if client already has a pending appointment today
    const todayStart = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');
    const todayEnd = new Date(now.toISOString().split('T')[0] + 'T23:59:59Z');
    const existingAppointment = await this.prisma.appointment.findFirst({
      where: {
        clientId: data.clientId,
        tenantId,
        startTime: { gte: todayStart, lte: todayEnd },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (existingAppointment) {
      // Complete the existing appointment instead of creating new
      await this.prisma.appointment.update({
        where: { id: existingAppointment.id },
        data: { status: 'COMPLETED' },
      });
      return { data: existingAppointment };
    }

    // Create appointment without overlap check (POS exception)
    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId,
        locationId: data.locationId,
        clientId: data.clientId,
        employeeId: primaryEmployeeId,
        startTime,
        endTime,
        source: 'WALK_IN',
        status: 'COMPLETED',
        notes: data.notes || 'Venta desde Punto de Venta',
        createdBy: userId,
      },
    });

    // Create appointment items
    let currentStart = new Date(startTime);
    const items = [];
    for (const assignment of data.serviceAssignments) {
      const service = services.find((s) => s.id === assignment.serviceId);
      if (!service) continue;

      const employeeService = await this.prisma.employeeService.findFirst({
        where: { employeeId: assignment.employeeId, serviceId: service.id },
      });

      const itemEnd = new Date(currentStart.getTime() + service.durationMinutes * 60000);
      items.push({
        appointmentId: appointment.id,
        serviceId: service.id,
        employeeId: assignment.employeeId,
        startTime: currentStart,
        endTime: itemEnd,
        priceSnapshot: employeeService?.customPrice ?? service.price,
        commissionSnapshot: employeeService?.commission ?? null,
        durationSnapshot: service.durationMinutes,
        serviceNameSnapshot: service.name,
      });
      currentStart = new Date(itemEnd.getTime() + service.bufferAfterMinutes * 60000);
    }

    if (items.length > 0) {
      await this.prisma.appointmentItem.createMany({ data: items });
    }

    await this.prisma.appointmentStatusHistory.create({
      data: { appointmentId: appointment.id, fromStatus: null, toStatus: 'COMPLETED', changedBy: userId },
    });

    return { data: appointment };
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
      // Aceptamos ISO completo ("2026-06-12T00:00:00.000-06:00") o YYYY-MM-DD.
      // Si es solo fecha, se agrega T00:00:00Z (start) o T23:59:59Z (end).
      if (filters.startDate) {
        where.startTime.gte = filters.startDate.includes('T')
          ? new Date(filters.startDate)
          : new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.startTime.lte = filters.endDate.includes('T')
          ? new Date(filters.endDate)
          : new Date(filters.endDate + 'T23:59:59Z');
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { startTime: 'asc' },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true, durationSnapshot: true, commissionSnapshot: true } },
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
        productReservations: {
          include: { product: { select: { id: true, name: true, imageUrl: true } } },
        },
        redemption: {
          select: {
            id: true,
            code: true,
            pointsSpent: true,
            reward: { select: { name: true, type: true, discountAmount: true, discountMode: true } },
          },
        },
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
              status: 'CONFIRMED',
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
              toStatus: 'CONFIRMED',
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.appointment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancellationReason: dto.reason,
          cancelledBy: userId,
        },
      });

      // Refund loyalty points spent on this booking
      if (appointment.pointsSpent > 0 && appointment.clientId) {
        await tx.client.update({
          where: { id: appointment.clientId },
          data: { loyaltyPoints: { increment: appointment.pointsSpent } },
        });
      }

      // Revert reward redemption (coupon) back to ACTIVE so the client can reuse it
      if (appointment.redemptionId) {
        await tx.rewardRedemption.update({
          where: { id: appointment.redemptionId },
          data: { status: 'ACTIVE', usedAt: null },
        });
      }

      return cancelled;
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

    // Photo requirement depends on client consent
    // null = wizard not completed yet → block
    // false = client declined → no photo required
    // true = client accepted → require at least 1 photo
    if (appointment.photoConsent === null || appointment.photoConsent === undefined) {
      throw new BadRequestException(
        'Debes completar el flujo de cierre de cita (consentimiento de fotos)',
      );
    }
    if (appointment.photoConsent === true) {
      const photoCount = await this.prisma.appointmentPhoto.count({
        where: { appointmentId: id, tenantId },
      });
      if (photoCount === 0) {
        throw new BadRequestException(
          'El cliente aceptó fotos del resultado. Debes subir al menos una foto',
        );
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    // Award loyalty points to client
    const items = await this.prisma.appointmentItem.findMany({
      where: { appointmentId: id },
      include: { service: { select: { pointsReward: true, price: true } } },
    });
    const totalPoints = items.reduce((sum, item) => {
      const pts =
        item.service.pointsReward ?? Math.floor(Number(item.service.price));
      return sum + pts;
    }, 0);
    if (totalPoints > 0 && appointment.clientId) {
      await this.prisma.client.update({
        where: { id: appointment.clientId },
        data: { loyaltyPoints: { increment: totalPoints } },
      });
    }

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

  async setPhotoConsent(
    id: string,
    tenantId: string,
    consent: boolean,
    userId?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
      throw new BadRequestException('No se puede modificar una cita finalizada');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { photoConsent: consent, photoConsentAt: new Date() },
    });

    return { data: updated };
  }

  async recordPayment(
    id: string,
    tenantId: string,
    dto: { paymentMethod: string; amount?: number; notes?: string },
    userId?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        items: { select: { priceSnapshot: true } },
        payments: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('No se puede registrar pago en una cita cancelada');
    }

    if (appointment.payments.length > 0) {
      throw new ConflictException('Esta cita ya tiene un pago registrado');
    }

    const totalAmount =
      dto.amount ??
      appointment.items.reduce((sum, i) => sum + Number(i.priceSnapshot), 0);

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        appointmentId: id,
        clientId: appointment.clientId,
        locationId: appointment.locationId,
        amount: totalAmount,
        totalAmount,
        currency: 'MXN',
        paymentMethod: dto.paymentMethod as any,
        status: 'COMPLETED',
        notes: dto.notes,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.payment_recorded',
      entityType: 'appointment',
      entityId: id,
      newValues: { paymentMethod: dto.paymentMethod, totalAmount },
    });

    return { data: payment };
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

    await this.eventsService.emitAppointmentConfirmed(tenantId, id, {
      locationId: appointment.locationId,
      employeeId: appointment.employeeId,
    });

    return { data: updated };
  }

  async noShow(id: string, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede marcar como no-show una cita con estado: ${appointment.status}`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'NO_SHOW' },
    });

    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        fromStatus: appointment.status,
        toStatus: 'NO_SHOW',
        changedBy: userId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.no_show',
      entityType: 'appointment',
      entityId: id,
      oldValues: { status: appointment.status },
      newValues: { status: 'NO_SHOW' },
    });

    await this.eventsService.emitAppointmentNoShow(tenantId, id, {
      locationId: appointment.locationId,
      employeeId: appointment.employeeId,
    });

    return { data: updated };
  }
}
