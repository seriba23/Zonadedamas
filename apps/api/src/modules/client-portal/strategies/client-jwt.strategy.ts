import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ClientJwtPayload {
  sub: string;
  tenantId: string;
  email?: string;
  phone?: string;
  type: 'client';
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
      'ClientJwtStrategy',
    );
    return 'zonadedamas-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

@Injectable()
export class ClientJwtStrategy extends PassportStrategy(Strategy, 'client-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: ClientJwtPayload) {
    if (payload.type !== 'client') {
      throw new UnauthorizedException('Token no válido para portal de clientes');
    }

    if (!payload.tenantId) {
      throw new UnauthorizedException('Token inválido: falta tenantId');
    }

    const client = await this.prisma.client.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        isActive: true,
        passwordHash: { not: null },
      },
    });

    if (!client) {
      throw new UnauthorizedException('Cliente no encontrado o inactivo');
    }

    return {
      clientId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      phone: payload.phone,
      type: 'client' as const,
    };
  }
}
