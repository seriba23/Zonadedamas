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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { EmailChannel } from '../notifications/channels/email.channel';
import { UploadsService } from '../uploads/uploads.service';
import {
  renderPasswordResetEmail,
  renderPasswordSetOAuthEmail,
} from './email-templates/password-reset.template';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly rbacService: RbacService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailChannel: EmailChannel,
    private readonly uploads: UploadsService,
  ) {}

  /** True si la URL ya es un path local de uploads (no hotlink externo). */
  private isLocalUploadPath(url: string | null | undefined): boolean {
    if (!url) return false;
    return url.startsWith('/api/uploads/') || url.startsWith('/uploads/');
  }

  async login(email: string, password: string) {
    // Unified login: matches users with business profile, client profile, or both.
    const matchedUser = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        employee: { select: { id: true } },
        userRoles: { select: { role: { select: { slug: true } } } },
      },
    });

    if (!matchedUser || !matchedUser.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!matchedUser.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(password, matchedUser.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const hasBusiness = !!matchedUser.tenantId;
    // Any authenticated user can act as a marketplace client.
    // Auto-activate isClient on first login so the flag becomes persistent.
    let hasClient = matchedUser.isClient;
    if (!hasClient) {
      await this.prisma.user.update({
        where: { id: matchedUser.id },
        data: { isClient: true },
      });
      hasClient = true;
    }

    if (!hasBusiness && !hasClient) {
      throw new UnauthorizedException('Esta cuenta no tiene perfiles activos');
    }

    let business: any = null;
    let client: any = null;
    const profiles: string[] = [];

    if (hasBusiness) {
      const tenantId = matchedUser.tenantId!;

      // Auto-expire trial if needed
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
        select: { status: true, trialEndsAt: true },
      });
      if (subscription) {
        const now = new Date();
        if (subscription.status === 'TRIAL' && subscription.trialEndsAt && now > subscription.trialEndsAt) {
          await this.prisma.subscription.update({
            where: { tenantId },
            data: { status: 'SUSPENDED' },
          });
          await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { subscriptionStatus: 'SUSPENDED' },
          });
        }
      }

      // Admin = el user tiene asignado un rol con acceso administrativo.
      // owner: dueño del negocio. admin: rol clásico admin. helper: empleado
      // promovido vía "Convertir en administrador" (UI de Permisos).
      const ADMIN_ROLE_SLUGS = ['owner', 'admin', 'helper'];
      const hasAdminRole = (matchedUser.userRoles || []).some((ur) =>
        ADMIN_ROLE_SLUGS.includes(ur.role.slug),
      );

      const tokens = await this.generateTokens(matchedUser);
      business = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: matchedUser.id,
          email: matchedUser.email,
          firstName: matchedUser.firstName,
          lastName: matchedUser.lastName,
          tenantId: matchedUser.tenantId,
          tenantName: matchedUser.tenant?.name ?? null,
          employeeId: matchedUser.employee?.id ?? null,
          avatarUrl: matchedUser.avatarUrl,
          permissions: tokens.permissions,
          isAdmin: hasAdminRole,
        },
      };

      if (hasAdminRole) profiles.push('admin');
      if (matchedUser.employee) profiles.push('professional');
    }

    if (hasClient) {
      const tokens = await this.generateClientTokens(matchedUser);
      client = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: matchedUser.id,
          email: matchedUser.email,
          firstName: matchedUser.firstName,
          lastName: matchedUser.lastName,
          phone: matchedUser.phone,
          gender: matchedUser.gender,
          avatarUrl: matchedUser.avatarUrl,
          socialProvider: matchedUser.socialProvider,
        },
      };
      profiles.push('client');
    }

    // Backwards-compatible flat fields for existing /login frontend (admin/employee).
    return {
      // legacy flat shape (business). null if user is client-only.
      accessToken: business?.accessToken ?? null,
      refreshToken: business?.refreshToken ?? null,
      user: business?.user ?? null,
      // new unified fields
      business,
      client,
      profiles,
    };
  }

  async register(dto: RegisterDto) {
    if (dto.inviteCode) {
      return this.registerWithInviteCode(dto);
    }
    if (dto.type === 'individual') {
      return this.registerIndividual(dto);
    }
    if (dto.type === 'freelancer') {
      return this.registerFreelancer(dto);
    }
    throw new BadRequestException(
      'Debes proporcionar un código de invitación o registrarte como particular',
    );
  }

  async getInvitePreview(code: string) {
    const invite = await this.prisma.tenantInviteCode.findUnique({
      where: { code },
      include: {
        tenant: { select: { name: true, logoUrl: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
      },
    });

    if (!invite || !invite.isActive) {
      throw new NotFoundException('Código de invitación inválido');
    }
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException('El código de invitación ha expirado');
    }
    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('El código de invitación ha alcanzado el límite de usos');
    }

    const owner = await this.prisma.user.findFirst({
      where: {
        tenantId: invite.tenantId,
        userRoles: { some: { role: { slug: 'owner' } } },
      },
      select: { firstName: true, lastName: true },
    });

    return {
      data: {
        businessName: invite.tenant.name,
        logoUrl: invite.tenant.logoUrl,
        ownerName: owner ? `${owner.firstName} ${owner.lastName}` : null,
        jobTitle: invite.jobTitle || null,
        services: invite.services.map((s) => ({ id: s.service.id, name: s.service.name })),
      },
    };
  }

  private async registerWithInviteCode(dto: RegisterDto) {
    const invite = await this.prisma.tenantInviteCode.findUnique({
      where: { code: dto.inviteCode },
      include: {
        tenant: true,
        services: { select: { serviceId: true } },
      },
    });

    if (!invite || !invite.isActive) {
      throw new BadRequestException('Código de invitación inválido o inactivo');
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException('El código de invitación ha expirado');
    }

    if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
      throw new BadRequestException(
        'El código de invitación ha alcanzado el límite de usos',
      );
    }

    // Check if email already exists (now globally unique)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con este correo');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Get first location of the tenant
    const location = await this.prisma.location.findFirst({
      where: { tenantId: invite.tenantId, isActive: true },
    });
    if (!location) {
      throw new BadRequestException('El negocio no tiene ubicaciones activas');
    }

    // Get or create staff role
    let staffRole = await this.prisma.role.findUnique({
      where: { tenantId_slug: { tenantId: invite.tenantId, slug: 'staff' } },
    });
    if (!staffRole) {
      const basicPerms = await this.prisma.permission.findMany({
        where: { action: { in: ['read'] } },
      });
      staffRole = await this.prisma.role.create({
        data: {
          tenantId: invite.tenantId,
          name: 'Staff',
          slug: 'staff',
          description: 'Staff member with basic access',
          isSystem: true,
        },
      });
      if (basicPerms.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: basicPerms.map((p) => ({
            roleId: staffRole!.id,
            permissionId: p.id,
          })),
        });
      }
    }

    // Create user + employee + role assignment in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || null,
          // Direccion PERSONAL del empleado afiliado (no la del negocio
          // donde trabaja, que ya esta en invite.tenant). El profesional
          // puede tener una direccion personal distinta a la del local.
          address: dto.personalAddress || null,
          isActive: true,
        },
      });

      const newEmployee = await tx.employee.create({
        data: {
          tenantId: invite.tenantId,
          userId: newUser.id,
          locationId: location.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone || null,
          jobTitle: invite.jobTitle || null,
          isActive: true,
        },
      });

      // Auto-create default schedule: Mon-Sat 09:00-18:00
      await tx.employeeSchedule.createMany({
        data: (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => ({
          employeeId: newEmployee.id,
          dayOfWeek: day,
          isWorking: day !== 'SUNDAY',
          startTime: '09:00',
          endTime: '18:00',
          effectiveFrom: new Date('2020-01-01'),
        })),
      });

      // Assign services from invite code
      if (invite.services && invite.services.length > 0) {
        await tx.employeeService.createMany({
          data: invite.services.map((s) => ({
            employeeId: newEmployee.id,
            serviceId: s.serviceId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: staffRole.id,
          tenantId: invite.tenantId,
        },
      });

      // Increment invite code usage
      await tx.tenantInviteCode.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });

      return { newUser, newEmployee };
    });

    // Emit real-time notification to admin
    this.eventEmitter.emit('employee.joined', {
      tenantId: invite.tenantId,
      employee: {
        id: user.newEmployee.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        jobTitle: invite.jobTitle || null,
        services: (invite.services || []).map((s) => s.serviceId),
      },
    });

    const tokens = await this.generateTokens(user.newUser);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.newUser.id,
        email: user.newUser.email,
        firstName: user.newUser.firstName,
        lastName: user.newUser.lastName,
        tenantId: user.newUser.tenantId,
        permissions: tokens.permissions,
      },
    };
  }

  private async registerIndividual(dto: RegisterDto) {
    // Generate unique slug from business name or personal name
    const nameForSlug = dto.businessName || `${dto.firstName} ${dto.lastName}`;
    const baseSlug = nameForSlug
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    // Check slug uniqueness
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (existingTenant) {
      throw new ConflictException('Por favor intenta de nuevo');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Compose address from individual fields or legacy single field
    const addressParts = [
      dto.businessStreet,
      dto.businessCity,
      dto.businessState,
      dto.businessPostalCode,
      dto.businessCountry,
    ].filter(Boolean);
    const composedAddress =
      addressParts.length > 0
        ? addressParts.join(', ')
        : dto.businessAddress || null;

    // Store business types as comma-separated string
    const businessTypeValue =
      dto.businessTypes && dto.businessTypes.length > 0
        ? dto.businessTypes.join(',')
        : dto.businessType || null;

    // Get all permissions for owner role
    const ownerRolePermissions = await this.prisma.permission.findMany();

    const user = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // 30-day free trial
      const trialEndsAt = new Date(now);
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      // Create tenant with business info
      const tenant = await tx.tenant.create({
        data: {
          name: dto.businessName || `${dto.firstName} ${dto.lastName}`,
          slug,
          email: dto.email,
          phone: dto.phone || null,
          businessType: businessTypeValue,
          address: composedAddress,
          businessPhone: dto.businessPhone || null,
          contractAcceptedAt: dto.acceptContract ? now : null,
          isMarketplaceListed: true,
          timezone: 'America/New_York',
          currency: 'USD',
          subscriptionPlan: 'BASICO',
          subscriptionStatus: 'TRIAL',
        },
      });

      // Create trial subscription (no Stripe, no invoice)
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'BASICO',
          status: 'TRIAL',
          monthlyAmountUsd: 10,
          baseMonthlyUsd: 10,
          perEmployeeUsd: 10,
          billedEmployeeCount: 1, // owner counts as 1
          contractStartDate: now,
          contractEndDate: trialEndsAt,
          nextBillingDate: trialEndsAt,
          trialEndsAt,
        },
      });

      // Create default location with composed address
      const location = await tx.location.create({
        data: {
          tenantId: tenant.id,
          name: 'Principal',
          address: composedAddress,
          phone: dto.businessPhone || null,
          isActive: true,
        },
      });

      // Create user
      const newUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || null,
          // Direccion personal del admin/dueño. Separada de Tenant.address
          // (la del negocio) — pueden ser distintas.
          address: dto.personalAddress || null,
          isActive: true,
        },
      });

      // Create employee linked to user
      const ownerEmployee = await tx.employee.create({
        data: {
          tenantId: tenant.id,
          userId: newUser.id,
          locationId: location.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone || null,
          isActive: true,
        },
      });

      // Auto-create default schedule
      await tx.employeeSchedule.createMany({
        data: (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => ({
          employeeId: ownerEmployee.id,
          dayOfWeek: day,
          isWorking: day !== 'SUNDAY',
          startTime: '09:00',
          endTime: '18:00',
          effectiveFrom: new Date('2020-01-01'),
        })),
      });

      // Create Owner role for this tenant with all permissions
      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Owner',
          slug: 'owner',
          description: 'Full access to all features including billing',
          isSystem: true,
        },
      });

      // Assign all permissions to owner role
      if (ownerRolePermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: ownerRolePermissions.map((p) => ({
            roleId: ownerRole.id,
            permissionId: p.id,
          })),
        });
      }

      // Assign owner role to user
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: ownerRole.id,
          tenantId: tenant.id,
        },
      });

      return newUser;
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
        tenantId: user.tenantId,
        permissions: tokens.permissions,
      },
    };
  }

  private async registerFreelancer(dto: RegisterDto) {
    const fullName = `${dto.firstName} ${dto.lastName}`;
    const baseSlug = fullName
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    const existingTenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) throw new ConflictException('Por favor intenta de nuevo');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const ownerRolePermissions = await this.prisma.permission.findMany();

    const user = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const trialEndsAt = new Date(now);
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      // Componer la direccion del local del freelancer desde los campos
      // businessXxx (si el form los envio). Mismo formato string que usa
      // registerIndividual.
      const composedLocalAddress = [
        dto.businessStreet,
        dto.businessCity,
        dto.businessState,
        dto.businessPostalCode,
        dto.businessCountry,
      ].filter(Boolean).join(', ') || null;

      const tenant = await tx.tenant.create({
        data: {
          name: fullName,
          slug,
          email: dto.email,
          phone: dto.phone || null,
          address: composedLocalAddress,
          contractAcceptedAt: dto.acceptContract ? now : null,
          isMarketplaceListed: true,
          timezone: 'America/New_York',
          currency: 'USD',
          subscriptionPlan: 'BASICO',
          subscriptionStatus: 'TRIAL',
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'BASICO',
          status: 'TRIAL',
          monthlyAmountUsd: 5,
          baseMonthlyUsd: 5,
          perEmployeeUsd: 5,
          billedEmployeeCount: 1,
          contractStartDate: now,
          contractEndDate: trialEndsAt,
          nextBillingDate: trialEndsAt,
          trialEndsAt,
        },
      });

      const location = await tx.location.create({
        data: {
          tenantId: tenant.id,
          name: 'Principal',
          address: composedLocalAddress,
          isActive: true,
        },
      });

      const newUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || null,
          // Direccion personal del freelancer. Separada de Tenant.address
          // (del local del negocio independiente) — pueden ser distintas.
          address: dto.personalAddress || null,
          isActive: true,
        },
      });

      const socialEmployee = await tx.employee.create({
        data: {
          tenantId: tenant.id,
          userId: newUser.id,
          locationId: location.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone || null,
          isActive: true,
        },
      });

      await tx.employeeSchedule.createMany({
        data: (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => ({
          employeeId: socialEmployee.id,
          dayOfWeek: day,
          isWorking: day !== 'SUNDAY',
          startTime: '09:00',
          endTime: '18:00',
          effectiveFrom: new Date('2020-01-01'),
        })),
      });

      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Owner',
          slug: 'owner',
          description: 'Full access to all features including billing',
          isSystem: true,
        },
      });

      if (ownerRolePermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: ownerRolePermissions.map((p) => ({
            roleId: ownerRole.id,
            permissionId: p.id,
          })),
        });
      }

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: ownerRole.id,
          tenantId: tenant.id,
        },
      });

      return newUser;
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
        tenantId: user.tenantId,
        permissions: tokens.permissions,
      },
    };
  }

  async socialLogin(dto: SocialLoginDto) {
    // Verify token with provider
    const profile = dto.provider === 'google'
      ? await this.verifyGoogleToken(dto.token)
      : await this.verifyFacebookToken(dto.token);

    // Check if user already exists by email (across any tenant)
    const existingUsers = await this.prisma.user.findMany({
      where: { email: profile.email, isActive: true },
      include: { tenant: true },
    });

    if (existingUsers.length > 0) {
      // Avatar: si el user no tiene avatar O tiene una URL externa (hotlink
      // de un login social previo), descargar a local. Evita que el <img>
      // falle por referer policy / formato no soportado / expiracion de URL.
      const first = existingUsers[0];
      const needsLocalAvatar = !first.avatarUrl || !this.isLocalUploadPath(first.avatarUrl);
      if (needsLocalAvatar && profile.avatarUrl) {
        const localPath = await this.uploads.downloadAndSaveExternalImage(profile.avatarUrl, 'avatars');
        if (localPath) {
          await this.prisma.user.update({
            where: { id: first.id },
            data: { avatarUrl: localPath },
          });
        }
      }

      // Re-fetch with relations needed for the unified response (mirror of `login`).
      const matchedUser = await this.prisma.user.findUnique({
        where: { id: first.id },
        include: {
          tenant: true,
          employee: { select: { id: true } },
          userRoles: { select: { role: { select: { slug: true } } } },
        },
      });
      if (!matchedUser || !matchedUser.isActive) {
        throw new UnauthorizedException('Credenciales invalidas');
      }

      const hasBusiness = !!matchedUser.tenantId;
      let hasClient = matchedUser.isClient;
      if (!hasClient) {
        await this.prisma.user.update({
          where: { id: matchedUser.id },
          data: { isClient: true },
        });
        hasClient = true;
      }

      if (!hasBusiness && !hasClient) {
        throw new UnauthorizedException('Esta cuenta no tiene perfiles activos');
      }

      let business: any = null;
      let client: any = null;
      const profiles: string[] = [];

      if (hasBusiness) {
        const ADMIN_ROLE_SLUGS = ['owner', 'admin', 'helper'];
        const hasAdminRole = (matchedUser.userRoles || []).some((ur) =>
          ADMIN_ROLE_SLUGS.includes(ur.role.slug),
        );
        const tokens = await this.generateTokens(matchedUser);
        business = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: matchedUser.id,
            email: matchedUser.email,
            firstName: matchedUser.firstName,
            lastName: matchedUser.lastName,
            tenantId: matchedUser.tenantId,
            tenantName: matchedUser.tenant?.name ?? null,
            employeeId: matchedUser.employee?.id ?? null,
            avatarUrl: matchedUser.avatarUrl,
            permissions: tokens.permissions,
            isAdmin: hasAdminRole,
          },
        };
        if (hasAdminRole) profiles.push('admin');
        if (matchedUser.employee) profiles.push('professional');
      }

      if (hasClient) {
        const tokens = await this.generateClientTokens(matchedUser);
        client = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: matchedUser.id,
            email: matchedUser.email,
            firstName: matchedUser.firstName,
            lastName: matchedUser.lastName,
            phone: matchedUser.phone,
            gender: matchedUser.gender,
            avatarUrl: matchedUser.avatarUrl,
            socialProvider: matchedUser.socialProvider,
          },
        };
        profiles.push('client');
      }

      return {
        // Legacy flat fields — business tokens if available, else client (so the
        // social-login frontend always receives a usable token).
        accessToken: business?.accessToken ?? client?.accessToken ?? null,
        refreshToken: business?.refreshToken ?? client?.refreshToken ?? null,
        user: business?.user ?? client?.user ?? null,
        isNewUser: false,
        needsProfile: false,
        // Unified dual-profile fields.
        business,
        client,
        profiles,
      };
    }

    // New user — requires invite code to join a business
    if (!dto.inviteCode) {
      return {
        isNewUser: true,
        needsProfile: true,
        socialProfile: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          provider: dto.provider,
        },
      };
    }

    // Register with invite code
    const invite = await this.prisma.tenantInviteCode.findUnique({
      where: { code: dto.inviteCode },
      include: { tenant: true },
    });
    if (!invite || !invite.isActive) {
      throw new BadRequestException('Codigo de invitacion invalido o inactivo');
    }
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException('El codigo de invitacion ha expirado');
    }
    if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('El codigo de invitacion ha alcanzado el limite de usos');
    }

    // Check duplicate (email is now globally unique)
    const existingInTenant = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (existingInTenant) {
      throw new ConflictException('Ya existe una cuenta con este correo');
    }

    const location = await this.prisma.location.findFirst({
      where: { tenantId: invite.tenantId, isActive: true },
    });
    if (!location) throw new BadRequestException('El negocio no tiene ubicaciones activas');

    const staffRole = await this.prisma.role.findUnique({
      where: { tenantId_slug: { tenantId: invite.tenantId, slug: 'staff' } },
    });
    if (!staffRole) throw new BadRequestException('Configuracion de roles incompleta');

    // Create user + employee with a random password (social login, won't use it)
    const randomPassword = uuidv4();
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    // Descargar avatar de Google a local antes de crear (evita hotlink).
    let localAvatar: string | null = null;
    if (profile.avatarUrl) {
      localAvatar = await this.uploads.downloadAndSaveExternalImage(profile.avatarUrl, 'avatars');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          email: profile.email,
          passwordHash,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: localAvatar,
          isActive: true,
        },
      });

      const socialInviteEmployee = await tx.employee.create({
        data: {
          tenantId: invite.tenantId,
          userId: newUser.id,
          locationId: location.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          avatarUrl: localAvatar,
          isActive: true,
        },
      });

      await tx.employeeSchedule.createMany({
        data: (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => ({
          employeeId: socialInviteEmployee.id,
          dayOfWeek: day,
          isWorking: day !== 'SUNDAY',
          startTime: '09:00',
          endTime: '18:00',
          effectiveFrom: new Date('2020-01-01'),
        })),
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: staffRole.id,
          tenantId: invite.tenantId,
        },
      });

      await tx.tenantInviteCode.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });

      return newUser;
    });

    const tokens = await this.generateTokens(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser: true,
      needsProfile: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        permissions: tokens.permissions,
      },
    };
  }

  private async verifyGoogleToken(token: string): Promise<{
    email: string; firstName: string; lastName: string; avatarUrl?: string; socialId: string;
  }> {
    const idTokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (idTokenRes.ok) {
      const payload = await idTokenRes.json();
      if (!payload.email || payload.email_verified === 'false') {
        throw new UnauthorizedException('El email de Google no esta verificado');
      }
      return {
        email: payload.email,
        firstName: payload.given_name || payload.email.split('@')[0],
        lastName: payload.family_name || '',
        avatarUrl: payload.picture || undefined,
        socialId: payload.sub,
      };
    }
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!userInfoRes.ok) throw new UnauthorizedException('Token de Google invalido');
    const payload = await userInfoRes.json();
    if (!payload.email || !payload.email_verified) {
      throw new UnauthorizedException('El email de Google no esta verificado');
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
    email: string; firstName: string; lastName: string; avatarUrl?: string; socialId: string;
  }> {
    const res = await fetch(
      `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture.type(large)&access_token=${token}`,
    );
    if (!res.ok) throw new UnauthorizedException('Token de Facebook invalido');
    const payload = await res.json();
    if (!payload.email) {
      throw new UnauthorizedException('No se pudo obtener el email de Facebook');
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
    // Use tokenHint (first 8 chars) to narrow candidates before bcrypt
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenHint, revokedAt: null, scope: 'business' },
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
      throw new UnauthorizedException('Token de actualización inválido o expirado');
    }

    if (new Date() > matched.expiresAt) {
      await this.prisma.refreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token de actualización expirado');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Clean up expired business tokens in the background
    this.prisma.refreshToken.deleteMany({
      where: { scope: 'business', expiresAt: { lt: new Date() } },
    }).catch(() => {});

    const tokens = await this.generateTokens(matched.user);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(refreshToken: string) {
    // Use tokenHint to narrow candidates before bcrypt
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenHint, revokedAt: null },
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

  async getMe(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantId: true,
        isActive: true,
        createdAt: true,
        avatarUrl: true,
        userRoles: { select: { role: { select: { slug: true } } } },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const permissions = await this.rbacService.getUserPermissions(
      userId,
      tenantId,
    );

    // Find linked employee (include isActive to detect deactivation)
    const [employee, subscription, tenant] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { userId, tenantId },
        select: { id: true, avatarUrl: true, isActive: true, jobTitle: true },
      }),
      this.prisma.subscription.findUnique({
        where: { tenantId },
        select: { status: true, plan: true, trialEndsAt: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, currency: true },
      }),
    ]);

    const ADMIN_ROLE_SLUGS = ['owner', 'admin', 'helper'];
    const isAdmin = (user.userRoles || []).some((ur) =>
      ADMIN_ROLE_SLUGS.includes(ur.role.slug),
    );
    const { userRoles: _ur, ...userClean } = user;

    return {
      ...userClean,
      avatarUrl: employee?.avatarUrl || user.avatarUrl || null,
      permissions,
      isAdmin,
      employeeId: employee?.id || null,
      isEmployeeActive: employee ? employee.isActive : true,
      jobTitle: employee?.jobTitle || null,
      tenantName: tenant?.name || '',
      tenantCurrency: tenant?.currency || 'USD',
      subscriptionStatus: subscription?.status || 'ACTIVE',
      subscriptionPlan: subscription?.plan || 'BASICO',
      trialEndsAt: subscription?.trialEndsAt?.toISOString() || null,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Esta cuenta no tiene contraseña configurada (login social)');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
  }

  private async generateTokens(user: { id: string; tenantId: string | null; email: string }) {
    if (!user.tenantId) {
      throw new UnauthorizedException('Esta cuenta no tiene un perfil de negocio asociado');
    }

    // Fetch permissions once and embed in JWT
    const permissions = await this.rbacService.getUserPermissions(user.id, user.tenantId);

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
      issuer: 'siliba-tenant',
    });

    const refreshToken = uuidv4();
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const tokenHint = refreshToken.substring(0, 8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        userId: user.id,
        scope: 'business',
        expiresAt,
      },
    });

    return { accessToken, refreshToken, permissions };
  }

  private async generateClientTokens(user: { id: string; email: string }) {
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

  // ───────────────────────── Password reset ─────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        passwordHash: true,
        socialProvider: true,
        isActive: true,
      },
    });

    // Respuesta silenciosa si no existe / inactivo (no revelar). Las cuentas
    // sin passwordHash (creadas via OAuth) SI reciben el codigo: el reset
    // funciona como "establecer contrasena por primera vez", lo que les
    // permite tambien iniciar sesion con email/password ademas de Google.
    if (!user || !user.isActive) {
      return;
    }

    // Invalidar tokens activos previos del mismo usuario.
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, codeHash, expiresAt, method: 'EMAIL' },
    });

    const isOAuthOnly = !user.passwordHash;
    const subject = isOAuthOnly
      ? 'Establece tu contraseña - Siliba'
      : 'Restablece tu contraseña - Siliba';

    const body = isOAuthOnly
      ? renderPasswordSetOAuthEmail({
          firstName: user.firstName,
          code,
          provider: user.socialProvider,
        })
      : renderPasswordResetEmail({
          firstName: user.firstName,
          code,
        });

    await this.emailChannel.send({ to: user.email, subject, body });
  }

  async verifyResetCode(email: string, code: string): Promise<{ resetToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('Codigo invalido o expirado');

    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) throw new BadRequestException('Codigo invalido o expirado');

    if (token.attempts >= 5) {
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });
      throw new BadRequestException('Demasiados intentos. Solicita un nuevo codigo.');
    }

    const ok = await bcrypt.compare(code, token.codeHash);
    if (!ok) {
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Codigo invalido o expirado');
    }

    const secret = uuidv4();
    const tokenHash = await bcrypt.hash(secret, 10);
    await this.prisma.passwordResetToken.update({
      where: { id: token.id },
      data: {
        verifiedAt: new Date(),
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    return { resetToken: `${token.id}.${secret}` };
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    const [id, secret] = (resetToken || '').split('.');
    if (!id || !secret) {
      throw new BadRequestException('Sesion de recuperacion invalida o expirada');
    }

    const token = await this.prisma.passwordResetToken.findUnique({ where: { id } });
    if (
      !token ||
      token.usedAt ||
      !token.verifiedAt ||
      !token.tokenHash ||
      token.expiresAt < new Date()
    ) {
      throw new BadRequestException('Sesion de recuperacion invalida o expirada');
    }

    const ok = await bcrypt.compare(secret, token.tokenHash);
    if (!ok) {
      throw new BadRequestException('Sesion de recuperacion invalida o expirada');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
