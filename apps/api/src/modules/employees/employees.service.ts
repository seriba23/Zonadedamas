import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { SetSchedulesDto } from './dto/schedule.dto';
import { CreateTimeOffDto, ServiceConfigDto } from './dto/time-off.dto';
import { CreateReviewDto } from './dto/review.dto';
import { UpdatePersonalInfoDto } from './dto/personal-info.dto';
import { CreateDocumentDto } from './dto/document.dto';
import { CreateTrainingDto } from './dto/training.dto';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, pagination: PaginationDto, locationId?: string) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (locationId) where.locationId = locationId;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          location: { select: { id: true, name: true } },
          employeeServices: { include: { service: { select: { id: true, name: true } } } },
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
    // Verify location belongs to tenant
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId },
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    return this.prisma.employee.create({
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
  }

  async update(id: string, tenantId: string, dto: UpdateEmployeeDto) {
    await this.findOne(id, tenantId);
    return this.prisma.employee.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
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
          effectiveFrom: new Date(s.effectiveFrom),
          effectiveUntil: s.effectiveUntil ? new Date(s.effectiveUntil) : undefined,
        })),
      });

      return tx.employeeSchedule.findMany({
        where: { employeeId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  async getTimeOff(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeTimeOff.findMany({
      where: { employeeId },
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

  async getAllTimeOffs(tenantId: string, startDate: string, endDate: string) {
    return this.prisma.employeeTimeOff.findMany({
      where: {
        employee: { tenantId },
        startDatetime: { lte: new Date(endDate + 'T23:59:59Z') },
        endDatetime: { gte: new Date(startDate + 'T00:00:00Z') },
      },
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
      topServices,
      upcomingAppointments,
      ratingResult,
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
          status: { in: ['PENDING', 'CONFIRMED'] },
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
    ]);

    const revenue = Number(revenueResult._sum.priceSnapshot ?? 0);
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
      topServices: topServices.map((s) => ({
        serviceName: s.serviceNameSnapshot,
        count: s._count.serviceNameSnapshot,
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
}
