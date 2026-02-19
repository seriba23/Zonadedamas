import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where = { tenantId };

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { name: 'asc' },
        include: {
          addons: true,
          serviceResources: { include: { resource: true } },
          _count: { select: { employeeServices: true } },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async findOne(id: string, tenantId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, tenantId },
      include: {
        addons: true,
        serviceResources: { include: { resource: true } },
        employeeServices: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(tenantId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: {
        ...dto,
        tenantId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateServiceDto) {
    await this.findOne(id, tenantId);
    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Service deactivated' };
  }
}
