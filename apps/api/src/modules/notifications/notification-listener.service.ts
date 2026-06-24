// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De NestJS: Injectable (servicio inyectable) y Logger (registro en consola).
import { Injectable, Logger } from '@nestjs/common';
// OnEvent: decorador del sistema de eventos. Marca un método como "oyente": se
// ejecutará AUTOMÁTICAMENTE cuando en la app se emita un evento con ese nombre.
// Aquí es la pieza clave: el dominio (citas, pagos) "anuncia" cosas y este
// servicio las escucha para disparar notificaciones.
import { OnEvent } from '@nestjs/event-emitter';
// PrismaService: acceso a la base de datos (citas, pagos, clientes...).
import { PrismaService } from '../../prisma/prisma.service';
// El "remitente": el servicio que de verdad busca plantillas y envía. Este
// listener solo arma los datos y se lo delega.
import { NotificationSenderService } from './notification-sender.service';
// DomainEventPayload: la forma (tipo) de los datos que viajan con cada evento de
// dominio (qué negocio, qué entidad, qué cambió, etc.).
import { DomainEventPayload } from '../events/events.service';

@Injectable() // <- Servicio inyectable de NestJS.
export class NotificationListenerService {
  // Logger etiquetado con el nombre de esta clase.
  private readonly logger = new Logger(NotificationListenerService.name);

  // Inyección: Prisma (BD) y el servicio remitente.
  constructor(
    private readonly prisma: PrismaService,
    private readonly senderService: NotificationSenderService,
  ) {}

  // getAppointmentContext: método auxiliar PRIVADO (solo se usa dentro de esta
  // clase). Dado el id de una cita y su negocio, busca la cita con sus datos
  // relacionados y prepara las "variables" de plantilla listas para usar.
  //   - Devuelve: { appointment, variables } o null si no existe la cita.
  private async getAppointmentContext(
    appointmentId: string,
    tenantId: string,
  ) {
    // Buscamos la cita (filtrando por id Y negocio, por seguridad multi-tenant)
    // e "include" trae datos de tablas relacionadas que necesitamos para el texto.
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        // Del cliente: nombre, email y teléfono (para saber A QUIÉN y POR DÓNDE).
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        // Del empleado: solo su nombre (para mencionarlo en el mensaje).
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        // items = los servicios de la cita, con copia (snapshot) de nombre,
        // precio y duración tal como estaban al reservar.
        items: {
          select: {
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
          },
        },
      },
    });
    // Si no existe la cita, devolvemos null (el que llama decidirá qué hacer).
    if (!appointment) return null;

    // serviceNames = los nombres de los servicios unidos en un solo texto.
    //   - map(...) RECORRE cada item "i" y se queda SOLO con su nombre.
    //   - join(', ') une esa lista de nombres separándolos por ", ".
    // Ej.: ["Corte", "Tinte"] -> "Corte, Tinte".
    const serviceNames = appointment.items
      .map((i) => i.serviceNameSnapshot)
      .join(', ');
    // totalPrice = la suma de los precios de todos los servicios, con 2 decimales.
    //   - reduce(...) RECORRE los items acumulando en "sum" (empieza en 0).
    //   - Number(i.priceSnapshot) convierte el precio (que viene como Decimal/
    //     texto) a número para poder sumarlo.
    //   - .toFixed(2) formatea el total con 2 decimales como texto (ej. "45.00").
    const totalPrice = appointment.items
      .reduce((sum, i) => sum + Number(i.priceSnapshot), 0)
      .toFixed(2);

    // Devolvemos la cita y el objeto de variables ya listas para la plantilla.
    return {
      appointment,
      variables: {
        // Nombre completo del cliente (nombre + apellido, interpolados).
        clientName: `${appointment.client.firstName} ${appointment.client.lastName}`,
        // Solo el nombre de pila (para saludos más cercanos).
        clientFirstName: appointment.client.firstName,
        // Nombre completo del empleado.
        employeeName: `${appointment.employee.firstName} ${appointment.employee.lastName}`,
        services: serviceNames, // lista de servicios en texto
        totalPrice, // total formateado
        // Fecha de la cita en español, formato largo: toLocaleDateString con
        // 'es-ES' y opciones produce algo como "lunes, 3 de marzo de 2026".
        date: appointment.startTime.toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        // Hora de la cita "HH:MM" (2 dígitos cada una), ej. "10:00".
        time: appointment.startTime.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    };
  }

  // @OnEvent('appointment.created') = este método se ejecuta SOLO cuando alguien
  // en la app emite el evento "appointment.created" (cita creada). Es el enlace
  // entre "algo pasó en el dominio" y "enviar una notificación".
  @OnEvent('appointment.created')
  async handleAppointmentCreated(
    // event = los datos del evento. El tipo combina (con "&", intersección de
    // tipos) DomainEventPayload con un campo extra eventId. De aquí sacamos
    // aggregateId (id de la cita) y tenantId (el negocio).
    event: DomainEventPayload & { eventId: string },
  ) {
    // "try" para que un fallo al notificar NO rompa el flujo principal del evento.
    try {
      // Armamos el contexto (cita + variables) con el método auxiliar de arriba.
      const ctx = await this.getAppointmentContext(
        event.aggregateId,
        event.tenantId,
      );
      // Si la cita no existe (ctx es null), no hay nada que notificar: salimos.
      if (!ctx) return;

      // Pedimos al remitente que envíe las notificaciones de este evento, con el
      // email y teléfono del cliente y las variables ya preparadas.
      await this.senderService.sendForEvent({
        tenantId: event.tenantId,
        eventName: 'appointment.created',
        recipientEmail: ctx.appointment.client.email,
        recipientPhone: ctx.appointment.client.phone,
        variables: ctx.variables,
      });
    } catch (error: any) {
      // Si algo falla, lo registramos pero no lo propagamos (no relanzamos).
      this.logger.error(
        `Notification failed for appointment.created: ${error.message}`,
      );
    }
  }

  // Mismo patrón que el de arriba, pero para cuando la cita se CONFIRMA.
  @OnEvent('appointment.confirmed')
  async handleAppointmentConfirmed(
    event: DomainEventPayload & { eventId: string },
  ) {
    try {
      // Igual que en "created": obtenemos el contexto de la cita.
      const ctx = await this.getAppointmentContext(
        event.aggregateId,
        event.tenantId,
      );
      if (!ctx) return;

      // Enviamos las notificaciones del evento "appointment.confirmed".
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

  // Para cuando la cita se REAGENDA. Este caso necesita variables EXTRA (la
  // fecha vieja y la nueva), por eso es algo distinto a los demás.
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

      // Construimos las variables a partir de las base (...ctx.variables, que las
      // copia todas con el spread) y añadimos las propias del reagendado:
      const variables = {
        ...ctx.variables,
        // oldDate = la fecha ANTERIOR de la cita. Con el ternario: si el evento
        // trae oldStartTime, lo convertimos a fecha en español; si no, '' (vacío).
        oldDate: event.payload.oldStartTime
          ? new Date(event.payload.oldStartTime).toLocaleDateString(
              'es-ES',
            )
          : '',
        // newDate/newTime = la fecha y hora NUEVAS (reutilizamos las ya calculadas
        // en el contexto, que reflejan la cita ya movida).
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

  // Para cuando la cita se CANCELA. Mismo patrón estándar.
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

  // Para cuando la cita se COMPLETA (el servicio se realizó). Patrón estándar.
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

  // Para cuando se COMPLETA UN PAGO. Aquí el dato base NO es una cita sino un
  // pago, así que buscamos el pago y armamos sus PROPIAS variables (monto, etc.).
  @OnEvent('payment.completed')
  async handlePaymentCompleted(
    event: DomainEventPayload & { eventId: string },
  ) {
    try {
      // Buscamos el pago por su id (aggregateId) y negocio, incluyendo los datos
      // del cliente que necesitamos para destinatario y saludo.
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
      // Si no existe el pago, no notificamos.
      if (!payment) return;

      // Variables específicas del pago para rellenar la plantilla:
      const variables = {
        clientName: `${payment.client.firstName} ${payment.client.lastName}`,
        clientFirstName: payment.client.firstName,
        // amount = el monto total con 2 decimales. Number(...) convierte el
        // Decimal a número y .toFixed(2) lo formatea como "45.00".
        amount: Number(payment.totalAmount).toFixed(2),
        currency: payment.currency, // moneda (ej. "MXN")
        paymentMethod: payment.paymentMethod, // método (ej. "CARD")
        // date = la fecha de creación del pago, en formato corto español.
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
