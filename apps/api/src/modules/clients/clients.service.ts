// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador que marca esta clase como un "servicio" que NestJS
//     puede crear e inyectar en otras clases (como el controlador).
//   - NotFoundException: error listo para usar que, al lanzarse, hace que la API
//     responda con código HTTP 404 (no encontrado).
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

// PrismaService es nuestro "puente" hacia la base de datos. Prisma es el ORM
// (herramienta que convierte llamadas de JavaScript en consultas SQL). A través
// de this.prisma leemos/escribimos tablas como client, appointment, payment, etc.
import { PrismaService } from '../../prisma/prisma.service';

// DTOs que describen la forma del cuerpo JSON al crear/actualizar un cliente.
import { CreateClientDto, UpdateClientDto } from './dto/create-client.dto';

// DTOs para los filtros de búsqueda y para crear etiquetas.
import { SearchClientsDto, CreateClientTagDto } from './dto/search-clients.dto';

// Función helper que arma la respuesta paginada estándar del proyecto a partir
// de la lista de datos, el total de registros y los parámetros de paginación.
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class ClientsService {
  // El constructor recibe el PrismaService que NestJS inyecta automáticamente.
  // "private readonly prisma" lo guarda como propiedad de solo lectura
  // (this.prisma) para usarlo en todos los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): lista clientes del negocio con filtros, paginación y datos extra
  // (etiquetas, avatar, última visita y conteo de citas).
  // Recibe: tenantId (id del negocio) y params (filtros + paginación).
  // Devuelve: una respuesta paginada estándar { data, meta }.
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, params: SearchClientsDto) {
    // page = página solicitada. "??" (operador de fusión nula) significa: si
    // params.page es null/undefined, usa 1 por defecto.
    const page = params.page ?? 1;
    // perPage = cuántos clientes por página; por defecto 20.
    const perPage = params.perPage ?? 20;
    // skip = cuántos registros saltar para llegar a la página pedida.
    // Ej.: página 3 con 20 por página => saltar (3-1)*20 = 40 registros.
    const skip = (page - 1) * perPage;

    // "where" es el objeto de condiciones de la consulta. Lo tipamos como "any"
    // para poder ir agregándole propiedades dinámicamente según los filtros.
    // Base: clientes de ESTE negocio (tenantId) y que estén activos.
    const where: any = { tenantId, isActive: true };

    // FILTRO "search": texto libre que busca en varios campos a la vez.
    if (params.search) {
      // where.OR = lista de condiciones donde basta que UNA se cumpla.
      // "contains" = coincidencia parcial (como un "LIKE %texto%" en SQL).
      where.OR = [
        { firstName: { contains: params.search } }, // nombre contiene el texto
        { lastName: { contains: params.search } },  // apellido contiene el texto
        { email: { contains: params.search } },     // email contiene el texto
        { phone: { contains: params.search } },      // teléfono contiene el texto
      ];
    }

    // FILTRO por email concreto: coincidencia parcial en el correo.
    if (params.email) {
      where.email = { contains: params.email };
    }

    // FILTRO por teléfono concreto: coincidencia parcial en el teléfono.
    if (params.phone) {
      where.phone = { contains: params.phone };
    }

    // FILTRO por rango de fecha de creación. "||" = si CUALQUIERA de los dos
    // (createdAfter o createdBefore) viene, entramos a construir el rango.
    if (params.createdAfter || params.createdBefore) {
      // Inicializamos el objeto de condición de fecha vacío.
      where.createdAt = {};
      // gte = "greater than or equal" (>=): creados a partir de esta fecha.
      if (params.createdAfter) where.createdAt.gte = new Date(params.createdAfter);
      // lte = "less than or equal" (<=): creados hasta esta fecha. Le añadimos
      // 'T23:59:59Z' para incluir TODO ese día hasta el último segundo (UTC).
      if (params.createdBefore) where.createdAt.lte = new Date(params.createdBefore + 'T23:59:59Z');
    }

    // Promise.all ejecuta DOS consultas EN PARALELO (a la vez) y espera a que
    // ambas terminen. Es más rápido que hacerlas una tras otra. Con
    // desestructuración guardamos el primer resultado en "data" (la lista de
    // clientes) y el segundo en "total" (el conteo total para la paginación).
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,                 // condiciones de filtro construidas arriba
        skip,                  // cuántos saltar (paginación)
        take: perPage,         // cuántos traer (tamaño de página)
        // orderBy = orden de los resultados. Es una lista, así que ordena
        // primero por apellido ascendente y, si empatan, por nombre ascendente.
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        // include = trae datos de tablas relacionadas junto con cada cliente.
        include: {
          // tags = etiquetas del cliente. Es una tabla intermedia, así que
          // dentro incluimos también "tag" para traer los datos de la etiqueta.
          tags: {
            include: { tag: true },
          },
          // La foto del cliente puede estar en su User vinculado (marketplace),
          // no solo en Client.avatarUrl. La incluimos para resolver el avatar.
          user: { select: { avatarUrl: true } },
          // _count = conteos de relaciones. Aquí cuántas citas tiene el cliente.
          _count: {
            select: { appointments: true },
          },
          // appointments = traemos SOLO la última cita COMPLETADA (para mostrar
          // la "última visita"). where filtra por estado COMPLETED, orderBy la
          // ordena de más reciente a más antigua y take:1 toma solo la primera.
          appointments: {
            where: { status: 'COMPLETED' },
            orderBy: { startTime: 'desc' },
            take: 1,
            select: { startTime: true }, // solo necesitamos la fecha de inicio
          },
        },
      }),
      // Segunda consulta del Promise.all: cuenta el total de clientes que
      // cumplen el mismo "where" (sin paginar), para calcular cuántas páginas hay.
      this.prisma.client.count({ where }),
    ]);

    // Transformamos cada cliente de la lista a la forma que el frontend espera.
    // map() recorre "data" y devuelve una NUEVA lista con un objeto por cliente.
    const mapped = data.map((client) => {
      // Desestructuración: separamos "appointments" y "user" del resto. "...rest"
      // recoge TODAS las demás propiedades del cliente. Así sacamos appointments
      // y user (que eran auxiliares) y nos quedamos con el cliente "limpio".
      const { appointments, user, ...rest } = client;
      return {
        ...rest, // todos los campos del cliente tal cual
        // avatarUrl: usamos la foto del Client si existe; si no (??), la del User
        // vinculado; si tampoco (??), null. El "?." evita error si user es null.
        avatarUrl: rest.avatarUrl ?? user?.avatarUrl ?? null,
        // lastVisit: la fecha de inicio de la última cita completada. Si no hay
        // ninguna, appointments[0] es undefined y el "?." devuelve undefined, y
        // el "??" lo convierte en null.
        lastVisit: appointments[0]?.startTime ?? null,
      };
    });

    // Construimos y devolvemos la respuesta paginada estándar con la lista ya
    // transformada, el total y los parámetros (para que el helper calcule meta).
    return buildPaginatedResponse(mapped, total, params);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): busca UN cliente activo por id dentro del negocio, con sus
  // etiquetas y sus 5 citas más recientes. Lanza 404 si no existe.
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    // findFirst = devuelve el PRIMER registro que cumpla las condiciones.
    // Filtramos por id, por negocio (tenantId) y que esté activo (isActive).
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId, isActive: true },
      include: {
        // Etiquetas del cliente (con los datos de cada etiqueta dentro).
        tags: {
          include: { tag: true },
        },
        // Las 5 citas más recientes del cliente.
        appointments: {
          orderBy: { startTime: 'desc' }, // más recientes primero
          take: 5,                        // máximo 5
          include: {
            // items = servicios de cada cita; dentro traemos el "service".
            items: { include: { service: true } },
            // employee = el empleado que atendió; solo nombre y apellido.
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        // Conteo total de citas del cliente.
        _count: {
          select: { appointments: true },
        },
      },
    });

    // Si no se encontró cliente, "client" es null. "!client" = "si NO hay
    // cliente" -> lanzamos error 404 con un mensaje claro.
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Si existe, lo devolvemos con todos sus datos relacionados.
    return client;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea un cliente nuevo dentro del negocio.
  // Recibe: tenantId y el DTO con los datos del cliente. Devuelve el creado.
  // ───────────────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateClientDto) {
    // Dedup: evitar fichas duplicadas por teléfono/email dentro del negocio.
    // Si ya existe una activa con ese teléfono o correo, avisamos (409) con el
    // id existente para que el frontend ofrezca abrirla en vez de duplicar.
    const or: any[] = [];
    if (dto.phone) or.push({ phone: dto.phone });
    if (dto.email) or.push({ email: dto.email });
    if (or.length > 0) {
      const existing = await this.prisma.client.findFirst({
        where: { tenantId, isActive: true, OR: or },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      });
      if (existing) {
        const byPhone = !!dto.phone && existing.phone === dto.phone;
        throw new ConflictException({
          message: `Ya tienes un cliente con ese ${byPhone ? 'teléfono' : 'correo'}: ${existing.firstName} ${existing.lastName}.`,
          existingClientId: existing.id,
        });
      }
    }
    return this.prisma.client.create({
      data: {
        ...dto, // todos los campos enviados (firstName, lastName, email, etc.)
        // dateOfBirth llega como texto. Operador ternario:
        //   condición ? valorSiVerdadero : valorSiFalso
        // Si vino una fecha, la convertimos a objeto Date; si no, "undefined"
        // (que Prisma interpreta como "no asignar este campo").
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        tenantId,       // ligamos el cliente a este negocio (multi-tenant)
        isActive: true, // nace activo
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // generateClaimToken(): crea (o reutiliza) el token de "reclamo" de un cliente
  // walk-in, para invitarlo por WhatsApp a crear/vincular su cuenta real.
  // ───────────────────────────────────────────────────────────────────────────
  async generateClaimToken(id: string, tenantId: string) {
    const client = await this.findOne(id, tenantId);
    if (!client.phone) {
      throw new BadRequestException('El cliente necesita un teléfono para invitarlo por WhatsApp.');
    }
    if (client.userId) {
      throw new BadRequestException('Este cliente ya tiene una cuenta vinculada en la plataforma.');
    }
    if (client.claimToken) return { token: client.claimToken };
    // Token de 12 chars sin caracteres ambiguos (mismo alfabeto que las citas).
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 12; i++) token += chars[Math.floor(Math.random() * chars.length)];
    await this.prisma.client.update({
      where: { id },
      data: { claimToken: token, claimTokenAt: new Date() },
    });
    return { token };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update(): actualiza un cliente existente.
  // Primero verifica que exista (findOne lanza 404 si no), luego actualiza.
  // ───────────────────────────────────────────────────────────────────────────
  async update(id: string, tenantId: string, dto: UpdateClientDto) {
    // Reutilizamos findOne para validar que el cliente existe y es de este
    // negocio. Si no, findOne lanza 404 y no seguimos.
    await this.findOne(id, tenantId);
    return this.prisma.client.update({
      where: { id }, // qué registro actualizar
      data: {
        ...dto, // solo los campos enviados se actualizan
        // Igual que en create: convertimos la fecha a Date si vino, o undefined.
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  // setBlocked(): bloquea o desbloquea a un cliente del negocio. Un cliente
  // bloqueado no puede agendar más citas (se valida en todos los flujos de
  // reserva). Guarda el motivo para poder verlo si reintenta.
  async setBlocked(id: string, tenantId: string, blocked: boolean, reason?: string) {
    await this.findOne(id, tenantId);
    return this.prisma.client.update({
      where: { id },
      data: blocked
        ? { isBlocked: true, blockedReason: reason?.trim() || null, blockedAt: new Date() }
        : { isBlocked: false, blockedReason: null, blockedAt: null },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // remove(): "elimina" un cliente. NO borra la fila: es un borrado lógico
  // (soft delete) que solo lo marca como inactivo (isActive: false).
  // ───────────────────────────────────────────────────────────────────────────
  async remove(id: string, tenantId: string) {
    // Validamos que exista antes de tocarlo.
    await this.findOne(id, tenantId);
    // Soft delete
    await this.prisma.client.update({
      where: { id },
      data: { isActive: false }, // lo desactivamos en lugar de borrarlo
    });
    // Devolvemos un mensaje simple de confirmación.
    return { message: 'Cliente eliminado' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // addTag(): asocia una etiqueta a un cliente (relación cliente-etiqueta).
  // ───────────────────────────────────────────────────────────────────────────
  async addTag(clientId: string, tenantId: string, tagId: string) {
    // Validamos que el cliente exista y sea de este negocio.
    await this.findOne(clientId, tenantId);

    // Validamos que la etiqueta exista y pertenezca al mismo negocio.
    const tag = await this.prisma.clientTag.findFirst({
      where: { id: tagId, tenantId },
    });
    // Si no existe la etiqueta -> 404.
    if (!tag) throw new NotFoundException('Etiqueta no encontrada');

    // upsert = "update or insert": si la relación ya existe, no hace nada
    // (update: {}); si no existe, la crea (create). Así evitamos duplicados.
    return this.prisma.clientTagMap.upsert({
      // where con clave compuesta clientId_tagId: identifica la fila única que
      // une ese cliente con esa etiqueta.
      where: { clientId_tagId: { clientId, tagId } },
      update: {},                    // si ya existe, no cambia nada
      create: { clientId, tagId },   // si no existe, crea la relación
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // removeTag(): quita la asociación de una etiqueta con un cliente.
  // ───────────────────────────────────────────────────────────────────────────
  async removeTag(clientId: string, tenantId: string, tagId: string) {
    // Validamos que el cliente exista y sea de este negocio.
    await this.findOne(clientId, tenantId);

    // deleteMany borra todas las filas que coincidan (aquí, la relación entre
    // ese cliente y esa etiqueta). Si no hay ninguna, simplemente no borra nada.
    await this.prisma.clientTagMap.deleteMany({
      where: { clientId, tagId },
    });
    return { message: 'Etiqueta eliminada' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findAllTags(): lista todas las etiquetas del negocio, con el conteo de
  // cuántos clientes tiene cada una.
  // ───────────────────────────────────────────────────────────────────────────
  async findAllTags(tenantId: string) {
    return this.prisma.clientTag.findMany({
      where: { tenantId },           // solo etiquetas de este negocio
      orderBy: { name: 'asc' },      // ordenadas alfabéticamente por nombre
      include: {
        // _count.clients = cuántos clientes están asociados a cada etiqueta.
        _count: { select: { clients: true } },
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // createTag(): crea una etiqueta nueva en el negocio.
  // ───────────────────────────────────────────────────────────────────────────
  async createTag(tenantId: string, dto: CreateClientTagDto) {
    return this.prisma.clientTag.create({
      data: {
        name: dto.name,   // nombre de la etiqueta
        color: dto.color, // color (puede venir undefined si no se envió)
        tenantId,         // ligada a este negocio
      },
    });
  }

  /**
   * Resumen del cliente para la vista de detalle del admin: info basica
   * + listas resumidas (proximas / pasadas / pagos / cupones activos) +
   * agregados (totalSpent, totalCompletedAppointments, etc).
   */
  async getSummary(id: string, tenantId: string) {
    // Buscamos el cliente (sin exigir isActive aquí) con su usuario vinculado
    // (para el avatar) y sus etiquetas.
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
      include: {
        // Datos que el CLIENTE mantiene en su propia cuenta (una vez validada):
        // alergias, fecha de nacimiento y género. NO traemos la dirección (esa
        // solo se usa al hacer un pedido a domicilio).
        user: {
          select: {
            id: true, avatarUrl: true, allergies: true, birthDate: true, gender: true,
            emergencyContactName: true, emergencyContactLastName: true,
            emergencyContactPhone: true, emergencyContactRelation: true,
          },
        },
        // Perfil concreto (estilo Netflix) si la ficha está vinculada a uno; sus
        // datos son más específicos que los del titular.
        profile: { select: { allergies: true, dateOfBirth: true, gender: true } },
        tags: { include: { tag: true } },
      },
    });
    // Si no existe -> 404.
    if (!client) throw new NotFoundException('Cliente no encontrado');

    // "now" = el momento actual, para separar citas futuras de pasadas.
    const now = new Date();
    // Promise.all lanza SIETE consultas EN PARALELO y espera a todas. Con
    // desestructuración guardamos cada resultado en su variable, en el MISMO
    // orden en que aparecen abajo.
    const [
      upcomingAppointments,    // próximas citas
      completedAppointments,   // citas ya completadas
      payments,                // pagos completados
      purchases,               // compras de productos
      activeCoupons,           // cupones activos del cliente
      totalCompletedCount,     // conteo total de citas completadas
      paymentsAgg,             // suma total gastada (agregado)
    ] = await Promise.all([
      // 1) PRÓXIMAS CITAS: a partir de ahora (gte: now) y que NO estén
      // canceladas ni marcadas como no-show (notIn = "que no esté en la lista").
      this.prisma.appointment.findMany({
        where: {
          clientId: id,
          tenantId,
          startTime: { gte: now }, // gte = >= ahora (futuras o en curso)
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true } },
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true } },
        },
        orderBy: { startTime: 'asc' }, // las más cercanas primero
        take: 10,                      // máximo 10
      }),
      // 2) CITAS COMPLETADAS (historial de trabajos realizados).
      this.prisma.appointment.findMany({
        where: { clientId: id, tenantId, status: 'COMPLETED' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true } },
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true } },
        },
        orderBy: { startTime: 'desc' }, // las más recientes primero
        take: 10,
      }),
      // 3) PAGOS completados del cliente (los últimos 10).
      this.prisma.payment.findMany({
        where: { clientId: id, tenantId, status: 'COMPLETED' },
        select: {
          id: true,
          totalAmount: true,
          currency: true,
          paymentMethod: true,
          createdAt: true,
          appointmentId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Compras del cliente: pagos COMPLETED con al menos un item PRODUCT.
      // Cubre compras directas en POS y apartados pagados.
      // 4) "some" aquí significa "al menos un item del pago es de tipo PRODUCT".
      this.prisma.payment.findMany({
        where: {
          clientId: id,
          tenantId,
          status: 'COMPLETED',
          items: { some: { itemType: 'PRODUCT' } },
        },
        select: {
          id: true,
          totalAmount: true,
          currency: true,
          paymentMethod: true,
          createdAt: true,
          // Dentro de cada pago, traemos SOLO los items que son productos.
          items: {
            where: { itemType: 'PRODUCT' },
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // 5) CUPONES ACTIVOS: canjes de recompensa del cliente en estado ACTIVE,
      // con los datos de la recompensa asociada (nombre, tipo, descuento).
      this.prisma.rewardRedemption.findMany({
        where: { clientId: id, tenantId, status: 'ACTIVE' },
        include: {
          reward: {
            select: {
              name: true,
              type: true,
              discountAmount: true,
              discountMode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // 6) CONTEO total de citas completadas (un número, no la lista).
      this.prisma.appointment.count({
        where: { clientId: id, tenantId, status: 'COMPLETED' },
      }),
      // 7) AGREGADO: suma de todos los pagos completados del cliente.
      // _sum.totalAmount sumará el campo totalAmount de todas las filas que
      // cumplan el where.
      this.prisma.payment.aggregate({
        where: { clientId: id, tenantId, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
    ]);

    // Armamos y devolvemos el objeto de resumen en formato { data: ... }.
    return {
      data: {
        client,                 // datos básicos del cliente
        upcomingAppointments,   // próximas citas
        completedAppointments,  // citas completadas
        payments,               // pagos
        purchases,              // compras de productos
        activeCoupons,          // cupones activos
        stats: {
          totalCompletedAppointments: totalCompletedCount, // total de citas hechas
          // totalSpent: convertimos a número la suma. "|| 0" cubre el caso en
          // que no haya pagos (la suma vendría null) usando 0 en su lugar.
          totalSpent: Number(paymentsAgg._sum.totalAmount || 0),
          // activeCouponsCount: cuántos cupones activos hay (largo de la lista).
          activeCouponsCount: activeCoupons.length,
          // loyaltyPoints: puntos de fidelidad acumulados del cliente.
          loyaltyPoints: client.loyaltyPoints,
        },
      },
    };
  }
}
