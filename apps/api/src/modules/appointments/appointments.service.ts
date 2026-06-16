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
import { parseWallClock } from '../../common/utils/parse-wall-clock';
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
    // Wall-clock literal: parseWallClock fuerza UTC si el ISO viene naive,
    // así el valor guardado coincide con la hora que el cliente seleccionó
    // independientemente de la TZ del proceso. Ver doc en parse-wall-clock.ts.
    const startTime = parseWallClock(dto.startTime);
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

          // Check client overlap (cliente no puede tener 2 citas a la vez,
          // ni siquiera con empleados distintos). Se valida contra el rango
          // completo [startTime, endTime] de la cita nueva, no solo el slot
          // de inicio — asi una cita de 2 horas bloquea las 2 horas enteras.
          const clientOverlap = await tx.appointment.findFirst({
            where: {
              clientId: dto.clientId,
              tenantId,
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
            select: { id: true },
          });
          if (clientOverlap) {
            throw new ConflictException(
              'Ya tienes una cita en este horario. Selecciona otra hora.',
            );
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
      // Si la cita tenia productos reservados al hacer el booking,
      // marcarlos como DELIVERED ahora que se cobro (mismo motivo que en
      // payments.service y complete()).
      await this.prisma.productReservation.updateMany({
        where: {
          appointmentId: existingAppointment.id,
          tenantId,
          status: { in: ['PENDING', 'CONFIRMED', 'READY'] },
        },
        data: { status: 'DELIVERED' },
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
    if (filters.employeeIds) {
      const ids = filters.employeeIds.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) where.employeeId = { in: ids };
    } else if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.status) where.status = filters.status;

    // pendingPosPayment=true: el POS lista "Por cobrar" de cualquier dia.
    // Cuando este filtro está activo, ignoramos startDate/endDate.
    const isPendingPos = filters.pendingPosPayment === 'true';
    if (isPendingPos) {
      where.pendingPosPayment = true;
    } else if (filters.startDate || filters.endDate) {
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
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              // Si el cliente registró su cuenta en el portal, su foto vive
              // en users.avatar_url, no en clients.avatar_url. Tambien las
              // alergias viven solo en User (no en Client local). Traemos
              // ambas y el frontend hace fallback.
              user: { select: { avatarUrl: true, allergies: true } },
            },
          },
          employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
          items: { select: { serviceId: true, serviceNameSnapshot: true, priceSnapshot: true, durationSnapshot: true, commissionSnapshot: true } },
          // Para que el frontend pueda filtrar pagadas vs no pagadas sin
          // hacer queries adicionales. Trae todos los pagos; el frontend
          // filtra por status=COMPLETED.
          payments: true,
          // Productos reservados con la cita (para que el empleado vea lo
          // que el cliente sumó al booking).
          productReservations: {
            include: { product: { select: { id: true, name: true, imageUrl: true } } },
          },
          // Cupón canjeado por puntos (si lo hay). discountAmount ya viene
          // como campo escalar del appointment.
          redemption: {
            select: {
              id: true,
              code: true,
              reward: { select: { name: true, type: true, discountAmount: true, discountMode: true } },
            },
          },
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
        client: {
          // Incluye user para traer las alergias (viven en User.allergies
          // cuando el cliente esta vinculado a una cuenta marketplace).
          include: { user: { select: { avatarUrl: true, allergies: true } } },
        },
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
    // Igual que en create: forzar UTC para preservar wall-clock literal.
    const newStartTime = parseWallClock(dto.startTime);
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

          // Same check pero contra el propio cliente: no puede tener dos
          // citas que se solapen, ni siquiera con empleados distintos.
          const clientOverlap = await tx.appointment.findFirst({
            where: {
              clientId: appointment.clientId,
              tenantId,
              id: { not: id },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
              startTime: { lt: newEndTime },
              endTime: { gt: newStartTime },
            },
            select: { id: true },
          });
          if (clientOverlap) {
            throw new ConflictException(
              'Ya tienes una cita en este horario. Selecciona otra hora.',
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

    // Si la cita se completa sin haber registrado ningun pago previamente
    // (caso tipico: el admin marca COMPLETED desde el AppointmentModal sin
    // pasar por el wizard del empleado), la cita debe quedar pendiente de
    // cobro en el POS. Sin esto, la cita desaparece del POS y queda sin
    // posibilidad de cobrar. Si ya hay un pago COMPLETED, no hace falta.
    const existingPayment = await this.prisma.payment.findFirst({
      where: { appointmentId: id, tenantId, status: 'COMPLETED' },
      select: { id: true },
    });
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        pendingPosPayment: existingPayment ? false : true,
      },
    });

    // Productos reservados al hacer el booking: marcarlos como DELIVERED
    // cuando la cita se completa por el wizard del empleado (pago en
    // recepción o sin pago). Mismo razonamiento que en payments.service:
    // si no marcamos, quedan en PENDING y los reportes los muestran como
    // "por entregar" para siempre. El stock ya se descontó al crear la
    // reservación, aquí solo cambia el estado.
    await this.prisma.productReservation.updateMany({
      where: {
        appointmentId: id,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'READY'] },
      },
      data: { status: 'DELIVERED' },
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

    // Notificación push de "Califica tu experiencia" — registramos la
    // intención. Cuando se conecte FCM/APNS, el worker que consuma
    // NotificationLog con status=SENT y channel=PUSH disparará el envío
    // real. Si hay confirmationToken, incluimos el deeplink al QR/page;
    // si no, link genérico al portal del cliente.
    try {
      const client = appointment.clientId
        ? await this.prisma.client.findUnique({
            where: { id: appointment.clientId },
            select: { firstName: true, email: true, phone: true },
          })
        : null;
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true, name: true },
      });
      const deepLink = updated.confirmationToken
        ? `/confirm-payment/${updated.confirmationToken}`
        : `/portal/${tenant?.slug || ''}/appointments/${id}`;
      await this.prisma.notificationLog.create({
        data: {
          tenantId,
          channel: 'PUSH',
          eventName: 'appointment.completed',
          recipientEmail: client?.email || null,
          recipientPhone: client?.phone || null,
          subject: 'Califica tu experiencia',
          body: `Hola ${client?.firstName || ''}, tu cita en ${tenant?.name || ''} fue completada. Califica tu experiencia: ${deepLink}`.trim(),
          status: 'SENT',
          metadata: { appointmentId: id, deepLink },
          sentAt: new Date(),
        },
      });
    } catch (err) {
      // No bloqueamos el cierre de la cita si el log de notificación falla.
      this.logger.warn(`Failed to log appointment.completed push intent: ${err}`);
    }

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

  /**
   * El empleado finalizó el servicio (consent + fotos opcionales) pero el
   * cliente pagará en recepción. Marca la cita pendingPosPayment=true para
   * que aparezca en /pos con badge "Por cobrar". La cita queda IN_PROGRESS;
   * el POS la completará tras registrar el pago.
   */
  async deferToPos(id: string, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: { payments: true },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
      throw new BadRequestException('No se puede delegar al POS una cita finalizada');
    }

    if (appointment.payments.length > 0) {
      throw new ConflictException('Esta cita ya tiene un pago registrado');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        pendingPosPayment: true,
        status: appointment.status === 'PENDING' || appointment.status === 'CONFIRMED'
          ? 'IN_PROGRESS'
          : appointment.status,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.deferred_to_pos',
      entityType: 'appointment',
      entityId: id,
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

  /**
   * Genera el token de confirmación que el cliente usa para confirmar el
   * cobro y dejar su reseña desde su móvil (QR/link al cierre de cita).
   * Idempotente: si ya existe token y no se confirmó, lo devuelve. Si ya
   * se confirmó (confirmedAt set), no se vuelve a generar.
   */
  async generateConfirmationToken(id: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, confirmationToken: true, confirmedAt: true },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    if (appointment.confirmedAt) {
      return { data: { token: appointment.confirmationToken, alreadyConfirmed: true } };
    }
    if (appointment.confirmationToken) {
      return { data: { token: appointment.confirmationToken, alreadyConfirmed: false } };
    }
    // Token de 12 chars (sin ambiguos 0/O, 1/I/L). 32^12 ~ 1.15e18 combinaciones.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { confirmationToken: token },
      select: { confirmationToken: true },
    });
    return { data: { token: updated.confirmationToken, alreadyConfirmed: false } };
  }

  /**
   * Lista citas pendientes de recordatorio WhatsApp. Por defecto:
   * - PENDING o CONFIRMED (no canceladas/completadas)
   * - startTime entre ahora y ahora+36h
   * - reminderSentAt null
   *
   * Si sentToday=true, devuelve solo las que YA se les envio recordatorio
   * hoy (para la pestaña "Enviados hoy").
   */
  async listPendingReminders(
    tenantId: string,
    opts: { hoursAhead: number; sentToday: boolean },
  ) {
    const now = new Date();
    const limit = new Date(now.getTime() + opts.hoursAhead * 3600 * 1000);

    const where: any = {
      tenantId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      startTime: { gte: now, lte: limit },
    };

    if (opts.sentToday) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      where.reminderSentAt = { gte: todayStart };
    } else {
      where.reminderSentAt = null;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true },
        },
        items: {
          select: { serviceNameSnapshot: true, priceSnapshot: true, durationSnapshot: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return { data: appointments };
  }

  /**
   * Marca la cita como "recordatorio enviado" y, si no existe, genera el
   * confirmationToken para que el frontend lo incluya en el wa.me link.
   */
  async markReminderSent(id: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      select: { id: true, confirmationToken: true },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');

    let token = appointment.confirmationToken;
    if (!token) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      token = '';
      for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    await this.prisma.appointment.update({
      where: { id },
      data: {
        confirmationToken: token,
        reminderSentAt: new Date(),
      },
    });

    return { data: { token, reminderSentAt: new Date().toISOString() } };
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
