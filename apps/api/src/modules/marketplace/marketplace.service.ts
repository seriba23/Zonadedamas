import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { MarketplaceRegisterDto } from './dto/marketplace-register.dto';
import { MarketplaceLoginDto } from './dto/marketplace-login.dto';
import { MarketplaceDiscoverDto } from './dto/marketplace-discover.dto';
import { UpdateMarketplaceProfileDto } from './dto/update-marketplace-profile.dto';
import { ChangeMarketplacePasswordDto } from './dto/change-marketplace-password.dto';
import { ChangeMarketplaceContactDto } from './dto/change-marketplace-contact.dto';
import { MarketplaceBookDto } from './dto/marketplace-book.dto';
import { AppointmentsService } from '../appointments/appointments.service';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tenantsService: TenantsService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  // ─── AUTH ────────────────────────────────────────────

  async register(dto: MarketplaceRegisterDto) {
    const existing = await this.prisma.marketplaceUser.findFirst({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este email');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.marketplaceUser.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone || null,
        passwordHash,
      },
    });

    // Link any existing Client records with this email
    await this.prisma.client.updateMany({
      where: { email: dto.email, marketplaceUserId: null },
      data: { marketplaceUserId: user.id },
    });

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    };
  }

  async login(dto: MarketplaceLoginDto) {
    const user = await this.prisma.marketplaceUser.findFirst({
      where: { email: dto.email, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.marketplaceUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.marketplaceRefreshToken.findMany({
      where: { tokenHint, revokedAt: null },
      include: { user: true },
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
      throw new UnauthorizedException('Token de actualización inválido');
    }

    if (new Date() > matched.expiresAt) {
      await this.prisma.marketplaceRefreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token de actualización expirado');
    }

    // Revoke old (rotation)
    await this.prisma.marketplaceRefreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Cleanup expired
    this.prisma.marketplaceRefreshToken
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});

    const tokens = await this.generateTokens(matched.user);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.marketplaceRefreshToken.findMany({
      where: { tokenHint, revokedAt: null },
    });

    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        await this.prisma.marketplaceRefreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
  }

  async getMe(marketplaceUserId: string) {
    const user = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  // ─── DISCOVERY ───────────────────────────────────────

  async discover(dto: MarketplaceDiscoverDto) {
    const { lat, lng, radiusKm = 25, category, minRating, search, page = 1, perPage = 20 } = dto;
    const offset = (page - 1) * perPage;
    const hasGps = lat != null && lng != null;

    // Build WHERE conditions
    const conditions: string[] = [
      't.is_marketplace_listed = true',
      "t.subscription_status = 'active'",
    ];
    const params: any[] = [];

    if (category) {
      conditions.push('FIND_IN_SET(?, t.business_type) > 0');
      params.push(category);
    }

    if (search) {
      conditions.push('t.name LIKE ?');
      params.push(`%${search}%`);
    }

    // Count total
    const countSql = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM tenants t
      ${hasGps ? 'LEFT JOIN locations l ON l.tenant_id = t.id AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND l.is_active = true' : ''}
      WHERE ${conditions.join(' AND ')}
    `;
    const countResult: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
    const total = Number(countResult[0]?.total || 0);

    // Main query with distance
    let selectDistance = 'NULL as distance';
    let joinClause = '';
    let orderClause = 'name ASC';
    const mainParams: any[] = [];
    const havingConditions: string[] = [];

    if (hasGps) {
      selectDistance = `MIN(
        6371 * ACOS(
          LEAST(1.0, GREATEST(-1.0,
            COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
            COS(RADIANS(l.longitude) - RADIANS(?)) +
            SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
          ))
        )
      ) as distance`;
      mainParams.push(lat, lng, lat);
      joinClause = 'LEFT JOIN locations l ON l.tenant_id = t.id AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND l.is_active = true';
      // No filter by distance — show all businesses, sorted by proximity
      orderClause = 'COALESCE(distance, 999999) ASC, name ASC';
    }

    if (minRating) {
      havingConditions.push('averageRating >= ?');
    }

    // Add filter params after GPS params
    mainParams.push(...params);

    const havingClause = havingConditions.length > 0
      ? `HAVING ${havingConditions.join(' AND ')}`
      : '';

    const innerSql = `
      SELECT
        t.id, t.name, t.slug, t.logo_url as logoUrl,
        t.cover_image_url as coverImageUrl,
        t.business_type as businessType,
        t.description, t.address,
        ${selectDistance},
        (SELECT AVG(er.rating) FROM employee_reviews er WHERE er.tenant_id = t.id AND er.is_visible = true) as averageRating,
        (SELECT COUNT(*) FROM employee_reviews er WHERE er.tenant_id = t.id AND er.is_visible = true) as totalReviews,
        (SELECT COUNT(*) FROM appointments a WHERE a.tenant_id = t.id AND a.status = 'COMPLETED') as completedAppointments,
        (SELECT MIN(l2.address) FROM locations l2 WHERE l2.tenant_id = t.id AND l2.is_active = true) as locationAddress
      FROM tenants t
      ${joinClause}
      WHERE ${conditions.join(' AND ')}
      GROUP BY t.id
      ${havingClause}
    `;
    const mainSql = `
      SELECT * FROM (${innerSql}) sub
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;

    // Add having params (must match order in havingConditions)
    if (minRating) {
      mainParams.push(minRating);
    }
    mainParams.push(perPage, offset);

    const businesses: any[] = await this.prisma.$queryRawUnsafe(mainSql, ...mainParams);

    return {
      data: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl,
        coverImageUrl: b.coverImageUrl,
        businessType: b.businessType,
        description: b.description,
        address: b.locationAddress || b.address,
        distance: b.distance != null ? Math.round(Number(b.distance) * 10) / 10 : null,
        averageRating: b.averageRating != null
          ? Math.round(Number(b.averageRating) * 10) / 10
          : null,
        totalReviews: Number(b.totalReviews || 0),
        completedAppointments: Number(b.completedAppointments || 0),
      })),
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ─── FAVORITES ──────────────────────────────────────

  async toggleFavorite(marketplaceUserId: string, tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, isMarketplaceListed: true },
    });

    if (!tenant || !tenant.isMarketplaceListed) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const existing = await this.prisma.marketplaceFavorite.findUnique({
      where: {
        marketplaceUserId_tenantId: {
          marketplaceUserId,
          tenantId: tenant.id,
        },
      },
    });

    if (existing) {
      await this.prisma.marketplaceFavorite.delete({
        where: { id: existing.id },
      });
      return { favorited: false };
    }

    await this.prisma.marketplaceFavorite.create({
      data: {
        marketplaceUserId,
        tenantId: tenant.id,
      },
    });
    return { favorited: true };
  }

  async getMyFavorites(marketplaceUserId: string) {
    const favorites = await this.prisma.marketplaceFavorite.findMany({
      where: { marketplaceUserId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            coverImageUrl: true,
            businessType: true,
            address: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with rating data
    const enriched = await Promise.all(
      favorites.map(async (fav) => {
        const ratingAgg = await this.prisma.employeeReview.aggregate({
          where: { tenantId: fav.tenantId, isVisible: true },
          _avg: { rating: true },
          _count: { id: true },
        });

        return {
          ...fav.tenant,
          favoriteId: fav.id,
          favoritedAt: fav.createdAt,
          averageRating: ratingAgg._avg.rating
            ? Math.round(ratingAgg._avg.rating * 10) / 10
            : null,
          totalReviews: ratingAgg._count.id,
        };
      }),
    );

    return { data: enriched };
  }

  async getBusinessDetail(tenantSlug: string, marketplaceUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        coverImageUrl: true,
        businessType: true,
        description: true,
        address: true,
        phone: true,
        businessPhone: true,
        timezone: true,
        currency: true,
        isMarketplaceListed: true,
      },
    });

    if (!tenant || !tenant.isMarketplaceListed) {
      throw new NotFoundException('Negocio no encontrado');
    }

    // Get services
    const services = await this.prisma.service.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        color: true,
        category: true,
        subcategory: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get employees
    const employees = await this.prisma.employee.findMany({
      where: { tenantId: tenant.id, isActive: true },
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

    // Get completed appointments count
    const completedAppointments = await this.prisma.appointment.count({
      where: { tenantId: tenant.id, status: 'COMPLETED' },
    });

    // Get rating
    const ratingAgg = await this.prisma.employeeReview.aggregate({
      where: { tenantId: tenant.id, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    // Get recent reviews
    const reviews = await this.prisma.employeeReview.findMany({
      where: { tenantId: tenant.id, isVisible: true },
      include: {
        client: { select: { firstName: true, lastName: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get business hours
    const businessHours = await this.prisma.businessHours.findMany({
      where: { tenantId: tenant.id },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Get locations
    const locations = await this.prisma.location.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
      },
    });

    // Get gallery images
    const gallery = await this.prisma.tenantGalleryImage.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, imageUrl: true, caption: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    // Check if favorited
    let isFavorited = false;
    if (marketplaceUserId) {
      const fav = await this.prisma.marketplaceFavorite.findUnique({
        where: {
          marketplaceUserId_tenantId: {
            marketplaceUserId,
            tenantId: tenant.id,
          },
        },
      });
      isFavorited = !!fav;
    }

    return {
      data: {
        ...tenant,
        averageRating: ratingAgg._avg.rating
          ? Math.round(ratingAgg._avg.rating * 10) / 10
          : null,
        totalReviews: ratingAgg._count.id,
        completedAppointments,
        services,
        employees,
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          clientName: `${r.client.firstName} ${r.client.lastName?.[0] || ''}.`,
          employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
        })),
        businessHours,
        locations,
        gallery,
        isFavorited,
      },
    };
  }

  // ─── ENTER BUSINESS ──────────────────────────────────

  async enterBusiness(marketplaceUserId: string, tenantSlug: string) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);
    const mktUser = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
    });

    if (!mktUser) {
      throw new NotFoundException('Usuario marketplace no encontrado');
    }

    // Find existing Client linked to this marketplace user
    let client = await this.prisma.client.findFirst({
      where: { tenantId: tenant.id, marketplaceUserId },
    });

    if (!client && mktUser.email) {
      // Try matching by email (link pre-existing walk-in clients)
      client = await this.prisma.client.findFirst({
        where: { tenantId: tenant.id, email: mktUser.email },
      });
      if (client) {
        await this.prisma.client.update({
          where: { id: client.id },
          data: { marketplaceUserId },
        });
      }
    }

    if (!client) {
      // Create new local Client record
      client = await this.prisma.client.create({
        data: {
          tenantId: tenant.id,
          marketplaceUserId,
          firstName: mktUser.firstName,
          lastName: mktUser.lastName,
          email: mktUser.email,
          phone: mktUser.phone,
          source: 'MARKETPLACE',
          portalRegisteredAt: new Date(),
        },
      });
    }

    // Generate per-tenant client JWT (same format as client-portal)
    const clientAccessToken = this.jwtService.sign(
      {
        sub: client.id,
        tenantId: tenant.id,
        email: client.email || undefined,
        phone: client.phone || undefined,
        type: 'client' as const,
      },
      {
        expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
        issuer: 'zonadedamas-client',
      },
    );

    // Generate client refresh token for seamless portal usage
    const refreshTokenValue = uuidv4();
    const tokenHash = await bcrypt.hash(refreshTokenValue, 10);
    const tokenHint = refreshTokenValue.substring(0, 8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.clientRefreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        clientId: client.id,
        expiresAt,
      },
    });

    return {
      clientAccessToken,
      clientRefreshToken: refreshTokenValue,
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
    };
  }

  // ─── QR ──────────────────────────────────────────────

  async getQrData(tenantId: string, locationId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    let locationName: string | null = null;
    if (locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: locationId, tenantId },
      });
      locationName = location?.name || null;
    }

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const qrUrl = locationId
      ? `${baseUrl}/qr/${tenant.slug}?location=${locationId}`
      : `${baseUrl}/qr/${tenant.slug}`;

    return {
      data: {
        url: qrUrl,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        logoUrl: tenant.logoUrl,
        locationName,
      },
    };
  }

  // ─── PROFILE ────────────────────────────────────────

  async updateProfile(marketplaceUserId: string, dto: UpdateMarketplaceProfileDto) {
    const current = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updateData: any = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;

    const user = await this.prisma.marketplaceUser.update({
      where: { id: marketplaceUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    // Sync linked Client records
    const clientUpdate: any = {};
    if (dto.firstName !== undefined) clientUpdate.firstName = dto.firstName;
    if (dto.lastName !== undefined) clientUpdate.lastName = dto.lastName;

    if (Object.keys(clientUpdate).length > 0) {
      await this.prisma.client.updateMany({
        where: { marketplaceUserId },
        data: clientUpdate,
      });
    }

    return user;
  }

  async updateContact(
    marketplaceUserId: string,
    dto: { email?: string; phone?: string; currentPassword: string },
  ) {
    const current = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verify password
    const valid = await bcrypt.compare(dto.currentPassword, current.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    if (!dto.email && !dto.phone) {
      throw new ConflictException('Debes proporcionar un email o teléfono nuevo');
    }

    const updateData: any = {};
    const clientUpdate: any = {};

    // Check email uniqueness
    if (dto.email && dto.email !== current.email) {
      const existing = await this.prisma.marketplaceUser.findFirst({
        where: { email: dto.email, id: { not: marketplaceUserId } },
      });
      if (existing) {
        throw new ConflictException('Ya existe una cuenta con este email');
      }
      updateData.email = dto.email;
      clientUpdate.email = dto.email;
    }

    // Check phone uniqueness
    if (dto.phone !== undefined && dto.phone !== current.phone) {
      if (dto.phone) {
        const existing = await this.prisma.marketplaceUser.findFirst({
          where: { phone: dto.phone, id: { not: marketplaceUserId } },
        });
        if (existing) {
          throw new ConflictException('Ya existe una cuenta con este teléfono');
        }
      }
      updateData.phone = dto.phone || null;
      clientUpdate.phone = dto.phone || null;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ConflictException('No hay cambios que aplicar');
    }

    const user = await this.prisma.marketplaceUser.update({
      where: { id: marketplaceUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (Object.keys(clientUpdate).length > 0) {
      await this.prisma.client.updateMany({
        where: { marketplaceUserId },
        data: clientUpdate,
      });
    }

    return user;
  }

  async updateAvatar(marketplaceUserId: string, avatarUrl: string): Promise<string | null> {
    const current = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
      select: { avatarUrl: true },
    });
    const oldUrl = current?.avatarUrl || null;

    await this.prisma.marketplaceUser.update({
      where: { id: marketplaceUserId },
      data: { avatarUrl },
    });

    return oldUrl;
  }

  async changePassword(marketplaceUserId: string, dto: ChangeMarketplacePasswordDto) {
    const user = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.marketplaceUser.update({
      where: { id: marketplaceUserId },
      data: { passwordHash },
    });

    return { message: 'Contraseña actualizada' };
  }

  async getMyAppointments(
    marketplaceUserId: string,
    filter: 'upcoming' | 'past',
    page: number,
    perPage: number,
  ) {
    const clients = await this.prisma.client.findMany({
      where: { marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: [], meta: { total: 0, page, perPage, totalPages: 0 } };
    }

    const now = new Date();
    const where: any = {
      clientId: { in: clientIds },
    };

    if (filter === 'upcoming') {
      where.startTime = { gte: now };
      where.status = { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] };
    } else {
      where.OR = [
        { startTime: { lt: now } },
        { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } },
      ];
    }

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true, logoUrl: true } },
          employee: {
            select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true },
          },
          items: {
            select: {
              id: true,
              serviceNameSnapshot: true,
              priceSnapshot: true,
              durationSnapshot: true,
            },
          },
        },
        orderBy: { startTime: filter === 'upcoming' ? 'asc' : 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ─── STATS & GALLERY ─────────────────────────────────

  async getMyStats(marketplaceUserId: string) {
    const clients = await this.prisma.client.findMany({
      where: { marketplaceUserId },
      select: { id: true, loyaltyPoints: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: { totalServices: 0, totalPoints: 0, totalPhotos: 0 } };
    }

    const [totalServices, totalPhotos] = await Promise.all([
      this.prisma.appointment.count({
        where: { clientId: { in: clientIds }, status: 'COMPLETED' },
      }),
      this.prisma.appointmentPhoto.count({
        where: {
          appointment: {
            clientId: { in: clientIds },
            status: 'COMPLETED',
          },
        },
      }),
    ]);

    const totalPoints = clients.reduce((sum, c) => sum + c.loyaltyPoints, 0);

    return { data: { totalServices, totalPoints, totalPhotos } };
  }

  async getMyGallery(marketplaceUserId: string) {
    const clients = await this.prisma.client.findMany({
      where: { marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: [] };
    }

    const photos = await this.prisma.appointmentPhoto.findMany({
      where: {
        appointment: {
          clientId: { in: clientIds },
          status: 'COMPLETED',
        },
      },
      include: {
        appointment: {
          select: {
            id: true,
            startTime: true,
            items: {
              select: {
                serviceNameSnapshot: true,
                service: { select: { category: true } },
              },
              take: 1,
            },
            tenant: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by service category
    const byCategory: Record<
      string,
      {
        id: string;
        imageUrl: string;
        serviceName: string;
        date: Date;
        tenantName: string;
        tenantSlug: string;
      }[]
    > = {};

    for (const photo of photos) {
      const category =
        photo.appointment.items[0]?.service?.category || 'Otros';
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push({
        id: photo.id,
        imageUrl: photo.imageUrl,
        serviceName:
          photo.appointment.items[0]?.serviceNameSnapshot || 'Servicio',
        date: photo.appointment.startTime,
        tenantName: photo.appointment.tenant.name,
        tenantSlug: photo.appointment.tenant.slug,
      });
    }

    return {
      data: Object.entries(byCategory).map(([name, items]) => ({
        name,
        photos: items,
      })),
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────

  private async generateTokens(user: { id: string; email: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'marketplace' as const,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
      issuer: 'zonadedamas-marketplace',
    });

    const refreshToken = uuidv4();
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const tokenHint = refreshToken.substring(0, 8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.marketplaceRefreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        marketplaceUserId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  // ─── REWARDS ────────────────────────────────────────

  async getBusinessRewards(tenantSlug: string) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);

    const now = new Date();
    const rewards = await this.prisma.reward.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        OR: [
          { validUntil: null },
          { validUntil: { gte: now } },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        pointsRequired: true,
        discountAmount: true,
        discountMode: true,
        maxRedemptions: true,
        timesRedeemed: true,
        validUntil: true,
        service: { select: { id: true, name: true } },
      },
      orderBy: { pointsRequired: 'asc' },
    });

    // Filter out rewards that reached max redemptions
    const available = rewards.filter(
      (r) => !r.maxRedemptions || r.timesRedeemed < r.maxRedemptions,
    );

    return { data: available };
  }

  async getMyRewards(marketplaceUserId: string) {
    const clients = await this.prisma.client.findMany({
      where: { marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: [] };
    }

    const redemptions = await this.prisma.rewardRedemption.findMany({
      where: { clientId: { in: clientIds } },
      include: {
        reward: {
          select: {
            name: true,
            type: true,
            description: true,
            discountAmount: true,
            discountMode: true,
            service: { select: { name: true } },
          },
        },
        tenant: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: redemptions };
  }

  async redeemReward(
    marketplaceUserId: string,
    tenantSlug: string,
    rewardId: string,
  ) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);

    // Find client for this tenant
    const client = await this.prisma.client.findFirst({
      where: { tenantId: tenant.id, marketplaceUserId },
    });
    if (!client) {
      throw new NotFoundException(
        'No tienes una cuenta de cliente en este negocio',
      );
    }

    // Validate reward
    const reward = await this.prisma.reward.findFirst({
      where: { id: rewardId, tenantId: tenant.id, isActive: true },
    });
    if (!reward) {
      throw new NotFoundException('Recompensa no encontrada');
    }

    const now = new Date();
    if (reward.validUntil && reward.validUntil < now) {
      throw new BadRequestException('Esta recompensa ha expirado');
    }
    if (reward.maxRedemptions && reward.timesRedeemed >= reward.maxRedemptions) {
      throw new BadRequestException(
        'Esta recompensa ha alcanzado el máximo de canjes',
      );
    }
    if (client.loyaltyPoints < reward.pointsRequired) {
      throw new BadRequestException(
        `Necesitas ${reward.pointsRequired} puntos. Tienes ${client.loyaltyPoints}.`,
      );
    }

    // Execute in transaction
    const result = await this.prisma.$transaction(
      async (tx) => {
        // Re-check points inside transaction
        const freshClient = await tx.client.findUnique({
          where: { id: client.id },
          select: { loyaltyPoints: true },
        });
        if (
          !freshClient ||
          freshClient.loyaltyPoints < reward.pointsRequired
        ) {
          throw new BadRequestException('Puntos insuficientes');
        }

        // Deduct points
        await tx.client.update({
          where: { id: client.id },
          data: {
            loyaltyPoints: { decrement: reward.pointsRequired },
          },
        });

        // Increment redemption count
        await tx.reward.update({
          where: { id: reward.id },
          data: { timesRedeemed: { increment: 1 } },
        });

        // Generate unique coupon code
        const code = this.generateCouponCode();

        // Calculate expiry (30 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Create redemption
        const redemption = await tx.rewardRedemption.create({
          data: {
            tenantId: tenant.id,
            rewardId: reward.id,
            clientId: client.id,
            pointsSpent: reward.pointsRequired,
            code,
            expiresAt,
            status: 'ACTIVE',
          },
          include: {
            reward: {
              select: {
                name: true,
                type: true,
                discountAmount: true,
                discountMode: true,
              },
            },
          },
        });

        return redemption;
      },
      { isolationLevel: 'Serializable' },
    );

    return result;
  }

  private generateCouponCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // ─── BOOKING ──────────────────────────────────────────

  async bookAppointment(
    marketplaceUserId: string,
    tenantSlug: string,
    dto: MarketplaceBookDto,
  ) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);
    const mktUser = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
    });

    if (!mktUser) {
      throw new NotFoundException('Usuario marketplace no encontrado');
    }

    // Find or create client linked to marketplace user (same logic as enterBusiness)
    let client = await this.prisma.client.findFirst({
      where: { tenantId: tenant.id, marketplaceUserId },
    });

    if (!client && mktUser.email) {
      client = await this.prisma.client.findFirst({
        where: { tenantId: tenant.id, email: mktUser.email },
      });
      if (client) {
        await this.prisma.client.update({
          where: { id: client.id },
          data: { marketplaceUserId },
        });
      }
    }

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          tenantId: tenant.id,
          marketplaceUserId,
          firstName: mktUser.firstName,
          lastName: mktUser.lastName,
          email: mktUser.email,
          phone: mktUser.phone,
          source: 'MARKETPLACE',
          portalRegisteredAt: new Date(),
        },
      });
    }

    // Resolve employee's locationId
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId: tenant.id, isActive: true },
      select: { id: true, locationId: true },
    });

    if (!employee) {
      throw new NotFoundException('Profesional no encontrado');
    }

    // Delegate to AppointmentsService
    return this.appointmentsService.create(
      {
        locationId: employee.locationId,
        clientId: client.id,
        employeeId: dto.employeeId,
        serviceIds: dto.serviceIds,
        startTime: dto.startTime,
        notes: dto.notes,
        source: 'ONLINE',
      },
      tenant.id,
    );
  }
}
