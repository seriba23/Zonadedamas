import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// Fuente de verdad única para "stock bajo": productos activos del tenant
// con minStock configurado (>0). El where Prisma es laxo y la decisión
// final la toma isLowStockRow para que ambos pasos coincidan exactamente
// entre el alert del Home, el filtro del listado y el badge visual.
export function LOW_STOCK_WHERE(tenantId: string) {
  return { tenantId, isActive: true, minStock: { gt: 0 } };
}
export function isLowStockRow(p: { stock: number | null; minStock: number | null }) {
  const stock = p.stock ?? 0;
  const minStock = p.minStock ?? 0;
  return minStock > 0 && stock <= minStock;
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private uploads: UploadsService,
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
    if (query.lowStock) {
      return this.findLowStock(tenantId, { page, perPage });
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          images: { orderBy: { sortOrder: 'asc' } },
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

    const allProducts = await this.prisma.product.findMany({
      where: LOW_STOCK_WHERE(tenantId),
      include: {
        supplier: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { stock: 'asc' },
    });

    const lowStockProducts = allProducts.filter(isLowStockRow);

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
        images: { orderBy: { sortOrder: 'asc' } },
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
        currency: dto.currency || 'MXN',
        supplierId: dto.supplierId,
        supplierUrl: dto.supplierUrl,
        notes: dto.notes,
        shippingEnabled: dto.shippingEnabled ?? false,
        shippingCost: dto.shippingCost,
        isShopListed: dto.isShopListed ?? false,
        isActive: dto.isActive ?? true,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: 'asc' } },
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
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.supplierUrl !== undefined && { supplierUrl: dto.supplierUrl }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.shippingEnabled !== undefined && { shippingEnabled: dto.shippingEnabled }),
        ...(dto.shippingCost !== undefined && { shippingCost: dto.shippingCost }),
        ...(dto.isShopListed !== undefined && { isShopListed: dto.isShopListed }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: 'asc' } },
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
      include: { images: { select: { imageUrl: true } } },
    });
    if (!existing) throw new NotFoundException('Product not found');

    // Borrar archivos fisicos asociados antes del delete cascade.
    if (existing.imageUrl) {
      await this.uploads.deleteFile(existing.imageUrl).catch(() => {});
    }
    for (const img of existing.images) {
      await this.uploads.deleteFile(img.imageUrl).catch(() => {});
    }

    // Hard delete. ProductImage y ProductReservation tienen onDelete: Cascade
    // en el schema, asi que se eliminan automaticamente.
    await this.prisma.product.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId,
      action: 'product.deleted',
      entityType: 'Product',
      entityId: id,
      oldValues: { name: existing.name, sku: existing.sku },
    });

    return { data: { message: 'Product deleted' } };
  }

  // ─── Image Management ────────────────────────────

  async uploadMainImage(
    tenantId: string,
    productId: string,
    file: any,
    userId?: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    if (product.imageUrl) {
      await this.uploads.deleteFile(product.imageUrl);
    }

    const imageUrl = await this.uploads.saveFile(file, 'products');
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl },
    });

    return { data: { imageUrl: updated.imageUrl } };
  }

  async addGalleryImage(
    tenantId: string,
    productId: string,
    file: any,
    userId?: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { images: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.images.length >= 5) {
      throw new BadRequestException('Maximo 5 imagenes por producto');
    }

    const imageUrl = await this.uploads.saveFile(file, 'products');
    const image = await this.prisma.productImage.create({
      data: {
        productId,
        imageUrl,
        sortOrder: product.images.length,
      },
    });

    return { data: image };
  }

  async removeGalleryImage(
    tenantId: string,
    productId: string,
    imageId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Image not found');

    await this.uploads.deleteFile(image.imageUrl);
    await this.prisma.productImage.delete({ where: { id: imageId } });

    return { data: { message: 'Image removed' } };
  }

  // ─── Reservations (Dashboard) ���───────────────────

  async findAllReservations(
    tenantId: string,
    query: {
      page?: number;
      perPage?: number;
      status?: string;
    },
  ) {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.productReservation.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
          appointment: { select: { id: true, startTime: true, status: true } },
          user: { select: { id: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.productReservation.count({ where }),
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

  /**
   * Apartados cobrables: status no terminal + (sin cita o cita CANCELLED).
   * Devuelve los datos minimos que necesita el POS para precargar el cart
   * y el cliente: producto, cantidad, precio, cliente (snapshot) y un
   * flag para saber si vino de cita cancelada vs apartado puro.
   */
  async findPayableReservations(tenantId: string) {
    const reservations = await this.prisma.productReservation.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'READY'] },
        OR: [
          { appointmentId: null },
          { appointment: { status: 'CANCELLED' } },
        ],
      },
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
        appointment: { select: { id: true, status: true, startTime: true } },
        user: { select: { id: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: reservations };
  }

  async getSalesStats(tenantId: string) {
    const now = new Date();
    const todayStart = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalSales, todaySales, monthSales, recentSales] = await Promise.all([
      this.prisma.productReservation.aggregate({
        where: { tenantId, status: 'DELIVERED' },
        _sum: { unitPrice: true },
        _count: true,
      }),
      this.prisma.productReservation.aggregate({
        where: { tenantId, status: 'DELIVERED', updatedAt: { gte: todayStart } },
        _sum: { unitPrice: true },
        _count: true,
      }),
      this.prisma.productReservation.aggregate({
        where: { tenantId, status: 'DELIVERED', updatedAt: { gte: monthStart } },
        _sum: { unitPrice: true },
        _count: true,
      }),
      this.prisma.productReservation.findMany({
        where: { tenantId, status: 'DELIVERED' },
        include: { product: { select: { id: true, name: true, imageUrl: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      data: {
        total: { count: totalSales._count, revenue: Number(totalSales._sum.unitPrice || 0) },
        today: { count: todaySales._count, revenue: Number(todaySales._sum.unitPrice || 0) },
        month: { count: monthSales._count, revenue: Number(monthSales._sum.unitPrice || 0) },
        recent: recentSales,
      },
    };
  }

  async updateReservationStatus(
    tenantId: string,
    reservationId: string,
    newStatus: string,
    userId?: string,
  ) {
    const reservation = await this.prisma.productReservation.findFirst({
      where: { id: reservationId, tenantId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['READY', 'CANCELLED'],
      READY: ['DELIVERED', 'CANCELLED'],
    };

    const allowed = validTransitions[reservation.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `No se puede cambiar de ${reservation.status} a ${newStatus}`,
      );
    }

    const updated = await this.prisma.productReservation.update({
      where: { id: reservationId },
      data: { status: newStatus as any },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    // Restore stock if cancelled
    if (newStatus === 'CANCELLED') {
      await this.prisma.product.update({
        where: { id: reservation.productId },
        data: { stock: { increment: reservation.quantity } },
      });
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'reservation.status_changed',
      entityType: 'ProductReservation',
      entityId: reservationId,
      oldValues: { status: reservation.status } as any,
      newValues: { status: newStatus } as any,
    });

    return { data: updated };
  }
}
