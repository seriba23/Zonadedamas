import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

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

    const where: any = { tenantId };
    if (query.type) {
      where.type = query.type;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.name = { contains: query.search };
    }

    const [data, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.promotion.count({ where }),
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
    const promotion = await this.prisma.promotion.findFirst({
      where: { id, tenantId },
    });
    if (!promotion) throw new NotFoundException('Promotion not found');
    return { data: promotion };
  }

  async create(tenantId: string, dto: CreatePromotionDto, userId?: string) {
    if (dto.type === 'PERCENTAGE' && dto.value > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }

    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }

    if (dto.code) {
      const existing = await this.prisma.promotion.findFirst({
        where: { tenantId, code: dto.code, isActive: true },
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

    const promotion = await this.prisma.promotion.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        value: dto.value,
        code: dto.code,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        maxUses: dto.maxUses,
        serviceIds: dto.serviceIds ?? [],
        minAmount: dto.minAmount,
        allowPointPayment: dto.allowPointPayment ?? true,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'promotion.created',
      entityType: 'Promotion',
      entityId: promotion.id,
      newValues: promotion as any,
    });

    return { data: promotion };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePromotionDto,
    userId?: string,
  ) {
    const existing = await this.prisma.promotion.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Promotion not found');

    if (dto.type === 'PERCENTAGE' && Number(dto.value ?? existing.value) > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.promotion.findFirst({
        where: { tenantId, code: dto.code, isActive: true, id: { not: id } },
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

    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
        ...(dto.serviceIds !== undefined && { serviceIds: dto.serviceIds }),
        ...(dto.minAmount !== undefined && { minAmount: dto.minAmount }),
        ...(dto.allowPointPayment !== undefined && { allowPointPayment: dto.allowPointPayment }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'promotion.updated',
      entityType: 'Promotion',
      entityId: id,
      oldValues: existing as any,
      newValues: promotion as any,
    });

    return { data: promotion };
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const existing = await this.prisma.promotion.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Promotion not found');

    await this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'promotion.deactivated',
      entityType: 'Promotion',
      entityId: id,
    });

    return { data: { message: 'Promotion deactivated' } };
  }

  async validateCode(tenantId: string, code: string) {
    const promotion = await this.prisma.promotion.findFirst({
      where: { tenantId, code, isActive: true },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion code not found');
    }

    const now = new Date();
    if (now < promotion.startDate) {
      throw new BadRequestException('Promotion has not started yet');
    }
    if (now > promotion.endDate) {
      throw new BadRequestException('Promotion has expired');
    }

    if (promotion.maxUses != null && promotion.usedCount >= promotion.maxUses) {
      throw new BadRequestException('Promotion has reached its maximum number of uses');
    }

    return {
      data: {
        id: promotion.id,
        name: promotion.name,
        type: promotion.type,
        value: promotion.value,
        serviceIds: promotion.serviceIds,
        minAmount: promotion.minAmount,
      },
    };
  }
}
