import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InviteCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, maxUses?: number, expiresAt?: Date) {
    const code = this.generateCode();

    return this.prisma.tenantInviteCode.create({
      data: {
        tenantId,
        code,
        maxUses: maxUses || 0,
        expiresAt: expiresAt || null,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.tenantInviteCode.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deactivate(id: string, tenantId: string) {
    return this.prisma.tenantInviteCode.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}
