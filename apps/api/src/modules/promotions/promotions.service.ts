import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

/**
 * Mapper: shape de Reward (DB) -> shape de Promotion (legacy API).
 * Mantiene compat con el frontend admin que sigue esperando type
 * 'PERCENTAGE'/'FIXED_AMOUNT'/'TWO_FOR_ONE' y value.
 */
function rewardToPromotionShape(r: any): any {
  if (!r) return r;
  let logicalType: string = r.type;
  if (r.type === 'DESCUENTO') {
    logicalType = r.discountMode === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT';
  }
  return {
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    description: r.description,
    type: logicalType,
    value: Number(r.discountAmount ?? 0),
    code: r.code,
    startDate: r.startDate,
    endDate: r.endDate,
    maxUses: r.maxRedemptions,
    usedCount: r.timesRedeemed,
    serviceIds: r.serviceIds ?? [],
    minAmount: r.minAmount,
    allowPointPayment: r.allowPointPayment,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Mapper inverso: shape de Promotion DTO -> campos para Reward.create/update.
 */
function promotionDtoToRewardFields(dto: any): any {
  const result: any = {};
  if (dto.name !== undefined) result.name = dto.name;
  if (dto.description !== undefined) result.description = dto.description;
  if (dto.type !== undefined) {
    if (dto.type === 'PERCENTAGE' || dto.type === 'FIXED_AMOUNT') {
      result.type = 'DESCUENTO';
      result.discountMode = dto.type === 'PERCENTAGE' ? 'PERCENTAGE' : 'FLAT';
    } else if (dto.type === 'TWO_FOR_ONE') {
      result.type = 'TWO_FOR_ONE';
      result.discountMode = null;
    }
  }
  if (dto.value !== undefined) result.discountAmount = dto.value;
  if (dto.code !== undefined) result.code = dto.code;
  if (dto.startDate !== undefined) result.startDate = new Date(dto.startDate);
  if (dto.endDate !== undefined) result.endDate = new Date(dto.endDate);
  if (dto.maxUses !== undefined) result.maxRedemptions = dto.maxUses;
  if (dto.serviceIds !== undefined) result.serviceIds = dto.serviceIds;
  if (dto.minAmount !== undefined) result.minAmount = dto.minAmount;
  if (dto.allowPointPayment !== undefined) result.allowPointPayment = dto.allowPointPayment;
  if (dto.isActive !== undefined) result.isActive = dto.isActive;
  return result;
}

/**
 * NOTA (Fase 3): este modulo se mantiene como fachada por compat con el
 * frontend admin existente. Internamente opera sobre la tabla `rewards`
 * (no `promotions`), filtrando solo los tipos DESCUENTO + TWO_FOR_ONE.
 * Los rewards tipo SERVICIO (cupones por puntos) son gestionados por el
 * modulo `rewards` y no aparecen aqui.
 */
@Injectable()
export class PromotionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(
    tenantId: string,
    query: {
      page?: number;
      perPage?: number;
      type?: string;
      isActive?: boolean;
      search?: string;
    },
  ) {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    const where: any = {
      tenantId,
      type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] },
    };

    // Si el frontend filtra por type, traducir al shape de Reward.
    if (query.type === 'PERCENTAGE') {
      where.type = 'DESCUENTO';
      where.discountMode = 'PERCENTAGE';
    } else if (query.type === 'FIXED_AMOUNT') {
      where.type = 'DESCUENTO';
      where.discountMode = 'FLAT';
    } else if (query.type === 'TWO_FOR_ONE') {
      where.type = 'TWO_FOR_ONE';
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.name = { contains: query.search };
    }

    const [data, total] = await Promise.all([
      this.prisma.reward.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.reward.count({ where }),
    ]);

    return {
      data: data.map(rewardToPromotionShape),
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
      where: { id, tenantId, type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] } },
    });
    if (!reward) throw new NotFoundException('Promotion not found');
    return { data: rewardToPromotionShape(reward) };
  }

  async create(tenantId: string, dto: CreatePromotionDto, userId?: string) {
    if (dto.type === 'PERCENTAGE' && dto.value > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }

    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }

    if (dto.code) {
      const existing = await this.prisma.reward.findFirst({
        where: {
          tenantId,
          code: dto.code,
          isActive: true,
          type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] },
        },
      });
      if (existing) {
        throw new BadRequestException('A promotion with this code already exists');
      }
    }

    if (dto.serviceIds?.length) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds }, tenantId, isActive: true },
        select: { id: true },
      });
      if (services.length !== dto.serviceIds.length) {
        throw new BadRequestException('One or more services not found');
      }
    }

    const fields = promotionDtoToRewardFields(dto);
    const reward = await this.prisma.reward.create({
      data: {
        tenantId,
        ...fields,
        serviceIds: fields.serviceIds ?? [],
        isActive: fields.isActive ?? true,
        allowPointPayment: fields.allowPointPayment ?? true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'promotion.created',
      entityType: 'Reward',
      entityId: reward.id,
      newValues: reward as any,
    });

    return { data: rewardToPromotionShape(reward) };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePromotionDto,
    userId?: string,
  ) {
    const existing = await this.prisma.reward.findFirst({
      where: { id, tenantId, type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] } },
    });
    if (!existing) throw new NotFoundException('Promotion not found');

    // Para validacion de percentage, considerar el valor entrante o el
    // existente. existing.discountAmount es el value en Reward.
    const incomingType = dto.type ?? rewardToPromotionShape(existing).type;
    const incomingValue = dto.value ?? Number(existing.discountAmount ?? 0);
    if (incomingType === 'PERCENTAGE' && Number(incomingValue) > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.reward.findFirst({
        where: {
          tenantId,
          code: dto.code,
          isActive: true,
          id: { not: id },
          type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] },
        },
      });
      if (duplicate) {
        throw new BadRequestException('A promotion with this code already exists');
      }
    }

    if (dto.serviceIds?.length) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds }, tenantId, isActive: true },
        select: { id: true },
      });
      if (services.length !== dto.serviceIds.length) {
        throw new BadRequestException('One or more services not found');
      }
    }

    const fields = promotionDtoToRewardFields(dto);
    const reward = await this.prisma.reward.update({
      where: { id },
      data: fields,
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'promotion.updated',
      entityType: 'Reward',
      entityId: id,
      oldValues: existing as any,
      newValues: reward as any,
    });

    return { data: rewardToPromotionShape(reward) };
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const existing = await this.prisma.reward.findFirst({
      where: { id, tenantId, type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] } },
    });
    if (!existing) throw new NotFoundException('Promotion not found');

    await this.prisma.reward.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'promotion.deactivated',
      entityType: 'Reward',
      entityId: id,
    });

    return { data: { message: 'Promotion deactivated' } };
  }

  async validateCode(tenantId: string, code: string) {
    const reward = await this.prisma.reward.findFirst({
      where: {
        tenantId,
        code,
        isActive: true,
        type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] },
      },
    });

    if (!reward) {
      throw new NotFoundException('Promotion code not found');
    }

    const now = new Date();
    if (reward.startDate && now < reward.startDate) {
      throw new BadRequestException('Promotion has not started yet');
    }
    if (reward.endDate && now > reward.endDate) {
      throw new BadRequestException('Promotion has expired');
    }

    if (reward.maxRedemptions != null && reward.timesRedeemed >= reward.maxRedemptions) {
      throw new BadRequestException('Promotion has reached its maximum number of uses');
    }

    const shape = rewardToPromotionShape(reward);
    return {
      data: {
        id: shape.id,
        name: shape.name,
        type: shape.type,
        value: shape.value,
        serviceIds: shape.serviceIds,
        minAmount: shape.minAmount,
      },
    };
  }
}
