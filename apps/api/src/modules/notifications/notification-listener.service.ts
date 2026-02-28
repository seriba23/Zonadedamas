import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationSenderService } from './notification-sender.service';
import { DomainEventPayload } from '../events/events.service';

@Injectable()
export class NotificationListenerService {
  private readonly logger = new Logger(NotificationListenerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly senderService: NotificationSenderService,
  ) {}

  private async getAppointmentContext(
    appointmentId: string,
    tenantId: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        items: {
          select: {
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
          },
        },
      },
    });
    if (!appointment) return null;

    const serviceNames = appointment.items
      .map((i) => i.serviceNameSnapshot)
      .join(', ');
    const totalPrice = appointment.items
      .reduce((sum, i) => sum + Number(i.priceSnapshot), 0)
      .toFixed(2);

    return {
      appointment,
      variables: {
        clientName: `${appointment.client.firstName} ${appointment.client.lastName}`,
        clientFirstName: appointment.client.firstName,
        employeeName: `${appointment.employee.firstName} ${appointment.employee.lastName}`,
        services: serviceNames,
        totalPrice,
        date: appointment.startTime.toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: appointment.startTime.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    };
  }

  @OnEvent('appointment.created')
  async handleAppointmentCreated(
    event: DomainEventPayload & { eventId: string },
  ) {
    try {
      const ctx = await this.getAppointmentContext(
        event.aggregateId,
        event.tenantId,
      );
      if (!ctx) return;

      await this.senderService.sendForEvent({
        tenantId: event.tenantId,
        eventName: 'appointment.created',
        recipientEmail: ctx.appointment.client.email,
        recipientPhone: ctx.appointment.client.phone,
        variables: ctx.variables,
      });
    } catch (error: any) {
      this.logger.error(
        `Notification failed for appointment.created: ${error.message}`,
      );
    }
  }

  @OnEvent('appointment.confirmed')
  async handleAppointmentConfirmed(
    event: DomainEventPayload & { eventId: string },
  ) {
    try {
      const ctx = await this.getAppointmentContext(
        event.aggregateId,
        event.tenantId,
      );
      if (!ctx) return;

      await this.senderService.sendForEvent({
        tenantId: event.tenantId,
        eventName: 'appointment.confirmed',
        recipientEmail: ctx.appointment.client.email,
        recipientPhone: ctx.appointment.client.phone,
        variables: ctx.variables,
      });
    } catch (error: any) {
      this.logger.error(
        `Notification failed for appointment.confirmed: ${error.message}`,
      );
    }
  }

  @OnEvent('appointment.rescheduled')
  async handleAppointmentRescheduled(
    event: DomainEventPayload & { eventId: string },
  ) {
    try {
      const ctx = await this.getAppointmentContext(
        event.aggregateId,
        event.tenantId,
      );
      if (!ctx) return;

      const variables = {
        ...ctx.variables,
        oldDate: event.payload.oldStartTime
          ? new Date(event.payload.oldStartTime).toLocaleDateString(
              'es-ES',
            )
          : '',
        newDate: ctx.variables.date,
        newTime: ctx.variables.time,
      };

      await this.senderService.sendForEvent({
        tenantId: event.tenantId,
        eventName: 'appointment.rescheduled',
        recipientEmail: ctx.appointment.client.email,
        recipientPhone: ctx.appointment.client.phone,
        variables,
      });
    } catch (error: any) {
      this.logger.error(
        `Notification failed for appointment.rescheduled: ${error.message}`,
      );
    }
  }

  @OnEvent('appointment.cancelled')
  async handleAppointmentCancelled(
    event: DomainEventPayload & { eventId: string },
  ) {
    try {
      const ctx = await this.getAppointmentContext(
        event.aggregateId,
        event.tenantId,
      );
      if (!ctx) return;

      await this.senderService.sendForEvent({
        tenantId: event.tenantId,
        eventName: 'appointment.cancelled',
        recipientEmail: ctx.appointment.client.email,
        recipientPhone: ctx.appointment.client.phone,
        variables: ctx.variables,
      });
    } catch (error: any) {
      this.logger.error(
        `Notification failed for appointment.cancelled: ${error.message}`,
      );
    }
  }

  @OnEvent('appointment.completed')
  async handleAppointmentCompleted(
    event: DomainEventPayload & { eventId: string },
  ) {
    try {
      const ctx = await this.getAppointmentContext(
        event.aggregateId,
        event.tenantId,
      );
      if (!ctx) return;

      await this.senderService.sendForEvent({
        tenantId: event.tenantId,
        eventName: 'appointment.completed',
        recipientEmail: ctx.appointment.client.email,
        recipientPhone: ctx.appointment.client.phone,
        variables: ctx.variables,
      });
    } catch (error: any) {
      this.logger.error(
        `Notification failed for appointment.completed: ${error.message}`,
      );
    }
  }

  @OnEvent('payment.completed')
  async handlePaymentCompleted(
    event: DomainEventPayload & { eventId: string },
  ) {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: { id: event.aggregateId, tenantId: event.tenantId },
        include: {
          client: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });
      if (!payment) return;

      const variables = {
        clientName: `${payment.client.firstName} ${payment.client.lastName}`,
        clientFirstName: payment.client.firstName,
        amount: Number(payment.totalAmount).toFixed(2),
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        date: payment.createdAt.toLocaleDateString('es-ES'),
      };

      await this.senderService.sendForEvent({
        tenantId: event.tenantId,
        eventName: 'payment.completed',
        recipientEmail: payment.client.email,
        recipientPhone: payment.client.phone,
        variables,
      });
    } catch (error: any) {
      this.logger.error(
        `Notification failed for payment.completed: ${error.message}`,
      );
    }
  }
}
