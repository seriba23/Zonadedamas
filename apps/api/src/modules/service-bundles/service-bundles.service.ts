import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateServiceBundleDto } from './dto/create-service-bundle.dto';
import { UpdateServiceBundleDto } from './dto/update-service-bundle.dto';

@Injectable()
export class ServiceBundlesService {
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
      this.prisma.serviceBundle.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip,
        take: perPage,
      }),
      this.prisma.serviceBundle.count({ where }),
    ]);

    // Enrich with service details
    const enrichedData = await Promise.all(
      data.map(async (bundle) => {
        const services = await this.prisma.service.findMany({
          where: { id: { in: bundle.serviceIds as string[] }, tenantId },
          select: { id: true, name: true, price: true, durationMinutes: true },
        });
        const totalOriginalPrice = services.reduce(
          (sum, s) => sum + Number(s.price),
          0,
        );
        const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
        const savingsPercent =
          totalOriginalPrice > 0
            ? Math.round(
                ((totalOriginalPrice - Number(bundle.bundlePrice)) /
                  totalOriginalPrice) *
                  100,
              )
            : 0;

        return {
          ...bundle,
          services,
          totalDuration,
          totalOriginalPrice,
          savingsPercent,
        };
      }),
    );

    return {
      data: enrichedData,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id, tenantId },
    });
    if (!bundle) throw new NotFoundException('Service bundle not found');

    const services = await this.prisma.service.findMany({
      where: { id: { in: bundle.serviceIds as string[] }, tenantId },
      select: { id: true, name: true, price: true, durationMinutes: true },
    });
    const totalOriginalPrice = services.reduce(
      (sum, s) => sum + Number(s.price),
      0,
    );
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const savingsPercent =
      totalOriginalPrice > 0
        ? Math.round(
            ((totalOriginalPrice - Number(bundle.bundlePrice)) /
              totalOriginalPrice) *
              100,
          )
        : 0;

    return {
      data: {
        ...bundle,
        services,
        totalDuration,
        totalOriginalPrice,
        savingsPercent,
      },
    };
  }

  async create(
    tenantId: string,
    dto: CreateServiceBundleDto,
    userId?: string,
  ) {
    if (!dto.serviceIds.length) {
      throw new BadRequestException('At least one service is required');
    }

    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds }, tenantId, isActive: true },
      select: { id: true, name: true, price: true, durationMinutes: true },
    });
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException('One or more services not found');
    }

    const totalOriginalPrice = services.reduce(
      (sum, s) => sum + Number(s.price),
      0,
    );
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const savingsPercent =
      totalOriginalPrice > 0
        ? Math.round(
            ((totalOriginalPrice - dto.bundlePrice) / totalOriginalPrice) * 100,
          )
        : 0;

    const bundle = await this.prisma.serviceBundle.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        bundlePrice: dto.bundlePrice,
        serviceIds: dto.serviceIds,
        totalDuration,
        savingsPercent,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        pointsReward: dto.pointsReward ?? null,
        redeemableWithPoints: dto.redeemableWithPoints ?? false,
        pointsRequired: dto.pointsRequired ?? null,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'serviceBundle.created',
      entityType: 'ServiceBundle',
      entityId: bundle.id,
      newValues: bundle as any,
    });

    return {
      data: {
        ...bundle,
        services,
        totalOriginalPrice,
      },
    };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateServiceBundleDto,
    userId?: string,
  ) {
    const existing = await this.prisma.serviceBundle.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Service bundle not found');

    let totalDuration: number | undefined;
    let savingsPercent: number | undefined;
    let services: any[] | undefined;

    const serviceIds = dto.serviceIds ?? (existing.serviceIds as string[]);
    const bundlePrice = dto.bundlePrice ?? Number(existing.bundlePrice);

    if (dto.serviceIds || dto.bundlePrice !== undefined) {
      const fetchedServices = await this.prisma.service.findMany({
        where: { id: { in: serviceIds }, tenantId, isActive: true },
        select: { id: true, name: true, price: true, durationMinutes: true },
      });
      if (dto.serviceIds && fetchedServices.length !== dto.serviceIds.length) {
        throw new BadRequestException('One or more services not found');
      }

      services = fetchedServices;
      const totalOriginalPrice = fetchedServices.reduce(
        (sum, s) => sum + Number(s.price),
        0,
      );
      totalDuration = fetchedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
      savingsPercent =
        totalOriginalPrice > 0
          ? Math.round(
              ((totalOriginalPrice - bundlePrice) / totalOriginalPrice) * 100,
            )
          : 0;
    }

    const bundle = await this.prisma.serviceBundle.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.bundlePrice !== undefined && { bundlePrice: dto.bundlePrice }),
        ...(dto.serviceIds !== undefined && { serviceIds: dto.serviceIds }),
        ...(totalDuration !== undefined && { totalDuration }),
        ...(savingsPercent !== undefined && { savingsPercent }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.pointsReward !== undefined && { pointsReward: dto.pointsReward }),
        ...(dto.redeemableWithPoints !== undefined && { redeemableWithPoints: dto.redeemableWithPoints }),
        ...(dto.pointsRequired !== undefined && { pointsRequired: dto.pointsRequired }),
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'serviceBundle.updated',
      entityType: 'ServiceBundle',
      entityId: id,
      oldValues: existing as any,
      newValues: bundle as any,
    });

    return {
      data: {
        ...bundle,
        ...(services && { services }),
      },
    };
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const existing = await this.prisma.serviceBundle.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Service bundle not found');

    await this.prisma.serviceBundle.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'serviceBundle.deactivated',
      entityType: 'ServiceBundle',
      entityId: id,
    });

    return { data: { message: 'Service bundle deactivated' } };
  }
}
