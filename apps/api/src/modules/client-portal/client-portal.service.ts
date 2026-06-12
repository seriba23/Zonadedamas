import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { AvailabilityService } from '../availability/availability.service';
import { ClientRegisterDto } from './dto/client-register.dto';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientUpdateProfileDto, ClientChangePasswordDto } from './dto/client-update-profile.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ClientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tenantsService: TenantsService,
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── TENANT RESOLUTION ──────────────────────────────

  async resolveTenant(slug: string) {
    return this.tenantsService.findBySlug(slug);
  }

  // ─── AUTH ────────────────────────────────────────────

  async register(dto: ClientRegisterDto, tenantId: string) {
    const isEmail = dto.identifier.includes('@');
    const email = isEmail ? dto.identifier : (dto.email || null);
    const phone = !isEmail ? dto.identifier : (dto.phone || null);

    // Check if client with this identifier already exists
    let existingClient = await this.findClientByIdentifier(dto.identifier, tenantId);

    if (existingClient && existingClient.passwordHash) {
      throw new ConflictException('Ya existe una cuenta con este correo o teléfono');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const now = new Date();

    let client: any;

    if (existingClient) {
      // Activate portal for existing client (e.g., created via public booking)
      client = await this.prisma.client.update({
        where: { id: existingClient.id },
        data: {
          passwordHash,
          portalRegisteredAt: now,
          firstName: dto.firstName || existingClient.firstName,
          lastName: dto.lastName || existingClient.lastName,
          email: email || existingClient.email,
          phone: phone || existingClient.phone,
        },
      });
    } else {
      client = await this.prisma.client.create({
        data: {
          tenantId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          phone,
          passwordHash,
          portalRegisteredAt: now,
          source: 'ONLINE',
        },
      });
    }

    const tokens = await this.generateClientTokens(client);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      client: {
        id: client.id,
        email: client.email,
        phone: client.phone,
        firstName: client.firstName,
        lastName: client.lastName,
        tenantId,
      },
    };
  }

  async login(dto: ClientLoginDto, tenantId: string) {
    const client = await this.findClientByIdentifier(dto.identifier, tenantId);

    if (!client || !client.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(dto.password, client.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.client.update({
      where: { id: client.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateClientTokens(client);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      client: {
        id: client.id,
        email: client.email,
        phone: client.phone,
        firstName: client.firstName,
        lastName: client.lastName,
        tenantId,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: { tokenHint, revokedAt: null },
      include: { client: true },
    });

    let matched: (typeof candidates)[0] | null = null;
    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        matched = stored;
        break;
      }
    }

    if (!matched) {
      throw new UnauthorizedException('Token de actualización inválido o expirado');
    }

    if (new Date() > matched.expiresAt) {
      await this.prisma.clientRefreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token de actualización expirado');
    }

    // Revoke old token (rotation)
    await this.prisma.clientRefreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Clean up expired tokens in the background
    this.prisma.clientRefreshToken
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});

    const tokens = await this.generateClientTokens(matched.client);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: { tokenHint, revokedAt: null },
    });

    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        await this.prisma.clientRefreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
  }

  async getMe(clientId: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        dateOfBirth: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  // ─── APPOINTMENTS ────────────────────────────────────

  async getAppointments(clientId: string, tenantId: string, filter: 'upcoming' | 'past' | 'all' = 'all') {
    // Las citas se guardan con startTime en "hora del negocio" interpretada
    // como UTC raw. Ajustamos now al mismo sistema restando el offset del
    // tenant (CDMX UTC-6). TODO: usar Tenant.timezone para multi-region.
    const TENANT_OFFSET_HOURS = -6;
    const now = new Date(Date.now() + TENANT_OFFSET_HOURS * 60 * 60 * 1000);
    const where: any = { clientId, tenantId };

    if (filter === 'upcoming') {
      where.startTime = { gte: now };
      where.status = { notIn: ['CANCELLED', 'NO_SHOW'] };
    } else if (filter === 'past') {
      where.OR = [
        { startTime: { lt: now } },
        { status: { in: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
      ];
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        items: {
          select: {
            id: true,
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            color: true,
          },
        },
        review: {
          select: { id: true, rating: true },
        },
        photos: {
          select: { id: true, imageUrl: true, caption: true },
        },
      },
      orderBy: { startTime: filter === 'past' ? 'desc' : 'asc' },
    });

    return { data: appointments };
  }

  async getAppointmentDetail(appointmentId: string, clientId: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
      include: {
        items: {
          select: {
            id: true,
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            color: true,
          },
        },
        location: {
          select: { id: true, name: true, address: true },
        },
        review: true,
        photos: {
          select: { id: true, imageUrl: true, caption: true, createdAt: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    return { data: appointment };
  }

  async cancelAppointment(appointmentId: string, clientId: string, tenantId: string, reason?: string) {
    // Validate ownership
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    return this.appointmentsService.cancel(
      appointmentId,
      { reason: reason || 'Cancelada por el cliente' },
      tenantId,
      `client:${clientId}`,
    );
  }

  async rescheduleAppointment(
    appointmentId: string,
    clientId: string,
    tenantId: string,
    startTime: string,
    employeeId?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    return this.appointmentsService.reschedule(
      appointmentId,
      { startTime, employeeId },
      tenantId,
      `client:${clientId}`,
    );
  }

  // ─── BOOKING ─────────────────────────────────────────

  async getServices(tenantId: string) {
    return this.prisma.service.findMany({
      where: {
        tenantId,
        isActive: true,
        employeeServices: { some: { employee: { isActive: true } } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        color: true,
        category: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getEmployees(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        color: true,
        bio: true,
        employeeServices: {
          select: { serviceId: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getAvailability(
    serviceIds: string[],
    startDate: string,
    endDate: string,
    tenantId: string,
    employeeId?: string,
    locationId?: string,
  ) {
    return this.availabilityService.getAvailableSlots(
      { serviceIds, startDate, endDate, employeeId, locationId },
      tenantId,
    );
  }

  async book(
    clientId: string,
    tenantId: string,
    data: {
      employeeId: string;
      serviceIds: string[];
      startTime: string;
      notes?: string;
    },
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: data.employeeId, tenantId, isActive: true },
      select: { id: true, locationId: true },
    });

    if (!employee) {
      throw new NotFoundException('Profesional no encontrado');
    }

    return this.appointmentsService.create(
      {
        locationId: employee.locationId,
        clientId,
        employeeId: data.employeeId,
        serviceIds: data.serviceIds,
        startTime: data.startTime,
        notes: data.notes,
        source: 'ONLINE',
      },
      tenantId,
    );
  }

  // ─── PROFILE ─────────────────────────────────────────

  async updateProfile(clientId: string, tenantId: string, dto: ClientUpdateProfileDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
      },
    });

    return {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone,
      gender: updated.gender,
      dateOfBirth: updated.dateOfBirth,
    };
  }

  async changePassword(clientId: string, tenantId: string, dto: ClientChangePasswordDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client || !client.passwordHash) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, client.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.client.update({
      where: { id: clientId },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens on password change
    await this.prisma.clientRefreshToken.updateMany({
      where: { clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  // ─── REVIEWS ─────────────────────────────────────────

  async createReview(
    appointmentId: string,
    clientId: string,
    tenantId: string,
    dto: CreateReviewDto,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
      include: { review: true },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException('Solo puedes dejar reseña en citas completadas');
    }

    if (appointment.review) {
      throw new ConflictException('Ya existe una reseña para esta cita');
    }

    const review = await this.prisma.employeeReview.create({
      data: {
        tenantId,
        employeeId: appointment.employeeId,
        clientId,
        appointmentId,
        rating: dto.rating,
        comment: dto.comment,
        businessRating: dto.businessRating,
        businessComment: dto.businessComment,
        reviewedAt: new Date(),
      },
    });

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { firstName: true, lastName: true },
    });
    this.eventEmitter.emit('review.created', {
      tenantId,
      reviewId: review.id,
      employeeId: appointment.employeeId,
      rating: review.rating,
      clientName: client ? `${client.firstName} ${client.lastName}` : 'Un cliente',
    });

    return { data: review };
  }

  async getMyReviews(clientId: string, tenantId: string) {
    const reviews = await this.prisma.employeeReview.findMany({
      where: { clientId, tenantId },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
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
      orderBy: { createdAt: 'desc' },
    });

    return { data: reviews };
  }

  // ─── PHOTOS & SERVICE HISTORY ────────────────────────

  async getAppointmentPhotos(appointmentId: string, clientId: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    const photos = await this.prisma.appointmentPhoto.findMany({
      where: { appointmentId, tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return { data: photos };
  }

  async getServiceHistory(clientId: string, tenantId: string) {
    // Get all completed appointments with photos, grouped by service
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clientId,
        tenantId,
        status: 'COMPLETED',
      },
      include: {
        items: {
          select: {
            serviceNameSnapshot: true,
            serviceId: true,
          },
        },
        photos: {
          select: { id: true, imageUrl: true, caption: true, createdAt: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        review: {
          select: { id: true, rating: true, comment: true },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Group by service name
    const serviceMap = new Map<
      string,
      {
        serviceName: string;
        serviceId: string;
        appointments: typeof appointments;
      }
    >();

    for (const appt of appointments) {
      for (const item of appt.items) {
        const key = item.serviceNameSnapshot;
        if (!serviceMap.has(key)) {
          serviceMap.set(key, {
            serviceName: item.serviceNameSnapshot,
            serviceId: item.serviceId,
            appointments: [],
          });
        }
        serviceMap.get(key)!.appointments.push(appt);
      }
    }

    // Deduplicate appointments per service group
    const history = Array.from(serviceMap.values()).map((group) => {
      const uniqueAppts = [...new Map(group.appointments.map((a) => [a.id, a])).values()];
      return {
        serviceName: group.serviceName,
        serviceId: group.serviceId,
        totalAppointments: uniqueAppts.length,
        totalPhotos: uniqueAppts.reduce((sum, a) => sum + a.photos.length, 0),
        appointments: uniqueAppts,
      };
    });

    return { data: history };
  }

  // ─── REPUTATION (PUBLIC) ─────────────────────────────

  async getReputation(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true },
    });

    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado');
    }

    // Overall business rating
    const overallAgg = await this.prisma.employeeReview.aggregate({
      where: { tenantId, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    // Per-employee ratings
    const employeeRatings = await this.prisma.employeeReview.groupBy({
      by: ['employeeId'],
      where: { tenantId, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    const employeeIds = employeeRatings.map((r) => r.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });

    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    return {
      data: {
        business: {
          id: tenant.id,
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          averageRating: overallAgg._avg.rating
            ? Math.round(overallAgg._avg.rating * 10) / 10
            : null,
          totalReviews: overallAgg._count.id,
        },
        employees: employeeRatings.map((r) => {
          const emp = employeeMap.get(r.employeeId);
          return {
            id: r.employeeId,
            firstName: emp?.firstName || '',
            lastName: emp?.lastName || '',
            avatarUrl: emp?.avatarUrl || null,
            averageRating: r._avg.rating
              ? Math.round(r._avg.rating * 10) / 10
              : null,
            totalReviews: r._count.id,
          };
        }),
      },
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────

  private async findClientByIdentifier(identifier: string, tenantId: string) {
    const isEmail = identifier.includes('@');

    if (isEmail) {
      return this.prisma.client.findFirst({
        where: { tenantId, email: identifier, isActive: true },
      });
    }

    return this.prisma.client.findFirst({
      where: { tenantId, phone: identifier, isActive: true },
    });
  }

  private async generateClientTokens(client: {
    id: string;
    tenantId: string;
    email?: string | null;
    phone?: string | null;
  }) {
    const payload = {
      sub: client.id,
      tenantId: client.tenantId,
      email: client.email || undefined,
      phone: client.phone || undefined,
      type: 'client' as const,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
      issuer: 'siliba-client',
    });

    const refreshToken = uuidv4();
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const tokenHint = refreshToken.substring(0, 8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days for clients

    await this.prisma.clientRefreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        clientId: client.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
