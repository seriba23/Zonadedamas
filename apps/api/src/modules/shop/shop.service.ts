import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto, CreateBatchReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ShopService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async resolveTenant(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        shopEnabled: true,
        isMarketplaceListed: true,
        shopPickupEnabled: true,
        shopShippingEnabled: true,
        shopPaymentCash: true,
        shopPaymentSpei: true,
        shopPaymentCard: true,
        shopSpeiBankName: true,
        shopSpeiHolderName: true,
        shopSpeiClabe: true,
      },
    });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');
    if (!tenant.isMarketplaceListed || !tenant.shopEnabled) {
      throw new NotFoundException('Tienda no disponible');
    }
    return tenant;
  }

  async getShopSettings(slug: string) {
    const tenant = await this.resolveTenant(slug);

    const paymentMethods: string[] = [];
    if (tenant.shopPaymentCash) paymentMethods.push('CASH');
    if (tenant.shopPaymentSpei) paymentMethods.push('SPEI');
    if (tenant.shopPaymentCard) paymentMethods.push('CARD');

    const fulfillmentOptions: string[] = [];
    if (tenant.shopPickupEnabled) fulfillmentOptions.push('PICKUP');
    if (tenant.shopShippingEnabled) fulfillmentOptions.push('SHIPPING');

    return {
      data: {
        shopEnabled: tenant.shopEnabled,
        tenantName: tenant.name,
        paymentMethods,
        fulfillmentOptions,
        speiInfo: tenant.shopPaymentSpei && tenant.shopSpeiClabe ? {
          bankName: tenant.shopSpeiBankName,
          holderName: tenant.shopSpeiHolderName,
          clabe: tenant.shopSpeiClabe,
        } : null,
      },
    };
  }

  async getProducts(
    slug: string,
    query: { page?: number; perPage?: number; category?: string },
  ) {
    const tenant = await this.resolveTenant(slug);
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    const where: any = {
      tenantId: tenant.id,
      isShopListed: true,
      isActive: true,
      stock: { gt: 0 },
    };
    if (query.category) {
      where.category = query.category;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          price: true,
          currency: true,
          stock: true,
          imageUrl: true,
          shippingEnabled: true,
          shippingCost: true,
          images: {
            select: { id: true, imageUrl: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
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

  async getProductDetail(slug: string, productId: string) {
    const tenant = await this.resolveTenant(slug);

    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: tenant.id,
        isShopListed: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        price: true,
        stock: true,
        unit: true,
        imageUrl: true,
        shippingCost: true,
        images: {
          select: { id: true, imageUrl: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return { data: product };
  }

  async createReservation(slug: string, dto: CreateReservationDto, marketplaceUserId?: string) {
    const tenant = await this.resolveTenant(slug);

    // Validate fulfillment type
    if (dto.fulfillmentType === 'SHIPPING' && !tenant.shopShippingEnabled) {
      throw new BadRequestException('Este negocio no ofrece envios');
    }
    if (dto.fulfillmentType === 'PICKUP' && !tenant.shopPickupEnabled) {
      throw new BadRequestException(
        'Este negocio no ofrece recoger en tienda',
      );
    }

    // Validate payment method
    const paymentAllowed =
      (dto.preferredPaymentMethod === 'CASH' && tenant.shopPaymentCash) ||
      (dto.preferredPaymentMethod === 'SPEI' && tenant.shopPaymentSpei) ||
      (dto.preferredPaymentMethod === 'CARD' && tenant.shopPaymentCard);
    if (!paymentAllowed) {
      throw new BadRequestException(
        'Metodo de pago no aceptado por este negocio',
      );
    }

    // Validate shipping address for shipping
    if (dto.fulfillmentType === 'SHIPPING' && !dto.shippingAddress) {
      throw new BadRequestException(
        'Direccion de envio requerida para entregas a domicilio',
      );
    }

    // Transactional: validate stock and create reservation
    const reservation = await this.prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: {
            id: dto.productId,
            tenantId: tenant.id,
            isShopListed: true,
            isActive: true,
          },
        });
        if (!product) throw new NotFoundException('Producto no encontrado');

        if (product.stock < dto.quantity) {
          throw new BadRequestException(
            `Stock insuficiente. Disponible: ${product.stock}`,
          );
        }

        // Decrement stock
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: dto.quantity } },
        });

        // Create reservation with price snapshot
        return tx.productReservation.create({
          data: {
            tenantId: tenant.id,
            productId: product.id,
            quantity: dto.quantity,
            unitPrice: product.price,
            shippingCost: dto.fulfillmentType === 'SHIPPING' ? (product.shippingCost || 0) : 0,
            customerName: dto.customerName,
            customerEmail: dto.customerEmail,
            customerPhone: dto.customerPhone,
            fulfillmentType: dto.fulfillmentType as any,
            preferredPaymentMethod: dto.preferredPaymentMethod as any,
            shippingAddress: dto.shippingAddress,
            appointmentId: dto.appointmentId || null,
            notes: dto.notes,
            userId: marketplaceUserId,
          },
          include: {
            product: { select: { id: true, name: true, imageUrl: true } },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    this.eventEmitter.emit('purchase.created', {
      tenantId: tenant.id,
      purchase: {
        id: reservation.id,
        customerName: reservation.customerName,
        customerEmail: reservation.customerEmail,
        customerPhone: reservation.customerPhone,
        fulfillmentType: reservation.fulfillmentType,
        paymentMethod: reservation.preferredPaymentMethod,
        items: [
          {
            productId: reservation.product.id,
            productName: reservation.product.name,
            productImage: reservation.product.imageUrl ?? null,
            quantity: reservation.quantity,
            unitPrice: Number(reservation.unitPrice),
          },
        ],
        total:
          Number(reservation.unitPrice) * reservation.quantity +
          Number(reservation.shippingCost || 0),
        createdAt: reservation.createdAt,
      },
    });

    return { data: reservation };
  }

  async createBatchReservation(slug: string, dto: CreateBatchReservationDto, marketplaceUserId?: string) {
    const tenant = await this.resolveTenant(slug);

    if (dto.fulfillmentType === 'SHIPPING' && !tenant.shopShippingEnabled) {
      throw new BadRequestException('Este negocio no ofrece envios');
    }
    if (dto.fulfillmentType === 'PICKUP' && !tenant.shopPickupEnabled) {
      throw new BadRequestException('Este negocio no ofrece recoger en tienda');
    }

    const paymentAllowed =
      (dto.preferredPaymentMethod === 'CASH' && tenant.shopPaymentCash) ||
      (dto.preferredPaymentMethod === 'SPEI' && tenant.shopPaymentSpei) ||
      (dto.preferredPaymentMethod === 'CARD' && tenant.shopPaymentCard);
    if (!paymentAllowed) {
      throw new BadRequestException('Metodo de pago no aceptado por este negocio');
    }

    if (dto.fulfillmentType === 'SHIPPING' && !dto.shippingAddress) {
      throw new BadRequestException('Direccion de envio requerida');
    }

    const reservations = await this.prisma.$transaction(
      async (tx) => {
        const results: any[] = [];

        for (const item of dto.items) {
          const product = await tx.product.findFirst({
            where: {
              id: item.productId,
              tenantId: tenant.id,
              isShopListed: true,
              isActive: true,
            },
          });
          if (!product) throw new NotFoundException(`Producto no encontrado: ${item.productId}`);
          if (product.stock < item.quantity) {
            throw new BadRequestException(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}`);
          }

          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.quantity } },
          });

          const reservation = await tx.productReservation.create({
            data: {
              tenantId: tenant.id,
              productId: product.id,
              quantity: item.quantity,
              unitPrice: product.price,
              shippingCost: dto.fulfillmentType === 'SHIPPING' ? (product.shippingCost || 0) : 0,
              customerName: dto.customerName,
              customerEmail: dto.customerEmail,
              customerPhone: dto.customerPhone,
              fulfillmentType: dto.fulfillmentType as any,
              preferredPaymentMethod: dto.preferredPaymentMethod as any,
              shippingAddress: dto.shippingAddress,
              appointmentId: dto.appointmentId || null,
              notes: dto.notes,
              userId: marketplaceUserId,
            },
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          });
          results.push(reservation);
        }

        return results;
      },
      { isolationLevel: 'Serializable' },
    );

    if (reservations.length > 0) {
      const first = reservations[0];
      const total = reservations.reduce(
        (sum, r) => sum + Number(r.unitPrice) * r.quantity + Number(r.shippingCost || 0),
        0,
      );
      this.eventEmitter.emit('purchase.created', {
        tenantId: tenant.id,
        purchase: {
          id: first.id,
          customerName: first.customerName,
          customerEmail: first.customerEmail,
          customerPhone: first.customerPhone,
          fulfillmentType: first.fulfillmentType,
          paymentMethod: first.preferredPaymentMethod,
          items: reservations.map((r) => ({
            productId: r.product.id,
            productName: r.product.name,
            productImage: r.product.imageUrl ?? null,
            quantity: r.quantity,
            unitPrice: Number(r.unitPrice),
          })),
          total,
          createdAt: first.createdAt,
        },
      });
    }

    return { data: reservations };
  }
}
