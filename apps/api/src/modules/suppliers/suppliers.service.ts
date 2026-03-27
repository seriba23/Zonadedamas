import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
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
      this.prisma.supplier.findMany({
        where,
        include: {
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.supplier.count({ where }),
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
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { products: true } },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return { data: supplier };
  }

  async create(tenantId: string, dto: CreateSupplierDto, userId?: string) {
    const supplier = await this.prisma.supplier.create({
      data: {
        tenantId,
        name: dto.name,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        notes: dto.notes,
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'supplier.created',
      entityType: 'Supplier',
      entityId: supplier.id,
      newValues: supplier as any,
    });

    return { data: supplier };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateSupplierDto,
    userId?: string,
  ) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Supplier not found');

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'supplier.updated',
      entityType: 'Supplier',
      entityId: id,
      oldValues: existing as any,
      newValues: supplier as any,
    });

    return { data: supplier };
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Supplier not found');

    await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'supplier.deactivated',
      entityType: 'Supplier',
      entityId: id,
    });

    return { data: { message: 'Supplier deactivated' } };
  }
}
