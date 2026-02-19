import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateResourceDto, UpdateResourceDto } from './dto/create-resource.dto';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where = { tenantId };

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
    if (!resource) throw new NotFoundException('Resource not found');
    return resource;
  }

  async create(tenantId: string, dto: CreateResourceDto) {
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId },
    });
    if (!location) throw new NotFoundException('Location not found');

    return this.prisma.resource.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        locationId: dto.locationId,
        tenantId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateResourceDto) {
    await this.findOne(id, tenantId);
    return this.prisma.resource.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.resource.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Resource deactivated' };
  }
}
