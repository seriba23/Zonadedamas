import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreatorJwtPayload {
  sub: string;
  email: string;
  type: 'creator';
  iat?: number;
  exp?: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    Logger.warn(
      'JWT_SECRET not set — using insecure default.',
      'CreatorJwtStrategy',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

@Injectable()
export class CreatorJwtStrategy extends PassportStrategy(Strategy, 'creator-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: CreatorJwtPayload) {
    if (payload.type !== 'creator') {
      throw new UnauthorizedException('Token no válido para portal de creadores');
    }

    const influencer = await this.prisma.influencer.findFirst({
      where: { id: payload.sub, status: { not: 'SUSPENDED' } },
    });
    if (!influencer) {
      throw new UnauthorizedException('Creador no encontrado o suspendido');
    }

    return { influencerId: influencer.id, email: influencer.email, type: 'creator' as const };
  }
}
