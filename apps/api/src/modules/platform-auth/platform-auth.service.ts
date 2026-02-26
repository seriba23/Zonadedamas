import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.platformUser.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Update last login
    await this.prisma.platformUser.update({
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
        role: 'platform_admin',
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.platformRefreshToken.findMany({
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
      await this.prisma.platformRefreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token de actualización expirado');
    }

    // Revoke old token (rotation)
    await this.prisma.platformRefreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(matched.user);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.platformRefreshToken.findMany({
      where: { tokenHint, revokedAt: null },
    });

    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        await this.prisma.platformRefreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.platformUser.findFirst({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return { ...user, role: 'platform_admin' };
  }

  private async generateTokens(user: { id: string; email: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: 'platform_admin',
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
      issuer: 'zonadedamas-platform',
    });

    const refreshToken = uuidv4();
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const tokenHint = refreshToken.substring(0, 8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.platformRefreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
