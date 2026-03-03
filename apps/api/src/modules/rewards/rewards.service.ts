import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

@Injectable()
export class RewardsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(
    tenantId: string,
    query: { page?: number; perPage?: number; isActive?: boolean },
  ) {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.reward.findMany({
        where,
        include: {
          service: { select: { id: true, name: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.reward.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const reward = await this.prisma.reward.findFirst({
      where: { id, tenantId },
      include: {
        service: { select: { id: true, name: true, price: true } },
        _count: { select: { redemptions: true } },
      },
    });
    if (!reward) throw new NotFoundException('Reward not found');
    return { data: reward };
  }

  async create(tenantId: string, dto: CreateRewardDto, userId?: string) {
    if (dto.type === 'SERVICIO' && dto.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, tenantId, isActive: true },
      });
      if (!service) throw new BadRequestException('Service not found');
    }

    if (dto.type === 'DESCUENTO') {
      if (dto.discountAmount == null || !dto.discountMode) {
        throw new BadRequestException(
          'discountAmount and discountMode are required for DESCUENTO type',
        );
      }
      if (dto.discountMode === 'PERCENTAGE' && dto.discountAmount > 100) {
        throw new BadRequestException('Percentage discount cannot exceed 100');
      }
    }

    const reward = await this.prisma.reward.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        pointsRequired: dto.pointsRequired,
        serviceId: dto.type === 'SERVICIO' ? dto.serviceId : null,
        discountAmount:
          dto.type === 'DESCUENTO' ? dto.discountAmount : null,
        discountMode: dto.type === 'DESCUENTO' ? dto.discountMode : null,
        isActive: dto.isActive ?? true,
        maxRedemptions: dto.maxRedemptions,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
      include: {
        service: { select: { id: true, name: true, price: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'reward.created',
      entityType: 'Reward',
      entityId: reward.id,
      newValues: reward as any,
    });

    return { data: reward };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateRewardDto,
    userId?: string,
  ) {
    const existing = await this.prisma.reward.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Reward not found');

    if (dto.type === 'SERVICIO' && dto.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, tenantId, isActive: true },
      });
      if (!service) throw new BadRequestException('Service not found');
    }

    const reward = await this.prisma.reward.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.pointsRequired !== undefined && {
          pointsRequired: dto.pointsRequired,
        }),
        ...(dto.serviceId !== undefined && { serviceId: dto.serviceId }),
        ...(dto.discountAmount !== undefined && {
          discountAmount: dto.discountAmount,
        }),
        ...(dto.discountMode !== undefined && {
          discountMode: dto.discountMode,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.maxRedemptions !== undefined && {
          maxRedemptions: dto.maxRedemptions,
        }),
        ...(dto.validUntil !== undefined && {
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        }),
      },
      include: {
        service: { select: { id: true, name: true, price: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'reward.updated',
      entityType: 'Reward',
      entityId: id,
      oldValues: existing as any,
      newValues: reward as any,
    });

    return { data: reward };
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const existing = await this.prisma.reward.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Reward not found');

    await this.prisma.reward.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'reward.deactivated',
      entityType: 'Reward',
      entityId: id,
    });

    return { data: { message: 'Reward deactivated' } };
  }

  async markCouponUsed(tenantId: string, code: string, userId?: string) {
    const redemption = await this.prisma.rewardRedemption.findFirst({
      where: { code, tenantId },
      include: { reward: true },
    });
    if (!redemption) throw new NotFoundException('Coupon not found');
    if (redemption.status === 'USED') {
      throw new BadRequestException('Coupon already used');
    }
    if (redemption.status === 'EXPIRED') {
      throw new BadRequestException('Coupon is expired');
    }

    const updated = await this.prisma.rewardRedemption.update({
      where: { id: redemption.id },
      data: { status: 'USED', usedAt: new Date() },
      include: {
        reward: { select: { name: true, type: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'reward.coupon_used',
      entityType: 'RewardRedemption',
      entityId: redemption.id,
      newValues: { code, rewardName: redemption.reward.name } as any,
    });

    return { data: updated };
  }

  async getRedemptions(
    tenantId: string,
    rewardId: string,
    query: { page?: number; perPage?: number },
  ) {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    const where = { tenantId, rewardId };

    const [data, total] = await Promise.all([
      this.prisma.rewardRedemption.findMany({
        where,
        include: {
          client: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.rewardRedemption.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }
}
