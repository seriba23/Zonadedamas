import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
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
import { CreateTenantReviewDto } from './dto/tenant-review.dto';
import { AppointmentsService } from '../appointments/appointments.service';
import { UploadsService } from '../uploads/uploads.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    private readonly uploads: UploadsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** True si la URL ya es un path local de uploads (no hotlink externo). */
  private isLocalUploadPath(url: string | null | undefined): boolean {
    if (!url) return false;
    return url.startsWith('/api/uploads/') || url.startsWith('/uploads/');
  }

  // ─── OTP ─────────────────────────────────────────────

  async sendOtp(marketplaceUserId: string) {
    const user = await this.prisma.user.findUnique({
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
    const user = await this.prisma.user.findUnique({
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
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este email');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone || null,
        passwordHash,
        isClient: true,
      },
    });

    // Link any existing Client records with this email
    await this.prisma.client.updateMany({
      where: { email: dto.email, userId: null },
      data: { userId: user.id },
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
    const user = await this.prisma.user.findFirst({
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
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: true, suspendedAt: null, suspendedUntil: null },
      });
      user.isActive = true;
      reactivated = true;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.user.update({
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
    let user = await this.prisma.user.findFirst({
      where: { email: profile.email },
    });

    let isNewUser = false;

    if (user) {
      // Reactivate if suspended
      if (!user.isActive && user.suspendedUntil) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isActive: true, suspendedAt: null, suspendedUntil: null },
        });
        user.isActive = true;
      }
      if (!user.isActive) {
        throw new UnauthorizedException('Cuenta desactivada');
      }

      // Update social info if not set yet
      const updateData: any = { lastLoginAt: new Date() };
      if (!user.socialProvider) {
        updateData.socialProvider = dto.provider;
        updateData.socialId = profile.socialId;
      }
      // Avatar: si el user no tiene avatar O tiene una URL externa (de un
      // login social previo guardado como hotlink), descargar a local. Esto
      // evita que falle el <img> por referer policy, formato no soportado
      // (GIF animado de Google) o expiracion de la URL.
      const needsLocalAvatar = !user.avatarUrl || !this.isLocalUploadPath(user.avatarUrl);
      if (needsLocalAvatar && profile.avatarUrl) {
        const localPath = await this.uploads.downloadAndSaveExternalImage(profile.avatarUrl, 'avatars');
        if (localPath) updateData.avatarUrl = localPath;
      }
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      // Create new user (no password needed). Si Google devolvio avatarUrl,
      // intentamos descargarla al server; si falla, queda null y el cliente
      // verá las iniciales como fallback.
      let avatarPath: string | null = null;
      if (profile.avatarUrl) {
        avatarPath = await this.uploads.downloadAndSaveExternalImage(profile.avatarUrl, 'avatars');
      }
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: avatarPath,
          socialProvider: dto.provider,
          socialId: profile.socialId,
          isClient: true,
        },
      });
      isNewUser = true;

      // Link existing Client records
      await this.prisma.client.updateMany({
        where: { email: profile.email, userId: null },
        data: { userId: user.id },
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
    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenHint, revokedAt: null, scope: 'client' },
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
      await this.prisma.refreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token de actualización expirado');
    }

    // Revoke old (rotation)
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Cleanup expired client tokens
    this.prisma.refreshToken
      .deleteMany({ where: { scope: 'client', expiresAt: { lt: new Date() } } })
      .catch(() => {});

    const tokens = await this.generateTokens(matched.user);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenHint, revokedAt: null, scope: 'client' },
    });

    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
  }

  async getMe(marketplaceUserId: string) {
    const user = await this.prisma.user.findUnique({
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
        passwordHash: true,
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
      await this.prisma.user.update({
        where: { id: marketplaceUserId },
        data: { suspendedAt: null, suspendedUntil: null, isActive: true },
      });
      (user as any).suspendedAt = null;
      (user as any).suspendedUntil = null;
    }

    // Exponer "hasPassword" sin enviar el hash al cliente.
    const { passwordHash, ...rest } = user;
    return { ...rest, hasPassword: !!passwordHash };
  }

  // ─── DISCOVERY ───────────────────────────────────────

  async discover(dto: MarketplaceDiscoverDto) {
    const {
      lat, lng, radiusKm = 10, category, search,
      sortBy, availableToday, availableNow, shopOnly,
      page = 1, perPage = 20,
    } = dto;
    const offset = (page - 1) * perPage;
    const hasGps = lat != null && lng != null;
    // Filtro real por distancia: solo aplica si hay GPS Y un radio
    // explicito mayor que cero. Hasta ahora el parametro se calculaba
    // pero NUNCA se usaba en el WHERE — los clientes veian negocios
    // de todo el pais sin importar el radio configurado.
    const applyRadius = hasGps && typeof radiusKm === 'number' && radiusKm > 0;

    // MySQL ELT maps DAYOFWEEK() (1=Sun..7=Sat) to Prisma DayOfWeek enum strings
    const dayOfWeekExpr = "ELT(DAYOFWEEK(CURDATE()), 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')";

    // Build WHERE conditions
    // Excluimos freelancers porque su perfil pertenece a la pestana
    // "Profesionales" (1 persona = 1 perfil de empleado), no a "Negocios"
    // (que muestra salones/empresas).
    const conditions: string[] = [
      't.is_marketplace_listed = true',
      "t.subscription_status IN ('active', 'ACTIVE', 'TRIAL')",
      "t.tenant_type != 'FREELANCER'",
    ];
    const params: any[] = [];

    if (category) {
      conditions.push('FIND_IN_SET(?, t.business_type) > 0');
      params.push(category);
    }

    if (search) {
      // Busqueda multi-campo: nombre del negocio, categoria (business_type),
      // direccion, o nombre/subcategoria de cualquier servicio activo.
      conditions.push(
        `(t.name LIKE ? OR t.business_type LIKE ? OR t.address LIKE ? ` +
        `OR EXISTS (SELECT 1 FROM services s WHERE s.tenant_id = t.id AND s.is_active = true AND (s.name LIKE ? OR s.subcategory LIKE ? OR s.category LIKE ?)))`,
      );
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }

    if (availableToday) {
      conditions.push(`EXISTS (SELECT 1 FROM business_hours bh WHERE bh.tenant_id = t.id AND bh.day_of_week = ${dayOfWeekExpr} AND bh.is_open = true)`);
    }

    if (shopOnly) {
      conditions.push('t.shop_enabled = true');
      conditions.push(`EXISTS (SELECT 1 FROM products p WHERE p.tenant_id = t.id AND p.is_shop_listed = true AND p.is_active = true AND p.stock > 0)`);
    }

    if (availableNow) {
      // Criterio mas permisivo (alineado con profesionales): el negocio
      // tiene horario para HOY con is_open=true Y al menos un empleado
      // activo. No exigimos que la hora actual caiga dentro del horario
      // (eso era demasiado estricto y dejaba "0 resultados" en escenarios
      // razonables, p.ej. justo antes de abrir o cerrando hoy temprano).
      conditions.push(`EXISTS (
        SELECT 1 FROM business_hours bh
        WHERE bh.tenant_id = t.id
          AND bh.day_of_week = ${dayOfWeekExpr}
          AND bh.is_open = true
      )`);
      conditions.push(`EXISTS (
        SELECT 1 FROM employees e
        WHERE e.tenant_id = t.id
          AND e.is_active = true
      )`);
    }

    // Count total. Si aplicamos filtro de radio, el count debe usar la
    // misma subquery con distancia (sino el "total" no coincide con la
    // pagina real). Si no hay GPS o radio, count plano.
    let total = 0;
    if (applyRadius) {
      const countDistSql = `
        SELECT COUNT(*) as total FROM (
          SELECT t.id, MIN(
            6371 * ACOS(
              LEAST(1.0, GREATEST(-1.0,
                COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
                COS(RADIANS(l.longitude) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
              ))
            )
          ) as distance
          FROM tenants t
          LEFT JOIN locations l ON l.tenant_id = t.id AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND l.is_active = true
          WHERE ${conditions.join(' AND ')}
          GROUP BY t.id
        ) sub
        WHERE distance IS NOT NULL AND distance <= ?
      `;
      const countResult: any[] = await this.prisma.$queryRawUnsafe(
        countDistSql,
        lat, lng, lat,
        ...params,
        radiusKm,
      );
      total = Number(countResult[0]?.total || 0);
    } else {
      const countSql = `
        SELECT COUNT(DISTINCT t.id) as total
        FROM tenants t
        ${hasGps ? 'LEFT JOIN locations l ON l.tenant_id = t.id AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND l.is_active = true' : ''}
        WHERE ${conditions.join(' AND ')}
      `;
      const countResult: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
      total = Number(countResult[0]?.total || 0);
    }

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

    // Subquery para badge hasImmediateAvailability en la lista. Misma logica
    // permisiva que el filtro: abierto hoy + al menos un empleado activo.
    const availableNowSelect = `(
      EXISTS (
        SELECT 1 FROM business_hours bh2
        WHERE bh2.tenant_id = t.id
          AND bh2.day_of_week = ${dayOfWeekExpr}
          AND bh2.is_open = true
      )
      AND EXISTS (
        SELECT 1 FROM employees e2
        WHERE e2.tenant_id = t.id
          AND e2.is_active = true
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
    // Filtro de radio en el outer: distance solo existe como alias del
    // SELECT cuando hasGps. NULL = negocio sin ubicacion (lo excluimos
    // cuando aplicamos radio, ya que no hay forma de saber su distancia).
    const radiusWhere = applyRadius ? 'WHERE distance IS NOT NULL AND distance <= ?' : '';
    const mainSql = `
      SELECT * FROM (${innerSql}) sub
      ${radiusWhere}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;

    if (applyRadius) mainParams.push(radiusKm);
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
        userId_tenantId: {
          userId: marketplaceUserId,
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
        userId: marketplaceUserId,
        tenantId: tenant.id,
      },
    });
    return { favorited: true };
  }

  async getMyFavorites(marketplaceUserId: string) {
    const favorites = await this.prisma.marketplaceFavorite.findMany({
      where: { userId: marketplaceUserId },
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
        tenantType: true,
        description: true,
        address: true,
        phone: true,
        businessPhone: true,
        timezone: true,
        currency: true,
        isMarketplaceListed: true,
        stripeOnboardingComplete: true,
        shopEnabled: true,
        confettiEnabled: true,
        confettiStyle: true,
        confettiStyles: true,
        confettiColors: true,
      },
    });

    if (!tenant || !tenant.isMarketplaceListed) {
      throw new NotFoundException('Negocio no encontrado');
    }

    // Get services (only those with at least one active employee assigned)
    const services = await this.prisma.service.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        employeeServices: { some: { employee: { isActive: true } } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        currency: true,
        color: true,
        category: true,
        subcategory: true,
        pointsReward: true,
        redeemableWithPoints: true,
        pointsRequired: true,
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

    // Rating combinado (TenantReview + EmployeeReview.businessRating)
    const combined = await this.getCombinedTenantRating(tenant.id);

    // Reseñas directas del negocio (TenantReview). La reseña del usuario
    // actual va primero para resaltarla en el frontend.
    const tenantReviewsRaw = await this.prisma.tenantReview.findMany({
      where: { tenantId: tenant.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: [{ updatedAt: 'desc' }],
    });

    let myTenantReview: any = null;
    const otherTenantReviews = tenantReviewsRaw.filter((r) => {
      if (marketplaceUserId && r.userId === marketplaceUserId) {
        myTenantReview = r;
        return false;
      }
      return true;
    });
    const tenantReviews = myTenantReview ? [myTenantReview, ...otherTenantReviews] : otherTenantReviews;

    // Reseñas DEL NEGOCIO que vienen del flujo de cierre de cita: solo las que
    // traen businessRating (el cliente además calificó al negocio). Las que solo
    // califican al empleado NO van aquí — esas se muestran en el perfil del
    // empleado. Sin este filtro, el perfil del negocio mezclaba reseñas de
    // empleados con la calificación del empleado, mostrando reseñas que no son
    // del negocio.
    const employeeReviewsRaw = await this.prisma.employeeReview.findMany({
      where: { tenantId: tenant.id, isVisible: true, businessRating: { not: null } },
      include: {
        client: { select: { userId: true, firstName: true, lastName: true, avatarUrl: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Una sola reseña por cliente (la más reciente). Unificamos las reseñas
    // directas del marketplace (identificadas por userId) con las del cierre de
    // cita (por el userId vinculado del cliente, o su clientId si no tiene
    // cuenta de marketplace) y nos quedamos con la más reciente de cada persona.
    const tenantReviewsMapped = tenantReviews.map((r) => ({
      id: r.id,
      source: 'tenant' as const,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isMine: marketplaceUserId ? r.userId === marketplaceUserId : false,
      clientName: `${r.user.firstName} ${r.user.lastName?.[0] || ''}.`,
      clientAvatarUrl: r.user.avatarUrl || null,
      employeeName: null as string | null,
      businessRating: r.rating,
      businessComment: r.comment,
      _key: r.userId ? `u:${r.userId}` : `t:${r.id}`,
      _ts: new Date(r.updatedAt ?? r.createdAt).getTime(),
    }));
    const employeeReviewsMapped = employeeReviewsRaw.map((r) => ({
      id: r.id,
      source: 'employee' as const,
      // Reseña DEL NEGOCIO: mostramos businessRating/businessComment.
      rating: r.businessRating,
      comment: r.businessComment,
      createdAt: r.createdAt,
      updatedAt: r.createdAt,
      isMine: false,
      clientName: `${r.client.firstName} ${r.client.lastName?.[0] || ''}.`,
      clientAvatarUrl: (r.client as any).avatarUrl || null,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}` as string | null,
      businessRating: r.businessRating,
      businessComment: r.businessComment,
      _key: r.client.userId ? `u:${r.client.userId}` : `c:${r.clientId}`,
      _ts: new Date(r.createdAt).getTime(),
    }));
    const seenReviewKeys = new Set<string>();
    const dedupedReviews = [...tenantReviewsMapped, ...employeeReviewsMapped]
      .sort((a, b) => b._ts - a._ts)
      .filter((r) => {
        if (seenReviewKeys.has(r._key)) return false;
        seenReviewKeys.add(r._key);
        return true;
      })
      .slice(0, 10)
      .map(({ _key, _ts, ...rest }) => rest);

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

    // Get bundles
    const bundles = await this.prisma.serviceBundle.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        bundlePrice: true,
        serviceIds: true,
        totalDuration: true,
        savingsPercent: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get active rewards (DESCUENTO/TWO_FOR_ONE) — antes era prisma.promotion,
    // pero en Fase 1 unificamos los datos. Ahora leemos de rewards y mapeamos
    // al mismo shape que esperaba el frontend (type=PERCENTAGE/FIXED_AMOUNT/
    // TWO_FOR_ONE, value=discountAmount). Los rewards tipo SERVICIO (canje
    // por puntos) NO se incluyen aqui — esos van por otro flujo.
    const now = new Date();
    const activeRewards = await this.prisma.reward.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] },
        // Filtros de vigencia (si tienen rango definido)
        OR: [
          { startDate: null, endDate: null },
          {
            AND: [
              { OR: [{ startDate: null }, { startDate: { lte: now } }] },
              { OR: [{ endDate: null }, { endDate: { gte: now } }] },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        discountAmount: true,
        discountMode: true,
        code: true,
        startDate: true,
        endDate: true,
        maxRedemptions: true,
        timesRedeemed: true,
        serviceIds: true,
        minAmount: true,
        allowPointPayment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mapear al shape que espera el frontend (compat con promotions):
    // - Reward DESCUENTO + PERCENTAGE -> { type: 'PERCENTAGE', value: discountAmount }
    // - Reward DESCUENTO + FLAT       -> { type: 'FIXED_AMOUNT', value: discountAmount }
    // - Reward TWO_FOR_ONE            -> { type: 'TWO_FOR_ONE', value: 0 }
    const availablePromotions = activeRewards
      .filter((r) => r.maxRedemptions == null || r.timesRedeemed < r.maxRedemptions)
      .map((r) => {
        let mappedType: string = r.type;
        let value: number = 0;
        if (r.type === 'DESCUENTO') {
          mappedType = r.discountMode === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT';
          value = Number(r.discountAmount || 0);
        } else if (r.type === 'TWO_FOR_ONE') {
          mappedType = 'TWO_FOR_ONE';
          value = 0;
        }
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          type: mappedType,
          value,
          code: r.code,
          startDate: r.startDate,
          endDate: r.endDate,
          maxUses: r.maxRedemptions,
          usedCount: r.timesRedeemed,
          serviceIds: r.serviceIds,
          minAmount: r.minAmount,
          allowPointPayment: r.allowPointPayment,
        };
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
          userId_tenantId: {
            userId: marketplaceUserId,
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
        averageRating: combined.avg,
        averageBusinessRating: combined.avg,
        totalReviews: combined.total,
        myReview: myTenantReview
          ? {
              id: myTenantReview.id,
              rating: myTenantReview.rating,
              comment: myTenantReview.comment,
              createdAt: myTenantReview.createdAt,
              updatedAt: myTenantReview.updatedAt,
            }
          : null,
        completedAppointments,
        services,
        employees,
        reviews: dedupedReviews,
        businessHours,
        locations,
        bundles,
        promotions: availablePromotions,
        gallery,
        isFavorited,
      },
    };
  }

  // ─── TENANT REVIEWS ────────────────────────────────────

  /**
   * Promedio combinado del negocio = todas las TenantReview + los businessRating
   * no nulos de EmployeeReview. Una métrica que refleja tanto la reseña directa
   * del marketplace como las que vienen del flujo de cierre de cita.
   */
  private async getCombinedTenantRating(tenantId: string) {
    const [tenantAgg, employeeBusinessAgg] = await Promise.all([
      this.prisma.tenantReview.aggregate({
        where: { tenantId },
        _avg: { rating: true },
        _sum: { rating: true },
        _count: { id: true },
      }),
      this.prisma.employeeReview.aggregate({
        where: { tenantId, isVisible: true, businessRating: { not: null } },
        _sum: { businessRating: true },
        _count: { businessRating: true },
      }),
    ]);

    const tenantSum = Number(tenantAgg._sum.rating || 0);
    const tenantCount = tenantAgg._count.id;
    const empBusinessSum = Number(employeeBusinessAgg._sum.businessRating || 0);
    const empBusinessCount = employeeBusinessAgg._count.businessRating;

    const totalCount = tenantCount + empBusinessCount;
    const totalSum = tenantSum + empBusinessSum;
    const avg = totalCount > 0 ? totalSum / totalCount : null;

    return {
      avg: avg !== null ? Math.round(avg * 10) / 10 : null,
      total: totalCount,
    };
  }

  /**
   * Rating del empleado = sus EmployeeReview.rating + TODAS las TenantReview
   * del negocio donde trabaja. Esto cumple la regla "la puntuación al negocio
   * influye en el puntaje de los empleados".
   */
  private async getCombinedEmployeeRating(employeeId: string, tenantId: string) {
    const [empAgg, tenantAgg] = await Promise.all([
      this.prisma.employeeReview.aggregate({
        where: { employeeId, isVisible: true },
        _sum: { rating: true },
        _count: { id: true },
      }),
      this.prisma.tenantReview.aggregate({
        where: { tenantId },
        _sum: { rating: true },
        _count: { id: true },
      }),
    ]);

    const empSum = Number(empAgg._sum.rating || 0);
    const empCount = empAgg._count.id;
    const tnSum = Number(tenantAgg._sum.rating || 0);
    const tnCount = tenantAgg._count.id;

    const totalCount = empCount + tnCount;
    const totalSum = empSum + tnSum;
    const avg = totalCount > 0 ? totalSum / totalCount : null;

    return {
      avg: avg !== null ? Math.round(avg * 10) / 10 : null,
      total: totalCount,
    };
  }

  async getTenantReviews(tenantSlug: string, userId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, isMarketplaceListed: true },
    });
    if (!tenant || !tenant.isMarketplaceListed) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const reviews = await this.prisma.tenantReview.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = await this.getCombinedTenantRating(tenant.id);

    return {
      data: {
        averageRating: summary.avg,
        totalReviews: summary.total,
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          userId: r.userId,
          isMine: userId ? r.userId === userId : false,
          userName: `${r.user.firstName} ${r.user.lastName?.[0] || ''}.`,
          userAvatarUrl: r.user.avatarUrl || null,
        })),
      },
    };
  }

  async upsertTenantReview(
    tenantSlug: string,
    userId: string,
    dto: CreateTenantReviewDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, isMarketplaceListed: true },
    });
    if (!tenant || !tenant.isMarketplaceListed) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const review = await this.prisma.tenantReview.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId } },
      create: {
        tenantId: tenant.id,
        userId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
      update: {
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
    });

    return {
      data: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        isMine: true,
      },
    };
  }

  async deleteTenantReview(tenantSlug: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');

    await this.prisma.tenantReview.deleteMany({
      where: { tenantId: tenant.id, userId },
    });

    return { data: { message: 'Reseña eliminada' } };
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
      where: { userId_employeeId: { userId: marketplaceUserId, employeeId } },
    });

    if (existing) {
      await this.prisma.marketplaceProfessionalFavorite.delete({ where: { id: existing.id } });
      return { data: { favorited: false } };
    }

    await this.prisma.marketplaceProfessionalFavorite.create({
      data: { userId: marketplaceUserId, employeeId },
    });
    return { data: { favorited: true } };
  }

  async getMyProfessionalFavorites(marketplaceUserId: string) {
    const favorites = await this.prisma.marketplaceProfessionalFavorite.findMany({
      where: { userId: marketplaceUserId },
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
      // Busqueda multi-campo: nombre, apellido, especialidad (jobTitle),
      // bio, servicios que realiza el profesional y categoria del negocio
      // donde trabaja. Permite encontrar profesionales por lo que ofrecen,
      // no solo por su nombre.
      where.OR = [
        { firstName: { contains: cleanSearch } },
        { lastName: { contains: cleanSearch } },
        { jobTitle: { contains: cleanSearch } },
        { bio: { contains: cleanSearch } },
        { employeeServices: { some: { service: { name: { contains: cleanSearch } } } } },
        { tenant: { businessType: { contains: cleanSearch } } },
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
        // Orden alfabetico por nombre + apellido (es-MX).
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
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

    // Stats, rating, dos fuentes de portfolio (manual + appointment photos)
    // y top services en paralelo.
    const [completedCount, ratingAgg, manualPortfolio, worksRaw, topServices] = await Promise.all([
      this.prisma.appointment.count({
        where: { employeeId, tenantId: tenant.id, status: 'COMPLETED' },
      }),
      this.prisma.employeeReview.aggregate({
        where: { employeeId, tenantId: tenant.id, isVisible: true },
        _avg: { rating: true },
        _count: { id: true },
      }),
      // Portfolio manual curado desde el dashboard (EmployeePortfolioImage).
      // Si tienen serviceId asignado, se incluye el service para categorizar.
      // Si no, aparecen solo en el tab "Todos".
      // Las fotos con isHidden=true no se muestran en el perfil publico —
      // siguen en el portafolio personal del empleado para que pueda
      // revertir cuando quiera.
      // Las isFeatured=true aparecen primero en el perfil publico.
      this.prisma.employeePortfolioImage.findMany({
        where: { employeeId, isHidden: false },
        include: {
          service: { select: { id: true, name: true } },
        },
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 60,
      }),
      // Fotos de resultado subidas al cerrar las citas COMPLETED del empleado.
      // Si la foto tiene serviceId, ese es el servicio (1 foto = 1 servicio).
      // Si no tiene (legacy, antes del cambio), fallback a todos los items de
      // la cita filtrados a este empleado.
      this.prisma.appointmentPhoto.findMany({
        where: {
          tenantId: tenant.id,
          appointment: {
            employeeId,
            tenantId: tenant.id,
            status: 'COMPLETED',
          },
        },
        include: {
          service: { select: { id: true, name: true } },
          appointment: {
            select: {
              id: true,
              items: {
                where: { employeeId },
                select: {
                  serviceId: true,
                  serviceNameSnapshot: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
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

    // Merge de las dos fuentes en un solo array. Cada item tiene services[]
    // (vacio para fotos manuales). El frontend agrupa por nombre de servicio
    // y muestra las fotos manuales solo en el tab "Todos".
    //
    // Deduplicacion por imageUrl: una misma foto puede estar en ambas
    // tablas porque el wizard de cerrar cita crea AppointmentPhoto Y
    // auto-copia a EmployeePortfolioImage. Manual gana (tiene metadata
    // rica: isFeatured, isHidden, sortOrder).
    const seen = new Set<string>();
    const portfolio: any[] = [];
    for (const p of manualPortfolio) {
      if (seen.has(p.imageUrl)) continue;
      seen.add(p.imageUrl);
      portfolio.push({
        id: p.id,
        imageUrl: p.imageUrl,
        caption: p.caption,
        createdAt: p.createdAt,
        services: p.service ? [{ id: p.service.id, name: p.service.name }] : [],
      });
    }
    for (const p of worksRaw) {
      if (seen.has(p.imageUrl)) continue;
      seen.add(p.imageUrl);
      portfolio.push({
        id: p.id,
        imageUrl: p.imageUrl,
        caption: p.caption,
        createdAt: p.createdAt,
        services: p.service
          ? [{ id: p.service.id, name: p.service.name }]
          : (p.appointment?.items || []).map((it) => ({
              id: it.serviceId,
              name: it.serviceNameSnapshot,
            })),
      });
    }

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

    // Lista completa de servicios que el profesional realiza, para mostrar
    // en una seccion dedicada del perfil. Incluye duracion y precio para
    // que el cliente pueda elegir.
    const allServices = await this.prisma.employeeService.findMany({
      where: { employeeId, service: { isActive: true } },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            durationMinutes: true,
            price: true,
            currency: true,
            category: true,
            subcategory: true,
          },
        },
      },
    });
    const services = allServices
      .map((es) => es.service)
      .filter(Boolean)
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'es'));

    // Rating combinado del empleado: incluye TenantReview del negocio.
    const combinedEmpRating = await this.getCombinedEmployeeRating(employeeId, tenant.id);

    return {
      data: {
        ...employee,
        businessName: tenant.name,
        tenantSlug: tenant.slug,
        completedAppointments: completedCount,
        averageRating: combinedEmpRating.avg,
        totalReviews: combinedEmpRating.total,
        portfolio,
        services,
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
    const mktUser = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
    });

    if (!mktUser) {
      throw new NotFoundException('Usuario marketplace no encontrado');
    }

    // Find existing Client linked to this marketplace user
    let client = await this.prisma.client.findFirst({
      where: { tenantId: tenant.id, userId: marketplaceUserId },
    });

    if (!client && mktUser.email) {
      // Try matching by email (link pre-existing walk-in clients)
      client = await this.prisma.client.findFirst({
        where: { tenantId: tenant.id, email: mktUser.email },
      });
      if (client) {
        await this.prisma.client.update({
          where: { id: client.id },
          data: { userId: marketplaceUserId },
        });
      }
    }

    if (!client) {
      // Create new local Client record
      client = await this.prisma.client.create({
        data: {
          tenantId: tenant.id,
          userId: marketplaceUserId,
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

    // Base URL para el QR del negocio: ordena de mas especifico a generico.
    // APP_BASE_URL es la variable canonica para el dominio publico del web;
    // FRONTEND_URL es la que ya existe en .env de produccion (la usa CORS,
    // emails, etc), asi cubre tenants ya desplegados sin tener que editar
    // .env. El localhost queda solo como fallback de desarrollo local.
    const baseUrl =
      process.env.APP_BASE_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
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
    const current = await this.prisma.user.findUnique({
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
    if (dto.country !== undefined) updateData.country = dto.country || null;
    if (dto.phone !== undefined) updateData.phone = dto.phone || null;

    const user = await this.prisma.user.update({
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

    // Sync linked Client records. Cada tenant donde el marketplace user está
    // registrado tiene una fila en `clients` con userId apuntando al User.
    // Si solo propagamos firstName/lastName, el POS de cada negocio sigue
    // mostrando phone/email viejos cuando el usuario actualiza su perfil —
    // el cajero termina con teléfono incorrecto en el campo de WhatsApp.
    // Propagamos todos los campos espejados en la tabla clients.
    const clientUpdate: any = {};
    if (dto.firstName !== undefined) clientUpdate.firstName = dto.firstName;
    if (dto.lastName !== undefined) clientUpdate.lastName = dto.lastName;
    if (dto.phone !== undefined) clientUpdate.phone = dto.phone || null;
    if (dto.gender !== undefined) clientUpdate.gender = dto.gender || null;
    if (dto.birthDate !== undefined) clientUpdate.dateOfBirth = dto.birthDate ? new Date(dto.birthDate) : null;

    if (Object.keys(clientUpdate).length > 0) {
      await this.prisma.client.updateMany({
        where: { userId: marketplaceUserId },
        data: clientUpdate,
      });
    }

    return user;
  }

  async updateSettings(marketplaceUserId: string, dto: UpdateMarketplaceSettingsDto) {
    const current = await this.prisma.user.findUnique({
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

    const user = await this.prisma.user.update({
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

    await this.prisma.user.update({
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
    const user = await this.prisma.user.findUnique({
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
    await this.prisma.user.delete({
      where: { id: marketplaceUserId },
    });

    return { message: 'Cuenta eliminada' };
  }

  async reactivateAccount(marketplaceUserId: string) {
    await this.prisma.user.update({
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
    const current = await this.prisma.user.findUnique({
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
      const existing = await this.prisma.user.findFirst({
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
        const existing = await this.prisma.user.findFirst({
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

    const user = await this.prisma.user.update({
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
        where: { userId: marketplaceUserId },
        data: clientUpdate,
      });
    }

    return user;
  }

  async updateAvatar(marketplaceUserId: string, avatarUrl: string): Promise<string | null> {
    const current = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
      select: { avatarUrl: true },
    });
    const oldUrl = current?.avatarUrl || null;

    await this.prisma.user.update({
      where: { id: marketplaceUserId },
      data: { avatarUrl },
    });

    // Propagar avatar a los Client rows espejados en cada tenant — si no,
    // el avatar viejo persiste en el avatar mostrado por staff/POS.
    await this.prisma.client.updateMany({
      where: { userId: marketplaceUserId },
      data: { avatarUrl },
    });

    return oldUrl;
  }

  async changePassword(marketplaceUserId: string, dto: ChangeMarketplacePasswordDto) {
    const user = await this.prisma.user.findUnique({
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
    await this.prisma.user.update({
      where: { id: marketplaceUserId },
      data: { passwordHash },
    });

    return { message: 'Contraseña actualizada' };
  }

  /**
   * El cliente deja la reseña de SU cita ya completada desde el marketplace.
   * Valida pertenencia (clientId.userId === marketplaceUserId), estado
   * COMPLETED, y que no exista review previa. Idéntica forma a la creada por
   * el flujo confirm-payment.
   */
  async createReviewForMyAppointment(
    marketplaceUserId: string,
    appointmentId: string,
    dto: { rating: number; comment?: string; businessRating?: number; businessComment?: string },
  ) {
    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('La calificación principal debe ser un entero entre 1 y 5');
    }
    if (dto.businessRating !== undefined && dto.businessRating !== null) {
      if (!Number.isInteger(dto.businessRating) || dto.businessRating < 1 || dto.businessRating > 5) {
        throw new BadRequestException('La calificación secundaria debe ser un entero entre 1 y 5');
      }
    }
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        tenantId: true,
        employeeId: true,
        clientId: true,
        status: true,
        client: { select: { userId: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    if (appointment.client?.userId !== marketplaceUserId) {
      throw new ForbiddenException('No puedes reseñar una cita ajena');
    }
    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException('Solo puedes reseñar citas completadas');
    }
    const existing = await this.prisma.employeeReview.findUnique({
      where: { appointmentId: appointment.id },
    });
    if (existing) {
      throw new BadRequestException('Esta cita ya tiene una reseña');
    }
    const review = await this.prisma.employeeReview.create({
      data: {
        tenantId: appointment.tenantId,
        employeeId: appointment.employeeId,
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        rating: dto.rating,
        comment: dto.comment || null,
        businessRating: dto.businessRating ?? null,
        businessComment: dto.businessComment || null,
        reviewedAt: new Date(),
      },
      select: { id: true, rating: true, businessRating: true, reviewedAt: true },
    });
    const client = await this.prisma.client.findUnique({
      where: { id: appointment.clientId },
      select: { firstName: true, lastName: true },
    });
    this.eventEmitter.emit('review.created', {
      tenantId: appointment.tenantId,
      reviewId: review.id,
      employeeId: appointment.employeeId,
      rating: review.rating,
      clientName: client ? `${client.firstName} ${client.lastName}` : 'Un cliente',
    });
    return { data: review };
  }

  /**
   * El cliente omite dejar reseña de UNA cita. Permanente y por cita: marca
   * reviewDismissedAt para que el modal no vuelva a saltar para esa cita (no
   * afecta otras citas, ni futuras, del mismo negocio).
   */
  async dismissMyAppointmentReview(marketplaceUserId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, client: { select: { userId: true } } },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    if (appointment.client?.userId !== marketplaceUserId) {
      throw new ForbiddenException('No puedes modificar una cita ajena');
    }
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { reviewDismissedAt: new Date() },
    });
    return { data: { dismissed: true } };
  }

  async getMyAppointments(
    marketplaceUserId: string,
    filter: 'upcoming' | 'past' | 'all',
    page: number,
    perPage: number,
  ) {
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: [], meta: { total: 0, page, perPage, totalPages: 0 } };
    }

    // Las citas se guardan con startTime en "hora del negocio" raw, sin
    // offset real. Para clasificar upcoming/past necesitamos el "now en
    // hora del negocio" de cada sucursal (Location.timezone). Por eso
    // traemos todas las citas (filtradas solo por cliente + status), y
    // hacemos el upcoming/past en memoria con la TZ propia de cada cita.
    const baseWhere: any = { clientId: { in: clientIds } };
    if (filter === 'upcoming') {
      baseWhere.status = { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] };
    }

    const allAppts = await this.prisma.appointment.findMany({
      where: baseWhere,
      // Select explicito + relaciones minimas. La sucursal viene en
      // location (directa); no es necesario duplicar locations del tenant.
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        notes: true,
        discountAmount: true,
        paymentProofUrl: true,
        createdAt: true,
        tenant: {
          select: {
            id: true, name: true, slug: true, logoUrl: true,
            timezone: true, businessPhone: true, currency: true,
            tenantType: true,
          },
        },
        location: {
          select: { id: true, name: true, address: true, timezone: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true },
        },
        items: {
          select: { id: true, serviceNameSnapshot: true, priceSnapshot: true, durationSnapshot: true },
        },
        payments: {
          select: { id: true, status: true, paymentMethod: true, totalAmount: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        redemption: {
          select: {
            id: true,
            code: true,
            reward: { select: { name: true, type: true, discountAmount: true, discountMode: true } },
          },
        },
        // Para saber si la cita ya tiene reseña (oculta el modal en marketplace).
        review: { select: { id: true, rating: true, businessRating: true } },
        // Si el cliente ya omitió la reseña de esta cita, no volver a pedirla.
        reviewDismissedAt: true,
      },
    });

    // Filtrado upcoming/past con TZ por sucursal.
    const apptIsUpcoming = (appt: any): boolean => {
      const tz =
        appt.location?.timezone ||
        appt.tenant?.timezone ||
        'America/Mexico_City';
      const nowStr = nowInTz(tz); // "YYYY-MM-DDTHH:mm:ss"
      const apptStr = toRawIso(appt.startTime);
      return apptStr >= nowStr;
    };

    const filtered = allAppts.filter((appt) => {
      const isUp = apptIsUpcoming(appt);
      const isClosed = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status as string);
      if (filter === 'upcoming') return isUp && !isClosed;
      if (filter === 'past') return !isUp || isClosed;
      return true; // 'all': sin filtro
    });

    filtered.sort((a, b) => {
      const aStr = toRawIso(a.startTime);
      const bStr = toRawIso(b.startTime);
      // upcoming asc; past/all desc (más reciente primero)
      return filter === 'upcoming'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    const total = filtered.length;
    const paged = filtered.slice((page - 1) * perPage, page * perPage);

    return {
      data: paged,
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

    const where: any = { userId: marketplaceUserId };

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
              businessPhone: true,
              currency: true,
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
      where: { userId: marketplaceUserId },
      select: { id: true, tenantId: true, loyaltyPoints: true, tenant: { select: { name: true, slug: true, logoUrl: true } } },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: { totalServices: 0, totalPoints: 0, totalPhotos: 0, pointsByTenant: [] } };
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
    const pointsByTenant = clients
      .filter((c) => c.loyaltyPoints > 0)
      .map((c) => ({
        tenantId: c.tenantId,
        tenantName: c.tenant.name,
        tenantSlug: c.tenant.slug,
        tenantLogo: c.tenant.logoUrl,
        points: c.loyaltyPoints,
      }));

    return { data: { totalServices, totalPoints, totalPhotos, pointsByTenant } };
  }

  async getMyGallery(marketplaceUserId: string) {
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId },
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
      where: { userId: marketplaceUserId },
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

  /**
   * Actualiza el paymentProofUrl de una cita propia del cliente.
   * Devuelve la URL anterior (si existía) para que el caller la borre del disco.
   */
  async setAppointmentPaymentProof(
    marketplaceUserId: string,
    appointmentId: string,
    newUrl: string,
  ): Promise<string | null> {
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) {
      throw new NotFoundException('No se encontró el cliente');
    }
    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId: { in: clientIds } },
      select: { id: true, status: true, paymentProofUrl: true },
    });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    if (['CANCELLED', 'NO_SHOW'].includes(appt.status as string)) {
      throw new BadRequestException('Esta cita ya no admite subir comprobante');
    }
    const oldUrl = appt.paymentProofUrl;
    await this.prisma.appointment.update({
      where: { id: appt.id },
      data: { paymentProofUrl: newUrl },
    });
    return oldUrl || null;
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

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        userId: user.id,
        scope: 'client',
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
        serviceIds: true,
        code: true,
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
      where: { userId: marketplaceUserId },
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
            serviceId: true,
            serviceIds: true,
            service: { select: { id: true, name: true, price: true } },
          },
        },
        tenant: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: redemptions };
  }

  async getReferralInfo(code: string) {
    // Antes leiamos de promotionReferral; ahora de rewardReferral.
    const referral = await this.prisma.rewardReferral.findFirst({
      where: { code, status: 'ACTIVE' },
      include: {
        reward: { select: { name: true } },
        tenant: { select: { name: true, slug: true } },
      },
    });

    if (!referral) {
      return { data: null };
    }

    // Get generator's name
    const client = await this.prisma.client.findFirst({
      where: { id: referral.generatedByClientId },
      select: { firstName: true, lastName: true },
    });

    const svcIds: string[] = Array.isArray(referral.serviceIds) ? referral.serviceIds as string[] : [];
    let serviceNames: string[] = [];
    if (svcIds.length > 0) {
      const svcs = await this.prisma.service.findMany({
        where: { id: { in: svcIds } },
        select: { name: true },
      });
      serviceNames = svcs.map((s) => s.name);
    }

    return {
      data: {
        code: referral.code,
        status: referral.status,
        expiresAt: referral.expiresAt,
        promotionName: referral.reward.name, // mantengo el nombre del campo de respuesta por compat con frontend
        tenantName: referral.tenant.name,
        tenantSlug: referral.tenant.slug,
        generatedBy: client ? `${client.firstName} ${client.lastName || ''}`.trim() : null,
        serviceNames,
      },
    };
  }

  async getMyReferrals(marketplaceUserId: string) {
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: [] };
    }

    // Antes leiamos promotionReferral; ahora rewardReferral.
    const referrals = await this.prisma.rewardReferral.findMany({
      where: { generatedByClientId: { in: clientIds } },
      include: {
        reward: { select: { name: true, type: true, description: true } },
        tenant: { select: { name: true, slug: true, logoUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve service names for each referral. Renombramos reward -> promotion
    // en la respuesta para mantener compat con el frontend.
    const enriched = await Promise.all(
      referrals.map(async (ref) => {
        const svcIds: string[] = Array.isArray(ref.serviceIds) ? ref.serviceIds as string[] : [];
        let serviceNames: string[] = [];
        if (svcIds.length > 0) {
          const svcs = await this.prisma.service.findMany({
            where: { id: { in: svcIds } },
            select: { name: true },
          });
          serviceNames = svcs.map((s) => s.name);
        }
        return { ...ref, promotion: ref.reward, serviceNames };
      }),
    );

    return { data: enriched };
  }

  async redeemReward(
    marketplaceUserId: string,
    tenantSlug: string,
    rewardId: string,
  ) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);

    // Find client for this tenant. Si el usuario nunca ha hecho una cita
    // aqui, no hay Client → no tiene puntos. El error original sonaba a
    // "tu cuenta no existe" lo cual confunde al cliente del marketplace.
    // Reframe del mensaje en terminos de puntos para ser util.
    const client = await this.prisma.client.findFirst({
      where: { tenantId: tenant.id, userId: marketplaceUserId },
    });
    if (!client) {
      throw new BadRequestException(
        `No cuentas con puntos suficientes. Agenda servicios con ${tenant.name} para ganar puntos y canjearlos por recompensas.`,
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
    // Guard: este endpoint solo canjea rewards basados en puntos. Despues
    // del cambio a Reward unificado, hay rewards sin pointsRequired (los
    // migrados desde Promotion). Esos no se canjean por aqui.
    const pointsRequired = reward.pointsRequired;
    if (pointsRequired == null) {
      throw new BadRequestException(
        'Esta recompensa no se canjea por puntos. Usá el flujo de cupones del booking.',
      );
    }
    if (client.loyaltyPoints < pointsRequired) {
      throw new BadRequestException(
        `Necesitas ${pointsRequired} puntos. Tienes ${client.loyaltyPoints}.`,
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
          freshClient.loyaltyPoints < pointsRequired
        ) {
          throw new BadRequestException('Puntos insuficientes');
        }

        // Deduct points
        await tx.client.update({
          where: { id: client.id },
          data: {
            loyaltyPoints: { decrement: pointsRequired },
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
            pointsSpent: pointsRequired,
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
    const mktUser = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
    });

    if (!mktUser) {
      throw new NotFoundException('Usuario marketplace no encontrado');
    }

    // Find or create client linked to marketplace user (same logic as enterBusiness)
    let client = await this.prisma.client.findFirst({
      where: { tenantId: tenant.id, userId: marketplaceUserId },
    });

    if (!client && mktUser.email) {
      client = await this.prisma.client.findFirst({
        where: { tenantId: tenant.id, email: mktUser.email },
      });
      if (client) {
        await this.prisma.client.update({
          where: { id: client.id },
          data: { userId: marketplaceUserId },
        });
      }
    }

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          tenantId: tenant.id,
          userId: marketplaceUserId,
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

    // Validate reward (antes "promotion") if provided. Mutuamente excluyente
    // con coupon. dto.promotionId mantiene su nombre por compat de API; los IDs
    // de reward y promotion coinciden por la migracion (Fase 1).
    let promotionRecord: any = null;
    if (dto.promotionId && !dto.couponCode) {
      const rawReward = await this.prisma.reward.findFirst({
        where: {
          id: dto.promotionId,
          tenantId: tenant.id,
          isActive: true,
          type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] },
        },
      });

      if (!rawReward) {
        throw new BadRequestException('Cupón no encontrado');
      }

      // Mapear al "type logico" que usaba la promotion: PERCENTAGE /
      // FIXED_AMOUNT / TWO_FOR_ONE. Mantiene la logica de calculo de
      // descuento intacta.
      const logicalType: string = rawReward.type === 'DESCUENTO'
        ? (rawReward.discountMode === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT')
        : rawReward.type; // TWO_FOR_ONE pasa tal cual

      promotionRecord = {
        ...rawReward,
        type: logicalType,
        value: Number(rawReward.discountAmount || 0),
        // Counter unificado: usar timesRedeemed/maxRedemptions de Reward
        usedCount: rawReward.timesRedeemed,
        maxUses: rawReward.maxRedemptions,
      };

      const now = new Date();
      if (rawReward.startDate && now < rawReward.startDate) {
        throw new BadRequestException('El cupón aún no ha comenzado');
      }
      if (rawReward.endDate && now > rawReward.endDate) {
        throw new BadRequestException('El cupón ha expirado');
      }
      if (rawReward.maxRedemptions != null && rawReward.timesRedeemed >= rawReward.maxRedemptions) {
        throw new BadRequestException('El cupón ha alcanzado el límite de usos');
      }

      // Validate service compatibility
      const promoServiceIds: string[] = Array.isArray(rawReward.serviceIds) ? rawReward.serviceIds as string[] : [];
      if (promoServiceIds.length > 0) {
        const hasApplicable = dto.serviceIds.some((id) => promoServiceIds.includes(id));
        if (!hasApplicable) {
          throw new BadRequestException('El cupón no aplica a los servicios seleccionados');
        }
      }

      // Calculate promotion discount
      const applicableIds = promoServiceIds.length > 0
        ? dto.serviceIds.filter((id) => promoServiceIds.includes(id))
        : dto.serviceIds;

      const promoServices = await this.prisma.service.findMany({
        where: { id: { in: applicableIds }, tenantId: tenant.id },
        select: { price: true },
      });
      const subtotal = promoServices.reduce((s, svc) => s + Number(svc.price), 0);

      if (rawReward.minAmount && subtotal < Number(rawReward.minAmount)) {
        throw new BadRequestException(`Monto mínimo requerido: ${rawReward.minAmount}`);
      }

      if (logicalType === 'PERCENTAGE') {
        discountAmount = Math.round(subtotal * Number(rawReward.discountAmount || 0) / 100 * 100) / 100;
      } else if (logicalType === 'FIXED_AMOUNT') {
        discountAmount = Math.min(Number(rawReward.discountAmount || 0), subtotal);
      } else if (logicalType === 'TWO_FOR_ONE') {
        // 2x1: No discount for the original booker — they pay full price.
        // A referral code will be generated post-booking for a friend.
        discountAmount = null;
      }
    }

    // Validate referral code (from 2x1 shared by a friend).
    // Antes leiamos de promotionReferral; ahora leemos de rewardReferral
    // (donde se generan los nuevos y donde la migration copio los viejos).
    let referralRecord: any = null;
    if (dto.referralCode && !dto.couponCode && !dto.promotionId) {
      const rawRef = await this.prisma.rewardReferral.findFirst({
        where: { code: dto.referralCode, tenantId: tenant.id, status: 'ACTIVE' },
        include: { reward: true },
      });
      if (rawRef) {
        referralRecord = { ...rawRef, promotion: rawRef.reward };
      }

      if (!referralRecord) {
        throw new BadRequestException('Código de referido no válido o ya utilizado');
      }

      if (referralRecord.expiresAt && new Date(referralRecord.expiresAt) < new Date()) {
        throw new BadRequestException('Este código de referido ha expirado');
      }

      // Validate that at least one of the booked services matches the referral
      const refServiceIds: string[] = Array.isArray(referralRecord.serviceIds) ? referralRecord.serviceIds : [];
      if (refServiceIds.length > 0) {
        const hasMatch = dto.serviceIds.some((id) => refServiceIds.includes(id));
        if (!hasMatch) {
          throw new BadRequestException('Este código solo es válido para los servicios de la promoción original');
        }
      }

      // The friend who redeems cannot be the same person who generated it
      if (client.id === referralRecord.generatedByClientId) {
        throw new BadRequestException('No puedes usar tu propio código de referido');
      }

      // Apply 100% discount on the applicable services
      const applicableIds = refServiceIds.length > 0
        ? dto.serviceIds.filter((id) => refServiceIds.includes(id))
        : dto.serviceIds;

      const refServices = await this.prisma.service.findMany({
        where: { id: { in: applicableIds }, tenantId: tenant.id },
        select: { price: true },
      });
      discountAmount = refServices.reduce((s, svc) => s + Number(svc.price), 0);
    }

    // Pay with points: validate and calculate
    let pointsSpent = 0;
    if (dto.payWithPoints) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds }, tenantId: tenant.id },
        select: { id: true, name: true, redeemableWithPoints: true, pointsRequired: true },
      });

      const nonRedeemable = services.filter((s) => !s.redeemableWithPoints || !s.pointsRequired);
      if (nonRedeemable.length > 0) {
        throw new BadRequestException('No todos los servicios seleccionados son canjeables con puntos');
      }

      pointsSpent = services.reduce((sum, s) => sum + (s.pointsRequired || 0), 0);
      if (pointsSpent <= 0) {
        throw new BadRequestException('No se puede calcular el costo en puntos');
      }

      if (client.loyaltyPoints < pointsSpent) {
        throw new BadRequestException(
          `Puntos insuficientes. Necesitas ${pointsSpent} pts y tienes ${client.loyaltyPoints} pts`,
        );
      }
    }

    // Delegate to AppointmentsService.
    // Si vienen serviceAssignments (multi-empleado), las pasamos para que
    // cada servicio quede ligado a su profesional. employeeId queda como
    // "primario" (en general el primero del map).
    const appointment = await this.appointmentsService.create(
      {
        locationId: employee.locationId,
        clientId: client.id,
        employeeId: dto.employeeId,
        serviceIds: dto.serviceIds,
        startTime: dto.startTime,
        notes: dto.notes,
        source: 'ONLINE',
        serviceAssignments: dto.serviceAssignments,
      },
      tenant.id,
    );

    // Post-booking transactions
    const postOps: any[] = [];

    // Deduct points if paying with points
    if (dto.payWithPoints && pointsSpent > 0 && appointment?.data?.id) {
      postOps.push(
        this.prisma.client.update({
          where: { id: client.id },
          data: { loyaltyPoints: { decrement: pointsSpent } },
        }),
        this.prisma.appointment.update({
          where: { id: appointment.data.id },
          data: {
            pointsSpent,
            notes: `${appointment.data.notes || ''}\n[Pagado con ${pointsSpent} puntos]`.trim(),
          },
        }),
      );
    }

    // Mark coupon as used and link to appointment
    if (redemption && appointment?.data?.id) {
      postOps.push(
        this.prisma.rewardRedemption.update({
          where: { id: redemption.id },
          data: { status: 'USED', usedAt: new Date() },
        }),
        this.prisma.appointment.update({
          where: { id: appointment.data.id },
          data: { redemptionId: redemption.id, discountAmount },
        }),
      );
    }

    // Increment reward counter (antes era promotion.usedCount) y guardar
    // descuento en la cita.
    if (promotionRecord && appointment?.data?.id) {
      postOps.push(
        this.prisma.reward.update({
          where: { id: promotionRecord.id },
          data: { timesRedeemed: { increment: 1 } },
        }),
      );
      if (discountAmount) {
        postOps.push(
          this.prisma.appointment.update({
            where: { id: appointment.data.id },
            data: {
              discountAmount,
              notes: `${appointment.data.notes || ''}\n[Cupón: ${promotionRecord.name}]`.trim(),
            },
          }),
        );
      }
    }

    // Mark referral code as used (rewardReferral, antes promotionReferral)
    if (referralRecord && appointment?.data?.id) {
      postOps.push(
        this.prisma.rewardReferral.update({
          where: { id: referralRecord.id },
          data: {
            status: 'USED',
            usedAt: new Date(),
            redeemedByClientId: client.id,
            redeemedAppointmentId: appointment.data.id,
          },
        }),
        this.prisma.appointment.update({
          where: { id: appointment.data.id },
          data: {
            discountAmount,
            notes: `${appointment.data.notes || ''}\n[Código 2x1: ${referralRecord.code} — Cupón: ${referralRecord.promotion.name}]`.trim(),
          },
        }),
      );
    }

    // Generate referral code for TWO_FOR_ONE rewards (post-booking).
    // Antes creaba promotionReferral; ahora rewardReferral.
    let referralCode: string | null = null;
    if (promotionRecord?.type === 'TWO_FOR_ONE' && appointment?.data?.id) {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }

      const promoSvcIds = Array.isArray(promotionRecord.serviceIds) ? promotionRecord.serviceIds : dto.serviceIds;

      await this.prisma.rewardReferral.create({
        data: {
          tenantId: tenant.id,
          rewardId: promotionRecord.id,
          appointmentId: appointment.data.id,
          serviceIds: promoSvcIds,
          code,
          generatedByClientId: client.id,
          expiresAt: promotionRecord.endDate,
        },
      });

      referralCode = code;
    }

    if (postOps.length > 0) {
      await this.prisma.$transaction(postOps);
    }

    return {
      ...appointment,
      data: {
        ...appointment.data,
        discountAmount,
        pointsSpent: pointsSpent > 0 ? pointsSpent : null,
        couponApplied: redemption ? { code: redemption.code, reward: redemption.reward.name } : null,
        promotionApplied: promotionRecord ? { id: promotionRecord.id, name: promotionRecord.name } : null,
        referralCode,
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
        client: { select: { userId: true, id: true } },
        items: true,
      },
    });

    if (!appointment || appointment.client?.userId !== marketplaceUserId) {
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
      where: { userId: marketplaceUserId },
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
      // Rewards migrados desde Promotion no tienen pointsRequired. Para esos
      // canRedeem es siempre true (se canjean en el booking, no por puntos).
      const pr = r.pointsRequired ?? 0;
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
        canRedeem: (client?.loyaltyPoints ?? 0) >= pr,
        pointsNeeded: Math.max(0, pr - (client?.loyaltyPoints ?? 0)),
      };
    });

    return { data };
  }
}

// ─── TZ helpers (hora del negocio) ──────────────────────────────────
// Las citas se guardan con startTime en "hora del negocio" raw, sin
// offset. Para comparar contra "ahora" necesitamos el now expresado en
// la TZ de la sucursal en formato 'YYYY-MM-DDTHH:mm:ss', y luego una
// simple comparación de strings.

function nowInTz(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  } catch {
    return new Date().toISOString().substring(0, 19);
  }
}

function toRawIso(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (typeof d === 'string') return d.substring(0, 19);
  // Las citas se guardan en UTC raw (sin offset real). Las "leemos" como
  // si fueran TZ-naive: toISOString sin TZ shift es lo que queremos.
  return d.toISOString().substring(0, 19);
}
