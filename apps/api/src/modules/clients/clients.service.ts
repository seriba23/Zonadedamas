import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/create-client.dto';
import { SearchClientsDto, CreateClientTagDto } from './dto/search-clients.dto';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: SearchClientsDto) {
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: any = { tenantId, isActive: true };

    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search } },
        { lastName: { contains: params.search } },
        { email: { contains: params.search } },
        { phone: { contains: params.search } },
      ];
    }

    if (params.email) {
      where.email = { contains: params.email };
    }

    if (params.phone) {
      where.phone = { contains: params.phone };
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          tags: {
            include: { tag: true },
          },
          _count: {
            select: { appointments: true },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, params);
  }

  async findOne(id: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
      include: {
        tags: {
          include: { tag: true },
        },
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 5,
          include: {
            items: { include: { service: true } },
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        _count: {
          select: { appointments: true },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async create(tenantId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        tenantId,
        isActive: true,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateClientDto) {
    await this.findOne(id, tenantId);
    return this.prisma.client.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    // Soft delete
    await this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Client deleted' };
  }

  async addTag(clientId: string, tenantId: string, tagId: string) {
    await this.findOne(clientId, tenantId);

    const tag = await this.prisma.clientTag.findFirst({
      where: { id: tagId, tenantId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    return this.prisma.clientTagMap.upsert({
      where: { clientId_tagId: { clientId, tagId } },
      update: {},
      create: { clientId, tagId },
    });
  }

  async removeTag(clientId: string, tenantId: string, tagId: string) {
    await this.findOne(clientId, tenantId);

    await this.prisma.clientTagMap.deleteMany({
      where: { clientId, tagId },
    });
    return { message: 'Tag removed' };
  }

  async findAllTags(tenantId: string) {
    return this.prisma.clientTag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { clients: true } },
      },
    });
  }

  async createTag(tenantId: string, dto: CreateClientTagDto) {
    return this.prisma.clientTag.create({
      data: {
        name: dto.name,
        color: dto.color,
        tenantId,
      },
    });
  }
}
