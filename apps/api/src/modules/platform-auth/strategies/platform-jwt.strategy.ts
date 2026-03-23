import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  role: 'platform_admin';
  iss?: string;
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
      'PlatformJwtStrategy',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
      issuer: 'siliba-platform',
    });
  }

  async validate(payload: PlatformJwtPayload) {
    if (payload.role !== 'platform_admin') {
      throw new UnauthorizedException('Token inválido para esta plataforma');
    }

    const user = await this.prisma.platformUser.findFirst({
      where: { id: payload.sub, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario de plataforma no encontrado o inactivo');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: 'platform_admin' as const,
    };
  }
}
