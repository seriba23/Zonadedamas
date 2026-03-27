import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(
    tenantId: string,
    query: {
      page?: number;
      perPage?: number;
      category?: string;
      supplierId?: string;
      isActive?: boolean;
      lowStock?: boolean;
    },
  ) {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (query.category) {
      where.category = query.category;
    }
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    // Prisma doesn't support comparing two columns directly,
    // so for low stock we use a separate method that filters in-memory
    if (query.lowStock) {
      return this.findLowStock(tenantId, { page, perPage });
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.product.count({ where }),
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

  async findLowStock(
    tenantId: string,
    query: { page?: number; perPage?: number },
  ) {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    // Fetch all products with minStock set, then filter in memory
    // since Prisma can't compare two columns directly
    const where: any = {
      tenantId,
      isActive: true,
      minStock: { not: null },
      stock: { not: null },
    };

    const allProducts = await this.prisma.product.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { stock: 'asc' },
    });

    const lowStockProducts = allProducts.filter(
      (p) => p.stock !== null && p.minStock !== null && p.stock <= p.minStock,
    );

    const total = lowStockProducts.length;
    const data = lowStockProducts.slice(skip, skip + perPage);

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
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        supplier: { select: { id: true, name: true, contactName: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return { data: product };
  }

  async create(tenantId: string, dto: CreateProductDto, userId?: string) {
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId, isActive: true },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    const product = await this.prisma.product.create({
      data: {
        tenantId,
        name: dto.name,
        sku: dto.sku,
        description: dto.description,
        category: dto.category,
        price: dto.price,
        costPrice: dto.costPrice,
        stock: dto.stock ?? 0,
        minStock: dto.minStock ?? 0,
        unit: dto.unit,
        supplierId: dto.supplierId,
        isActive: dto.isActive ?? true,
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'product.created',
      entityType: 'Product',
      entityId: product.id,
      newValues: product as any,
    });

    return { data: product };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProductDto,
    userId?: string,
  ) {
    const existing = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Product not found');

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId, isActive: true },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'product.updated',
      entityType: 'Product',
      entityId: id,
      oldValues: existing as any,
      newValues: product as any,
    });

    return { data: product };
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Product not found');

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'product.deactivated',
      entityType: 'Product',
      entityId: id,
    });

    return { data: { message: 'Product deactivated' } };
  }
}
