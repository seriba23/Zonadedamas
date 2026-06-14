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

    if (dto.type === 'TWO_FOR_ONE') {
      // 2x1 necesita serviceIds explicitos para saber a que se aplica;
      // sin ellos no podemos generar un referral util.
      const arr = Array.isArray(dto.serviceIds) ? dto.serviceIds : [];
      if (arr.length === 0) {
        throw new BadRequestException(
          'Los cupones 2×1 deben tener al menos un servicio asociado',
        );
      }
    }

    // Codigo unico por tenant (si se proporciono)
    if (dto.code) {
      const dup = await this.prisma.reward.findFirst({
        where: { tenantId, code: dto.code, isActive: true },
      });
      if (dup) {
        throw new BadRequestException('Ya existe un cupón con ese código');
      }
    }

    // Unificacion serviceId / serviceIds:
    //  - SERVICIO con un solo servicio se mantiene en serviceId (compat).
    //  - SERVICIO con varios (o vacio) y DESCUENTO/TWO_FOR_ONE usan serviceIds.
    const serviceIdsArr = Array.isArray(dto.serviceIds) ? dto.serviceIds : [];
    const useSingularFK = dto.type === 'SERVICIO' && !!dto.serviceId && serviceIdsArr.length === 0;
    const reward = await this.prisma.reward.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        pointsRequired: dto.pointsRequired,
        serviceId: useSingularFK ? dto.serviceId : null,
        serviceIds: serviceIdsArr,
        discountAmount:
          dto.type === 'DESCUENTO' ? dto.discountAmount : null,
        discountMode: dto.type === 'DESCUENTO' ? dto.discountMode : null,
        code: dto.code || null,
        minAmount: dto.minAmount ?? null,
        allowPointPayment: dto.allowPointPayment ?? true,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
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
        ...(dto.serviceIds !== undefined && {
          serviceIds: Array.isArray(dto.serviceIds) ? dto.serviceIds : [],
        }),
        ...(dto.discountAmount !== undefined && {
          discountAmount: dto.discountAmount,
        }),
        ...(dto.discountMode !== undefined && {
          discountMode: dto.discountMode,
        }),
        ...(dto.code !== undefined && { code: dto.code || null }),
        ...(dto.minAmount !== undefined && { minAmount: dto.minAmount }),
        ...(dto.allowPointPayment !== undefined && {
          allowPointPayment: dto.allowPointPayment,
        }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
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

  async giftReward(tenantId: string, rewardId: string, clientId: string, userId: string) {
    const reward = await this.prisma.reward.findFirst({
      where: { id: rewardId, tenantId },
    });
    if (!reward) throw new NotFoundException('Recompensa no encontrada');

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    // Generate coupon code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const redemption = await this.prisma.rewardRedemption.create({
      data: {
        tenantId,
        rewardId,
        clientId,
        pointsSpent: 0,
        code,
        expiresAt,
        status: 'ACTIVE',
      },
      include: {
        reward: { select: { name: true, type: true, discountAmount: true, discountMode: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'RewardRedemption',
      entityId: redemption.id,
      newValues: { giftedTo: `${client.firstName} ${client.lastName}`, reward: reward.name, code },
    });

    return { data: redemption };
  }

  // Valida un codigo publico de cupon (uso interno, tipico para cajeros
  // que ingresan el codigo manual en POS). Devuelve el reward si esta
  // vigente y dentro de maxRedemptions. Equivalente al viejo
  // PromotionsService.validateCode.
  async validateCode(tenantId: string, code: string) {
    if (!code || !code.trim()) {
      throw new BadRequestException('Código requerido');
    }
    const reward = await this.prisma.reward.findFirst({
      where: { tenantId, code: code.trim(), isActive: true },
      include: { service: { select: { id: true, name: true } } },
    });
    if (!reward) {
      throw new NotFoundException('Código no válido');
    }
    const now = new Date();
    if (reward.startDate && reward.startDate > now) {
      throw new BadRequestException('Este cupón aún no está vigente');
    }
    if (reward.endDate && reward.endDate < now) {
      throw new BadRequestException('Este cupón ya expiró');
    }
    if (reward.validUntil && reward.validUntil < now) {
      throw new BadRequestException('Este cupón ya expiró');
    }
    if (reward.maxRedemptions && reward.timesRedeemed >= reward.maxRedemptions) {
      throw new BadRequestException('Este cupón alcanzó el máximo de canjes');
    }
    return { data: reward };
  }

  // Retira/elimina un RewardRedemption emitido. Reglas:
  // - status === 'USED' -> rechazado (el cliente ya consumio el cupon).
  // - Si fue canje por puntos (pointsSpent > 0), devolvemos esos puntos al
  //   loyalty_points del cliente para que la operacion sea reversible.
  // - Si fue regalo (pointsSpent === 0), simplemente se elimina.
  // - Si el reward tenia timesRedeemed > 0 derivado de este redemption, lo
  //   decrementamos para que no afecte maxRedemptions.
  // - Audit log antes de borrar (mantiene trazabilidad aunque la fila se vaya).
  async removeRedemption(
    tenantId: string,
    redemptionId: string,
    userId: string,
  ) {
    const redemption = await this.prisma.rewardRedemption.findFirst({
      where: { id: redemptionId, tenantId },
      include: {
        reward: { select: { id: true, name: true } },
        client: { select: { id: true, firstName: true, lastName: true, loyaltyPoints: true } },
      },
    });
    if (!redemption) throw new NotFoundException('Cupón no encontrado');
    if (redemption.status === 'USED') {
      throw new BadRequestException(
        'No se puede eliminar un cupón que ya fue usado por el cliente',
      );
    }

    // Audit ANTES del delete para que el snapshot quede aunque la fila se vaya
    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'RewardRedemption',
      entityId: redemption.id,
      newValues: {
        code: redemption.code,
        reward: redemption.reward.name,
        client: `${redemption.client.firstName} ${redemption.client.lastName}`,
        pointsSpent: redemption.pointsSpent,
        status: redemption.status,
        refunded: redemption.pointsSpent > 0,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (redemption.pointsSpent > 0) {
        await tx.client.update({
          where: { id: redemption.client.id },
          data: { loyaltyPoints: { increment: redemption.pointsSpent } },
        });
      }
      // Revertir contador de canjes del reward (si llego a contarse)
      await tx.reward.update({
        where: { id: redemption.reward.id },
        data: { timesRedeemed: { decrement: 1 } },
      }).catch(() => {
        // Si timesRedeemed ya esta en 0 algunos DBs fallan; ignorable.
      });
      await tx.rewardRedemption.delete({ where: { id: redemption.id } });
    });

    return {
      data: {
        id: redemption.id,
        refunded: redemption.pointsSpent > 0 ? redemption.pointsSpent : 0,
      },
    };
  }

  // Listado de cupones (RewardRedemption) del tenant con filtros para el
  // dashboard de admin. Distingue origen (gift vs canje), status, y permite
  // filtrar por fecha de expiracion o de creacion.
  async listRedemptions(
    tenantId: string,
    query: {
      page?: number;
      perPage?: number;
      status?: string; // ACTIVE | USED | EXPIRED
      source?: 'GIFT' | 'REDEEM'; // GIFT = pointsSpent=0; REDEEM = pointsSpent>0
      expiresFrom?: string; // ISO date
      expiresTo?: string;
      createdFrom?: string;
      createdTo?: string;
      clientId?: string;
      rewardId?: string;
      search?: string; // busca en firstName/lastName/email del cliente y nombre del reward
    },
  ) {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (query.status && ['ACTIVE', 'USED', 'EXPIRED'].includes(query.status)) {
      where.status = query.status;
    }
    if (query.source === 'GIFT') {
      where.pointsSpent = 0;
    } else if (query.source === 'REDEEM') {
      where.pointsSpent = { gt: 0 };
    }
    if (query.expiresFrom || query.expiresTo) {
      where.expiresAt = {};
      if (query.expiresFrom) where.expiresAt.gte = new Date(query.expiresFrom);
      if (query.expiresTo) {
        // incluye todo el dia "expiresTo"
        const to = new Date(query.expiresTo);
        to.setHours(23, 59, 59, 999);
        where.expiresAt.lte = to;
      }
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) where.createdAt.gte = new Date(query.createdFrom);
      if (query.createdTo) {
        const to = new Date(query.createdTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }
    if (query.clientId) where.clientId = query.clientId;
    if (query.rewardId) where.rewardId = query.rewardId;
    if (query.search) {
      const s = query.search.trim();
      if (s) {
        where.OR = [
          { client: { firstName: { contains: s } } },
          { client: { lastName: { contains: s } } },
          { client: { email: { contains: s } } },
          { reward: { name: { contains: s } } },
          { code: { contains: s } },
        ];
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.rewardRedemption.findMany({
        where,
        include: {
          reward: {
            select: {
              id: true,
              name: true,
              type: true,
              discountAmount: true,
              discountMode: true,
              pointsRequired: true,
              service: { select: { id: true, name: true } },
            },
          },
          client: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          appointment: { select: { id: true, startTime: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.rewardRedemption.count({ where }),
    ]);

    // Resumen del tenant (totales sin filtros, sirven como contadores
    // permanentes en el header del historial).
    const [totalAll, totalActive, totalUsed, totalExpired, totalGifts, pointsAgg] = await Promise.all([
      this.prisma.rewardRedemption.count({ where: { tenantId } }),
      this.prisma.rewardRedemption.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.rewardRedemption.count({ where: { tenantId, status: 'USED' } }),
      this.prisma.rewardRedemption.count({ where: { tenantId, status: 'EXPIRED' } }),
      this.prisma.rewardRedemption.count({ where: { tenantId, pointsSpent: 0 } }),
      // Total de puntos que los clientes han gastado canjeando cupones.
      // Es la suma de pointsSpent de TODAS las redemptions (regalos suman 0).
      this.prisma.rewardRedemption.aggregate({
        where: { tenantId },
        _sum: { pointsSpent: true },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        summary: {
          totalAll,
          totalActive,
          totalUsed,
          totalExpired,
          totalGifts,
          totalRedeemed: totalAll - totalGifts,
          totalPointsSpent: pointsAgg._sum.pointsSpent ?? 0,
        },
      },
    };
  }
}
