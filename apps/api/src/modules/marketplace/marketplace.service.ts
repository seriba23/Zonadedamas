import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { MarketplaceRegisterDto } from './dto/marketplace-register.dto';
import { MarketplaceLoginDto } from './dto/marketplace-login.dto';
import { MarketplaceDiscoverDto } from './dto/marketplace-discover.dto';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tenantsService: TenantsService,
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
      conditions.push('t.business_type = ?');
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
    let havingClause = '';
    let orderClause = 't.name ASC';
    const mainParams: any[] = [];

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
      havingClause = `HAVING distance IS NULL OR distance <= ?`;
      orderClause = 'distance ASC, t.name ASC';
    }

    // Add filter params after GPS params
    mainParams.push(...params);

    const mainSql = `
      SELECT
        t.id, t.name, t.slug, t.logo_url as logoUrl,
        t.cover_image_url as coverImageUrl,
        t.business_type as businessType,
        t.description, t.address,
        ${selectDistance},
        (SELECT AVG(er.rating) FROM employee_reviews er WHERE er.tenant_id = t.id AND er.is_visible = true) as averageRating,
        (SELECT COUNT(*) FROM employee_reviews er WHERE er.tenant_id = t.id AND er.is_visible = true) as totalReviews,
        (SELECT MIN(l2.address) FROM locations l2 WHERE l2.tenant_id = t.id AND l2.is_active = true) as locationAddress
      FROM tenants t
      ${joinClause}
      WHERE ${conditions.join(' AND ')}
      GROUP BY t.id
      ${havingClause}
      ${minRating ? 'HAVING averageRating >= ?' : ''}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;

    // Add having params
    if (hasGps) {
      mainParams.push(radiusKm);
    }
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
      })),
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getBusinessDetail(tenantSlug: string) {
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
      },
      orderBy: { sortOrder: 'asc' },
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

    return {
      data: {
        ...tenant,
        averageRating: ratingAgg._avg.rating
          ? Math.round(ratingAgg._avg.rating * 10) / 10
          : null,
        totalReviews: ratingAgg._count.id,
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
}
