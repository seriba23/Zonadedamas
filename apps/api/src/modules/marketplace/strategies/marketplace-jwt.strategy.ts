import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface MarketplaceJwtPayload {
  sub: string;
  email: string;
  type: 'marketplace';
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
      'JWT_SECRET not set — using insecure default. Set JWT_SECRET for production.',
      'MarketplaceJwtStrategy',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

@Injectable()
export class MarketplaceJwtStrategy extends PassportStrategy(Strategy, 'marketplace-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: MarketplaceJwtPayload) {
    if (payload.type !== 'marketplace') {
      throw new UnauthorizedException('Token no válido para marketplace');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, isClient: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return {
      marketplaceUserId: payload.sub,
      email: payload.email,
      type: 'marketplace' as const,
    };
  }
}
