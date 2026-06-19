import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateResourceDto, UpdateResourceDto } from './dto/create-resource.dto';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, pagination: PaginationDto, assignedTo?: string) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (assignedTo) where.assignedTo = assignedTo;

    const [data, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { name: 'asc' },
        include: {
          location: { select: { id: true, name: true } },
        },
      }),
      this.prisma.resource.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async findOne(id: string, tenantId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, tenantId },
      include: {
        location: true,
        serviceResources: { include: { service: true } },
      },
    });
    if (!resource) throw new NotFoundException('Recurso no encontrado');
    return resource;
  }

  async create(tenantId: string, dto: CreateResourceDto) {
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId },
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    // Auto-calculate quantity from locationQuantities if provided
    const locQty = dto.locationQuantities || null;
    const quantity = locQty
      ? Object.values(locQty).reduce((sum, q) => sum + q, 0)
      : (dto.quantity ?? 1);

    return this.prisma.resource.create({
      data: {
        name: dto.name,
        description: dto.description,
        notes: dto.notes,
        type: dto.type,
        imageUrl: dto.imageUrl,
        value: dto.value,
        quantity,
        locationQuantities: locQty ?? Prisma.JsonNull,
        serialNumber: dto.serialNumber,
        brand: dto.brand,
        condition: dto.condition || 'good',
        assignedTo: dto.assignedTo || null,
        assignedAt: dto.assignedTo ? new Date() : null,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate + 'T00:00:00Z') : null,
        locationId: dto.locationId,
        tenantId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateResourceDto) {
    const existing = await this.findOne(id, tenantId);

    const data: any = { ...dto };

    // Handle assignedTo change
    if ('assignedTo' in dto) {
      data.assignedTo = dto.assignedTo || null;
      if (dto.assignedTo !== (existing as any).assignedTo) {
        data.assignedAt = dto.assignedTo ? new Date() : null;
      }
    }

    // Handle purchaseDate
    if (dto.purchaseDate !== undefined) {
      data.purchaseDate = dto.purchaseDate ? new Date(dto.purchaseDate + 'T00:00:00Z') : null;
    }

    // Auto-calculate quantity from locationQuantities
    if (dto.locationQuantities) {
      data.quantity = Object.values(dto.locationQuantities as Record<string, number>).reduce((sum, q) => sum + q, 0);
    }

    return this.prisma.resource.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.resource.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Recurso desactivado' };
  }
}
