// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un
//     "servicio" inyectable que NestJS puede crear y pasar a otras clases.
//   - NotFoundException: error listo que hace responder HTTP 404 (no encontrado).
//   - BadRequestException: error que hace responder HTTP 400 (petición inválida).
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

// PrismaService: el "puente" hacia la base de datos. Prisma es el ORM que
// convierte llamadas de JavaScript en consultas SQL. Con this.prisma leemos y
// escribimos tablas como reward, rewardRedemption, client, service, etc.
import { PrismaService } from '../../prisma/prisma.service';

// AuditService: servicio para registrar en la bitácora (audit_log) cada acción
// importante (crear/editar/borrar). Sirve para trazabilidad y seguridad.
import { AuditService } from '../audit/audit.service';

// DTOs que describen y validan los datos al crear y actualizar recompensas.
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

// @Injectable marca la clase como servicio: NestJS la crea una vez y la comparte.
@Injectable()
export class RewardsService {
  // CONSTRUCTOR + INYECCIÓN: NestJS pasa automáticamente las dependencias que
  // pedimos aquí. "private" las guarda como propiedades (this.prisma, this.audit)
  // para usarlas en todos los métodos de abajo.
  constructor(
    private prisma: PrismaService, // acceso a la base de datos.
    private audit: AuditService,   // registro de auditoría.
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): lista (paginada) las recompensas de un negocio (tenant).
  // Recibe el tenantId y un objeto "query" con página, tamaño y filtro activo.
  // Devuelve { data, meta } (los datos + información de paginación).
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(
    tenantId: string,
    query: { page?: number; perPage?: number; isActive?: boolean },
  ) {
    // page: la página pedida. Math.max(1, ...) garantiza un mínimo de 1.
    // "query.page || 1": si page es undefined/0 (valores "falsy"), usa 1.
    const page = Math.max(1, query.page || 1);
    // perPage: cuántos por página. Lo acotamos entre 1 y 100:
    //   - Math.max(1, ... || 20): si no vino, usa 20; nunca menos de 1.
    //   - Math.min(100, ...): nunca más de 100 (evita pedir demasiados).
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    // skip: cuántos registros saltar para llegar a la página pedida.
    // Página 1 => salta 0; página 2 con 20/pág => salta 20; etc.
    const skip = (page - 1) * perPage;

    // "where" es el filtro de la consulta. Empieza filtrando por tenantId, para
    // que SOLO veamos recompensas de este negocio (regla multi-tenant).
    const where: any = { tenantId };
    // Si vino el filtro isActive (no es undefined), lo añadimos al where.
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // Promise.all ejecuta las DOS consultas EN PARALELO (a la vez) y espera a
    // que ambas terminen. Devuelve sus resultados en orden: [data, total].
    const [data, total] = await Promise.all([
      // 1) findMany: trae la "página" de recompensas que cumple el filtro.
      this.prisma.reward.findMany({
        where,
        include: {
          // De cada recompensa traemos también su servicio asociado (si tiene),
          // pero solo id, nombre y precio (select elige campos puntuales).
          service: { select: { id: true, name: true, price: true } },
        },
        orderBy: { createdAt: 'desc' }, // más recientes primero ('desc' = descendente).
        skip,        // saltar los de páginas anteriores.
        take: perPage, // tomar como máximo perPage registros.
      }),
      // 2) count: cuenta el TOTAL de recompensas que cumplen el filtro (sin
      //    paginar), para poder calcular el número de páginas.
      this.prisma.reward.count({ where }),
    ]);

    // Devolvemos los datos y la "meta" con la información de paginación.
    return {
      data,
      meta: {
        total,
        page,
        perPage,
        // totalPages: total dividido entre perPage, redondeado HACIA ARRIBA
        // (Math.ceil) para que sobre página si hay un resto. Ej.: 21/20 => 2.
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): devuelve UNA recompensa por su id (dentro del tenant).
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(tenantId: string, id: string) {
    // findFirst: busca el PRIMER registro que cumpla el filtro. Filtramos por id
    // Y tenantId juntos para no exponer recompensas de otros negocios.
    const reward = await this.prisma.reward.findFirst({
      where: { id, tenantId },
      include: {
        service: { select: { id: true, name: true, price: true } },
        // _count: pide a Prisma un conteo de relaciones. Aquí cuántas veces se
        // ha canjeado esta recompensa (cuántas filas en redemptions apuntan a ella).
        _count: { select: { redemptions: true } },
      },
    });
    // "!reward" se lee "si NO hay recompensa". Si no existe -> error 404.
    if (!reward) throw new NotFoundException('Reward not found');
    return { data: reward };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea una nueva recompensa tras validar reglas según su tipo.
  // Recibe tenantId, los datos validados (dto) y el id del usuario autor.
  // ───────────────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateRewardDto, userId?: string) {
    // Si la recompensa es de tipo SERVICIO y trae un serviceId, verificamos que
    // ese servicio exista, sea del mismo negocio y esté activo. El "&&" exige
    // que AMBAS condiciones sean verdaderas para entrar.
    if (dto.type === 'SERVICIO' && dto.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, tenantId, isActive: true },
      });
      // Si no encontró ese servicio -> error 400 (datos inválidos).
      if (!service) throw new BadRequestException('Service not found');
    }

    // Validaciones específicas del tipo DESCUENTO.
    if (dto.type === 'DESCUENTO') {
      // "== null" detecta TANTO null COMO undefined (doble igual, no triple).
      // "!dto.discountMode" es true si discountMode falta o está vacío.
      // Para un descuento necesitamos AMBOS: el monto y el modo.
      if (dto.discountAmount == null || !dto.discountMode) {
        throw new BadRequestException(
          'discountAmount and discountMode are required for DESCUENTO type',
        );
      }
      // Si el descuento es porcentual, no puede superar el 100%.
      if (dto.discountMode === 'PERCENTAGE' && dto.discountAmount > 100) {
        throw new BadRequestException('Percentage discount cannot exceed 100');
      }
    }

    if (dto.type === 'TWO_FOR_ONE') {
      // 2x1 necesita serviceIds explicitos para saber a que se aplica;
      // sin ellos no podemos generar un referral util.
      // Array.isArray comprueba que serviceIds sea de verdad una lista; si no,
      // usamos un arreglo vacío [] para evitar errores al medir su longitud.
      const arr = Array.isArray(dto.serviceIds) ? dto.serviceIds : [];
      // .length === 0 => la lista está vacía: un 2x1 sin servicios no tiene sentido.
      if (arr.length === 0) {
        throw new BadRequestException(
          'Los cupones 2×1 deben tener al menos un servicio asociado',
        );
      }
    }

    // Codigo unico por tenant (si se proporciono)
    // Si el usuario puso un código manual, comprobamos que no exista ya otro
    // cupón ACTIVO con ese mismo código en este negocio (evita duplicados).
    if (dto.code) {
      const dup = await this.prisma.reward.findFirst({
        where: { tenantId, code: dto.code, isActive: true },
      });
      if (dup) {
        throw new BadRequestException('Ya existe un cupón con ese código');
      }
    }

    // Unificacion serviceId / serviceIds:
    //  - SERVICIO con un solo servicio se mantiene en serviceId (compat).
    //  - SERVICIO con varios (o vacio) y DESCUENTO/TWO_FOR_ONE usan serviceIds.
    // serviceIdsArr: la lista de servicios saneada (arreglo seguro).
    const serviceIdsArr = Array.isArray(dto.serviceIds) ? dto.serviceIds : [];
    // useSingularFK: ¿guardamos el servicio en el campo SINGULAR serviceId?
    // Solo si: es tipo SERVICIO, hay un serviceId ("!!dto.serviceId" lo
    // convierte a true/false) y NO hay lista de varios (longitud 0).
    const useSingularFK = dto.type === 'SERVICIO' && !!dto.serviceId && serviceIdsArr.length === 0;
    // Creamos el registro en la tabla reward con todos sus campos.
    const reward = await this.prisma.reward.create({
      data: {
        tenantId,                       // a qué negocio pertenece.
        name: dto.name,                 // nombre.
        description: dto.description,    // descripción (puede ser undefined).
        type: dto.type,                 // SERVICIO | DESCUENTO | TWO_FOR_ONE.
        pointsRequired: dto.pointsRequired, // costo en puntos.
        // Guardamos serviceId SOLO si useSingularFK es true; si no, null.
        serviceId: useSingularFK ? dto.serviceId : null,
        serviceIds: serviceIdsArr,      // lista de servicios (puede ir vacía).
        // discountAmount y discountMode solo tienen sentido en DESCUENTO; para
        // otros tipos los dejamos en null con un ternario (condición ? sí : no).
        discountAmount:
          dto.type === 'DESCUENTO' ? dto.discountAmount : null,
        discountMode: dto.type === 'DESCUENTO' ? dto.discountMode : null,
        // "dto.code || null": si code es vacío/undefined (falsy), guardamos null.
        code: dto.code || null,
        // "??" (nullish coalescing): usa el valor de la izquierda salvo que sea
        // null/undefined; en ese caso usa null. (A diferencia de "||", aquí un 0
        // SÍ se respeta, no se considera "vacío".)
        minAmount: dto.minAmount ?? null,
        // Si no se especifica allowPointPayment, por defecto true.
        allowPointPayment: dto.allowPointPayment ?? true,
        // Convertimos los textos de fecha a objetos Date; si no vinieron, null.
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        // Por defecto la recompensa se crea activa.
        isActive: dto.isActive ?? true,
        maxRedemptions: dto.maxRedemptions, // máximo de canjes (puede ser undefined).
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
      include: {
        // Tras crearla, traemos también su servicio (id, nombre, precio).
        service: { select: { id: true, name: true, price: true } },
      },
    });

    // Registramos la creación en la bitácora de auditoría. "reward as any" es un
    // truco de TypeScript para pasar el objeto sin choques de tipos.
    await this.audit.log({
      tenantId,
      userId,
      action: 'reward.created', // qué acción ocurrió.
      entityType: 'Reward',     // sobre qué tipo de entidad.
      entityId: reward.id,      // sobre qué registro concreto.
      newValues: reward as any, // estado nuevo (para el historial).
    });

    return { data: reward };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update(): actualiza una recompensa existente con SOLO los campos enviados.
  // ───────────────────────────────────────────────────────────────────────────
  async update(
    tenantId: string,
    id: string,
    dto: UpdateRewardDto,
    userId?: string,
  ) {
    // Buscamos la recompensa actual (y comprobamos que sea de este negocio).
    const existing = await this.prisma.reward.findFirst({
      where: { id, tenantId },
    });
    // Si no existe -> error 404.
    if (!existing) throw new NotFoundException('Reward not found');

    // Si cambian el tipo a SERVICIO con un serviceId, validamos ese servicio
    // igual que en create() (que exista, sea del negocio y esté activo).
    if (dto.type === 'SERVICIO' && dto.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, tenantId, isActive: true },
      });
      if (!service) throw new BadRequestException('Service not found');
    }

    // Actualizamos la fila. La técnica clave aquí es el "spread condicional":
    //   ...(condición && { campo: valor })
    // Si la condición es VERDADERA, se "esparce" (...) el objeto { campo: valor }
    // dentro del data y ese campo se actualiza. Si es FALSA, "&&" da false y al
    // esparcir un false NO se añade nada: así SOLO tocamos los campos enviados
    // (cuyo valor en el dto es distinto de undefined) y dejamos el resto igual.
    const reward = await this.prisma.reward.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.pointsRequired !== undefined && {
          pointsRequired: dto.pointsRequired,
        }),
        ...(dto.serviceId !== undefined && { serviceId: dto.serviceId }),
        ...(dto.serviceIds !== undefined && {
          // Saneamos la lista: si no es un arreglo, guardamos uno vacío.
          serviceIds: Array.isArray(dto.serviceIds) ? dto.serviceIds : [],
        }),
        ...(dto.discountAmount !== undefined && {
          discountAmount: dto.discountAmount,
        }),
        ...(dto.discountMode !== undefined && {
          discountMode: dto.discountMode,
        }),
        // Para code, si llega vacío ("") lo guardamos como null (|| null).
        ...(dto.code !== undefined && { code: dto.code || null }),
        ...(dto.minAmount !== undefined && { minAmount: dto.minAmount }),
        ...(dto.allowPointPayment !== undefined && {
          allowPointPayment: dto.allowPointPayment,
        }),
        ...(dto.startDate !== undefined && {
          // Texto a Date; si viene vacío, null.
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.maxRedemptions !== undefined && {
          maxRedemptions: dto.maxRedemptions,
        }),
        ...(dto.validUntil !== undefined && {
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        }),
      },
      include: {
        service: { select: { id: true, name: true, price: true } },
      },
    });

    // Auditamos el cambio guardando el estado anterior y el nuevo, para poder
    // comparar qué cambió.
    await this.audit.log({
      tenantId,
      userId,
      action: 'reward.updated',
      entityType: 'Reward',
      entityId: id,
      oldValues: existing as any, // cómo estaba antes.
      newValues: reward as any,   // cómo quedó.
    });

    return { data: reward };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // remove(): "borrado lógico". No elimina la fila; la marca como inactiva
  // (isActive: false) para conservar el historial de canjes asociados.
  // ───────────────────────────────────────────────────────────────────────────
  async remove(tenantId: string, id: string, userId?: string) {
    // Verificamos que la recompensa exista y sea de este negocio.
    const existing = await this.prisma.reward.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Reward not found');

    // En vez de delete, hacemos update poniendo isActive en false.
    await this.prisma.reward.update({
      where: { id },
      data: { isActive: false },
    });

    // Auditamos la desactivación.
    await this.audit.log({
      tenantId,
      userId,
      action: 'reward.deactivated',
      entityType: 'Reward',
      entityId: id,
    });

    return { data: { message: 'Reward deactivated' } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // markCouponUsed(): marca un cupón como USADO cuando el cliente lo presenta.
  // Busca el cupón por su código, valida su estado y lo sella como usado.
  // ───────────────────────────────────────────────────────────────────────────
  async markCouponUsed(tenantId: string, code: string, userId?: string) {
    // Buscamos el canje (RewardRedemption) por su código dentro del negocio.
    // "include: { reward: true }" trae también la recompensa completa asociada.
    const redemption = await this.prisma.rewardRedemption.findFirst({
      where: { code, tenantId },
      include: { reward: true },
    });
    // Si no hay cupón con ese código -> 404.
    if (!redemption) throw new NotFoundException('Coupon not found');
    // No se puede usar dos veces: si ya está USED -> 400.
    if (redemption.status === 'USED') {
      throw new BadRequestException('Coupon already used');
    }
    // Tampoco si ya caducó (EXPIRED) -> 400.
    if (redemption.status === 'EXPIRED') {
      throw new BadRequestException('Coupon is expired');
    }

    // Marcamos el cupón como USED y guardamos cuándo se usó (usedAt = ahora).
    const updated = await this.prisma.rewardRedemption.update({
      where: { id: redemption.id },
      data: { status: 'USED', usedAt: new Date() },
      include: {
        reward: { select: { name: true, type: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    });

    // Auditamos el uso del cupón.
    await this.audit.log({
      tenantId,
      userId,
      action: 'reward.coupon_used',
      entityType: 'RewardRedemption',
      entityId: redemption.id,
      newValues: { code, rewardName: redemption.reward.name } as any,
    });

    return { data: updated };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getRedemptions(): lista (paginada) los canjes de UNA recompensa concreta.
  // ───────────────────────────────────────────────────────────────────────────
  async getRedemptions(
    tenantId: string,
    rewardId: string,
    query: { page?: number; perPage?: number },
  ) {
    // Misma lógica de paginación que findAll: page >= 1, perPage entre 1 y 100,
    // y skip = cuántos registros saltar para llegar a la página pedida.
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    // Filtro: canjes de este negocio Y de esta recompensa en concreto.
    const where = { tenantId, rewardId };

    // En paralelo: la página de canjes y el total que cumplen el filtro.
    const [data, total] = await Promise.all([
      this.prisma.rewardRedemption.findMany({
        where,
        include: {
          // De cada canje traemos datos básicos del cliente.
          client: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' }, // más recientes primero.
        skip,
        take: perPage,
      }),
      this.prisma.rewardRedemption.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // giftReward(): REGALA una recompensa a un cliente sin que gaste puntos
  // (pointsSpent: 0). Genera un cupón con código único y 30 días de validez.
  // ───────────────────────────────────────────────────────────────────────────
  async giftReward(tenantId: string, rewardId: string, clientId: string, userId: string) {
    // Verificamos que la recompensa exista en este negocio.
    const reward = await this.prisma.reward.findFirst({
      where: { id: rewardId, tenantId },
    });
    if (!reward) throw new NotFoundException('Recompensa no encontrada');

    // Verificamos que el cliente exista en este negocio.
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    // ── GENERACIÓN DEL CÓDIGO DE CUPÓN ──
    // "chars" es el alfabeto permitido. OJO: NO incluye caracteres ambiguos
    // (la letra O y el 0, la I/L y el 1) para que el código sea fácil de leer
    // y teclear sin confusiones.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = ''; // empezamos con texto vacío y le iremos pegando caracteres.
    // Bucle: 8 vueltas (i de 0 a 7) => el código tendrá 8 caracteres.
    for (let i = 0; i < 8; i++) {
      // Math.random() da un decimal entre 0 y 1 (sin llegar a 1).
      // Multiplicado por chars.length nos da un número dentro del rango del
      // alfabeto; Math.floor lo redondea hacia abajo para obtener un índice
      // entero válido; charAt(...) toma el carácter en esa posición y lo pega.
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Calculamos la fecha de caducidad: hoy + 30 días.
    const expiresAt = new Date();              // ahora.
    expiresAt.setDate(expiresAt.getDate() + 30); // avanza 30 días (gestiona el cambio de mes).

    // Creamos la fila del cupón (RewardRedemption) en estado ACTIVE.
    const redemption = await this.prisma.rewardRedemption.create({
      data: {
        tenantId,
        rewardId,
        clientId,
        // El cupón regalado pertenece al mismo perfil que el client (si tiene).
        profileId: client.profileId,
        pointsSpent: 0, // 0 porque es un REGALO (no consumió puntos).
        code,           // el código generado arriba.
        expiresAt,      // caduca en 30 días.
        status: 'ACTIVE',
      },
      include: {
        reward: { select: { name: true, type: true, discountAmount: true, discountMode: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    });

    // Auditamos el regalo. La plantilla de texto `${...}` une nombre y apellido
    // del cliente en una sola cadena legible.
    await this.audit.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'RewardRedemption',
      entityId: redemption.id,
      newValues: { giftedTo: `${client.firstName} ${client.lastName}`, reward: reward.name, code },
    });

    return { data: redemption };
  }

  // Valida un codigo publico de cupon (uso interno, tipico para cajeros
  // que ingresan el codigo manual en POS). Devuelve el reward si esta
  // vigente y dentro de maxRedemptions. Equivalente al viejo
  // PromotionsService.validateCode.
  // ───────────────────────────────────────────────────────────────────────────
  // validateCode(): comprueba si un código de cupón es válido AHORA (vigente y
  // con canjes disponibles) SIN consumir nada. Devuelve la recompensa si pasa
  // todas las verificaciones; si no, lanza el error correspondiente.
  // ───────────────────────────────────────────────────────────────────────────
  async validateCode(tenantId: string, code: string) {
    // Rechazamos si no hay código. ".trim()" quita espacios al inicio/fin; si
    // tras quitarlos queda vacío, el "!" lo hace true => código requerido.
    // El "||" exige que el código no sea falsy NI quede vacío tras recortarlo.
    if (!code || !code.trim()) {
      throw new BadRequestException('Código requerido');
    }
    // Buscamos una recompensa ACTIVA con ese código (recortado) en el negocio.
    const reward = await this.prisma.reward.findFirst({
      where: { tenantId, code: code.trim(), isActive: true },
      include: { service: { select: { id: true, name: true } } },
    });
    // Si no existe ninguna -> 404.
    if (!reward) {
      throw new NotFoundException('Código no válido');
    }
    const now = new Date(); // momento actual, para comparar fechas de vigencia.
    // Si tiene fecha de inicio y esa fecha es FUTURA (> now), aún no empieza.
    if (reward.startDate && reward.startDate > now) {
      throw new BadRequestException('Este cupón aún no está vigente');
    }
    // Si tiene fecha de fin y ya PASÓ (< now), expiró.
    if (reward.endDate && reward.endDate < now) {
      throw new BadRequestException('Este cupón ya expiró');
    }
    // validUntil es otra fecha de caducidad (del cupón individual); misma idea.
    if (reward.validUntil && reward.validUntil < now) {
      throw new BadRequestException('Este cupón ya expiró');
    }
    // Si tiene un tope de canjes y ya se alcanzó (timesRedeemed >= máximo),
    // no quedan usos disponibles. ">=" es "mayor o igual".
    if (reward.maxRedemptions && reward.timesRedeemed >= reward.maxRedemptions) {
      throw new BadRequestException('Este cupón alcanzó el máximo de canjes');
    }
    // Pasó todas las validaciones: devolvemos la recompensa.
    return { data: reward };
  }

  // Retira/elimina un RewardRedemption emitido. Reglas:
  // - status === 'USED' -> rechazado (el cliente ya consumio el cupon).
  // - Si fue canje por puntos (pointsSpent > 0), devolvemos esos puntos al
  //   loyalty_points del cliente para que la operacion sea reversible.
  // - Si fue regalo (pointsSpent === 0), simplemente se elimina.
  // - Si el reward tenia timesRedeemed > 0 derivado de este redemption, lo
  //   decrementamos para que no afecte maxRedemptions.
  // - Audit log antes de borrar (mantiene trazabilidad aunque la fila se vaya).
  // ───────────────────────────────────────────────────────────────────────────
  // removeRedemption(): retira un cupón YA emitido. Si fue canje por puntos,
  // DEVUELVE esos puntos al cliente (operación reversible). Ver reglas arriba.
  // ───────────────────────────────────────────────────────────────────────────
  async removeRedemption(
    tenantId: string,
    redemptionId: string,
    userId: string,
  ) {
    // Buscamos el cupón con los datos que necesitaremos: su recompensa y su
    // cliente (incluyendo loyaltyPoints, el saldo de puntos del cliente).
    const redemption = await this.prisma.rewardRedemption.findFirst({
      where: { id: redemptionId, tenantId },
      include: {
        reward: { select: { id: true, name: true } },
        client: { select: { id: true, firstName: true, lastName: true, loyaltyPoints: true } },
      },
    });
    if (!redemption) throw new NotFoundException('Cupón no encontrado');
    // No se puede retirar un cupón YA usado por el cliente.
    if (redemption.status === 'USED') {
      throw new BadRequestException(
        'No se puede eliminar un cupón que ya fue usado por el cliente',
      );
    }

    // Audit ANTES del delete para que el snapshot quede aunque la fila se vaya
    // Guardamos una "foto" del cupón en la bitácora antes de borrarlo, para no
    // perder la trazabilidad. "refunded" indica si se devolverán puntos
    // (true cuando pointsSpent > 0, es decir, cuando fue un canje y no un regalo).
    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'RewardRedemption',
      entityId: redemption.id,
      newValues: {
        code: redemption.code,
        reward: redemption.reward.name,
        client: `${redemption.client.firstName} ${redemption.client.lastName}`,
        pointsSpent: redemption.pointsSpent,
        status: redemption.status,
        refunded: redemption.pointsSpent > 0,
      },
    });

    // ── TRANSACCIÓN ──
    // $transaction agrupa varias operaciones para que se ejecuten "todo o nada":
    // si alguna falla, se deshacen todas (rollback). Así evitamos estados a
    // medias (p. ej. devolver puntos pero no borrar el cupón). Dentro usamos
    // "tx" en vez de "this.prisma" para que las escrituras formen parte de la
    // misma transacción.
    await this.prisma.$transaction(async (tx) => {
      // Si el cupón se obtuvo gastando puntos, los DEVOLVEMOS al cliente.
      // "increment" suma de forma atómica al saldo actual (sin condiciones de
      // carrera): loyaltyPoints += pointsSpent.
      if (redemption.pointsSpent > 0) {
        await tx.client.update({
          where: { id: redemption.client.id },
          data: { loyaltyPoints: { increment: redemption.pointsSpent } },
        });
      }
      // Revertir contador de canjes del reward (si llego a contarse)
      // "decrement: 1" resta 1 al contador timesRedeemed de la recompensa.
      await tx.reward.update({
        where: { id: redemption.reward.id },
        data: { timesRedeemed: { decrement: 1 } },
      }).catch(() => {
        // Si timesRedeemed ya esta en 0 algunos DBs fallan; ignorable.
        // .catch(() => {}) "traga" ese error para que no rompa la transacción.
      });
      // Finalmente, borramos la fila del cupón.
      await tx.rewardRedemption.delete({ where: { id: redemption.id } });
    });

    // Respondemos con el id retirado y cuántos puntos se devolvieron (0 si era
    // un regalo, porque pointsSpent era 0).
    return {
      data: {
        id: redemption.id,
        refunded: redemption.pointsSpent > 0 ? redemption.pointsSpent : 0,
      },
    };
  }

  // Listado de cupones (RewardRedemption) del tenant con filtros para el
  // dashboard de admin. Distingue origen (gift vs canje), status, y permite
  // filtrar por fecha de expiracion o de creacion.
  // ───────────────────────────────────────────────────────────────────────────
  // listRedemptions(): historial completo de cupones del negocio con MUCHOS
  // filtros opcionales. Además devuelve un resumen de contadores globales.
  // ───────────────────────────────────────────────────────────────────────────
  async listRedemptions(
    tenantId: string,
    query: {
      page?: number;
      perPage?: number;
      status?: string; // ACTIVE | USED | EXPIRED
      source?: 'GIFT' | 'REDEEM'; // GIFT = pointsSpent=0; REDEEM = pointsSpent>0
      expiresFrom?: string; // ISO date
      expiresTo?: string;
      createdFrom?: string;
      createdTo?: string;
      clientId?: string;
      rewardId?: string;
      search?: string; // busca en firstName/lastName/email del cliente y nombre del reward
    },
  ) {
    // Paginación (igual que en los demás métodos de listado).
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    // Construimos el filtro "where" paso a paso, partiendo del tenant.
    const where: any = { tenantId };
    // Filtro por estado, pero SOLO si es uno de los válidos. includes(...)
    // comprueba que query.status esté dentro de la lista permitida.
    if (query.status && ['ACTIVE', 'USED', 'EXPIRED'].includes(query.status)) {
      where.status = query.status;
    }
    // Filtro por origen del cupón:
    //   - GIFT (regalo): pointsSpent es exactamente 0.
    //   - REDEEM (canje): pointsSpent > 0 ("gt" = greater than, mayor que).
    if (query.source === 'GIFT') {
      where.pointsSpent = 0;
    } else if (query.source === 'REDEEM') {
      where.pointsSpent = { gt: 0 };
    }
    // Filtro por rango de fecha de EXPIRACIÓN. Solo entramos si vino al menos
    // una de las dos fechas (el "||" es "o").
    if (query.expiresFrom || query.expiresTo) {
      where.expiresAt = {}; // objeto donde acumularemos los límites gte/lte.
      // "gte" = greater-than-or-equal (>=): expira a partir de esta fecha.
      if (query.expiresFrom) where.expiresAt.gte = new Date(query.expiresFrom);
      if (query.expiresTo) {
        // incluye todo el dia "expiresTo"
        // Ajustamos la hora al final del día (23:59:59.999) para que el filtro
        // incluya cupones que expiran en CUALQUIER momento de ese día.
        const to = new Date(query.expiresTo);
        to.setHours(23, 59, 59, 999);
        where.expiresAt.lte = to; // "lte" = less-than-or-equal (<=).
      }
    }
    // Mismo patrón para el rango de fecha de CREACIÓN.
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) where.createdAt.gte = new Date(query.createdFrom);
      if (query.createdTo) {
        const to = new Date(query.createdTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }
    // Filtros directos por cliente y por recompensa (si vinieron).
    if (query.clientId) where.clientId = query.clientId;
    if (query.rewardId) where.rewardId = query.rewardId;
    // Búsqueda libre de texto.
    if (query.search) {
      const s = query.search.trim(); // recortamos espacios.
      if (s) {
        // OR = se cumple si CUALQUIERA de estas condiciones coincide. "contains"
        // busca el texto "s" como subcadena (coincidencia parcial). Buscamos en
        // nombre/apellido/email del cliente, en el nombre del reward y en el
        // código del propio cupón.
        where.OR = [
          { client: { firstName: { contains: s } } },
          { client: { lastName: { contains: s } } },
          { client: { email: { contains: s } } },
          { reward: { name: { contains: s } } },
          { code: { contains: s } },
        ];
      }
    }

    // En paralelo: la página de cupones y el total que cumplen el filtro.
    const [data, total] = await Promise.all([
      // 1) findMany: la página de cupones con datos relacionados ricos.
      this.prisma.rewardRedemption.findMany({
        where,
        include: {
          // De la recompensa traemos lo necesario para mostrar la tarjeta.
          reward: {
            select: {
              id: true,
              name: true,
              type: true,
              discountAmount: true,
              discountMode: true,
              pointsRequired: true,
              service: { select: { id: true, name: true } },
            },
          },
          // Datos del cliente, incluyendo su avatar.
          client: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          // Si el cupón se usó en una cita, traemos su id y hora de inicio.
          appointment: { select: { id: true, startTime: true } },
        },
        orderBy: { createdAt: 'desc' }, // más recientes primero.
        skip,
        take: perPage,
      }),
      // 2) count: total de cupones que cumplen el filtro (para la paginación).
      this.prisma.rewardRedemption.count({ where }),
    ]);

    // Resumen del tenant (totales sin filtros, sirven como contadores
    // permanentes en el header del historial).
    // Estos 6 conteos/sumas usan SOLO tenantId (ignoran los filtros de arriba),
    // por eso son "contadores permanentes". Se calculan todos en paralelo.
    const [totalAll, totalActive, totalUsed, totalExpired, totalGifts, pointsAgg] = await Promise.all([
      this.prisma.rewardRedemption.count({ where: { tenantId } }),                       // todos.
      this.prisma.rewardRedemption.count({ where: { tenantId, status: 'ACTIVE' } }),     // activos.
      this.prisma.rewardRedemption.count({ where: { tenantId, status: 'USED' } }),       // usados.
      this.prisma.rewardRedemption.count({ where: { tenantId, status: 'EXPIRED' } }),    // expirados.
      this.prisma.rewardRedemption.count({ where: { tenantId, pointsSpent: 0 } }),       // regalos (0 puntos).
      // Total de puntos que los clientes han gastado canjeando cupones.
      // Es la suma de pointsSpent de TODAS las redemptions (regalos suman 0).
      // aggregate con _sum suma la columna pointsSpent de todas las filas.
      this.prisma.rewardRedemption.aggregate({
        where: { tenantId },
        _sum: { pointsSpent: true },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        // summary: el bloque de contadores globales para la cabecera del panel.
        summary: {
          totalAll,
          totalActive,
          totalUsed,
          totalExpired,
          totalGifts,
          // Canjes (no regalos) = total menos los regalos.
          totalRedeemed: totalAll - totalGifts,
          // Suma de puntos gastados. "?? 0" usa 0 si la suma fuera null (cuando
          // no hay ninguna fila, aggregate puede devolver null).
          totalPointsSpent: pointsAgg._sum.pointsSpent ?? 0,
        },
      },
    };
  }
}
