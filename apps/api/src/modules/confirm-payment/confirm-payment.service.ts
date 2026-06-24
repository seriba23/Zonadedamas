// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos tres cosas:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un
//     "servicio" que NestJS puede crear e inyectar en otras clases.
//   - NotFoundException: error listo para usar que, al lanzarse, hace que la
//     API responda con código HTTP 404 (no encontrado).
//   - BadRequestException: error que responde con HTTP 400 (petición inválida).
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

// EventEmitter2 es el "emisor de eventos" del proyecto. Permite "avisar" a otras
// partes del sistema de que algo pasó (ej. "se creó una reseña") sin llamarlas
// directamente. Otros módulos pueden "escuchar" ese evento y reaccionar (mandar
// notificación, recalcular promedios, etc.). Reemplaza a las colas tipo BullMQ.
import { EventEmitter2 } from '@nestjs/event-emitter';

// PrismaService es nuestro "puente" hacia la base de datos. Prisma es la
// herramienta (ORM) que convierte llamadas de JavaScript en consultas SQL.
// A través de this.prisma podremos leer/escribir tablas como appointment,
// employeeReview, client, etc.
import { PrismaService } from '../../prisma/prisma.service';

@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class ConfirmPaymentService {
  // El constructor recibe dos dependencias que NestJS inyecta automáticamente:
  //   - prisma: para hablar con la base de datos.
  //   - eventEmitter: para emitir eventos de dominio.
  // "private readonly" guarda cada una como propiedad de solo lectura
  // (this.prisma / this.eventEmitter) para usarlas en los métodos de abajo.
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // resolve(): busca la cita a partir del token y devuelve TODOS sus datos
  // (cliente, empleado, servicios, pago, fotos, recompensa, reseña, negocio…)
  // para mostrarlos en la página pública de confirmación de cobro.
  // ───────────────────────────────────────────────────────────────────────────
  async resolve(token: string) {
    // findUnique = "encuentra UN registro único". Buscamos la cita cuyo
    // confirmationToken sea igual al token recibido.
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token }, // condición de búsqueda
      // "include" = además de la cita, trae datos de tablas relacionadas.
      include: {
        // Del cliente queremos su nombre y su foto (select elige campos puntuales).
        client: { select: { firstName: true, lastName: true, avatarUrl: true } },
        // Del empleado: id, nombre, foto y color (para pintar su avatar).
        employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true } },
        // items = los servicios de la cita. "Snapshot" significa que se guardó
        // una copia del nombre/precio/duración tal como estaban al reservar,
        // para que no cambien si luego editas el servicio.
        items: {
          select: {
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
            serviceId: true,
          },
        },
        // payments = los cobros de la cita. Aquí pedimos el desglose del cobro:
        // método, importe, propina, descuento, total, estado y fecha.
        payments: {
          select: { paymentMethod: true, amount: true, tipAmount: true, discountAmount: true, totalAmount: true, status: true, createdAt: true },
          // where: solo el pago COMPLETADO (ignoramos pendientes/fallidos).
          where: { status: 'COMPLETED' },
          // orderBy createdAt 'desc' = del más reciente al más antiguo.
          orderBy: { createdAt: 'desc' },
          // take: 1 = traer únicamente el primero de esa lista (el más reciente).
          take: 1,
        },
        // photos = fotos del resultado subidas por el staff (id, url y a qué
        // servicio pertenecen).
        photos: { select: { id: true, imageUrl: true, serviceId: true } },
        // tenant = el negocio. Además de nombre/slug/logo/portada/tipo, traemos
        // la configuración del confeti de celebración (si está activo, su estilo,
        // los estilos disponibles y los colores), para la animación de éxito.
        tenant: {
          select: {
            name: true,
            slug: true,
            logoUrl: true,
            coverImageUrl: true,
            tenantType: true,
            confettiEnabled: true,
            confettiStyle: true,
            confettiStyles: true,
            confettiColors: true,
          },
        },
        // productReservations = productos reservados/vendidos en esta cita.
        productReservations: {
          // status: { not: 'CANCELLED' } => "distinto de CANCELLED": traemos las
          // reservas que NO estén canceladas.
          where: { status: { not: 'CANCELLED' } },
          select: {
            id: true,
            quantity: true,   // cuántas unidades
            unitPrice: true,  // precio por unidad
            // product = datos del producto en sí (id, nombre, imagen).
            product: { select: { id: true, name: true, imageUrl: true } },
          },
        },
        // redemption = el canje de recompensa/cupón aplicado a la cita (si hubo).
        redemption: {
          select: {
            id: true,
            code: true, // código del cupón
            // reward = la recompensa origen: nombre, tipo y, si es descuento,
            // su monto y modo (porcentaje o fijo).
            reward: {
              select: {
                name: true,
                type: true,
                discountAmount: true,
                discountMode: true,
              },
            },
          },
        },
        // review = la reseña ya existente de esta cita (si la hay). Solo traemos
        // lo justo para saber si ya fue reseñada y con qué notas.
        review: { select: { id: true, rating: true, businessRating: true } },
      },
    });
    // Si no se encontró ninguna cita con ese token, "appointment" será null.
    // "!appointment" se lee como "si NO hay cita". En ese caso lanzamos 404.
    if (!appointment) throw new NotFoundException('Token no encontrado o cita inexistente');
    // Si todo salió bien, devolvemos la cita con todos sus datos relacionados.
    return appointment;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // confirm(): el cliente confirma que el cobro fue correcto. Marca confirmedAt.
  // Es "idempotente": si ya estaba confirmada, no vuelve a hacerlo, solo avisa.
  // ───────────────────────────────────────────────────────────────────────────
  async confirm(token: string) {
    // Buscamos la cita por su token, pero solo traemos los campos mínimos que
    // necesitamos para decidir. Traer menos campos hace la consulta más rápida.
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: { id: true, tenantId: true, status: true, confirmedAt: true, photoConsent: true },
    });
    // Si no existe la cita -> error 404.
    if (!appointment) throw new NotFoundException('Token no encontrado');
    // Si confirmedAt ya tiene valor (no es null), la cita YA estaba confirmada.
    // Devolvemos esa fecha y "alreadyConfirmed: true" sin tocar nada más.
    if (appointment.confirmedAt) {
      return { data: { confirmedAt: appointment.confirmedAt, alreadyConfirmed: true } };
    }
    // Primera vez que se confirma: guardamos el momento actual (new Date()) en
    // confirmedAt. select pide que la actualización nos devuelva ese campo.
    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id }, // qué registro actualizar
      data: { confirmedAt: new Date() },
      select: { confirmedAt: true },
    });
    // Devolvemos la fecha recién guardada y avisamos que NO estaba confirmada antes.
    return { data: { confirmedAt: updated.confirmedAt, alreadyConfirmed: false } };
  }

  /**
   * Crea la reseña vía token público. El cliente puede dejar rating del
   * empleado (obligatorio) y opcionalmente del negocio. Idempotente: si ya
   * existe review para la cita, lanza error.
   */
  async createReview(
    token: string,
    // dto = los datos de la reseña: nota del empleado (obligatoria) y, opcional,
    // comentario del empleado, nota del negocio y comentario del negocio.
    dto: { rating: number; comment?: string; businessRating?: number; businessComment?: string },
  ) {
    // VALIDACIÓN de la nota del empleado. Debe ser un número ENTERO entre 1 y 5.
    //   - !Number.isInteger(dto.rating): true si NO es un entero (ej. 3.5).
    //   - dto.rating < 1: por debajo del mínimo.
    //   - dto.rating > 5: por encima del máximo.
    // El "||" significa "o": si CUALQUIERA de las 3 se cumple, es inválida -> 400.
    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('La calificación del empleado debe ser un entero entre 1 y 5');
    }
    // VALIDACIÓN de la nota del negocio, pero SOLO si el cliente la mandó.
    //   - dto.businessRating !== undefined: que el campo venga presente.
    //   - dto.businessRating !== null: que no venga vacío como null.
    // El "&&" exige que AMBAS sean verdad para entrar a validar (si no la mandó,
    // se la salta porque es opcional).
    if (dto.businessRating !== undefined && dto.businessRating !== null) {
      // Mismo chequeo de "entero entre 1 y 5" que arriba, pero para el negocio.
      if (!Number.isInteger(dto.businessRating) || dto.businessRating < 1 || dto.businessRating > 5) {
        throw new BadRequestException('La calificación del negocio debe ser un entero entre 1 y 5');
      }
    }
    // Buscamos la cita por token, trayendo solo los ids que necesitamos para
    // construir la reseña (negocio, empleado y cliente).
    const appointment = await this.prisma.appointment.findUnique({
      where: { confirmationToken: token },
      select: { id: true, tenantId: true, employeeId: true, clientId: true },
    });
    // Si no existe la cita -> error 404.
    if (!appointment) throw new NotFoundException('Token no encontrado');
    // Buscamos si YA existe una reseña para esta cita. La relación es uno-a-uno
    // por appointmentId, así que findUnique nos dará la reseña o null.
    const existing = await this.prisma.employeeReview.findUnique({
      where: { appointmentId: appointment.id },
    });
    // Si ya existía, no permitimos crear otra (idempotencia) -> error 400.
    if (existing) {
      throw new BadRequestException('Esta cita ya tiene una reseña');
    }
    // Creamos la reseña en la base de datos.
    const review = await this.prisma.employeeReview.create({
      data: {
        tenantId: appointment.tenantId,     // negocio dueño de la reseña
        employeeId: appointment.employeeId, // empleado reseñado
        clientId: appointment.clientId,     // cliente que reseña
        appointmentId: appointment.id,      // cita asociada (clave única)
        rating: dto.rating,                 // nota del empleado
        // comment: si el cliente mandó comentario lo usamos; si no (cadena vacía
        // o undefined), "|| null" guarda null en su lugar.
        comment: dto.comment || null,
        // businessRating: el "??" (nullish coalescing) usa dto.businessRating
        // salvo que sea null/undefined, en cuyo caso guarda null. (Ojo: a
        // diferencia de "||", el "??" SÍ aceptaría un 0, aunque aquí ya validamos
        // que sea 1–5, así que nunca llega 0.)
        businessRating: dto.businessRating ?? null,
        // businessComment: igual que comment, vacío/undefined -> null.
        businessComment: dto.businessComment || null,
        reviewedAt: new Date(),             // momento de la reseña (ahora)
      },
      // Pedimos que nos devuelva solo estos campos de la reseña creada.
      select: { id: true, rating: true, businessRating: true, reviewedAt: true },
    });
    // Buscamos el nombre del cliente para incluirlo en el evento (notificación).
    const client = await this.prisma.client.findUnique({
      where: { id: appointment.clientId },
      select: { firstName: true, lastName: true },
    });
    // Emitimos el evento 'review.created' para que otros módulos reaccionen
    // (ej. avisar al empleado, recalcular su promedio de estrellas, etc.).
    this.eventEmitter.emit('review.created', {
      tenantId: appointment.tenantId,
      reviewId: review.id,
      employeeId: appointment.employeeId,
      rating: review.rating,
      // clientName con operador ternario (condición ? valorSí : valorNo):
      // si encontramos al cliente, juntamos nombre + apellido; si no (client es
      // null), usamos el texto genérico 'Un cliente'.
      clientName: client ? `${client.firstName} ${client.lastName}` : 'Un cliente',
    });
    // Devolvemos la reseña creada en el formato estándar { data: ... }.
    return { data: review };
  }
}
