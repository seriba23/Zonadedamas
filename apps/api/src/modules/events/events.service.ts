import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';

export interface DomainEventPayload {
  type: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, any>;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async emit(event: DomainEventPayload): Promise<void> {
    try {
      // Persist to database
      const domainEvent = await this.prisma.domainEvent.create({
        data: {
          eventName: event.type,
          tenantId: event.tenantId,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          payload: event.payload,
          processedAt: null,
        },
      });

      // Emit in-process event (replaces BullMQ queue)
      this.eventEmitter.emit(event.type, {
        eventId: domainEvent.id,
        ...event,
      });

      // Mark as processed immediately (in-process handling)
      await this.prisma.domainEvent.update({
        where: { id: domainEvent.id },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`Failed to emit domain event: ${event.type}`, err);
    }
  }

  async emitAppointmentCreated(
    tenantId: string,
    appointmentId: string,
    payload: Record<string, any>,
  ) {
    await this.emit({
      type: 'appointment.created',
      tenantId,
      aggregateId: appointmentId,
      aggregateType: 'Appointment',
      payload,
    });
  }

  async emitAppointmentCancelled(
    tenantId: string,
    appointmentId: string,
    payload: Record<string, any>,
  ) {
    await this.emit({
      type: 'appointment.cancelled',
      tenantId,
      aggregateId: appointmentId,
      aggregateType: 'Appointment',
      payload,
    });
  }

  async emitAppointmentRescheduled(
    tenantId: string,
    appointmentId: string,
    payload: Record<string, any>,
  ) {
    await this.emit({
      type: 'appointment.rescheduled',
      tenantId,
      aggregateId: appointmentId,
      aggregateType: 'Appointment',
      payload,
    });
  }

  async emitAppointmentCompleted(
    tenantId: string,
    appointmentId: string,
    payload: Record<string, any>,
  ) {
    await this.emit({
      type: 'appointment.completed',
      tenantId,
      aggregateId: appointmentId,
      aggregateType: 'Appointment',
      payload,
    });
  }

  async emitPaymentCompleted(
    tenantId: string,
    paymentId: string,
    payload: Record<string, any>,
  ) {
    await this.emit({
      type: 'payment.completed',
      tenantId,
      aggregateId: paymentId,
      aggregateType: 'Payment',
      payload,
    });
  }

  async emitAppointmentConfirmed(
    tenantId: string,
    appointmentId: string,
    payload: Record<string, any>,
  ) {
    await this.emit({
      type: 'appointment.confirmed',
      tenantId,
      aggregateId: appointmentId,
      aggregateType: 'Appointment',
      payload,
    });
  }

  async emitAppointmentNoShow(
    tenantId: string,
    appointmentId: string,
    payload: Record<string, any>,
  ) {
    await this.emit({
      type: 'appointment.no_show',
      tenantId,
      aggregateId: appointmentId,
      aggregateType: 'Appointment',
      payload,
    });
  }
}
