// Injectable + Logger de NestJS.
import { Injectable, Logger } from '@nestjs/common';
// OnEvent: decorador que SUSCRIBE un método a un "evento de dominio". Cuando en
// otra parte del sistema se emite ese evento (ej. 'appointment.created'),
// NestJS ejecuta automáticamente el método decorado. Es el patrón "publicar/
// suscribir": quien crea la cita NO sabe quién escucha; solo emite el evento.
import { OnEvent } from '@nestjs/event-emitter';
// Puente a la base de datos.
import { PrismaService } from '../../prisma/prisma.service';
// Servicio que crea las notificaciones y dispara el push.
import { NotifyStaffService } from './notify-staff.service';
// Tipo que describe la "carga" estándar de un evento de dominio (qué campos trae).
import { DomainEventPayload } from '../events/events.service';

// Esta clase ESCUCHA eventos del negocio y, por cada uno, genera la notificación
// adecuada para el staff. No expone endpoints HTTP: solo reacciona a eventos.
@Injectable()
export class StaffEventsListener {
  private readonly logger = new Logger(StaffEventsListener.name);

  // Inyectamos la BD (para leer detalles del evento) y el notificador.
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyStaffService,
  ) {}

  // ─── Helpers ───────────────────────────────────────
  // (Métodos auxiliares privados reutilizados por los manejadores de abajo.)

  // formatDateTime(): convierte una fecha en un texto legible en español de
  // México, mostrando día, mes abreviado, hora y minutos (ej. "23 jun 15:30").
  private formatDateTime(date: Date): string {
    // toLocaleString formatea según un idioma ('es-MX') y unas opciones.
    return date.toLocaleString('es-MX', {
      day: '2-digit',   // día con 2 dígitos (ej. "03")
      month: 'short',   // mes abreviado (ej. "jun")
      hour: '2-digit',  // hora con 2 dígitos
      minute: '2-digit',// minutos con 2 dígitos
    });
  }

  // getAppointmentBasics(): trae los datos mínimos de una cita que necesitan
  // varios manejadores (id, hora, empleado, nombre del cliente y servicios).
  // Filtra por id + tenantId (seguridad multi-tenant). findFirst = 1 registro o null.
  private async getAppointmentBasics(id: string, tenantId: string) {
    return this.prisma.appointment.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        startTime: true,
        employeeId: true,
        status: true, // para avisar si la cita nace "por confirmar" (PENDING)
        // De relaciones, traemos solo lo que mostraremos en el texto:
        client: { select: { firstName: true, lastName: true } },
        items: { select: { serviceNameSnapshot: true } },
      },
    });
  }

  // ─── Appointments ──────────────────────────────────

  // @OnEvent('appointment.created'): se ejecuta cuando se crea una cita.
  // "event" trae, entre otros, aggregateId (id de la cita) y tenantId.
  @OnEvent('appointment.created')
  async handleAppointmentCreated(event: DomainEventPayload) {
    // try/catch: si algo falla al notificar, NO queremos que se rompa el flujo
    // que creó la cita. Capturamos el error y solo lo registramos.
    try {
      // Leemos los datos básicos de la cita recién creada.
      const apt = await this.getAppointmentBasics(
        event.aggregateId,
        event.tenantId,
      );
      // Si no se encontró (raro), salimos sin notificar.
      if (!apt) return;

      // Armamos el nombre completo del cliente (plantilla con `${...}`).
      const clientName = `${apt.client.firstName} ${apt.client.lastName}`;
      // Unimos los nombres de los servicios en un solo texto separado por comas.
      const services = apt.items.map((i) => i.serviceNameSnapshot).join(', ');

      // Si la cita nace en PENDING (reserva del cliente online), avisamos que
      // está "por confirmar"; si la agendó el negocio, nace confirmada.
      const porConfirmar = apt.status === 'PENDING';

      // Pedimos crear la notificación. Nótese link (vista empleado) y adminLink
      // (vista admin/calendario): cada destinatario verá el que le corresponde.
      await this.notify.notify({
        tenantId: event.tenantId,
        type: 'appointment.created',
        section: 'appointments',
        title: porConfirmar ? 'Cita por confirmar' : 'Nueva cita',
        // "services || 'una cita'": si no hubiera servicios, usamos un texto
        // genérico para que la frase quede natural.
        body: `${clientName} reservó ${services || 'una cita'} para el ${this.formatDateTime(apt.startTime)}.${porConfirmar ? ' Está por confirmar.' : ''}`,
        link: `/employee/appointments?appointmentId=${apt.id}`,
        adminLink: `/calendar?appointmentId=${apt.id}`,
        entityType: 'appointment',
        entityId: apt.id,
        // Audiencia: el empleado de la cita + los admins.
        audience: { kind: 'employee_and_admins', employeeId: apt.employeeId },
      });
    } catch (err: any) {
      this.logger.warn(`appointment.created notify failed: ${err?.message}`);
    }
  }

  // @OnEvent('appointment.cancelled'): cuando una cita se cancela.
  @OnEvent('appointment.cancelled')
  async handleAppointmentCancelled(event: DomainEventPayload) {
    try {
      // (Mismo patrón que el handler anterior: leer cita, validar, notificar.)
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

  // @OnEvent('appointment.rescheduled'): cuando una cita cambia de horario.
  @OnEvent('appointment.rescheduled')
  async handleAppointmentRescheduled(event: DomainEventPayload) {
    try {
      // (Mismo patrón.) Aquí apt.startTime ya es el NUEVO horario.
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

  // @OnEvent('appointment.confirmed'): cuando el cliente confirma la cita.
  @OnEvent('appointment.confirmed')
  async handleAppointmentConfirmed(event: DomainEventPayload) {
    try {
      // (Mismo patrón que los anteriores.)
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

  // @OnEvent('purchase.created'): nueva compra en la tienda. Aquí el evento NO
  // es un DomainEventPayload estándar, sino un objeto con la compra ya armada,
  // por eso describimos su forma "inline" (entre llaves) en el parámetro.
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
      // Construimos un texto resumen de los productos comprados.
      const itemsLabel =
        payload.purchase.items
          .slice(0, 3) // tomamos como máximo los 3 primeros productos
          // Para cada uno: "2× Shampoo" (cantidad + nombre).
          .map((i) => `${i.quantity}× ${i.productName}`)
          .join(', ') +
        // Si había más de 3 productos, añadimos "..." al final (ternario).
        (payload.purchase.items.length > 3 ? '...' : '');

      await this.notify.notify({
        tenantId: payload.tenantId,
        type: 'purchase.created',
        section: 'shop',
        title: 'Nueva compra en tu tienda',
        // toFixed(2) formatea el total con 2 decimales (ej. 50 -> "50.00").
        body: `${payload.purchase.customerName} compró ${itemsLabel} ($${payload.purchase.total.toFixed(2)}).`,
        link: `/reservations?focus=${payload.purchase.id}`,
        entityType: 'purchase',
        entityId: payload.purchase.id,
        // Solo admins (las ventas de tienda las gestionan ellos).
        audience: { kind: 'admins' },
      });
    } catch (err: any) {
      this.logger.warn(`purchase.created notify failed: ${err?.message}`);
    }
  }

  // @OnEvent('payment.completed'): cuando se registra un pago completado.
  @OnEvent('payment.completed')
  async handlePaymentCompleted(event: DomainEventPayload) {
    try {
      // Buscamos el pago por id + tenant y traemos solo lo necesario para el texto.
      const payment = await this.prisma.payment.findFirst({
        where: { id: event.aggregateId, tenantId: event.tenantId },
        select: {
          id: true,
          totalAmount: true,
          currency: true,
          paymentMethod: true,
          appointmentId: true,
          client: { select: { firstName: true, lastName: true } },
        },
      });
      if (!payment) return;

      const clientName = `${payment.client.firstName} ${payment.client.lastName}`;
      // El pago se ve en el contexto de la cita que lo origino. Validamos
      // que la cita realmente exista en el tenant antes de armar el link:
      // si la cita fue eliminada o pertenece a otro tenant, evitamos
      // mandar al admin a un modal vacio "Cita no encontrada".
      // Empezamos con un link de respaldo a /reports; lo cambiamos solo si la
      // cita existe. "let" porque puede reasignarse.
      let link: string = '/reports';
      if (payment.appointmentId) {
        const aptExists = await this.prisma.appointment.findFirst({
          where: { id: payment.appointmentId, tenantId: event.tenantId },
          select: { id: true },
        });
        if (aptExists) {
          link = `/calendar?appointmentId=${payment.appointmentId}`;
        }
      }

      await this.notify.notify({
        tenantId: event.tenantId,
        type: 'payment.completed',
        section: 'payments',
        title: 'Pago recibido',
        // Number(...) asegura que totalAmount sea numérico antes de toFixed(2)
        // (Prisma puede devolver decimales como un tipo especial Decimal).
        body: `${clientName} pagó ${Number(payment.totalAmount).toFixed(2)} ${payment.currency} (${payment.paymentMethod}).`,
        link,
        entityType: 'payment',
        entityId: payment.id,
        audience: { kind: 'admins' },
      });
    } catch (err: any) {
      this.logger.warn(`payment.completed notify failed: ${err?.message}`);
    }
  }

  // ─── Reviews ──────────────────────────────────────

  // @OnEvent('review.created'): cuando un cliente deja una reseña.
  @OnEvent('review.created')
  async handleReviewCreated(payload: {
    tenantId: string;
    reviewId: string;
    employeeId: string;
    rating: number;     // número de estrellas (1 a 5)
    clientName: string;
  }) {
    try {
      await this.notify.notify({
        tenantId: payload.tenantId,
        type: 'review.created',
        section: 'reviews',
        title: 'Nueva reseña',
        // Pluralización: si rating es 1 -> "estrella"; si no -> "estrellas".
        body: `${payload.clientName} te dejó ${payload.rating} estrella${payload.rating === 1 ? '' : 's'}.`,
        link: `/employee/reviews`,
        adminLink: `/reviews`,
        entityType: 'review',
        entityId: payload.reviewId,
        // El empleado reseñado + los admins.
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

  // @OnEvent('inventory.low_stock'): cuando un producto baja del umbral de stock.
  @OnEvent('inventory.low_stock')
  async handleLowStock(payload: {
    tenantId: string;
    productId: string;
    productName: string;
    stock: number;      // unidades restantes
    threshold: number;  // umbral mínimo configurado
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

  // @OnEvent('product_reservation.created'): cuando un cliente "aparta" producto.
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

  // ─── Time-off / Permisos de ausencia ───────────────────

  // @OnEvent('timeoff.requested'): el empleado solicitó un permiso de ausencia.
  // Notificamos a los admins con un enlace directo a la pestaña de aprobación.
  @OnEvent('timeoff.requested')
  async handleTimeOffRequested(payload: {
    tenantId: string;
    timeOffId: string;
    employeeId: string;
    employeeName: string;
    startDatetime: Date;
    endDatetime: Date;
    reason?: string | null;
  }) {
    try {
      await this.notify.notify({
        tenantId: payload.tenantId,
        type: 'timeoff.requested',
        section: 'staff',
        title: 'Nueva solicitud de permiso',
        body: `${payload.employeeName} solicitó un permiso del ${this.formatDateTime(payload.startDatetime)} al ${this.formatDateTime(payload.endDatetime)}.`,
        // adminLink: abre la pestaña "Permisos" de Personal para aprobar/rechazar.
        adminLink: `/staff?tab=permisos`,
        entityType: 'timeoff',
        entityId: payload.timeOffId,
        // Solo admins: son quienes aprueban/rechazan.
        audience: { kind: 'admins' },
      });
    } catch (err: any) {
      this.logger.warn(`timeoff.requested notify failed: ${err?.message}`);
    }
  }

  // @OnEvent('timeoff.approved'): el admin aprobó el permiso. Avisamos al empleado.
  @OnEvent('timeoff.approved')
  async handleTimeOffApproved(payload: {
    tenantId: string;
    timeOffId: string;
    employeeId: string;
    employeeName: string;
    startDatetime: Date;
    endDatetime: Date;
  }) {
    await this.notifyEmployeeTimeOffDecision(payload, 'APPROVED');
  }

  // @OnEvent('timeoff.rejected'): el admin rechazó el permiso. Avisamos al empleado
  // incluyendo el motivo del rechazo.
  @OnEvent('timeoff.rejected')
  async handleTimeOffRejected(payload: {
    tenantId: string;
    timeOffId: string;
    employeeId: string;
    employeeName: string;
    startDatetime: Date;
    endDatetime: Date;
    rejectionReason?: string | null;
  }) {
    await this.notifyEmployeeTimeOffDecision(payload, 'REJECTED', payload.rejectionReason);
  }

  // Helper común para las notificaciones de decisión (aprobado/rechazado): la
  // notificación va SOLO al empleado dueño de la solicitud, resolviendo su
  // userId (un empleado puede no tener cuenta de login: en ese caso se omite).
  private async notifyEmployeeTimeOffDecision(
    payload: { tenantId: string; timeOffId: string; employeeId: string; startDatetime: Date; endDatetime: Date },
    decision: 'APPROVED' | 'REJECTED',
    rejectionReason?: string | null,
  ) {
    try {
      const emp = await this.prisma.employee.findFirst({
        where: { id: payload.employeeId, tenantId: payload.tenantId },
        select: { userId: true },
      });
      // Sin cuenta de usuario no hay a quién notificar in-app.
      if (!emp?.userId) return;

      const rango = `${this.formatDateTime(payload.startDatetime)} al ${this.formatDateTime(payload.endDatetime)}`;
      const aprobado = decision === 'APPROVED';
      await this.notify.notify({
        tenantId: payload.tenantId,
        type: aprobado ? 'timeoff.approved' : 'timeoff.rejected',
        section: 'staff',
        title: aprobado ? 'Permiso aprobado' : 'Permiso rechazado',
        body: aprobado
          ? `Tu permiso del ${rango} fue aprobado.`
          : `Tu permiso del ${rango} fue rechazado.${rejectionReason ? ` Motivo: ${rejectionReason}` : ''}`,
        link: `/employee/time-off`,
        entityType: 'timeoff',
        entityId: payload.timeOffId,
        // Solo al empleado dueño de la solicitud.
        audience: { kind: 'users', userIds: [emp.userId] },
      });
    } catch (err: any) {
      this.logger.warn(`timeoff.${decision.toLowerCase()} notify failed: ${err?.message}`);
    }
  }

  // ─── Suscripción: meses de regalo ──────────────────

  // @OnEvent('subscription.gifted'): el super admin regaló meses al negocio.
  // Avisamos a los admins del negocio que su acceso quedó cubierto por cortesía.
  @OnEvent('subscription.gifted')
  async handleSubscriptionGifted(payload: {
    tenantId: string;
    months: number;
    until: Date;
  }) {
    try {
      const m = payload.months;
      const hasta = new Date(payload.until).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      await this.notify.notify({
        tenantId: payload.tenantId,
        type: 'subscription.gifted',
        section: 'subscription',
        title: `${m} mes${m === 1 ? '' : 'es'} de regalo`,
        body: `Siliba te regaló ${m} mes${m === 1 ? '' : 'es'} gratis. Tu acceso está cubierto sin cargo hasta el ${hasta}.`,
        adminLink: `/settings?tab=suscripcion`,
        entityType: 'subscription',
        audience: { kind: 'admins' },
      });
    } catch (err: any) {
      this.logger.warn(`subscription.gifted notify failed: ${err?.message}`);
    }
  }
}
