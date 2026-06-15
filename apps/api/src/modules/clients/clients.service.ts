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

    if (params.createdAfter || params.createdBefore) {
      where.createdAt = {};
      if (params.createdAfter) where.createdAt.gte = new Date(params.createdAfter);
      if (params.createdBefore) where.createdAt.lte = new Date(params.createdBefore + 'T23:59:59Z');
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
          appointments: {
            where: { status: 'COMPLETED' },
            orderBy: { startTime: 'desc' },
            take: 1,
            select: { startTime: true },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    const mapped = data.map((client) => {
      const { appointments, ...rest } = client;
      return {
        ...rest,
        lastVisit: appointments[0]?.startTime ?? null,
      };
    });

    return buildPaginatedResponse(mapped, total, params);
  }

  async findOne(id: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId, isActive: true },
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
      throw new NotFoundException('Cliente no encontrado');
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
    return { message: 'Cliente eliminado' };
  }

  async addTag(clientId: string, tenantId: string, tagId: string) {
    await this.findOne(clientId, tenantId);

    const tag = await this.prisma.clientTag.findFirst({
      where: { id: tagId, tenantId },
    });
    if (!tag) throw new NotFoundException('Etiqueta no encontrada');

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
    return { message: 'Etiqueta eliminada' };
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

  /**
   * Resumen del cliente para la vista de detalle del admin: info basica
   * + listas resumidas (proximas / pasadas / pagos / cupones activos) +
   * agregados (totalSpent, totalCompletedAppointments, etc).
   */
  async getSummary(id: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { id: true, avatarUrl: true } },
        tags: { include: { tag: true } },
      },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const now = new Date();
    const [
      upcomingAppointments,
      completedAppointments,
      payments,
      activeCoupons,
      totalCompletedCount,
      paymentsAgg,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          clientId: id,
          tenantId,
          startTime: { gte: now },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true } },
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 10,
      }),
      this.prisma.appointment.findMany({
        where: { clientId: id, tenantId, status: 'COMPLETED' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true } },
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true } },
        },
        orderBy: { startTime: 'desc' },
        take: 10,
      }),
      this.prisma.payment.findMany({
        where: { clientId: id, tenantId, status: 'COMPLETED' },
        select: {
          id: true,
          totalAmount: true,
          currency: true,
          paymentMethod: true,
          createdAt: true,
          appointmentId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.rewardRedemption.findMany({
        where: { clientId: id, tenantId, status: 'ACTIVE' },
        include: {
          reward: {
            select: {
              name: true,
              type: true,
              discountAmount: true,
              discountMode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.appointment.count({
        where: { clientId: id, tenantId, status: 'COMPLETED' },
      }),
      this.prisma.payment.aggregate({
        where: { clientId: id, tenantId, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      data: {
        client,
        upcomingAppointments,
        completedAppointments,
        payments,
        activeCoupons,
        stats: {
          totalCompletedAppointments: totalCompletedCount,
          totalSpent: Number(paymentsAgg._sum.totalAmount || 0),
          activeCouponsCount: activeCoupons.length,
          loyaltyPoints: client.loyaltyPoints,
        },
      },
    };
  }
}
