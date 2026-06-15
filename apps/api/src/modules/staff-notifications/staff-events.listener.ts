import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { NotifyStaffService } from './notify-staff.service';
import { DomainEventPayload } from '../events/events.service';

@Injectable()
export class StaffEventsListener {
  private readonly logger = new Logger(StaffEventsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyStaffService,
  ) {}

  // ─── Helpers ───────────────────────────────────────

  private formatDateTime(date: Date): string {
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private async getAppointmentBasics(id: string, tenantId: string) {
    return this.prisma.appointment.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        startTime: true,
        employeeId: true,
        client: { select: { firstName: true, lastName: true } },
        items: { select: { serviceNameSnapshot: true } },
      },
    });
  }

  // ─── Appointments ──────────────────────────────────

  @OnEvent('appointment.created')
  async handleAppointmentCreated(event: DomainEventPayload) {
    try {
      const apt = await this.getAppointmentBasics(
        event.aggregateId,
        event.tenantId,
      );
      if (!apt) return;

      const clientName = `${apt.client.firstName} ${apt.client.lastName}`;
      const services = apt.items.map((i) => i.serviceNameSnapshot).join(', ');

      await this.notify.notify({
        tenantId: event.tenantId,
        type: 'appointment.created',
        section: 'appointments',
        title: 'Nueva cita',
        body: `${clientName} reservó ${services || 'una cita'} para el ${this.formatDateTime(apt.startTime)}.`,
        link: `/employee/appointments?appointmentId=${apt.id}`,
        adminLink: `/calendar?appointmentId=${apt.id}`,
        entityType: 'appointment',
        entityId: apt.id,
        audience: { kind: 'employee_and_admins', employeeId: apt.employeeId },
      });
    } catch (err: any) {
      this.logger.warn(`appointment.created notify failed: ${err?.message}`);
    }
  }

  @OnEvent('appointment.cancelled')
  async handleAppointmentCancelled(event: DomainEventPayload) {
    try {
      const apt = await this.getAppointmentBasics(
        event.aggregateId,
        event.tenantId,
      );
      if (!apt) return;
      const clientName = `${apt.client.firstName} ${apt.client.lastName}`;

      await this.notify.notify({
        tenantId: event.tenantId,
        type: 'appointment.cancelled',
        section: 'appointments',
        title: 'Cita cancelada',
        body: `${clientName} canceló su cita del ${this.formatDateTime(apt.startTime)}.`,
        link: `/employee/appointments?appointmentId=${apt.id}`,
        adminLink: `/calendar?appointmentId=${apt.id}`,
        entityType: 'appointment',
        entityId: apt.id,
        audience: { kind: 'employee_and_admins', employeeId: apt.employeeId },
      });
    } catch (err: any) {
      this.logger.warn(`appointment.cancelled notify failed: ${err?.message}`);
    }
  }

  @OnEvent('appointment.rescheduled')
  async handleAppointmentRescheduled(event: DomainEventPayload) {
    try {
      const apt = await this.getAppointmentBasics(
        event.aggregateId,
        event.tenantId,
      );
      if (!apt) return;
      const clientName = `${apt.client.firstName} ${apt.client.lastName}`;

      await this.notify.notify({
        tenantId: event.tenantId,
        type: 'appointment.rescheduled',
        section: 'appointments',
        title: 'Cita reagendada',
        body: `${clientName} reagendó su cita al ${this.formatDateTime(apt.startTime)}.`,
        link: `/employee/appointments?appointmentId=${apt.id}`,
        adminLink: `/calendar?appointmentId=${apt.id}`,
        entityType: 'appointment',
        entityId: apt.id,
        audience: { kind: 'employee_and_admins', employeeId: apt.employeeId },
      });
    } catch (err: any) {
      this.logger.warn(
        `appointment.rescheduled notify failed: ${err?.message}`,
      );
    }
  }

  @OnEvent('appointment.confirmed')
  async handleAppointmentConfirmed(event: DomainEventPayload) {
    try {
      const apt = await this.getAppointmentBasics(
        event.aggregateId,
        event.tenantId,
      );
      if (!apt) return;
      const clientName = `${apt.client.firstName} ${apt.client.lastName}`;

      await this.notify.notify({
        tenantId: event.tenantId,
        type: 'appointment.confirmed',
        section: 'appointments',
        title: 'Cita confirmada por el cliente',
        body: `${clientName} confirmó su cita del ${this.formatDateTime(apt.startTime)}.`,
        link: `/employee/appointments?appointmentId=${apt.id}`,
        adminLink: `/calendar?appointmentId=${apt.id}`,
        entityType: 'appointment',
        entityId: apt.id,
        audience: { kind: 'employee_and_admins', employeeId: apt.employeeId },
      });
    } catch (err: any) {
      this.logger.warn(`appointment.confirmed notify failed: ${err?.message}`);
    }
  }

  // ─── Shop / Payments ───────────────────────────────

  @OnEvent('purchase.created')
  async handlePurchaseCreated(payload: {
    tenantId: string;
    purchase: {
      id: string;
      customerName: string;
      total: number;
      items: Array<{ productName: string; quantity: number }>;
    };
  }) {
    try {
      const itemsLabel =
        payload.purchase.items
          .slice(0, 3)
          .map((i) => `${i.quantity}× ${i.productName}`)
          .join(', ') +
        (payload.purchase.items.length > 3 ? '...' : '');

      await this.notify.notify({
        tenantId: payload.tenantId,
        type: 'purchase.created',
        section: 'shop',
        title: 'Nueva compra en tu tienda',
        body: `${payload.purchase.customerName} compró ${itemsLabel} ($${payload.purchase.total.toFixed(2)}).`,
        link: `/reservations?focus=${payload.purchase.id}`,
        entityType: 'purchase',
        entityId: payload.purchase.id,
        audience: { kind: 'admins' },
      });
    } catch (err: any) {
      this.logger.warn(`purchase.created notify failed: ${err?.message}`);
    }
  }

  @OnEvent('payment.completed')
  async handlePaymentCompleted(event: DomainEventPayload) {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: { id: event.aggregateId, tenantId: event.tenantId },
        select: {
          id: true,
          totalAmount: true,
          currency: true,
          paymentMethod: true,
          client: { select: { firstName: true, lastName: true } },
        },
      });
      if (!payment) return;

      const clientName = `${payment.client.firstName} ${payment.client.lastName}`;

      await this.notify.notify({
        tenantId: event.tenantId,
        type: 'payment.completed',
        section: 'payments',
        title: 'Pago recibido',
        body: `${clientName} pagó ${Number(payment.totalAmount).toFixed(2)} ${payment.currency} (${payment.paymentMethod}).`,
        link: `/reports?focus=${payment.id}`,
        entityType: 'payment',
        entityId: payment.id,
        audience: { kind: 'admins' },
      });
    } catch (err: any) {
      this.logger.warn(`payment.completed notify failed: ${err?.message}`);
    }
  }

  // ─── Reviews ──────────────────────────────────────

  @OnEvent('review.created')
  async handleReviewCreated(payload: {
    tenantId: string;
    reviewId: string;
    employeeId: string;
    rating: number;
    clientName: string;
  }) {
    try {
      await this.notify.notify({
        tenantId: payload.tenantId,
        type: 'review.created',
        section: 'reviews',
        title: 'Nueva reseña',
        body: `${payload.clientName} te dejó ${payload.rating} estrella${payload.rating === 1 ? '' : 's'}.`,
        link: `/employee/reviews`,
        adminLink: `/reviews`,
        entityType: 'review',
        entityId: payload.reviewId,
        audience: {
          kind: 'employee_and_admins',
          employeeId: payload.employeeId,
        },
      });
    } catch (err: any) {
      this.logger.warn(`review.created notify failed: ${err?.message}`);
    }
  }

  // ─── Inventory ─────────────────────────────────────

  @OnEvent('inventory.low_stock')
  async handleLowStock(payload: {
    tenantId: string;
    productId: string;
    productName: string;
    stock: number;
    threshold: number;
  }) {
    try {
      await this.notify.notify({
        tenantId: payload.tenantId,
        type: 'inventory.low_stock',
        section: 'inventory',
        title: 'Stock bajo',
        body: `${payload.productName} tiene ${payload.stock} unidades (umbral ${payload.threshold}).`,
        link: `/inventory?focus=${payload.productId}`,
        entityType: 'product',
        entityId: payload.productId,
        audience: { kind: 'admins' },
      });
    } catch (err: any) {
      this.logger.warn(`inventory.low_stock notify failed: ${err?.message}`);
    }
  }

  // ─── Product Reservations ──────────────────────────

  @OnEvent('product_reservation.created')
  async handleReservationCreated(payload: {
    tenantId: string;
    reservationId: string;
    productName: string;
    clientName: string;
    quantity: number;
  }) {
    try {
      await this.notify.notify({
        tenantId: payload.tenantId,
        type: 'product_reservation.created',
        section: 'reservations',
        title: 'Nuevo apartado',
        body: `${payload.clientName} apartó ${payload.quantity}× ${payload.productName}.`,
        link: `/reservations?focus=${payload.reservationId}`,
        entityType: 'product_reservation',
        entityId: payload.reservationId,
        audience: { kind: 'admins' },
      });
    } catch (err: any) {
      this.logger.warn(
        `product_reservation.created notify failed: ${err?.message}`,
      );
    }
  }
}
