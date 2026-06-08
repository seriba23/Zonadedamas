import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConfirmPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(token: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      include: {
        client: { select: { firstName: true, lastName: true, avatarUrl: true } },
        employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true } },
        items: {
          select: {
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
            serviceId: true,
          },
        },
        payments: {
          select: { paymentMethod: true, totalAmount: true, status: true, createdAt: true },
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        photos: { select: { id: true, imageUrl: true, serviceId: true } },
        tenant: { select: { name: true, slug: true, logoUrl: true, tenantType: true } },
        review: { select: { id: true, rating: true, businessRating: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Token no encontrado o cita inexistente');
    return appointment;
  }

  async confirm(token: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: { id: true, tenantId: true, status: true, confirmedAt: true, photoConsent: true },
    });
    if (!appointment) throw new NotFoundException('Token no encontrado');
    if (appointment.confirmedAt) {
      return { data: { confirmedAt: appointment.confirmedAt, alreadyConfirmed: true } };
    }
    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { confirmedAt: new Date() },
      select: { confirmedAt: true },
    });
    return { data: { confirmedAt: updated.confirmedAt, alreadyConfirmed: false } };
  }

  /**
   * Crea la reseña vía token público. El cliente puede dejar rating del
   * empleado (obligatorio) y opcionalmente del negocio. Idempotente: si ya
   * existe review para la cita, lanza error.
   */
  async createReview(
    token: string,
    dto: { rating: number; comment?: string; businessRating?: number; businessComment?: string },
  ) {
    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('La calificación del empleado debe ser un entero entre 1 y 5');
    }
    if (dto.businessRating !== undefined && dto.businessRating !== null) {
      if (!Number.isInteger(dto.businessRating) || dto.businessRating < 1 || dto.businessRating > 5) {
        throw new BadRequestException('La calificación del negocio debe ser un entero entre 1 y 5');
      }
    }
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: { id: true, tenantId: true, employeeId: true, clientId: true },
    });
    if (!appointment) throw new NotFoundException('Token no encontrado');
    const existing = await this.prisma.employeeReview.findUnique({
      where: { appointmentId: appointment.id },
    });
    if (existing) {
      throw new BadRequestException('Esta cita ya tiene una reseña');
    }
    const review = await this.prisma.employeeReview.create({
      data: {
        tenantId: appointment.tenantId,
        employeeId: appointment.employeeId,
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        rating: dto.rating,
        comment: dto.comment || null,
        businessRating: dto.businessRating ?? null,
        businessComment: dto.businessComment || null,
        reviewedAt: new Date(),
      },
      select: { id: true, rating: true, businessRating: true, reviewedAt: true },
    });
    return { data: review };
  }
}
