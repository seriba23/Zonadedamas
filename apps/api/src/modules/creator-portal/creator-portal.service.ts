import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatorCodesService } from '../creator-codes/creator-codes.service';
import {
  CreatorLoginDto,
  CreatorRegisterDto,
  CreatorSetPasswordDto,
  CreatorChangePasswordDto,
} from './dto/creator-auth.dto';

@Injectable()
export class CreatorPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly creatorCodes: CreatorCodesService,
  ) {}

  private signToken(influencer: { id: string; email: string }) {
    return this.jwtService.sign({
      sub: influencer.id,
      email: influencer.email,
      type: 'creator',
    });
  }

  private publicProfile(inf: any) {
    return {
      id: inf.id,
      email: inf.email,
      firstName: inf.firstName,
      lastName: inf.lastName,
      phone: inf.phone,
      status: inf.status,
      stripeOnboardingComplete: inf.stripeOnboardingComplete,
    };
  }

  async login(dto: CreatorLoginDto) {
    const email = dto.email.toLowerCase().trim();
    const influencer = await this.prisma.influencer.findUnique({ where: { email } });

    if (!influencer || !influencer.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (influencer.status === 'SUSPENDED') {
      throw new UnauthorizedException('Tu cuenta está suspendida. Contacta al administrador.');
    }

    const ok = await bcrypt.compare(dto.password, influencer.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    await this.prisma.influencer.update({
      where: { id: influencer.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: this.signToken(influencer),
      influencer: this.publicProfile(influencer),
    };
  }

  async register(dto: CreatorRegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.influencer.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const influencer = await this.prisma.influencer.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
        passwordHash,
        status: 'PENDING', // queda pendiente de aprobación del super-admin
      },
    });

    // No emitimos token: debe esperar aprobación para acceder al panel con datos.
    return {
      registered: true,
      influencer: this.publicProfile(influencer),
      message: 'Cuenta creada. Un administrador la revisará y aprobará pronto.',
    };
  }

  async setPasswordFromToken(dto: CreatorSetPasswordDto) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { inviteToken: dto.token },
    });
    if (
      !influencer ||
      !influencer.inviteTokenExpiresAt ||
      influencer.inviteTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('El enlace es inválido o expiró');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.influencer.update({
      where: { id: influencer.id },
      data: { passwordHash, inviteToken: null, inviteTokenExpiresAt: null },
    });

    return {
      accessToken: influencer.status !== 'SUSPENDED' ? this.signToken(influencer) : null,
      influencer: this.publicProfile(influencer),
    };
  }

  async changePassword(influencerId: string, dto: CreatorChangePasswordDto) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    if (!influencer?.passwordHash) {
      throw new UnauthorizedException('Cuenta sin contraseña configurada');
    }
    const ok = await bcrypt.compare(dto.currentPassword, influencer.passwordHash);
    if (!ok) throw new UnauthorizedException('La contraseña actual es incorrecta');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.influencer.update({
      where: { id: influencerId },
      data: { passwordHash },
    });
    return { data: { changed: true } };
  }

  async me(influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    if (!influencer) throw new UnauthorizedException('Creador no encontrado');
    return { data: this.publicProfile(influencer) };
  }

  /** Dashboard del creador: reutiliza la agregación del panel admin, sin notas internas. */
  async dashboard(influencerId: string) {
    const detail = await this.creatorCodes.getInfluencerDetail(influencerId);
    const d: any = detail.data;
    if (d?.influencer) delete d.influencer.notes;
    return { data: d };
  }

  // ─── Cobros self-service (Stripe Connect) ─────────

  async stripeOnboardingLink(influencerId: string) {
    const base = process.env.WEB_URL || 'http://localhost:3000';
    return this.creatorCodes.createStripeOnboardingLink(
      influencerId,
      `${base}/creator/dashboard`,
    );
  }

  async stripeStatus(influencerId: string) {
    return this.creatorCodes.getStripeStatus(influencerId);
  }
}
