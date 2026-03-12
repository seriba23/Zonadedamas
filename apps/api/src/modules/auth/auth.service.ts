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
import { RbacService } from '../rbac/rbac.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly rbacService: RbacService,
  ) {}

  async login(email: string, password: string) {
    const users = await this.prisma.user.findMany({
      where: { email, isActive: true },
      include: { tenant: true },
    });

    if (!users.length) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    let matchedUser: (typeof users)[0] | null = null;
    for (const user of users) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (isMatch) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.generateTokens(matchedUser);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: matchedUser.id,
        email: matchedUser.email,
        firstName: matchedUser.firstName,
        lastName: matchedUser.lastName,
        tenantId: matchedUser.tenantId,
        permissions: tokens.permissions,
      },
    };
  }

  async register(dto: RegisterDto) {
    if (dto.inviteCode) {
      return this.registerWithInviteCode(dto);
    }
    if (dto.type === 'individual') {
      return this.registerIndividual(dto);
    }
    throw new BadRequestException(
      'Debes proporcionar un código de invitación o registrarte como particular',
    );
  }

  private async registerWithInviteCode(dto: RegisterDto) {
    const invite = await this.prisma.tenantInviteCode.findUnique({
      where: { code: dto.inviteCode },
      include: { tenant: true },
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

    // Check if email already exists in this tenant
    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: invite.tenantId, email: dto.email },
      },
    });
    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con este correo en este negocio');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Get first location of the tenant
    const location = await this.prisma.location.findFirst({
      where: { tenantId: invite.tenantId, isActive: true },
    });
    if (!location) {
      throw new BadRequestException('El negocio no tiene ubicaciones activas');
    }

    // Get staff role
    const staffRole = await this.prisma.role.findUnique({
      where: {
        tenantId_slug: { tenantId: invite.tenantId, slug: 'staff' },
      },
    });
    if (!staffRole) {
      throw new BadRequestException('Configuración de roles incompleta');
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
          isActive: true,
        },
      });

      await tx.employee.create({
        data: {
          tenantId: invite.tenantId,
          userId: newUser.id,
          locationId: location.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone || null,
          isActive: true,
        },
      });

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
    const selectedPlan = (dto.selectedPlan as 'BASICO' | 'PLUS' | 'PRO') || 'BASICO';

    const planPrices: Record<string, number> = {
      BASICO: 29.99,
      PLUS: 49.99,
      PRO: 79.99,
    };
    const monthlyPrice = planPrices[selectedPlan] || 29.99;

    // Get owner role from any tenant to know the permissions
    const ownerRolePermissions = await this.prisma.permission.findMany();

    const user = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const oneYearLater = new Date(now);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

      // Create tenant with business info
      const tenant = await tx.tenant.create({
        data: {
          name: dto.businessName || `${dto.firstName} ${dto.lastName}`,
          slug,
          email: dto.email,
          phone: dto.phone || null,
          businessType: dto.businessType || null,
          address: dto.businessAddress || null,
          businessPhone: dto.businessPhone || null,
          contractAcceptedAt: dto.acceptContract ? now : null,
          timezone: 'America/New_York',
          currency: 'USD',
          subscriptionPlan: selectedPlan,
          subscriptionStatus: 'active',
        },
      });

      // Create subscription
      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: selectedPlan as any,
          status: 'ACTIVE',
          monthlyAmountUsd: monthlyPrice,
          contractStartDate: now,
          contractEndDate: oneYearLater,
          nextBillingDate: oneMonthLater,
        },
      });

      // Create first invoice (pending)
      const invoiceNumber = `INV-${now.getFullYear()}-${Date.now().toString().slice(-6)}`;
      await tx.invoice.create({
        data: {
          subscriptionId: subscription.id,
          tenantId: tenant.id,
          invoiceNumber,
          amountUsd: monthlyPrice,
          status: 'PENDING',
          periodStart: now,
          periodEnd: oneMonthLater,
          dueDate: oneMonthLater,
        },
      });

      // Create default location
      const location = await tx.location.create({
        data: {
          tenantId: tenant.id,
          name: 'Principal',
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
          isActive: true,
        },
      });

      // Create employee linked to user
      await tx.employee.create({
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

  async refresh(refreshToken: string) {
    // Use tokenHint (first 8 chars) to narrow candidates before bcrypt
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.refreshToken.findMany({
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

    // Clean up expired tokens in the background
    this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
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
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const permissions = await this.rbacService.getUserPermissions(
      userId,
      tenantId,
    );

    // Find linked employee
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
      select: { id: true, avatarUrl: true },
    });

    // Get subscription status
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      select: { status: true, plan: true },
    });

    return {
      ...user,
      avatarUrl: employee?.avatarUrl || user.avatarUrl || null,
      permissions,
      employeeId: employee?.id || null,
      subscriptionStatus: subscription?.status || 'ACTIVE',
      subscriptionPlan: subscription?.plan || 'BASICO',
    };
  }

  private async generateTokens(user: { id: string; tenantId: string; email: string }) {
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
      issuer: 'zonadedamas-tenant',
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
        expiresAt,
      },
    });

    return { accessToken, refreshToken, permissions };
  }
}
