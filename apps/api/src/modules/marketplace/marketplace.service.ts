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
import { UpdateMarketplaceProfileDto, UpdateMarketplaceSettingsDto } from './dto/update-marketplace-profile.dto';
import { ChangeMarketplacePasswordDto } from './dto/change-marketplace-password.dto';
import { ChangeMarketplaceContactDto } from './dto/change-marketplace-contact.dto';
import { MarketplaceBookDto } from './dto/marketplace-book.dto';
import { MarketplaceSocialLoginDto } from './dto/marketplace-social-login.dto';
import { AppointmentsService } from '../appointments/appointments.service';

@Injectable()
export class MarketplaceService {
  // SMS OTP store (password recovery + email change verification)
  private readonly otpStore = new Map<string, { code: string; expiresAt: Date }>();
  // Email OTP store (phone change verification)
  private readonly emailOtpStore = new Map<string, { code: string; expiresAt: Date }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tenantsService: TenantsService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  // ─── OTP ─────────────────────────────────────────────

  async sendOtp(marketplaceUserId: string) {
    const user = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
      select: { phone: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.phone) throw new BadRequestException('No tienes un número de teléfono registrado. Agrega uno en tu perfil primero.');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    this.otpStore.set(marketplaceUserId, { code, expiresAt });

    // TODO: integrate with Twilio/SMS provider
    console.log(`[OTP] Código para ${user.phone}: ${code} (expira ${expiresAt.toISOString()})`);

    const masked = user.phone.replace(/(\d{2})\d+(\d{2})/, '$1****$2');
    return { message: `Código enviado al ${masked}` };
  }

  verifyOtp(marketplaceUserId: string, code: string) {
    const entry = this.otpStore.get(marketplaceUserId);
    if (!entry) throw new BadRequestException('No hay código activo. Solicita uno nuevo.');
    if (new Date() > entry.expiresAt) {
      this.otpStore.delete(marketplaceUserId);
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo.');
    }
    if (entry.code !== code) throw new UnauthorizedException('Código incorrecto.');
    return { verified: true };
  }

  async sendOtpEmail(marketplaceUserId: string) {
    const user = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    this.emailOtpStore.set(marketplaceUserId, { code, expiresAt });

    // TODO: integrate with Resend/email provider
    console.log(`[OTP-EMAIL] Código para ${user.email}: ${code} (expira ${expiresAt.toISOString()})`);

    const masked = user.email.replace(/^(.{2})(.*)(@.+)$/, '$1****$3');
    return { message: `Código enviado a ${masked}` };
  }

  verifyOtpEmail(marketplaceUserId: string, code: string) {
    const entry = this.emailOtpStore.get(marketplaceUserId);
    if (!entry) throw new BadRequestException('No hay código activo. Solicita uno nuevo.');
    if (new Date() > entry.expiresAt) {
      this.emailOtpStore.delete(marketplaceUserId);
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo.');
    }
    if (entry.code !== code) throw new UnauthorizedException('Código incorrecto.');
    return { verified: true };
  }

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
        gender: user.gender,
      },
    };
  }

  async login(dto: MarketplaceLoginDto) {
    // Also find suspended users so we can reactivate on voluntary login
    // identifier can be email or phone number
    const isPhone = /^\+?[\d\s\-()]{7,15}$/.test(dto.identifier) && !dto.identifier.includes('@');
    const user = await this.prisma.marketplaceUser.findFirst({
      where: isPhone ? { phone: dto.identifier } : { email: dto.identifier },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        `Esta cuenta fue creada con ${user.socialProvider === 'google' ? 'Google' : 'Facebook'}. Inicia sesión con ese método.`,
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // If user is suspended, reactivate on voluntary login (they chose to come back)
    let reactivated = false;
    if (!user.isActive && user.suspendedUntil) {
      await this.prisma.marketplaceUser.update({
        where: { id: user.id },
        data: { isActive: true, suspendedAt: null, suspendedUntil: null },
      });
      user.isActive = true;
      reactivated = true;
    }

    if (!user.isActive) {
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
      reactivated,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        gender: user.gender,
        socialProvider: user.socialProvider,
      },
    };
  }

  async socialLogin(dto: MarketplaceSocialLoginDto) {
    // Verify token with provider and extract profile
    const profile = dto.provider === 'google'
      ? await this.verifyGoogleToken(dto.token)
      : await this.verifyFacebookToken(dto.token);

    // Find existing user by email
    let user = await this.prisma.marketplaceUser.findFirst({
      where: { email: profile.email },
    });

    let isNewUser = false;

    if (user) {
      // Reactivate if suspended
      if (!user.isActive && user.suspendedUntil) {
        await this.prisma.marketplaceUser.update({
          where: { id: user.id },
          data: { isActive: true, suspendedAt: null, suspendedUntil: null },
        });
        user.isActive = true;
      }
      if (!user.isActive) {
        throw new UnauthorizedException('Cuenta desactivada');
      }

      // Update social info if not set yet and update avatar if user doesn't have one
      const updateData: any = { lastLoginAt: new Date() };
      if (!user.socialProvider) {
        updateData.socialProvider = dto.provider;
        updateData.socialId = profile.socialId;
      }
      if (!user.avatarUrl && profile.avatarUrl) {
        updateData.avatarUrl = profile.avatarUrl;
      }
      user = await this.prisma.marketplaceUser.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      // Create new user (no password needed)
      user = await this.prisma.marketplaceUser.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl || null,
          socialProvider: dto.provider,
          socialId: profile.socialId,
        },
      });
      isNewUser = true;

      // Link existing Client records
      await this.prisma.client.updateMany({
        where: { email: profile.email, marketplaceUserId: null },
        data: { marketplaceUserId: user.id },
      });
    }

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        gender: user.gender,
        avatarUrl: user.avatarUrl,
        socialProvider: user.socialProvider,
      },
    };
  }

  private async verifyGoogleToken(token: string): Promise<{
    email: string; firstName: string; lastName: string;
    avatarUrl?: string; socialId: string;
  }> {
    // Try as id_token first (from Google Sign-In / One Tap)
    const idTokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (idTokenRes.ok) {
      const payload = await idTokenRes.json();
      if (!payload.email || payload.email_verified === 'false') {
        throw new UnauthorizedException('El email de Google no está verificado');
      }
      return {
        email: payload.email,
        firstName: payload.given_name || payload.email.split('@')[0],
        lastName: payload.family_name || '',
        avatarUrl: payload.picture || undefined,
        socialId: payload.sub,
      };
    }

    // Fallback: try as access_token via userinfo
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!userInfoRes.ok) {
      throw new UnauthorizedException('Token de Google inválido');
    }
    const payload = await userInfoRes.json();
    if (!payload.email || !payload.email_verified) {
      throw new UnauthorizedException('El email de Google no está verificado');
    }
    return {
      email: payload.email,
      firstName: payload.given_name || payload.email.split('@')[0],
      lastName: payload.family_name || '',
      avatarUrl: payload.picture || undefined,
      socialId: payload.sub,
    };
  }

  private async verifyFacebookToken(token: string): Promise<{
    email: string; firstName: string; lastName: string;
    avatarUrl?: string; socialId: string;
  }> {
    // Verify with Facebook Graph API
    const res = await fetch(
      `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture.type(large)&access_token=${token}`,
    );
    if (!res.ok) {
      throw new UnauthorizedException('Token de Facebook inválido');
    }
    const payload = await res.json();

    if (!payload.email) {
      throw new UnauthorizedException('No se pudo obtener el email de Facebook. Asegúrate de autorizar el acceso al email.');
    }

    return {
      email: payload.email,
      firstName: payload.first_name || payload.email.split('@')[0],
      lastName: payload.last_name || '',
      avatarUrl: payload.picture?.data?.url || undefined,
      socialId: payload.id,
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
        birthDate: true,
        gender: true,
        allergies: true,
        address: true,
        country: true,
        language: true,
        currency: true,
        searchRadius: true,
        notifAppointments: true,
        notifPromotions: true,
        notifRewards: true,
        notifMessages: true,
        socialProvider: true,
        suspendedAt: true,
        suspendedUntil: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Auto-reactivate if suspension period ended
    if (user.suspendedUntil && new Date() >= user.suspendedUntil) {
      await this.prisma.marketplaceUser.update({
        where: { id: marketplaceUserId },
        data: { suspendedAt: null, suspendedUntil: null, isActive: true },
      });
      (user as any).suspendedAt = null;
      (user as any).suspendedUntil = null;
    }

    return user;
  }

  // ─── DISCOVERY ───────────────────────────────────────

  async discover(dto: MarketplaceDiscoverDto) {
    const {
      lat, lng, radiusKm = 25, category, search,
      sortBy, availableToday, availableNow, shopOnly,
      page = 1, perPage = 20,
    } = dto;
    const offset = (page - 1) * perPage;
    const hasGps = lat != null && lng != null;

    // MySQL ELT maps DAYOFWEEK() (1=Sun..7=Sat) to Prisma DayOfWeek enum strings
    const dayOfWeekExpr = "ELT(DAYOFWEEK(CURDATE()), 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')";

    // Build WHERE conditions
    const conditions: string[] = [
      't.is_marketplace_listed = true',
      "t.subscription_status IN ('active', 'ACTIVE', 'TRIAL')",
    ];
    const params: any[] = [];

    if (category) {
      conditions.push('FIND_IN_SET(?, t.business_type) > 0');
      params.push(category);
    }

    if (search) {
      conditions.push('(t.name LIKE ? OR EXISTS (SELECT 1 FROM services s WHERE s.tenant_id = t.id AND s.is_active = true AND s.name LIKE ?))');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (availableToday) {
      conditions.push(`EXISTS (SELECT 1 FROM business_hours bh WHERE bh.tenant_id = t.id AND bh.day_of_week = ${dayOfWeekExpr} AND bh.is_open = true)`);
    }

    if (shopOnly) {
      conditions.push('t.shop_enabled = true');
      conditions.push(`EXISTS (SELECT 1 FROM products p WHERE p.tenant_id = t.id AND p.is_shop_listed = true AND p.is_active = true AND p.stock > 0)`);
    }

    if (availableNow) {
      // Business must be open RIGHT NOW + at least one active employee working now
      conditions.push(`EXISTS (
        SELECT 1 FROM business_hours bh
        WHERE bh.tenant_id = t.id
          AND bh.day_of_week = ${dayOfWeekExpr}
          AND bh.is_open = true
          AND CURTIME() >= bh.open_time
          AND CURTIME() < bh.close_time
      )`);
      conditions.push(`EXISTS (
        SELECT 1 FROM employee_schedules es
        JOIN employees e ON e.id = es.employee_id AND e.is_active = true
        WHERE e.tenant_id = t.id
          AND es.day_of_week = ${dayOfWeekExpr}
          AND es.is_working = true
          AND es.effective_from <= CURDATE()
          AND (es.effective_until IS NULL OR es.effective_until >= CURDATE())
          AND CURTIME() >= es.start_time
          AND CURTIME() < es.end_time
          AND NOT EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.employee_id = e.id
              AND a.status IN ('PENDING', 'CONFIRMED')
              AND a.start_time <= NOW()
              AND a.end_time > NOW()
          )
      )`);
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
    }

    // Determine ORDER BY based on sortBy
    let orderClause: string;
    if (sortBy === 'rating') {
      orderClause = 'COALESCE(averageRating, 0) DESC, completedAppointments DESC, name ASC';
    } else if (sortBy === 'services') {
      orderClause = 'completedAppointments DESC, COALESCE(averageRating, 0) DESC, name ASC';
    } else if (sortBy === 'distance' && hasGps) {
      orderClause = 'COALESCE(distance, 999999) ASC, name ASC';
    } else if (hasGps) {
      orderClause = 'COALESCE(distance, 999999) ASC, name ASC';
    } else {
      orderClause = 'name ASC';
    }

    // Add filter params after GPS params
    mainParams.push(...params);

    // Subquery to detect if business has immediate availability
    const availableNowSelect = `(
      EXISTS (
        SELECT 1 FROM business_hours bh2
        WHERE bh2.tenant_id = t.id
          AND bh2.day_of_week = ${dayOfWeekExpr}
          AND bh2.is_open = true
          AND CURTIME() >= bh2.open_time
          AND CURTIME() < bh2.close_time
      )
      AND EXISTS (
        SELECT 1 FROM employee_schedules es2
        JOIN employees e2 ON e2.id = es2.employee_id AND e2.is_active = true
        WHERE e2.tenant_id = t.id
          AND es2.day_of_week = ${dayOfWeekExpr}
          AND es2.is_working = true
          AND es2.effective_from <= CURDATE()
          AND (es2.effective_until IS NULL OR es2.effective_until >= CURDATE())
          AND CURTIME() >= es2.start_time
          AND CURTIME() < es2.end_time
          AND NOT EXISTS (
            SELECT 1 FROM appointments a2
            WHERE a2.employee_id = e2.id
              AND a2.status IN ('PENDING', 'CONFIRMED')
              AND a2.start_time <= NOW()
              AND a2.end_time > NOW()
          )
      )
    ) as hasImmediateAvailability`;

    const innerSql = `
      SELECT
        t.id, t.name, t.slug, t.logo_url as logoUrl,
        t.cover_image_url as coverImageUrl, t.card_color as cardColor,
        t.business_type as businessType,
        t.description, t.address,
        ${selectDistance},
        (SELECT AVG(er.rating) FROM employee_reviews er WHERE er.tenant_id = t.id AND er.is_visible = true) as averageRating,
        (SELECT COUNT(*) FROM employee_reviews er WHERE er.tenant_id = t.id AND er.is_visible = true) as totalReviews,
        (SELECT COUNT(*) FROM appointments a WHERE a.tenant_id = t.id AND a.status = 'COMPLETED') as completedAppointments,
        (SELECT MIN(l2.address) FROM locations l2 WHERE l2.tenant_id = t.id AND l2.is_active = true) as locationAddress,
        (SELECT MIN(s.price) FROM services s WHERE s.tenant_id = t.id AND s.is_active = true) as minServicePrice,
        (SELECT MAX(s.price) FROM services s WHERE s.tenant_id = t.id AND s.is_active = true) as maxServicePrice,
        ${availableNowSelect}
      FROM tenants t
      ${joinClause}
      WHERE ${conditions.join(' AND ')}
      GROUP BY t.id
    `;
    const mainSql = `
      SELECT * FROM (${innerSql}) sub
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;

    mainParams.push(perPage, offset);

    const businesses: any[] = await this.prisma.$queryRawUnsafe(mainSql, ...mainParams);

    return {
      data: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl,
        coverImageUrl: b.coverImageUrl,
        cardColor: b.cardColor || null,
        businessType: b.businessType,
        description: b.description,
        address: b.locationAddress || b.address,
        distance: b.distance != null ? Math.round(Number(b.distance) * 10) / 10 : null,
        averageRating: b.averageRating != null
          ? Math.round(Number(b.averageRating) * 10) / 10
          : null,
        totalReviews: Number(b.totalReviews || 0),
        completedAppointments: Number(b.completedAppointments || 0),
        priceRange: b.minServicePrice != null
          ? { min: Number(b.minServicePrice), max: Number(b.maxServicePrice) }
          : null,
        hasImmediateAvailability: !!b.hasImmediateAvailability,
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
        stripeOnboardingComplete: true,
        shopEnabled: true,
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
        pointsReward: true,
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

    // Get rating (employee + business)
    const ratingAgg = await this.prisma.employeeReview.aggregate({
      where: { tenantId: tenant.id, isVisible: true },
      _avg: { rating: true, businessRating: true },
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

    const { stripeOnboardingComplete, shopEnabled, ...tenantData } = tenant;

    return {
      data: {
        ...tenantData,
        acceptsOnlinePayment: !!stripeOnboardingComplete,
        shopEnabled: !!shopEnabled,
        averageRating: ratingAgg._avg.rating
          ? Math.round(ratingAgg._avg.rating * 10) / 10
          : null,
        averageBusinessRating: ratingAgg._avg.businessRating
          ? Math.round(ratingAgg._avg.businessRating * 10) / 10
          : null,
        totalReviews: ratingAgg._count.id,
        completedAppointments,
        services,
        employees,
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          businessRating: r.businessRating,
          businessComment: r.businessComment,
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

  // ─── PROFESSIONAL PROFILE (public) ─────────────────────

  async getBusinessTypes() {
    const types = await this.prisma.businessTypeCatalog.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { value: true, label: true },
    });
    return { data: types };
  }

  async getServiceCatalog() {
    const services = await this.prisma.serviceCatalog.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true, category: true },
    });
    return { data: services };
  }

  async getProfessions() {
    const professions = await this.prisma.profession.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    return { data: professions.map((p) => p.name) };
  }

  async toggleProfessionalFavorite(marketplaceUserId: string, employeeId: string) {
    const existing = await this.prisma.marketplaceProfessionalFavorite.findUnique({
      where: { marketplaceUserId_employeeId: { marketplaceUserId, employeeId } },
    });

    if (existing) {
      await this.prisma.marketplaceProfessionalFavorite.delete({ where: { id: existing.id } });
      return { data: { favorited: false } };
    }

    await this.prisma.marketplaceProfessionalFavorite.create({
      data: { marketplaceUserId, employeeId },
    });
    return { data: { favorited: true } };
  }

  async getMyProfessionalFavorites(marketplaceUserId: string) {
    const favorites = await this.prisma.marketplaceProfessionalFavorite.findMany({
      where: { marketplaceUserId },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, avatarUrl: true,
            coverImageUrl: true, color: true, bio: true, jobTitle: true,
            tenant: { select: { name: true, slug: true, address: true } },
            _count: { select: { appointments: true, reviews: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      favorites.map(async (fav) => {
        const ratingAgg = await this.prisma.employeeReview.aggregate({
          where: { employeeId: fav.employeeId, isVisible: true },
          _avg: { rating: true },
          _count: { id: true },
        });
        return {
          ...fav.employee,
          businessName: fav.employee.tenant.name,
          tenantSlug: fav.employee.tenant.slug,
          address: fav.employee.tenant.address,
          averageRating: ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
          totalReviews: ratingAgg._count.id,
        };
      }),
    );

    return { data: enriched };
  }

  async discoverProfessionals(dto: {
    search?: string;
    jobTitle?: string;
    lat?: number;
    lng?: number;
    perPage?: number;
    page?: number;
  }) {
    const { search, jobTitle, perPage = 30, page = 1 } = dto;
    const skip = (page - 1) * perPage;

    const where: any = {
      isActive: true,
      tenant: {
        isMarketplaceListed: true,
        subscriptionStatus: { in: ['active', 'ACTIVE', 'TRIAL'] },
      },
    };

    if (search) {
      const cleanSearch = search.replace('#', '').trim();
      where.OR = [
        { firstName: { contains: cleanSearch } },
        { lastName: { contains: cleanSearch } },
        { jobTitle: { contains: cleanSearch } },
      ];
    }

    if (jobTitle) {
      where.jobTitle = { contains: jobTitle };
    }

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          coverImageUrl: true,
          color: true,
          bio: true,
          jobTitle: true,
          tenant: {
            select: { name: true, slug: true, address: true },
          },
          _count: {
            select: { appointments: true, reviews: true },
          },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    // Enrich with ratings
    const enriched = await Promise.all(
      employees.map(async (emp) => {
        const ratingAgg = await this.prisma.employeeReview.aggregate({
          where: { employeeId: emp.id, isVisible: true },
          _avg: { rating: true },
          _count: { id: true },
        });
        return {
          ...emp,
          businessName: emp.tenant.name,
          tenantSlug: emp.tenant.slug,
          address: emp.tenant.address,
          averageRating: ratingAgg._avg.rating
            ? Math.round(ratingAgg._avg.rating * 10) / 10
            : null,
          totalReviews: ratingAgg._count.id,
        };
      }),
    );

    return {
      data: enriched,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  }

  async getProfessionalProfile(tenantSlug: string, employeeId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true, isMarketplaceListed: true },
    });

    if (!tenant || !tenant.isMarketplaceListed) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        coverImageUrl: true,
        color: true,
        bio: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Profesional no encontrado');
    }

    // Stats, rating, portfolio in parallel
    const [completedCount, ratingAgg, portfolio, topServices] = await Promise.all([
      this.prisma.appointment.count({
        where: { employeeId, tenantId: tenant.id, status: 'COMPLETED' },
      }),
      this.prisma.employeeReview.aggregate({
        where: { employeeId, tenantId: tenant.id, isVisible: true },
        _avg: { rating: true },
        _count: { id: true },
      }),
      this.prisma.employeePortfolioImage.findMany({
        where: { employeeId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 12,
      }),
      this.prisma.appointmentItem.groupBy({
        by: ['serviceNameSnapshot'],
        where: {
          appointment: { employeeId, tenantId: tenant.id, status: 'COMPLETED' },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    // If no completed work yet, fallback to assigned services
    let finalTopServices: { serviceName: string; count: number }[];
    if (topServices.length > 0) {
      finalTopServices = topServices.map((s) => ({
        serviceName: s.serviceNameSnapshot,
        count: s._count.id,
      }));
    } else {
      const assignedServices = await this.prisma.employeeService.findMany({
        where: { employeeId },
        include: { service: { select: { name: true } } },
        take: 5,
      });
      finalTopServices = assignedServices.map((es) => ({
        serviceName: es.service.name,
        count: 0,
      }));
    }

    // Recent reviews for this employee
    const reviews = await this.prisma.employeeReview.findMany({
      where: { employeeId, tenantId: tenant.id, isVisible: true },
      include: {
        client: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      data: {
        ...employee,
        businessName: tenant.name,
        tenantSlug: tenant.slug,
        completedAppointments: completedCount,
        averageRating: ratingAgg._avg.rating
          ? Math.round(ratingAgg._avg.rating * 10) / 10
          : null,
        totalReviews: ratingAgg._count.id,
        portfolio: portfolio.map((p) => ({
          id: p.id,
          imageUrl: p.imageUrl,
          caption: p.caption,
        })),
        topServices: finalTopServices,
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          clientName: `${r.client.firstName} ${r.client.lastName?.[0] || ''}.`,
          clientAvatarUrl: r.client.avatarUrl || null,
        })),
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
        issuer: 'siliba-client',
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
    if (dto.birthDate !== undefined) updateData.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.gender !== undefined) updateData.gender = dto.gender || null;
    if (dto.allergies !== undefined) updateData.allergies = dto.allergies || null;
    if (dto.address !== undefined) updateData.address = dto.address || null;
    if (dto.phone !== undefined) updateData.phone = dto.phone || null;

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
        birthDate: true,
        gender: true,
        allergies: true,
        address: true,
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

  async updateSettings(marketplaceUserId: string, dto: UpdateMarketplaceSettingsDto) {
    const current = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updateData: any = {};
    if (dto.country !== undefined) updateData.country = dto.country || null;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.searchRadius !== undefined) updateData.searchRadius = dto.searchRadius;
    if (dto.notifAppointments !== undefined) updateData.notifAppointments = dto.notifAppointments;
    if (dto.notifPromotions !== undefined) updateData.notifPromotions = dto.notifPromotions;
    if (dto.notifRewards !== undefined) updateData.notifRewards = dto.notifRewards;
    if (dto.notifMessages !== undefined) updateData.notifMessages = dto.notifMessages;

    const user = await this.prisma.marketplaceUser.update({
      where: { id: marketplaceUserId },
      data: updateData,
      select: {
        country: true,
        language: true,
        currency: true,
        searchRadius: true,
        notifAppointments: true,
        notifPromotions: true,
        notifRewards: true,
        notifMessages: true,
      },
    });

    return user;
  }

  async suspendAccount(marketplaceUserId: string, days: number) {
    if (days < 1 || days > 90) {
      throw new BadRequestException('El periodo debe ser entre 1 y 90 días');
    }

    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + days);

    await this.prisma.marketplaceUser.update({
      where: { id: marketplaceUserId },
      data: {
        isActive: false,
        suspendedAt: new Date(),
        suspendedUntil,
      },
    });

    return { suspendedUntil };
  }

  async deleteAccount(marketplaceUserId: string, password: string) {
    const user = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Social-only accounts can delete without password; password accounts require it
    if (user.passwordHash) {
      if (!password) {
        throw new BadRequestException('Debes confirmar tu contraseña');
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('Contraseña incorrecta');
      }
    }

    // Delete avatar file if exists
    if (user.avatarUrl) {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'uploads', user.avatarUrl.replace(/^\/uploads\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Cascade: deletes refresh tokens + favorites. Clients get marketplaceUserId = null.
    await this.prisma.marketplaceUser.delete({
      where: { id: marketplaceUserId },
    });

    return { message: 'Cuenta eliminada' };
  }

  async reactivateAccount(marketplaceUserId: string) {
    await this.prisma.marketplaceUser.update({
      where: { id: marketplaceUserId },
      data: {
        isActive: true,
        suspendedAt: null,
        suspendedUntil: null,
      },
    });

    return { message: 'Cuenta reactivada' };
  }

  async updateContact(
    marketplaceUserId: string,
    dto: { email?: string; phone?: string; currentPassword?: string; otpCode?: string },
  ) {
    const current = await this.prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Email change requires SMS OTP verification
    if (dto.email && dto.email !== current.email) {
      if (!dto.otpCode) throw new BadRequestException('Se requiere código de verificación por SMS para cambiar el email');
      this.verifyOtp(marketplaceUserId, dto.otpCode);
      this.otpStore.delete(marketplaceUserId);
    }

    // Phone change requires email OTP verification
    if (dto.phone !== undefined && dto.phone !== current.phone) {
      if (!dto.otpCode) throw new BadRequestException('Se requiere código de verificación por correo para cambiar el teléfono');
      this.verifyOtpEmail(marketplaceUserId, dto.otpCode);
      this.emailOtpStore.delete(marketplaceUserId);
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

    // Social-only users can set a password for the first time (no verification needed)
    if (user.passwordHash) {
      if (dto.otpCode) {
        // OTP bypass: verify code and consume it
        this.verifyOtp(marketplaceUserId, dto.otpCode);
        this.otpStore.delete(marketplaceUserId);
      } else {
        if (!dto.currentPassword) {
          throw new BadRequestException('Debes ingresar tu contraseña actual o usar un código de recuperación');
        }
        const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!isMatch) {
          throw new UnauthorizedException('Contraseña actual incorrecta');
        }
      }
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
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              address: true,
              locations: {
                where: { isActive: true },
                select: { id: true, name: true, address: true, latitude: true, longitude: true },
                take: 1,
                orderBy: { createdAt: 'asc' },
              },
            },
          },
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
          payments: {
            select: { id: true, status: true, paymentMethod: true, totalAmount: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
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

  async getMyPurchases(marketplaceUserId: string, page: number, perPage: number) {
    const skip = (page - 1) * perPage;

    const where: any = { marketplaceUserId };

    const [data, total] = await Promise.all([
      this.prisma.productReservation.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              currency: true,
            },
          },
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
              logoUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.productReservation.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

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

  // ─── PAYMENTS ──────────────────────────────────────────

  async getMyPayments(
    marketplaceUserId: string,
    page: number,
    perPage: number,
    status?: 'COMPLETED' | 'PENDING' | 'REFUNDED',
  ) {
    const clients = await this.prisma.client.findMany({
      where: { marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: [], meta: { total: 0, page, perPage, totalPages: 0 } };
    }

    const where: any = {
      clientId: { in: clientIds },
    };

    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          totalAmount: true,
          currency: true,
          paymentMethod: true,
          status: true,
          createdAt: true,
          tenant: { select: { name: true, slug: true, logoUrl: true } },
          appointment: {
            select: {
              startTime: true,
              items: {
                select: { serviceNameSnapshot: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
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
      issuer: 'siliba-marketplace',
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

    // Validate coupon if provided
    let redemption: any = null;
    let discountAmount: number | null = null;

    if (dto.couponCode) {
      redemption = await this.prisma.rewardRedemption.findFirst({
        where: { code: dto.couponCode, tenantId: tenant.id, clientId: client.id, status: 'ACTIVE' },
        include: { reward: { include: { service: { select: { id: true } } } } },
      });

      if (!redemption) {
        throw new BadRequestException('Cupón no válido o ya utilizado');
      }

      if (redemption.expiresAt && new Date(redemption.expiresAt) < new Date()) {
        throw new BadRequestException('Este cupón ha expirado');
      }

      const reward = redemption.reward;

      // Validate coupon is compatible with selected services
      if (reward.type === 'SERVICIO' && reward.serviceId) {
        if (!dto.serviceIds.includes(reward.serviceId)) {
          throw new BadRequestException('Este cupón solo aplica para el servicio asociado a la recompensa');
        }
      }

      // Calculate discount
      if (reward.type === 'DESCUENTO') {
        const services = await this.prisma.service.findMany({
          where: { id: { in: dto.serviceIds }, tenantId: tenant.id },
          select: { price: true },
        });
        const subtotal = services.reduce((s, svc) => s + Number(svc.price), 0);
        if (reward.discountMode === 'PERCENTAGE') {
          discountAmount = Math.round(subtotal * Number(reward.discountAmount) / 100 * 100) / 100;
        } else {
          discountAmount = Math.min(Number(reward.discountAmount), subtotal);
        }
      } else if (reward.type === 'SERVICIO' && reward.serviceId) {
        // Free service: discount = price of that service
        const freeService = await this.prisma.service.findFirst({
          where: { id: reward.serviceId, tenantId: tenant.id },
          select: { price: true },
        });
        if (freeService) discountAmount = Number(freeService.price);
      }
    }

    // Delegate to AppointmentsService
    const appointment = await this.appointmentsService.create(
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

    // Mark coupon as used and link to appointment
    if (redemption && appointment?.data?.id) {
      await this.prisma.$transaction([
        this.prisma.rewardRedemption.update({
          where: { id: redemption.id },
          data: { status: 'USED', usedAt: new Date() },
        }),
        this.prisma.appointment.update({
          where: { id: appointment.data.id },
          data: { redemptionId: redemption.id, discountAmount },
        }),
      ]);
    }

    return {
      ...appointment,
      data: {
        ...appointment.data,
        discountAmount,
        couponApplied: redemption ? { code: redemption.code, reward: redemption.reward.name } : null,
      },
    };
  }

  // ─── CHECKOUT (Stripe) ─────────────────────────────────

  async createCheckoutSession(
    marketplaceUserId: string,
    tenantSlug: string,
    appointmentId: string,
    stripeService: any,
    returnUrl?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');

    // Verify appointment belongs to this tenant and user
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: {
        client: { select: { marketplaceUserId: true, id: true } },
        items: true,
      },
    });

    if (!appointment || appointment.client?.marketplaceUserId !== marketplaceUserId) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Build line items from appointment items
    const lineItems = appointment.items.map((item) => ({
      name: item.serviceNameSnapshot,
      amount: Math.round(Number(item.priceSnapshot) * 100), // cents
      quantity: 1,
    }));

    const baseUrl = returnUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    const bizUrl = `${baseUrl}/marketplace/${tenantSlug}`;

    return stripeService.createCheckoutSession({
      tenantId: tenant.id,
      appointmentId,
      clientId: appointment.client.id,
      lineItems,
      currency: tenant.currency || 'MXN',
      successUrl: `${bizUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${bizUrl}?payment=cancelled`,
    });
  }

  // ─── AVAILABLE REWARDS ───────────────────────────────
  // Returns active rewards from businesses the user has visited,
  // sorted by pointsRequired asc (cheapest first).

  async getAvailableRewards(marketplaceUserId: string) {
    // All client records for this marketplace user
    const clients = await this.prisma.client.findMany({
      where: { marketplaceUserId },
      select: { id: true, tenantId: true, loyaltyPoints: true },
    });
    if (clients.length === 0) return { data: [] };

    const clientByTenantId = new Map(clients.map((c) => [c.tenantId, c]));
    const tenantIds = clients.map((c) => c.tenantId);

    const rewards = await this.prisma.reward.findMany({
      where: {
        tenantId: { in: tenantIds },
        isActive: true,
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
      include: {
        tenant: { select: { name: true, slug: true, logoUrl: true } },
        service: { select: { name: true } },
      },
      orderBy: { pointsRequired: 'asc' },
    });

    const data = rewards.map((r) => {
      const client = clientByTenantId.get(r.tenantId);
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        type: r.type,
        pointsRequired: r.pointsRequired,
        discountAmount: r.discountAmount,
        discountMode: r.discountMode,
        serviceName: r.service?.name ?? null,
        tenant: r.tenant,
        myPoints: client?.loyaltyPoints ?? 0,
        canRedeem: (client?.loyaltyPoints ?? 0) >= r.pointsRequired,
        pointsNeeded: Math.max(0, r.pointsRequired - (client?.loyaltyPoints ?? 0)),
      };
    });

    return { data };
  }
}
