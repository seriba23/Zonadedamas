// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un
//     "servicio" que NestJS puede crear e inyectar en otras clases.
//   - Logger: utilidad para escribir mensajes en la consola del servidor
//     (informativos, advertencias o errores). Ayuda a depurar y monitorear.
import { Injectable, Logger } from '@nestjs/common';

// EventEmitter2 es el "emisor de eventos": el objeto que permite DISPARAR un
// evento (emit) para que otras partes del código que estén "escuchando" ese
// evento reaccionen. Es el motor interno de @nestjs/event-emitter.
import { EventEmitter2 } from '@nestjs/event-emitter';

// PrismaService es nuestro "puente" hacia la base de datos. A través de
// this.prisma leemos y escribimos en las tablas (aquí, la tabla domainEvent).
import { PrismaService } from '../../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// CONTRATO DE DATOS: forma que debe tener un "evento de dominio".
// Una interface es una "plantilla de tipos": describe qué campos debe tener un
// objeto, sin generar código. Sirve para que TypeScript avise si te equivocas.
// ─────────────────────────────────────────────────────────────────────────────
export interface DomainEventPayload {
  type: string;            // nombre del evento, ej. "appointment.created"
  tenantId: string;        // id del negocio dueño del evento (multi-tenant)
  aggregateId: string;     // id de la entidad afectada (ej. id de la cita)
  aggregateType: string;   // tipo de esa entidad, ej. "Appointment"
  // payload = datos extra del evento. "Record<string, any>" significa "un objeto
  // con claves de texto y valores de cualquier tipo" (una bolsa flexible).
  payload: Record<string, any>;
}

@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class EventsService {
  // logger: nuestra herramienta para escribir en consola. EventsService.name es
  // el texto "EventsService", que aparecerá como etiqueta en cada mensaje para
  // saber de qué clase vino. "readonly" = no se puede reasignar.
  private readonly logger = new Logger(EventsService.name);

  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea e inyecta automáticamente estos dos objetos. "private readonly"
  // los guarda como propiedades de solo lectura (this.prisma / this.eventEmitter).
  constructor(
    private readonly prisma: PrismaService,        // acceso a la base de datos
    private readonly eventEmitter: EventEmitter2,  // motor de eventos en memoria
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // emit(): el método central. Recibe un evento, lo GUARDA en la base de datos,
  // lo DISPARA en memoria para que otros lo escuchen, y lo MARCA como procesado.
  // Devuelve Promise<void> (no devuelve datos; solo realiza el trabajo).
  // ───────────────────────────────────────────────────────────────────────────
  async emit(event: DomainEventPayload): Promise<void> {
    // try/catch: intenta el bloque "try"; si algo falla, salta al "catch" y
    // registra el error en vez de hacer caer toda la aplicación.
    try {
      // PASO 1: Persistir (guardar) el evento en la base de datos.
      // create() inserta una nueva fila en la tabla domainEvent.
      const domainEvent = await this.prisma.domainEvent.create({
        data: {
          eventName: event.type,             // nombre del evento
          tenantId: event.tenantId,          // negocio dueño
          aggregateId: event.aggregateId,    // entidad afectada
          aggregateType: event.aggregateType,// tipo de la entidad
          payload: event.payload,            // datos extra del evento
          // processedAt en null = "todavía no procesado". Lo marcaremos al final.
          processedAt: null,
        },
      });

      // PASO 2: Emitir el evento en el mismo proceso (reemplaza a una cola BullMQ).
      // El primer argumento (event.type) es el nombre que escucharán los handlers.
      // El segundo es el objeto que recibirán: el id recién creado en BD más...
      this.eventEmitter.emit(event.type, {
        eventId: domainEvent.id,
        // "...event" (spread) copia AQUÍ todos los campos del objeto "event"
        // (type, tenantId, aggregateId, etc.), para no escribirlos uno por uno.
        ...event,
      });

      // PASO 3: Marcar el evento como procesado de inmediato (se maneja en el
      // mismo proceso, no hay cola que espere). Guardamos la fecha/hora actual.
      await this.prisma.domainEvent.update({
        where: { id: domainEvent.id }, // qué fila actualizar
        data: { processedAt: new Date() }, // new Date() = momento actual
      });
    } catch (err) {
      // Si algo falló en cualquiera de los pasos, lo registramos como error.
      // Importante: NO relanzamos el error, para que un fallo al emitir un
      // evento (algo secundario) no rompa la operación principal del usuario.
      this.logger.error(`Failed to emit domain event: ${event.type}`, err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MÉTODOS "ATAJO": cada uno arma un evento concreto y llama a emit().
  // Existen para no repetir en todo el código el nombre exacto del evento ni el
  // aggregateType: aquí quedan centralizados y es difícil escribirlos mal.
  // Todos reciben: tenantId (negocio), el id de la entidad, y un payload (datos
  // extra). Todos usan "aggregateId: <id>" como nombre estándar del campo.
  // ───────────────────────────────────────────────────────────────────────────

  // Evento "cita creada": se dispara cuando se agenda una nueva cita.
  async emitAppointmentCreated(
    tenantId: string,
    appointmentId: string,
    payload: Record<string, any>,
  ) {
    await this.emit({
      type: 'appointment.created',     // nombre del evento
      tenantId,                        // negocio dueño
      aggregateId: appointmentId,      // id de la cita afectada
      aggregateType: 'Appointment',    // tipo de entidad
      payload,                         // datos extra
    });
  }

  // Evento "cita cancelada": se dispara cuando una cita pasa a CANCELLED.
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

  // Evento "cita reagendada": se dispara cuando se mueve la cita a otro horario.
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

  // Evento "cita completada": se dispara cuando la cita termina (COMPLETED).
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

  // Evento "pago completado": se dispara cuando se registra un pago exitoso.
  // OJO: aquí la entidad es un Payment (pago), no una cita. Por eso el
  // aggregateId es paymentId y el aggregateType es 'Payment'.
  async emitPaymentCompleted(
    tenantId: string,
    paymentId: string,
    payload: Record<string, any>,
  ) {
    await this.emit({
      type: 'payment.completed',
      tenantId,
      aggregateId: paymentId,        // id del pago afectado
      aggregateType: 'Payment',      // tipo de entidad: pago
      payload,
    });
  }

  // Evento "cita confirmada": se dispara cuando el cliente confirma asistencia.
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

  // Evento "no asistió" (no-show): se dispara cuando el cliente no se presentó.
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
