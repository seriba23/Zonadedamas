// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: decorador que marca esta clase como un "servicio" inyectable.
//   - NotFoundException: error listo que hace que la API responda HTTP 404.
import { Injectable, NotFoundException } from '@nestjs/common';
// Reglas de validación (de class-validator) que usamos en la clase de filtros:
//   - IsOptional: el campo puede faltar.
//   - IsString: si viene, debe ser texto.
import { IsOptional, IsString } from 'class-validator';
// PrismaService = el "puente" hacia la base de datos (ORM que traduce JS a SQL).
import { PrismaService } from '../../prisma/prisma.service';
// AuditService = registra en la bitácora de auditoría cada operación de escritura.
import { AuditService } from '../audit/audit.service';
// EventsService = emite "eventos de dominio" (avisos) cuando algo importante
// pasa (ej. un pago completado), para que otras partes del sistema reaccionen.
import { EventsService } from '../events/events.service';
// El DTO con la estructura validada del cuerpo para crear un pago.
import { CreatePaymentDto } from './dto/create-payment.dto';
// Utilidades de paginación: PaginationDto (campos page/perPage) y
// buildPaginatedResponse (arma la respuesta con metadatos de paginación).
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

// Antes era `interface extends PaginationDto`. Eso no funciona con
// class-validator/transformer: el ValidationPipe no sabe transformar
// los query params, así que `page` y `perPage` llegan como strings y
// Prisma rompe en `take`/`skip` (espera Int).
//
// PaymentFilters = la forma de los filtros aceptados al listar pagos. "extends
// PaginationDto" significa que HEREDA los campos de paginación (page, perPage) y
// además agrega los campos de abajo. Todos son opcionales y de tipo texto.
export class PaymentFilters extends PaginationDto {
  // clientId = filtrar por cliente concreto.
  @IsOptional() @IsString() clientId?: string;
  // appointmentId = filtrar por cita concreta.
  @IsOptional() @IsString() appointmentId?: string;
  // locationId = filtrar por sucursal concreta.
  @IsOptional() @IsString() locationId?: string;
  // paymentMethod = filtrar por método de pago (CASH, CARD, etc.).
  @IsOptional() @IsString() paymentMethod?: string;
  // startDate = fecha de inicio del rango (texto "YYYY-MM-DD").
  @IsOptional() @IsString() startDate?: string;
  // endDate = fecha de fin del rango (texto "YYYY-MM-DD").
  @IsOptional() @IsString() endDate?: string;
}

@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class PaymentsService {
  // CONSTRUCTOR + INYECCIÓN: NestJS inyecta las tres dependencias y las guarda
  // como propiedades de solo lectura (this.prisma, this.auditService,
  // this.eventsService) para usarlas en los métodos de abajo.
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // create(): registra un nuevo pago (cobro).
  //   - dto: los datos del pago ya validados (items, montos, método, etc.).
  //   - tenantId: el negocio dueño del pago (multi-inquilino).
  //   - userId: quién registra el pago (opcional; el "?" lo marca opcional).
  // Devuelve el pago creado dentro de { data: ... }.
  // ───────────────────────────────────────────────────────────────────────────
  async create(dto: CreatePaymentDto, tenantId: string, userId?: string) {
    // Si el cobro es de un apartado standalone, validar antes de crear
    // el Payment: el apartado debe existir, no estar terminado, y no
    // pertenecer a una cita activa (cuyo cobro tiene su propio flujo).
    //
    // "if (dto.productReservationId)" se cumple solo si vino ese id (si es texto
    // no vacío). Es decir, solo entramos aquí cuando el cobro es de un apartado.
    if (dto.productReservationId) {
      // findFirst = "trae el PRIMER registro que cumpla". Buscamos el apartado
      // por su id Y que pertenezca a este negocio (seguridad multi-inquilino).
      const reservation = await this.prisma.productReservation.findFirst({
        where: { id: dto.productReservationId, tenantId },
        // include = traer además datos de la cita relacionada (su id y estado).
        include: {
          appointment: { select: { id: true, status: true } },
        },
      });
      // "!reservation" se lee "si NO se encontró el apartado". En ese caso -> 404.
      if (!reservation) {
        throw new NotFoundException('Apartado no encontrado');
      }
      // [...].includes(x) devuelve true si "x" está en la lista. Con el "!"
      // delante, la condición es "si el estado NO es uno de los cobrables"
      // (PENDING, CONFIRMED o READY). Si ya está entregado/cancelado, no se cobra.
      if (!['PENDING', 'CONFIRMED', 'READY'].includes(reservation.status)) {
        throw new NotFoundException(
          // Interpolamos el estado actual en el mensaje (con `${...}`).
          `Este apartado ya esta en estado ${reservation.status} y no se puede cobrar.`,
        );
      }
      // Si el apartado está ligado a una cita Y esa cita NO está cancelada
      // (!== significa "distinto de"), entonces el cobro debe ir por el flujo
      // de la cita, no por aquí. "reservation.appointment &&" primero comprueba
      // que SÍ exista una cita ligada (si no hay, la condición es falsa y no entra).
      if (
        reservation.appointment &&
        reservation.appointment.status !== 'CANCELLED'
      ) {
        throw new NotFoundException(
          'Este apartado esta vinculado a una cita activa. Cobra la cita para procesar el apartado.',
        );
      }
    }

    // Calculate amounts
    // ── CÁLCULO DE MONTOS ──
    // subtotal = suma de (precio unitario × cantidad) de TODOS los renglones.
    // reduce() recorre la lista "items" acumulando un total:
    //   - "sum" es el acumulador (empieza en 0, ver el 0 del final).
    //   - "item" es cada renglón en cada vuelta.
    //   - En cada vuelta sumamos al acumulador item.unitPrice * item.quantity.
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0, // valor inicial del acumulador
    );
    // El operador "??" (fusión de nulos) devuelve el valor de la izquierda salvo
    // que sea null/undefined, en cuyo caso usa el de la derecha. Así, si no
    // mandaron propina/descuento/impuesto, usamos 0 en su lugar.
    const tipAmount = dto.tipAmount ?? 0;       // propina (se SUMA al total)
    const discountAmount = dto.discountAmount ?? 0; // descuento (se RESTA)
    const taxAmount = dto.taxAmount ?? 0;       // impuesto (se SUMA)
    // Anticipo ya pagado en la cita ligada: es un prepago que se descuenta del
    // total (los pagos de anticipo viven como Payment isDeposit en esa cita).
    let depositPaid = 0;
    if (dto.appointmentId) {
      const appt = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, tenantId },
        select: { depositPaid: true },
      });
      depositPaid = Math.max(0, Number(appt?.depositPaid ?? 0));
    }
    // TOTAL = (subtotal − descuento − anticipo, mínimo 0) + propina + impuesto.
    const totalAmount =
      Math.max(0, subtotal - discountAmount - depositPaid) + tipAmount + taxAmount;

    // ── GUARDAR EL PAGO EN LA BASE DE DATOS ──
    // create() inserta un nuevo registro. En "data" van los campos del pago.
    const payment = await this.prisma.payment.create({
      data: {
        tenantId, // negocio dueño (los campos sueltos son atajo de "tenantId: tenantId")
        appointmentId: dto.appointmentId, // cita ligada (o undefined si no hay)
        productReservationId: dto.productReservationId, // apartado ligado (o undefined)
        clientId: dto.clientId,   // cliente al que se cobra
        locationId: dto.locationId, // sucursal del cobro
        amount: subtotal,         // "amount" guarda el subtotal (antes de extras)
        tipAmount,                // propina
        discountAmount,           // descuento
        taxAmount,                // impuesto
        totalAmount,              // total final ya calculado arriba
        currency: 'MXN',          // moneda fija: pesos mexicanos
        paymentMethod: dto.paymentMethod, // método elegido
        status: 'COMPLETED',      // el pago se registra ya completado
        reference: dto.reference, // referencia opcional (folio/autorización)
        notes: dto.notes,         // notas opcionales
        createdBy: userId,        // quién lo registró
        // items.create = crear de una vez los renglones hijos del pago.
        items: {
          // map() transforma CADA "item" del dto en el objeto que la tabla de
          // renglones espera. Recorre toda la lista y devuelve una lista nueva.
          create: dto.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            // totalPrice del renglón = precio unitario × cantidad (su importe).
            totalPrice: item.unitPrice * item.quantity,
            itemType: item.itemType,
            referenceId: item.referenceId,
            referenceType: item.referenceType,
          })),
        },
      },
      // include: { items: true } => devolver también los renglones recién creados.
      include: { items: true },
    });

    // If linked to appointment, mark appointment as completed (with validation)
    // ── SI EL PAGO ES DE UNA CITA: marcar la cita como completada ──
    // Solo entramos si vino un appointmentId.
    if (dto.appointmentId) {
      // Buscamos la cita por su id y negocio (para validar su estado actual).
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, tenantId },
      });
      // Si la cita existe Y su estado es uno "abierto" (pendiente, confirmada o
      // en progreso), entonces la damos por completada al cobrar.
      if (
        appointment &&
        ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)
      ) {
        // Cambiamos el estado a COMPLETED y apagamos el flag de "pendiente de
        // cobro en el POS" (ya se cobró aquí).
        await this.prisma.appointment.update({
          where: { id: dto.appointmentId },
          data: { status: 'COMPLETED', pendingPosPayment: false },
        });
        // Guardamos en el historial de estados el cambio (bitácora de la cita).
        await this.prisma.appointmentStatusHistory.create({
          data: {
            appointmentId: dto.appointmentId,
            fromStatus: appointment.status, // estado anterior
            toStatus: 'COMPLETED',          // estado nuevo
            changedBy: userId,
            notes: 'Completada automaticamente al registrar pago',
          },
        });
        // Emitimos el evento "cita completada" para que otras partes del sistema
        // reaccionen (ej. recompensas, notificaciones, estadísticas).
        await this.eventsService.emitAppointmentCompleted(
          tenantId,
          dto.appointmentId,
          {
            locationId: appointment.locationId,
            employeeId: appointment.employeeId,
          },
        );
      } else if (appointment && appointment.pendingPosPayment) {
        // La cita ya estaba COMPLETED (admin la cerro sin cobrar) y se quedo
        // en el POS con pendingPosPayment=true. Al cobrar aqui, simplemente
        // desactivamos el flag para que desaparezca del listado.
        // (Este "else if" solo corre si NO entró al if de arriba.)
        await this.prisma.appointment.update({
          where: { id: dto.appointmentId },
          data: { pendingPosPayment: false },
        });
      }

      // Productos reservados al hacer el booking: marcarlos como DELIVERED.
      // El cliente acaba de pagar y se lleva la mercancía. Si no marcamos,
      // quedan en PENDING para siempre y los reportes de inventario las
      // siguen contando como "por entregar". El stock ya se descontó al
      // crear la reservación (ver shop.service.ts), así que aquí solo se
      // ajusta el estado, no hay efecto sobre Product.stock.
      //
      // updateMany = actualiza VARIOS registros a la vez (todos los que cumplan
      // el "where"). { in: [...] } = "cuyo estado esté en esta lista".
      await this.prisma.productReservation.updateMany({
        where: {
          appointmentId: dto.appointmentId,
          tenantId,
          status: { in: ['PENDING', 'CONFIRMED', 'READY'] },
        },
        data: { status: 'DELIVERED' },
      });
    }

    // Cobro standalone de apartado: marcar el reservation como
    // DELIVERED. Stock ya fue descontado al crearlo, no se toca.
    // (Caso del apartado sin cita: lo entregamos al cobrarlo.)
    if (dto.productReservationId) {
      await this.prisma.productReservation.update({
        where: { id: dto.productReservationId },
        data: { status: 'DELIVERED' },
      });
    }

    // ── AUDITORÍA ── Dejamos constancia de la operación en la bitácora.
    await this.auditService.log({
      tenantId,
      userId,
      action: 'payment.created',     // qué acción se hizo
      entityType: 'payment',         // sobre qué tipo de entidad
      entityId: payment.id,          // sobre qué registro concreto
      // "payment as any" = forzamos el tipo a "any" (libre) para guardar el
      // objeto completo como "valores nuevos" sin que TypeScript se queje.
      newValues: payment as any,
    });

    // ── EVENTO ── Avisamos al sistema de que un pago se completó (para que,
    // por ejemplo, se sumen puntos de recompensa o se actualicen reportes).
    await this.eventsService.emitPaymentCompleted(tenantId, payment.id, {
      clientId: dto.clientId,
      amount: totalAmount,
      paymentMethod: dto.paymentMethod,
    });

    // Devolvemos el pago creado en el formato estándar { data: ... }.
    return { data: payment };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): lista los pagos del negocio, aplicando filtros y paginación.
  //   - tenantId: el negocio (multi-inquilino).
  //   - filters: filtros opcionales + paginación (page/perPage).
  // Devuelve una respuesta paginada (datos + metadatos de total/páginas).
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters: PaymentFilters) {
    // Coerción defensiva: si por alguna razón el ValidationPipe no
    // transformó los query params (interface vs class, pipe deshabilitado
    // en algún test, etc.), forzamos Int aquí — Prisma rompe con strings.
    //
    // Number(...) convierte el texto a número. El "|| 1" significa "si lo de la
    // izquierda es falso (0, NaN, undefined...), usa 1". Así garantizamos página
    // válida aunque no llegue nada.
    const page = Number(filters.page) || 1;
    // perPage = cuántos por página, mínimo entre lo pedido (o 20 por defecto) y
    // 100. Math.min escoge el menor, para no permitir páginas gigantes.
    const perPage = Math.min(Number(filters.perPage) || 20, 100);
    // skip = cuántos registros saltar antes de empezar a leer (paginación).
    // Página 1 salta 0, página 2 salta perPage, etc.
    const skip = (page - 1) * perPage;

    // where = condiciones del filtrado. Empieza filtrando SIEMPRE por negocio.
    // ": any" relaja el tipo para poder ir agregando claves dinámicamente abajo.
    const where: any = { tenantId };
    // Cada "if" agrega un filtro SOLO si ese parámetro vino (texto no vacío).
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.appointmentId) where.appointmentId = filters.appointmentId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;

    // Filtro por rango de fechas: solo si vino al menos una de las dos
    // ("||" = "o"). Construimos un objeto sobre createdAt con gte/lte.
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      // gte = "mayor o igual que": desde la fecha de inicio (00:00 de ese día).
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      // lte = "menor o igual que": hasta el FIN del día de endDate. Le pegamos
      // 'T23:59:59Z' para incluir todo ese día completo (hasta el último segundo).
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate + 'T23:59:59Z');
    }

    // Promise.all ejecuta las DOS consultas EN PARALELO (a la vez) y espera a que
    // ambas terminen. Desestructuramos el resultado: "data" = los pagos de esta
    // página; "total" = cuántos pagos hay en total (para calcular páginas).
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,            // saltar los de páginas anteriores
        take: perPage,   // tomar como máximo perPage registros
        orderBy: { createdAt: 'desc' }, // más recientes primero ('desc' = descendente)
        include: {
          // Del cliente traemos solo id y nombre (lo justo para mostrar la lista).
          client: { select: { id: true, firstName: true, lastName: true } },
          // items = los renglones del pago.
          items: true,
        },
      }),
      // count() cuenta cuántos registros cumplen el MISMO "where" (sin paginar).
      this.prisma.payment.count({ where }),
    ]);

    // Armamos la respuesta paginada estándar (data + meta de paginación).
    return buildPaginatedResponse(data, total, filters);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): devuelve el detalle de UN pago por su id.
  //   - id: identificador del pago.
  //   - tenantId: el negocio (para que nadie vea pagos de otro negocio).
  // Devuelve el pago dentro de { data: ... } o lanza 404 si no existe.
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    // Buscamos el pago por id Y negocio (seguridad multi-inquilino).
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: {
        client: true, // todos los datos del cliente (es el detalle, sí interesa)
        appointment: {
          // De la cita ligada traemos solo lo útil para mostrar el contexto.
          select: { id: true, startTime: true, endTime: true, status: true },
        },
        items: true, // los renglones del pago
      },
    });

    // "!payment" = "si NO se encontró". Lanzamos 404 con mensaje claro.
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    // Devolvemos el pago en el formato estándar { data: ... }.
    return { data: payment };
  }
}
