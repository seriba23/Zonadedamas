import { Injectable, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

// Antes era `interface extends PaginationDto`. Eso no funciona con
// class-validator/transformer: el ValidationPipe no sabe transformar
// los query params, así que `page` y `perPage` llegan como strings y
// Prisma rompe en `take`/`skip` (espera Int).
export class PaymentFilters extends PaginationDto {
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() appointmentId?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
  ) {}

  async create(dto: CreatePaymentDto, tenantId: string, userId?: string) {
    // Calculate amounts
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const tipAmount = dto.tipAmount ?? 0;
    const discountAmount = dto.discountAmount ?? 0;
    const taxAmount = dto.taxAmount ?? 0;
    const totalAmount = subtotal + tipAmount - discountAmount + taxAmount;

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        appointmentId: dto.appointmentId,
        clientId: dto.clientId,
        locationId: dto.locationId,
        amount: subtotal,
        tipAmount,
        discountAmount,
        taxAmount,
        totalAmount,
        currency: 'MXN',
        paymentMethod: dto.paymentMethod,
        status: 'COMPLETED',
        reference: dto.reference,
        notes: dto.notes,
        createdBy: userId,
        items: {
          create: dto.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
            itemType: item.itemType,
            referenceId: item.referenceId,
            referenceType: item.referenceType,
          })),
        },
      },
      include: { items: true },
    });

    // If linked to appointment, mark appointment as completed (with validation)
    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, tenantId },
      });
      if (
        appointment &&
        ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)
      ) {
        await this.prisma.appointment.update({
          where: { id: dto.appointmentId },
          data: { status: 'COMPLETED' },
        });
        await this.prisma.appointmentStatusHistory.create({
          data: {
            appointmentId: dto.appointmentId,
            fromStatus: appointment.status,
            toStatus: 'COMPLETED',
            changedBy: userId,
            notes: 'Completada automaticamente al registrar pago',
          },
        });
        await this.eventsService.emitAppointmentCompleted(
          tenantId,
          dto.appointmentId,
          {
            locationId: appointment.locationId,
            employeeId: appointment.employeeId,
          },
        );
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'payment.created',
      entityType: 'payment',
      entityId: payment.id,
      newValues: payment as any,
    });

    await this.eventsService.emitPaymentCompleted(tenantId, payment.id, {
      clientId: dto.clientId,
      amount: totalAmount,
      paymentMethod: dto.paymentMethod,
    });

    return { data: payment };
  }

  async findAll(tenantId: string, filters: PaymentFilters) {
    // Coerción defensiva: si por alguna razón el ValidationPipe no
    // transformó los query params (interface vs class, pipe deshabilitado
    // en algún test, etc.), forzamos Int aquí — Prisma rompe con strings.
    const page = Number(filters.page) || 1;
    const perPage = Math.min(Number(filters.perPage) || 20, 100);
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.appointmentId) where.appointmentId = filters.appointmentId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate + 'T23:59:59Z');
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          items: true,
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, filters);
  }

  async findOne(id: string, tenantId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        appointment: {
          select: { id: true, startTime: true, endTime: true, status: true },
        },
        items: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return { data: payment };
  }
}
