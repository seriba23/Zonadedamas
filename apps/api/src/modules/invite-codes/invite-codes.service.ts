import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InviteCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, jobTitle?: string, serviceIds?: string[], maxUses?: number, expiresAt?: Date) {
    const code = this.generateCode();

    const inviteCode = await this.prisma.tenantInviteCode.create({
      data: {
        tenantId,
        code,
        jobTitle: jobTitle || null,
        maxUses: maxUses || 0,
        expiresAt: expiresAt || null,
      },
    });

    if (serviceIds && serviceIds.length > 0) {
      await this.prisma.tenantInviteCodeService.createMany({
        data: serviceIds.map((serviceId) => ({
          inviteCodeId: inviteCode.id,
          serviceId,
        })),
        skipDuplicates: true,
      });
    }

    return this.prisma.tenantInviteCode.findUnique({
      where: { id: inviteCode.id },
      include: { services: { include: { service: { select: { id: true, name: true } } } } },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.tenantInviteCode.findMany({
      where: { tenantId, isActive: true },
      include: { services: { include: { service: { select: { id: true, name: true } } } } },
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
