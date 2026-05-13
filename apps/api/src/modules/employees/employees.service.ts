import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseRangeBound } from '../../common/utils/date-range.util';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { SetSchedulesDto } from './dto/schedule.dto';
import { CreateTimeOffDto, ServiceConfigDto } from './dto/time-off.dto';
import { CreateReviewDto } from './dto/review.dto';
import { UpdatePersonalInfoDto } from './dto/personal-info.dto';
import { CreateDocumentDto } from './dto/document.dto';
import { CreateTrainingDto } from './dto/training.dto';
import { DeactivateEmployeeDto, DeactivateAction } from './dto/deactivate-employee.dto';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';
import { AvailabilityService } from '../availability/availability.service';
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly availabilityService: AvailabilityService,
    private readonly planLimitsService: PlanLimitsService,
    private readonly stripeService: StripeService,
  ) {}

  private async syncSubscriptionEmployeeCount(tenantId: string, employeeDeactivated = false) {
    try {
      const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
      if (!sub) return;

      if (sub.planInterval === 'ANNUAL') {
        // Annual plan: license becomes available, no Stripe quantity change
        if (employeeDeactivated) {
          await this.prisma.subscription.update({
            where: { tenantId },
            data: { availableLicenses: { increment: 1 } },
          });
        }
      } else if (sub.stripeSubscriptionId) {
        const count = await this.prisma.employee.count({ where: { tenantId, isActive: true } });
        await this.stripeService.updateSubscriptionEmployeeCount(tenantId, count);
      }
    } catch {
      // Non-blocking
    }
  }

  private getDayOfWeek(date: Date): 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY' {
    const days: ('SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY')[] = [
      'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
    ];
    return days[date.getUTCDay()];
  }

  async findAll(tenantId: string, pagination: PaginationDto, locationId?: string, includeInactive?: boolean, workingDate?: string) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (!includeInactive) where.isActive = true;
    if (locationId) where.locationId = locationId;

    // Filter by employees who have a working schedule on the given date
    if (workingDate) {
      const dateObj = new Date(workingDate + 'T00:00:00Z');
      const dayOfWeek = this.getDayOfWeek(dateObj);
      // Find employee IDs who work on this day
      const workingSchedules = await this.prisma.employeeSchedule.findMany({
        where: {
          dayOfWeek,
          isWorking: true,
          effectiveFrom: { lte: dateObj },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: dateObj } }],
          employee: { tenantId },
        },
        select: { employeeId: true },
        distinct: ['employeeId'],
      });
      const workingEmployeeIds = workingSchedules.map((s) => s.employeeId);
      where.id = { in: workingEmployeeIds };
    }

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          location: { select: { id: true, name: true } },
          employeeServices: { include: { service: { select: { id: true, name: true, price: true, durationMinutes: true } } } },
          schedules: { select: { isWorking: true, dayOfWeek: true } },
          _count: { select: { appointments: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    // Batch-fetch average ratings for returned employees
    const employeeIds = data.map((e) => e.id);
    const ratings = employeeIds.length > 0
      ? await this.prisma.employeeReview.groupBy({
          by: ['employeeId'],
          where: { employeeId: { in: employeeIds }, isVisible: true },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : [];

    const ratingMap = new Map(
      ratings.map((r) => [
        r.employeeId,
        {
          averageRating: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : null,
          totalReviews: r._count.rating,
        },
      ]),
    );

    const enriched = data.map((emp) => ({
      ...emp,
      averageRating: ratingMap.get(emp.id)?.averageRating ?? null,
      totalReviews: ratingMap.get(emp.id)?.totalReviews ?? 0,
    }));

    return buildPaginatedResponse(enriched, total, pagination);
  }

  async findByUserId(userId: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    return employee;
  }

  async findOne(id: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        location: true,
        employeeServices: { include: { service: true } },
        schedules: { orderBy: { dayOfWeek: 'asc' } },
        _count: { select: { portfolioImages: true, reviews: true, documents: true, trainings: true } },
      },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    return employee;
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    // Check plan employee limit
    await this.planLimitsService.checkEmployeeLimit(tenantId);

    // Verify location belongs to tenant
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId },
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    const employee = await this.prisma.employee.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        bio: dto.bio,
        color: dto.color ?? '#008080',
        locationId: dto.locationId,
        tenantId,
        isActive: dto.isActive ?? true,
        userId: dto.userId,
      },
    });

    // Auto-create default schedule: Mon-Sat 09:00-18:00
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
    await this.prisma.employeeSchedule.createMany({
      data: days.map((day) => ({
        employeeId: employee.id,
        dayOfWeek: day,
        isWorking: day !== 'SUNDAY',
        startTime: '09:00',
        endTime: '18:00',
        effectiveFrom: new Date('2020-01-01'),
      })),
    });

    this.syncSubscriptionEmployeeCount(tenantId);
    return employee;
  }

  async update(id: string, tenantId: string, dto: UpdateEmployeeDto) {
    await this.findOne(id, tenantId);
    // Normalize managerId: empty string → null
    const data: any = { ...dto };
    if ('managerId' in data && !data.managerId) {
      data.managerId = null;
    }
    const employee = await this.prisma.employee.update({
      where: { id },
      data,
    });
    if (dto.isActive !== undefined) {
      const deactivating = dto.isActive === false;
      this.syncSubscriptionEmployeeCount(tenantId, deactivating);
    }
    return employee;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
    this.syncSubscriptionEmployeeCount(tenantId, true);
    return { message: 'Empleado desactivado' };
  }

  async getSchedules(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeSchedule.findMany({
      where: { employeeId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async setSchedules(employeeId: string, tenantId: string, dto: SetSchedulesDto) {
    await this.findOne(employeeId, tenantId);

    return this.prisma.$transaction(async (tx) => {
      await tx.employeeSchedule.deleteMany({
        where: { employeeId },
      });

      const created = await tx.employeeSchedule.createMany({
        data: dto.schedules.map((s) => ({
          employeeId,
          dayOfWeek: s.dayOfWeek,
          isWorking: s.isWorking,
          startTime: s.startTime || '09:00',
          endTime: s.endTime || '18:00',
          effectiveFrom: s.effectiveFrom ? new Date(s.effectiveFrom) : new Date('2020-01-01'),
          effectiveUntil: s.effectiveUntil ? new Date(s.effectiveUntil) : undefined,
        })),
      });

      return tx.employeeSchedule.findMany({
        where: { employeeId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  async getTimeOff(employeeId: string, tenantId: string, status?: string) {
    await this.findOne(employeeId, tenantId);
    const where: any = { employeeId };
    if (status) where.status = status;
    return this.prisma.employeeTimeOff.findMany({
      where,
      orderBy: { startDatetime: 'asc' },
    });
  }

  async addTimeOff(
    employeeId: string,
    tenantId: string,
    dto: CreateTimeOffDto,
  ) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeTimeOff.create({
      data: {
        employeeId,
        startDatetime: new Date(dto.startDatetime),
        endDatetime: new Date(dto.endDatetime),
        reason: dto.reason,
        status: dto.status || 'APPROVED',
      },
    });
  }

  async removeTimeOff(
    employeeId: string,
    tenantId: string,
    timeOffId: string,
  ) {
    await this.findOne(employeeId, tenantId);
    const timeOff = await this.prisma.employeeTimeOff.findFirst({
      where: { id: timeOffId, employeeId },
    });
    if (!timeOff) throw new NotFoundException('Registro de tiempo libre no encontrado');

    await this.prisma.employeeTimeOff.delete({ where: { id: timeOffId } });
    return { message: 'Tiempo libre eliminado' };
  }

  async approveTimeOff(tenantId: string, employeeId: string, timeOffId: string, userId: string) {
    await this.findOne(employeeId, tenantId);
    const timeOff = await this.prisma.employeeTimeOff.findFirst({
      where: { id: timeOffId, employeeId },
    });
    if (!timeOff) throw new NotFoundException('Registro de tiempo libre no encontrado');
    if (timeOff.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden aprobar solicitudes pendientes');
    }
    return this.prisma.employeeTimeOff.update({
      where: { id: timeOffId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });
  }

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
        approvedBy: userId,
        approvedAt: new Date(),
        rejectionReason,
      },
    });
  }

  async getAllTimeOffs(tenantId: string, startDate: string, endDate: string, status?: string) {
    const where: any = {
      employee: { tenantId },
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

  async getStats(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      completedAllTime,
      completedThisMonth,
      cancelledCount,
      noShowCount,
      totalAppointments,
      revenueResult,
      commissionsResult,
      commissionsThisMonth,
      topServices,
      upcomingAppointments,
      ratingResult,
      topClients,
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: { employeeId, tenantId, status: 'COMPLETED' },
      }),
      this.prisma.appointment.count({
        where: {
          employeeId,
          tenantId,
          status: 'COMPLETED',
          startTime: { gte: startOfMonth },
        },
      }),
      this.prisma.appointment.count({
        where: { employeeId, tenantId, status: 'CANCELLED' },
      }),
      this.prisma.appointment.count({
        where: { employeeId, tenantId, status: 'NO_SHOW' },
      }),
      this.prisma.appointment.count({
        where: { employeeId, tenantId },
      }),
      this.prisma.appointmentItem.aggregate({
        where: {
          employeeId,
          appointment: { tenantId, status: 'COMPLETED' },
        },
        _sum: { priceSnapshot: true },
      }),
      this.prisma.appointmentItem.aggregate({
        where: {
          employeeId,
          appointment: { tenantId, status: 'COMPLETED' },
        },
        _sum: { commissionSnapshot: true },
      }),
      this.prisma.appointmentItem.aggregate({
        where: {
          employeeId,
          appointment: { tenantId, status: 'COMPLETED', startTime: { gte: startOfMonth } },
        },
        _sum: { commissionSnapshot: true },
      }),
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
      this.prisma.employeeReview.aggregate({
        where: { employeeId, tenantId, isVisible: true },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['clientId'],
        where: { employeeId, tenantId, status: 'COMPLETED' },
        _count: { clientId: true },
        orderBy: { _count: { clientId: 'desc' } },
        take: 5,
      }),
    ]);

    // Fetch top client names
    const topClientIds = topClients.map((c) => c.clientId);
    const clientNames = topClientIds.length > 0
      ? await this.prisma.client.findMany({
          where: { id: { in: topClientIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const clientMap = new Map(clientNames.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));

    const revenue = Number(revenueResult._sum.priceSnapshot ?? 0);
    const totalCommissions = Number(commissionsResult._sum.commissionSnapshot ?? 0);
    const monthCommissions = Number(commissionsThisMonth._sum.commissionSnapshot ?? 0);
    const cancellationRate =
      totalAppointments > 0
        ? Math.round(((cancelledCount + noShowCount) / totalAppointments) * 100)
        : 0;

    return {
      completedAllTime,
      completedThisMonth,
      cancelledCount,
      noShowCount,
      cancellationRate,
      totalRevenue: revenue,
      averageRating: ratingResult._avg.rating
        ? Math.round(ratingResult._avg.rating * 10) / 10
        : null,
      totalReviews: ratingResult._count.rating,
      totalCommissions,
      commissionsThisMonth: monthCommissions,
      topServices: topServices.map((s) => ({
        serviceName: s.serviceNameSnapshot,
        count: s._count.serviceNameSnapshot,
      })),
      topClients: topClients.map((c) => ({
        clientName: clientMap.get(c.clientId) || 'Unknown',
        count: c._count.clientId,
      })),
      upcomingAppointments,
    };
  }

  async getServices(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeService.findMany({
      where: { employeeId },
      include: { service: true },
    });
  }

  async setServices(
    employeeId: string,
    tenantId: string,
    services: ServiceConfigDto[],
  ) {
    await this.findOne(employeeId, tenantId);

    return this.prisma.$transaction(async (tx) => {
      const serviceIds = services.map((s) => s.serviceId);

      // Delete services no longer in the list
      await tx.employeeService.deleteMany({
        where: {
          employeeId,
          ...(serviceIds.length > 0
            ? { serviceId: { notIn: serviceIds } }
            : {}),
        },
      });

      if (services.length > 0) {
        // Validate all services belong to the tenant
        const validServices = await tx.service.findMany({
          where: { id: { in: serviceIds }, tenantId },
        });
        const validIds = new Set(validServices.map((s) => s.id));

        // Upsert each service with commission/customPrice
        for (const svc of services) {
          if (!validIds.has(svc.serviceId)) continue;
          await tx.employeeService.upsert({
            where: {
              employeeId_serviceId: { employeeId, serviceId: svc.serviceId },
            },
            update: {
              commission: svc.commission ?? null,
              customPrice: svc.customPrice ?? null,
            },
            create: {
              employeeId,
              serviceId: svc.serviceId,
              commission: svc.commission ?? null,
              customPrice: svc.customPrice ?? null,
            },
          });
        }
      }

      return tx.employeeService.findMany({
        where: { employeeId },
        include: { service: true },
      });
    });
  }

  // ─── AVATAR ────────────────────────────────────────

  async updateAvatar(employeeId: string, tenantId: string, avatarUrl: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { avatarUrl },
    });
  }

  // ─── PORTFOLIO ─────────────────────────────────────

  async getPortfolio(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeePortfolioImage.findMany({
      where: { employeeId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

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

  // ─── REVIEWS ───────────────────────────────────────

  async getReviews(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);

    const [reviews, aggregate] = await Promise.all([
      this.prisma.employeeReview.findMany({
        where: { employeeId, tenantId, isVisible: true },
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          appointment: {
            select: {
              id: true,
              startTime: true,
              items: {
                select: { serviceNameSnapshot: true },
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
      averageRating: aggregate._avg.rating
        ? Math.round(aggregate._avg.rating * 10) / 10
        : null,
      totalReviews: aggregate._count.rating,
    };
  }

  async createReview(
    employeeId: string,
    tenantId: string,
    dto: CreateReviewDto,
  ) {
    await this.findOne(employeeId, tenantId);

    // Validate the appointment exists, belongs to this employee+tenant, and is COMPLETED
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: dto.appointmentId,
        employeeId,
        tenantId,
        clientId: dto.clientId,
        status: 'COMPLETED',
      },
    });

    if (!appointment) {
      throw new BadRequestException(
        'La cita no existe, no está completada, o no pertenece a este empleado/cliente',
      );
    }

    // Check for duplicate review
    const existing = await this.prisma.employeeReview.findUnique({
      where: { appointmentId: dto.appointmentId },
    });
    if (existing) {
      throw new ConflictException('Ya existe una reseña para esta cita');
    }

    return this.prisma.employeeReview.create({
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
  }

  // ─── PERSONAL INFO ──────────────────────────────────

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

  async getDocuments(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.employeeDocument.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addDocument(
    id: string,
    tenantId: string,
    fileUrl: string,
    dto: CreateDocumentDto,
  ) {
    await this.findOne(id, tenantId);

    // If a document of this type already exists, replace it
    const existing = await this.prisma.employeeDocument.findUnique({
      where: {
        employeeId_documentType: {
          employeeId: id,
          documentType: dto.documentType,
        },
      },
    });

    if (existing) {
      const updated = await this.prisma.employeeDocument.update({
        where: { id: existing.id },
        data: { fileUrl },
      });
      return { document: updated, oldFileUrl: existing.fileUrl };
    }

    const document = await this.prisma.employeeDocument.create({
      data: {
        employeeId: id,
        documentType: dto.documentType,
        fileUrl,
      },
    });
    return { document, oldFileUrl: null };
  }

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

  async getEmployeeRoles(id: string, tenantId: string) {
    const employee = await this.findOne(id, tenantId);

    if (!employee.userId) {
      return { userId: null, roles: [] };
    }

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
      roles: userRoles.map((ur) => ({
        userRoleId: ur.id,
        roleId: ur.role.id,
        roleName: ur.role.name,
        roleSlug: ur.role.slug,
        isSystem: ur.role.isSystem,
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

  async getTrainings(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.employeeTraining.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

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
        dateCompleted: dto.dateCompleted ? new Date(dto.dateCompleted) : undefined,
        fileUrl,
      },
    });
  }

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

  async countPendingAppointments(employeeId: string, tenantId: string): Promise<number> {
    await this.findOne(employeeId, tenantId);
    return this.prisma.appointment.count({
      where: {
        employeeId,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
    });
  }

  async deactivate(
    employeeId: string,
    tenantId: string,
    dto: DeactivateEmployeeDto,
    userId: string,
  ) {
    const employee = await this.findOne(employeeId, tenantId);

    if (dto.action === DeactivateAction.SMART_RESCHEDULE) {
      return this.deactivateWithSmartReschedule(employee, tenantId, userId);
    }

    if (dto.action === DeactivateAction.REASSIGN) {
      return this.deactivateWithReassign(employee, tenantId, dto.targetEmployeeId!, userId);
    }

    if (dto.action === DeactivateAction.CANCEL) {
      return this.deactivateWithCancel(employee, tenantId, dto.cancelReason, userId);
    }

    // KEEP — just deactivate
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
      newValues: { action: 'keep' },
    });

    return { message: 'Empleado desactivado', action: 'keep', affectedAppointments: 0 };
  }

  private async deactivateWithReassign(
    employee: any,
    tenantId: string,
    targetEmployeeId: string,
    userId: string,
  ) {
    if (targetEmployeeId === employee.id) {
      throw new BadRequestException('No se puede reasignar al mismo empleado');
    }

    const target = await this.prisma.employee.findFirst({
      where: { id: targetEmployeeId, tenantId, isActive: true },
    });
    if (!target) {
      throw new NotFoundException('Empleado destino no encontrado o inactivo');
    }

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
    const targetAppointments = await this.prisma.appointment.findMany({
      where: {
        employeeId: targetEmployeeId,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
    });

    const nonConflicting: typeof pendingAppointments = [];
    const conflicting: Array<{
      appointment: (typeof pendingAppointments)[0];
      conflictsWith: { appointmentId: string; startTime: Date; endTime: Date };
    }> = [];

    for (const apt of pendingAppointments) {
      const overlap = targetAppointments.find(
        (ta) => ta.startTime < apt.endTime && ta.endTime > apt.startTime,
      );
      if (overlap) {
        conflicting.push({
          appointment: apt,
          conflictsWith: {
            appointmentId: overlap.id,
            startTime: overlap.startTime,
            endTime: overlap.endTime,
          },
        });
      } else {
        nonConflicting.push(apt);
      }
    }

    // Reassign non-conflicting in transaction
    if (nonConflicting.length > 0) {
      await this.prisma.$transaction(
        async (tx) => {
          for (const apt of nonConflicting) {
            await tx.appointment.update({
              where: { id: apt.id },
              data: { employeeId: targetEmployeeId },
            });
            await tx.appointmentItem.updateMany({
              where: { appointmentId: apt.id, employeeId: employee.id },
              data: { employeeId: targetEmployeeId },
            });
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
        action: 'reassign',
        targetEmployeeId,
        reassignedCount: nonConflicting.length,
        conflictCount: conflicting.length,
      },
    });

    for (const apt of nonConflicting) {
      await this.eventsService.emitAppointmentRescheduled(tenantId, apt.id, {
        oldEmployeeId: employee.id,
        newEmployeeId: targetEmployeeId,
        reason: 'employee_deactivation',
      });
    }

    if (employee.locationId) {
      await this.availabilityService.invalidateCacheForEmployee(tenantId, employee.locationId, employee.id);
      await this.availabilityService.invalidateCacheForEmployee(tenantId, employee.locationId, targetEmployeeId);
    }

    return {
      message: conflicting.length === 0
        ? 'Empleado desactivado y citas reasignadas'
        : `${nonConflicting.length} citas reasignadas, ${conflicting.length} con conflicto`,
      action: 'reassign',
      reassignedCount: nonConflicting.length,
      targetEmployeeId,
      deactivated: conflicting.length === 0,
      conflicts: conflicting.map((c) => ({
        id: c.appointment.id,
        startTime: c.appointment.startTime.toISOString(),
        endTime: c.appointment.endTime.toISOString(),
        status: c.appointment.status,
        clientName: `${c.appointment.client.firstName} ${c.appointment.client.lastName}`,
        services: c.appointment.items.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceNameSnapshot,
          durationMinutes: item.durationSnapshot,
        })),
        conflictsWith: {
          appointmentId: c.conflictsWith.appointmentId,
          startTime: c.conflictsWith.startTime.toISOString(),
          endTime: c.conflictsWith.endTime.toISOString(),
        },
      })),
    };
  }

  private async deactivateWithCancel(
    employee: any,
    tenantId: string,
    cancelReason: string | undefined,
    userId: string,
  ) {
    const pendingAppointments = await this.prisma.appointment.findMany({
      where: {
        employeeId: employee.id,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const apt of pendingAppointments) {
        await tx.appointment.update({
          where: { id: apt.id },
          data: {
            status: 'CANCELLED',
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

    for (const apt of pendingAppointments) {
      await this.eventsService.emitAppointmentCancelled(tenantId, apt.id, {
        reason: 'employee_deactivation',
        employeeId: employee.id,
      });
    }

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

  private async deactivateWithSmartReschedule(
    employee: any,
    tenantId: string,
    userId: string,
  ) {
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
    const shadowBookings = new Map<string, Array<{ start: Date; end: Date }>>();
    const reassignmentPlan: Array<{
      appointment: (typeof pendingAppointments)[0];
      targetEmployeeId: string;
      targetEmployeeName: string;
    }> = [];
    const conflicts: Array<(typeof pendingAppointments)[0]> = [];

    for (const apt of pendingAppointments) {
      const serviceIds = apt.items.map((item) => item.serviceId);

      // Find eligible employees (must have ALL services, active, not the one being deactivated)
      const candidates = await this.prisma.employee.findMany({
        where: {
          tenantId,
          isActive: true,
          id: { not: employee.id },
          employeeServices: { some: { serviceId: { in: serviceIds } } },
        },
        include: { employeeServices: true },
      });

      const eligible = candidates.filter((emp) =>
        serviceIds.every((sid) =>
          emp.employeeServices.some((es: any) => es.serviceId === sid),
        ),
      );

      let assigned = false;

      for (const candidate of eligible) {
        // Check shadow bookings first (planned but not yet in DB)
        const shadowBlocks = shadowBookings.get(candidate.id) || [];
        const hasShadowConflict = shadowBlocks.some(
          (b) => b.start < apt.endTime && b.end > apt.startTime,
        );
        if (hasShadowConflict) continue;

        // Check real availability at the exact same time
        const isAvailable = await this.availabilityService.isAvailableAtTime(
          candidate.id,
          apt.startTime,
          apt.endTime,
          tenantId,
        );
        if (!isAvailable) continue;

        // Found a match — register shadow booking and plan assignment
        const existing = shadowBookings.get(candidate.id) || [];
        existing.push({ start: apt.startTime, end: apt.endTime });
        shadowBookings.set(candidate.id, existing);

        reassignmentPlan.push({
          appointment: apt,
          targetEmployeeId: candidate.id,
          targetEmployeeName: `${candidate.firstName} ${candidate.lastName}`,
        });
        assigned = true;
        break;
      }

      if (!assigned) {
        conflicts.push(apt);
      }
    }

    // Execute auto-assignments in Serializable transaction
    if (reassignmentPlan.length > 0) {
      await this.prisma.$transaction(
        async (tx) => {
          for (const plan of reassignmentPlan) {
            const apt = plan.appointment;

            await tx.appointment.update({
              where: { id: apt.id },
              data: {
                employeeId: plan.targetEmployeeId,
                status: 'RESCHEDULED',
              },
            });

            await tx.appointmentItem.updateMany({
              where: { appointmentId: apt.id, employeeId: employee.id },
              data: { employeeId: plan.targetEmployeeId },
            });

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

    const affectedEmployeeIds = new Set<string>();
    for (const plan of reassignmentPlan) {
      await this.eventsService.emitAppointmentRescheduled(tenantId, plan.appointment.id, {
        oldEmployeeId: employee.id,
        newEmployeeId: plan.targetEmployeeId,
        reason: 'smart_reschedule',
      });
      affectedEmployeeIds.add(plan.targetEmployeeId);
    }

    if (employee.locationId) {
      await this.availabilityService.invalidateCacheForEmployee(tenantId, employee.locationId, employee.id);
      for (const empId of affectedEmployeeIds) {
        await this.availabilityService.invalidateCacheForEmployee(tenantId, employee.locationId, empId);
      }
    }

    return {
      message: conflicts.length === 0
        ? `Empleado desactivado. ${reassignmentPlan.length} citas reasignadas`
        : `${reassignmentPlan.length} citas reasignadas, ${conflicts.length} con conflicto`,
      action: 'smart_reschedule',
      reassignedCount: reassignmentPlan.length,
      deactivated: conflicts.length === 0,
      reassignments: reassignmentPlan.map((p) => ({
        appointmentId: p.appointment.id,
        clientName: `${p.appointment.client.firstName} ${p.appointment.client.lastName}`,
        services: p.appointment.items.map((i) => i.serviceNameSnapshot),
        startTime: p.appointment.startTime.toISOString(),
        endTime: p.appointment.endTime.toISOString(),
        newEmployeeId: p.targetEmployeeId,
        newEmployeeName: p.targetEmployeeName,
      })),
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

  async finalizeDeactivation(employeeId: string, tenantId: string, userId: string) {
    const employee = await this.findOne(employeeId, tenantId);

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
