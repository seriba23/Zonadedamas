// ─────────────────────────────────────────────────────────────────────────────
// SERVICIO PRINCIPAL del sistema de códigos de creador. Aquí vive la lógica de:
// listar/ver/crear/editar influencers, aprobarlos (generando su código único),
// suspender/reactivar/borrar, dar acceso al panel (contraseña o link), y enlazar
// con Stripe Connect para que puedan cobrar comisiones.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Injectable,           // marca la clase como servicio inyectable.
  NotFoundException,    // error -> HTTP 404 (no encontrado).
  BadRequestException,  // error -> HTTP 400 (petición inválida).
  ConflictException,    // error -> HTTP 409 (conflicto, p. ej. duplicado).
} from '@nestjs/common';
// bcrypt: librería para "hashear" contraseñas (guardarlas cifradas, no en claro).
// "* as bcrypt" importa todo el módulo bajo el nombre bcrypt.
import * as bcrypt from 'bcrypt';
// randomBytes: genera bytes aleatorios (lo usamos para contraseñas y tokens).
import { randomBytes } from 'crypto';
// PrismaService: puente hacia la base de datos.
import { PrismaService } from '../../prisma/prisma.service';
// StripeService: integración con Stripe (cuentas Connect, links, transfers).
import { StripeService } from '../stripe/stripe.service';
// NotifyStaffService: crea notificaciones en la consola del staff (y dispara push).
// Lo usamos para el aviso DORADO "ahora eres creador" al aprobar.
import { NotifyStaffService } from '../staff-notifications/notify-staff.service';
// DTOs de validación para crear/actualizar.
import { CreateInfluencerDto, UpdateInfluencerDto } from './dto/influencer.dto';
// Helpers del archivo de configuración: estado del referido y meses transcurridos.
import { referralState, monthsBetween } from './creator-codes.config';

@Injectable() // <- servicio inyectable de NestJS.
export class CreatorCodesService {
  // El constructor recibe (inyectados por NestJS) el acceso a la base de datos y
  // el servicio de Stripe. Quedan como this.prisma y this.stripe (solo lectura).
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly notifyStaff: NotifyStaffService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // notifyCreatorApproved(): tras aprobar a un creador, avisamos (con una
  // notificación DORADA) al usuario REAL de Siliba que tiene el MISMO correo.
  // Como User.email es único a nivel global, un correo = exactamente una cuenta,
  // que puede entrar como cliente / profesional / administrador. La notificación
  // se guarda por (tenantId + userId), así que aparece en TODAS las consolas de
  // staff de esa persona (profesional, freelancer, admin) donde ya inició sesión.
  //
  // Es "best-effort": si algo falla aquí (o el correo no corresponde a una cuenta
  // de staff), NO debe romper la aprobación. Por eso quien la llama la envuelve
  // en un catch.
  // ───────────────────────────────────────────────────────────────────────────
  private async notifyCreatorApproved(email: string) {
    const normalized = (email || '').toLowerCase().trim();
    if (!normalized) return;
    // Buscamos la cuenta real de Siliba con ese correo.
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, tenantId: true },
    });
    // Sin cuenta, o sin tenant (p. ej. solo cliente del marketplace): no hay
    // consola de staff donde mostrar la notificación. El creador podrá entrar
    // igualmente desde el acceso "Creadores" del login.
    if (!user?.tenantId) return;

    await this.notifyStaff.notify({
      tenantId: user.tenantId,
      // Solo a esta persona (la recién aprobada), no a todos los admins.
      audience: { kind: 'users', userIds: [user.id] },
      type: 'creator.approved',
      section: 'creator',
      title: '¡Ya eres parte de Creadores Siliba!',
      body: 'Tu solicitud fue aprobada. Toca para ver cómo funcionan las comisiones y entrar a tu portal de creadores.',
      // Deep-link a la pantalla de bienvenida (modal dorado + comisiones + SSO).
      link: '/creator/welcome',
      metadata: { kind: 'creator_approved' },
    });
  }

  // ─── LISTADO ──────────────────────────────────────

  // listInfluencers: devuelve una lista PAGINADA de influencers con filtros.
  // "filters" es un objeto con campos opcionales (todos llevan "?").
  async listInfluencers(filters: {
    page?: number;
    perPage?: number;
    status?: string;
    search?: string;
  }) {
    // "filters.page || 1": si page viene vacío/0/undefined, usamos 1 por defecto.
    const page = filters.page || 1;
    // perPage por defecto 20, pero NUNCA más de 100 (Math.min toma el menor de
    // los dos) para no devolver demasiados registros de golpe.
    const perPage = Math.min(filters.perPage || 20, 100);
    // skip = cuántos registros saltar para llegar a la página pedida.
    // Página 1 -> salta 0; página 2 -> salta perPage; etc.
    const skip = (page - 1) * perPage;

    // "where" = objeto con las condiciones de búsqueda para Prisma. Empieza vacío
    // (sin filtros). El tipo "any" evita conflictos de tipos al irlo armando.
    const where: any = {};
    // Solo aplicamos el filtro de estado si es uno de los valores válidos.
    if (
      filters.status === 'PENDING' ||
      filters.status === 'APPROVED' ||
      filters.status === 'SUSPENDED'
    ) {
      where.status = filters.status;
    }
    // Si hay texto de búsqueda, construimos un OR: coincide si el texto aparece
    // en CUALQUIERA de estos campos. "contains" = "contiene" (búsqueda parcial).
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search } }, // por nombre
        { lastName: { contains: filters.search } },  // por apellido
        { email: { contains: filters.search } },     // por email
        // "codes: { some: ... }" = el influencer tiene AL MENOS UN código cuyo
        // texto contenga la búsqueda. "some" en Prisma = "existe alguno que...".
        { codes: { some: { code: { contains: filters.search } } } },
      ];
    }

    // Promise.all ejecuta las DOS consultas EN PARALELO (más rápido que una tras
    // otra) y espera a que ambas terminen. Desestructuramos su resultado en:
    //   - influencers: la página actual de registros.
    //   - total: el número total de registros que cumplen el filtro.
    const [influencers, total] = await Promise.all([
      this.prisma.influencer.findMany({
        where,            // condiciones de filtro
        skip,             // cuántos saltar (paginación)
        take: perPage,    // cuántos traer (tamaño de página)
        // orderBy: ordena primero por estado ascendente, y dentro de cada estado
        // por fecha de creación descendente (los más nuevos primero).
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          // De cada influencer traemos SUS códigos, pero solo los activos.
          codes: {
            where: { isActive: true },
            select: { id: true, code: true, createdAt: true },
          },
          // "_count" = conteos rápidos: cuántos códigos y cuántos payouts tiene,
          // sin traer todos esos registros (solo el número).
          _count: { select: { codes: true, payouts: true } },
        },
      }),
      this.prisma.influencer.count({ where }), // total con el mismo filtro
    ]);

    return {
      // map() recorre cada influencer (inf) y lo transforma en un objeto "limpio"
      // con solo los campos que el frontend necesita. Recorre TODA la lista.
      data: influencers.map((inf) => ({
        id: inf.id,
        email: inf.email,
        firstName: inf.firstName,
        lastName: inf.lastName,
        phone: inf.phone,
        status: inf.status,
        approvedAt: inf.approvedAt,
        stripeOnboardingComplete: inf.stripeOnboardingComplete,
        notes: inf.notes,
        createdAt: inf.createdAt,
        // "inf.codes[0]?.code ?? null":
        //   inf.codes[0] = el primer código activo (si existe).
        //   "?." evita error si no hay códigos (devuelve undefined).
        //   "?? null" (nullish coalescing): si lo anterior es null/undefined,
        //   usa null. Resultado: el código activo, o null si no tiene.
        activeCode: inf.codes[0]?.code ?? null,
        codesCount: inf._count.codes,     // total de códigos (del conteo)
        payoutsCount: inf._count.payouts, // total de comisiones (del conteo)
      })),
      // meta: datos de paginación. totalPages = total / perPage redondeado hacia
      // arriba (Math.ceil) para incluir la última página aunque esté incompleta.
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  }

  // getInfluencerDetail: arma la vista DETALLADA de un influencer: sus datos,
  // sus códigos, los clientes (negocios) que ha referido con su estado, y el
  // resumen de comisiones (acumuladas, pagadas y pendientes).
  async getInfluencerDetail(id: string) {
    // Buscamos al influencer por id, incluyendo sus códigos y, dentro de cada
    // código, sus "usages" (cada vez que un negocio usó ese código al registrarse).
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
      include: {
        codes: {
          orderBy: { createdAt: 'desc' }, // códigos más nuevos primero
          include: { usages: true },      // y los usos de cada código
        },
      },
    });
    // Si no existe -> 404.
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    const now = new Date(); // momento actual, base para los cálculos de estado.

    // Todos los usos de todos los códigos del influencer
    // flatMap = map + aplanar. Recorre cada código (c), de él saca su lista de
    // usos (c.usages.map(...)) añadiéndoles el texto del código, y luego une
    // todas esas listas en UNA sola lista plana.
    // "{ ...u, code: c.code }" copia todos los campos del uso (u) y le agrega el
    // campo "code" (el spread "..." copia las propiedades de un objeto).
    const usages = influencer.codes.flatMap((c) =>
      c.usages.map((u) => ({ ...u, code: c.code })),
    );
    // Lista de los ids de los negocios referidos (uno por cada uso).
    const tenantIds = usages.map((u) => u.tenantId);

    // Tenants referidos (no hay relación FK directa → lookup por ids)
    // "tenantIds.length ? ... : []": si hay ids, buscamos esos negocios; si la
    // lista está vacía, devolvemos [] sin consultar la base de datos.
    const tenants = tenantIds.length
      ? await this.prisma.tenant.findMany({
          // "id: { in: tenantIds }" = trae los tenants cuyo id esté DENTRO de la
          // lista (operador Prisma "in" = "está en este conjunto").
          where: { id: { in: tenantIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            tenantType: true,
            // De cada negocio también queremos el estado de su suscripción.
            subscription: { select: { status: true, cancelledAt: true } },
          },
        })
      : [];
    // tenantMap = un Map (diccionario) id->tenant para buscar un negocio por su
    // id en O(1) (instantáneo) en vez de recorrer la lista cada vez.
    // tenants.map(t => [t.id, t]) crea pares [clave, valor] que el Map usa.
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    // Comisiones agrupadas por uso
    // Traemos TODAS las comisiones (payouts) de este influencer, mes más reciente
    // primero.
    const payouts = await this.prisma.creatorPayout.findMany({
      where: { influencerId: id },
      orderBy: { forMonth: 'desc' },
    });
    // paidByUsage = mapa usageId -> { count, sum }: por cada cliente referido,
    // cuántas comisiones y cuánto dinero suman.
    const paidByUsage = new Map<string, { count: number; sum: number }>();
    let totalAccrued = 0; // total devengado (todo lo generado, pagado o no)
    let totalPaid = 0;    // total ya transferido al influencer
    let totalPending = 0; // total pendiente de transferir
    // Recorremos cada comisión (p) para sumar los totales y agruparlas por uso.
    for (const p of payouts) {
      // p.amount puede venir como Decimal/string de Prisma; Number(...) lo
      // convierte a número JavaScript para poder sumarlo.
      const amount = Number(p.amount);
      totalAccrued += amount; // siempre suma al total devengado
      // Si tiene fecha de transferencia, ya se pagó; si no, está pendiente.
      if (p.transferredAt) totalPaid += amount;
      else totalPending += amount;
      // cur = el acumulado actual de ESTE uso, o uno nuevo en cero si es la
      // primera comisión que vemos para ese uso.
      const cur = paidByUsage.get(p.usageId) || { count: 0, sum: 0 };
      cur.count += 1;     // una comisión más para este uso
      cur.sum += amount;  // sumamos su monto
      paidByUsage.set(p.usageId, cur); // guardamos el acumulado actualizado
    }

    // Clientes referidos con estado calculado
    // Recorremos cada uso (u) y armamos el objeto "cliente" para el frontend.
    const clients = usages.map((u) => {
      // Buscamos el negocio asociado a este uso en el mapa.
      const tenant = tenantMap.get(u.tenantId);
      // Su suscripción, o null si el negocio no existe / no tiene.
      const sub = tenant?.subscription ?? null;
      // Calculamos el estado (ACTIVO/PAGANDO/EN_RIESGO/PERDIDO) con el helper.
      const state = referralState(u, sub, now);
      // Las comisiones acumuladas de este uso (o cero si no tiene).
      const commissions = paidByUsage.get(u.id) || { count: 0, sum: 0 };
      return {
        usageId: u.id,
        tenantId: u.tenantId,
        // Si el negocio fue eliminado, mostramos un texto de relleno.
        tenantName: tenant?.name ?? '(negocio eliminado)',
        tenantSlug: tenant?.slug ?? null,
        code: u.code,
        appliedAt: u.appliedAt,
        // Cuántos meses lleva activo este referido (desde que aplicó el código).
        monthsActive: monthsBetween(u.appliedAt, now),
        subscriptionStatus: sub?.status ?? null,
        state,
        commissionsCount: commissions.count,
        commissionsSum: commissions.sum,
      };
    });

    // stateCounts = cuántos clientes hay en cada estado. reduce() recorre la
    // lista "clients" acumulando en "acc" (un objeto). Para cada cliente (c)
    // incrementa el contador de su estado.
    const stateCounts = clients.reduce(
      (acc, c) => {
        // "(acc[c.state] || 0) + 1": si aún no había contador para ese estado,
        // parte de 0 y le suma 1.
        acc[c.state] = (acc[c.state] || 0) + 1;
        return acc; // reduce exige devolver el acumulador en cada vuelta
      },
      {} as Record<string, number>, // valor inicial: objeto vacío estado->número
    );

    // Armamos la respuesta final con todo lo calculado arriba.
    return {
      data: {
        // Datos básicos del influencer.
        influencer: {
          id: influencer.id,
          email: influencer.email,
          firstName: influencer.firstName,
          lastName: influencer.lastName,
          phone: influencer.phone,
          status: influencer.status,
          notes: influencer.notes,
          stripeOnboardingComplete: influencer.stripeOnboardingComplete,
          createdAt: influencer.createdAt,
          approvedAt: influencer.approvedAt,
        },
        // Lista de sus códigos. map() recorre cada código y añade cuántos usos
        // tiene (c.usages.length = longitud de la lista de usos).
        codes: influencer.codes.map((c) => ({
          id: c.id,
          code: c.code,
          isActive: c.isActive,
          usagesCount: c.usages.length,
        })),
        clients, // los clientes referidos calculados arriba
        // Conteos por estado. "|| 0" asegura mostrar 0 si ese estado no apareció.
        stateCounts: {
          ACTIVO: stateCounts.ACTIVO || 0,
          PAGANDO: stateCounts.PAGANDO || 0,
          EN_RIESGO: stateCounts.EN_RIESGO || 0,
          PERDIDO: stateCounts.PERDIDO || 0,
        },
        // Totales financieros.
        totals: {
          referredClients: clients.length, // cantidad de referidos
          accrued: totalAccrued,           // total generado
          paid: totalPaid,                 // total ya pagado
          pending: totalPending,           // total pendiente
        },
        // Lista de comisiones individuales. map() recorre cada payout.
        payouts: payouts.map((p) => ({
          id: p.id,
          usageId: p.usageId,
          amount: Number(p.amount),
          forMonth: p.forMonth,
          // "!!p.transferredAt": doble negación. Convierte el valor a booleano
          // verdadero/falso: true si hay fecha de transferencia, false si es null.
          transferred: !!p.transferredAt,
          transferredAt: p.transferredAt,
          stripeTransferId: p.stripeTransferId,
        })),
      },
    };
  }

  // ─── ALTA / EDICIÓN ───────────────────────────────

  // createInfluencer: da de alta un influencer nuevo en estado PENDING (pendiente
  // de aprobación). adminId = quién lo crea (aquí no se guarda, pero se recibe).
  async createInfluencer(dto: CreateInfluencerDto, adminId: string) {
    // Normalizamos el email: a minúsculas (toLowerCase) y sin espacios sobrantes
    // al inicio/fin (trim). Así evitamos duplicados por mayúsculas o espacios.
    const email = dto.email.toLowerCase().trim();
    // ¿Ya existe alguien con ese email? El email es único por influencer.
    const existing = await this.prisma.influencer.findUnique({
      where: { email },
    });
    // Si existe -> error 409 (conflicto: duplicado).
    if (existing) {
      throw new ConflictException('Ya existe un influencer con ese email');
    }

    // Creamos el registro. trim() limpia espacios en cada texto.
    const influencer = await this.prisma.influencer.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        // "dto.phone?.trim() || null": si vino teléfono, lo limpiamos; si quedó
        // vacío o no vino, guardamos null (campo opcional).
        phone: dto.phone?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: 'PENDING', // todo influencer nace pendiente de aprobación
      },
    });

    return { data: influencer };
  }

  // updateInfluencer: edita los datos de un influencer existente.
  async updateInfluencer(id: string, dto: UpdateInfluencerDto) {
    // Verificamos que exista; si no, 404.
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    // Construimos "data" solo con los campos que SÍ vinieron en el DTO.
    // El patrón "...(cond && { campo: valor })" funciona así:
    //   - si "cond" es falsa, el "&&" devuelve false y el spread "...false" no
    //     agrega nada (se ignora).
    //   - si "cond" es verdadera, el "&&" devuelve el objeto { campo: valor } y
    //     el spread lo MEZCLA dentro de data.
    // Comparamos con "!== undefined" para distinguir "no enviado" (no tocar) de
    // "enviado vacío" (sí tocar, p. ej. borrar el teléfono poniéndolo en null).
    const updated = await this.prisma.influencer.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
      },
    });

    return { data: updated };
  }

  // ─── APROBACIÓN (genera código automático) ────────

  // approveInfluencer: aprueba a un influencer y, si aún no tiene, le genera su
  // código único. adminId = el super-admin que aprueba (queda registrado).
  async approveInfluencer(id: string, adminId: string) {
    // Lo buscamos incluyendo sus códigos ACTIVOS (para saber si ya tiene uno).
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
      include: { codes: { where: { isActive: true } } },
    });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    // Si ya está aprobado Y ya tiene al menos un código activo, no hay nada que
    // hacer -> error 400. (&& = "Y": ambas condiciones deben cumplirse.)
    if (influencer.status === 'APPROVED' && influencer.codes.length > 0) {
      throw new BadRequestException('El influencer ya está aprobado y tiene un código activo');
    }

    // Aprobar + generar código en una transacción
    // $transaction: ejecuta varias operaciones como un BLOQUE atómico. Si algo
    // falla a la mitad, se deshace TODO (no queda aprobado sin código, ni al
    // revés). "tx" es el cliente Prisma dentro de la transacción.
    const result = await this.prisma.$transaction(async (tx) => {
      // 1) Marcamos al influencer como APPROVED y guardamos cuándo y quién.
      const updated = await tx.influencer.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(), // fecha/hora actual de aprobación
          approvedBy: adminId,    // id del admin que aprobó
        },
      });

      // Si ya tiene un código activo (caso reactivación), no generar otro
      // "influencer.codes[0] ?? null": el primer código activo, o null si no hay.
      let code = influencer.codes[0] ?? null;
      if (!code) {
        // 2) Generamos un código único basado en su nombre (ver más abajo).
        const generated = await this.generateUniqueCode(tx, influencer.firstName);
        // 3) Lo guardamos en la tabla de códigos, ligado a este influencer.
        code = await tx.creatorCode.create({
          data: { code: generated, influencerId: id },
        });
      }

      // Devolvemos el influencer actualizado y su código (nuevo o existente).
      return { influencer: updated, code };
    });

    // Aviso DORADO al usuario real de Siliba con este correo (best-effort: si
    // falla o el correo no es de una cuenta de staff, la aprobación sigue válida).
    await this.notifyCreatorApproved(influencer.email).catch(() => {});

    return { data: result };
  }

  // suspendInfluencer: pone al influencer en estado SUSPENDED (inactivo).
  async suspendInfluencer(id: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');
    // Si ya estaba suspendido, no tiene sentido repetir la acción -> 400.
    if (influencer.status === 'SUSPENDED') {
      throw new BadRequestException('El influencer ya está suspendido');
    }

    const updated = await this.prisma.influencer.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    return { data: updated };
  }

  // reactivateInfluencer: vuelve a APPROVED un influencer que estaba suspendido.
  async reactivateInfluencer(id: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');
    // Solo se reactiva lo que está suspendido. "!==" = "distinto de".
    if (influencer.status !== 'SUSPENDED') {
      throw new BadRequestException('Solo se puede reactivar un influencer suspendido');
    }

    const updated = await this.prisma.influencer.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    return { data: updated };
  }

  // deleteInfluencer: elimina por completo a un influencer (con restricción).
  async deleteInfluencer(id: string) {
    // Lo buscamos contando cuántas comisiones (payouts) tiene asociadas.
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
      include: { _count: { select: { payouts: true } } },
    });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    // No permitir borrar si ya generó comisiones (historial financiero)
    // Si tiene 1 o más payouts, borrarlo perdería historial contable -> 400.
    if (influencer._count.payouts > 0) {
      throw new BadRequestException(
        'No se puede eliminar: el influencer ya tiene comisiones registradas. Suspéndelo en su lugar.',
      );
    }

    // Sin historial financiero: se puede borrar de forma segura.
    await this.prisma.influencer.delete({ where: { id } });
    return { data: { message: 'Influencer eliminado' } };
  }

  // ─── ACCESO AL PANEL (contraseña) ─────────────────

  /** Método 1: el super-admin genera una contraseña temporal y la comparte. */
  async generatePassword(id: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    // Contraseña legible: 3 bloques tipo "k7Pm-9QnX-2Rdy" (cumple regla 8+/núm/símbolo)
    // Paso a paso:
    //   - randomBytes(9): 9 bytes aleatorios.
    //   - .toString('base64'): los convierte a texto base64 (letras/números/+//=).
    //   - .replace(/[^a-zA-Z0-9]/g, ''): quita TODO lo que NO sea letra o número
    //     (el "^" dentro de [] significa "negación"; la "g" = global, todas las
    //     coincidencias). Así eliminamos símbolos raros de base64.
    //   - .slice(0, 9): toma los primeros 9 caracteres resultantes.
    const raw = randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 9);
    // Formateamos la contraseña en 3 bloques separados por "-" y "#" para que sea
    // fácil de leer/dictar y para garantizar que lleva un símbolo (#) y números.
    //   - raw.slice(0,4) primeros 4, raw.slice(4,8) siguientes 4.
    //   - "raw.slice(8) || '7'": el carácter 9; si por algo quedó vacío, usa '7'.
    const tempPassword = `${raw.slice(0, 4)}-${raw.slice(4, 8)}#${raw.slice(8) || '7'}`;
    // Hasheamos la contraseña con bcrypt (factor 12 = nivel de seguridad/costo).
    // En la base NUNCA se guarda la contraseña en claro, solo este hash.
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Guardamos el hash y anulamos cualquier link de invitación previo (esta vía
    // y la del link son excluyentes: al fijar contraseña, el link deja de valer).
    await this.prisma.influencer.update({
      where: { id },
      data: { passwordHash, inviteToken: null, inviteTokenExpiresAt: null },
    });

    // Devolvemos la contraseña EN CLARO una sola vez para que el admin la comparta
    // (no se podrá recuperar después, porque solo guardamos su hash).
    return { data: { tempPassword, email: influencer.email } };
  }

  /** Método 2: genera un link de invitación para que el influencer fije su contraseña. */
  async createInviteLink(id: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    // Token aleatorio de 24 bytes en hexadecimal (48 caracteres). Es el "secreto"
    // que viajará en el link y prueba que quien lo tiene fue invitado.
    const token = randomBytes(24).toString('hex');
    // Caduca en 7 días: Date.now() (ahora en ms) + 7*24h en ms.
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    // Guardamos el token y su caducidad en el influencer.
    await this.prisma.influencer.update({
      where: { id },
      data: { inviteToken: token, inviteTokenExpiresAt: expiresAt },
    });

    // Base de la URL del sitio (variable de entorno, o localhost en desarrollo).
    const base = process.env.WEB_URL || 'http://localhost:3000';
    // Armamos el link que el influencer abrirá para fijar su contraseña.
    const url = `${base}/creator/set-password?token=${token}`;
    return { data: { url, email: influencer.email, expiresAt } };
  }

  // ─── STRIPE CONNECT (cobro de comisiones) ─────────

  // createStripeOnboardingLink: pide a Stripe un link para que el influencer
  // configure su cuenta de cobros (Stripe Connect) y pueda recibir comisiones.
  async createStripeOnboardingLink(id: string, returnUrl: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');
    // Debe estar aprobado antes de poder configurar cobros.
    if (influencer.status !== 'APPROVED') {
      throw new BadRequestException(
        'El influencer debe estar aprobado antes de configurar sus cobros',
      );
    }

    // Delegamos a StripeService la creación de la cuenta Connect + el link.
    const result = await this.stripe.createInfluencerConnectLink(id, returnUrl);
    return { data: result };
  }

  // getStripeStatus: consulta en Stripe si el influencer ya completó su
  // onboarding (si su cuenta ya puede recibir transferencias).
  async getStripeStatus(id: string) {
    const result = await this.stripe.getInfluencerConnectStatus(id);
    return { data: result };
  }

  // ─── GENERACIÓN DE CÓDIGO ─────────────────────────

  /**
   * Genera un código único tipo "LUNA8X3K": hasta 4 letras del nombre +
   * 4 caracteres aleatorios. Sin caracteres ambiguos (0/O, 1/I/L).
   */
  // "private" = solo se usa dentro de esta clase. Recibe "tx" (el cliente Prisma
  // de la transacción, para que la comprobación de unicidad ocurra dentro de la
  // misma transacción de aprobación) y "firstName" (el nombre del influencer).
  // Devuelve una Promise<string> = el código generado (texto), de forma asíncrona.
  private async generateUniqueCode(
    tx: any,
    firstName: string,
  ): Promise<string> {
    // Letras permitidas (sin O, I, L, que se confunden con 0/1).
    const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    // Letras + números permitidos (sin 0/1 ni O/I/L) para la parte aleatoria.
    const alphanum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    // Prefijo: hasta 4 letras del nombre (sin ambiguas), completado al azar
    // Encadenamos transformaciones sobre el nombre:
    //   - toUpperCase(): todo a MAYÚSCULAS.
    //   - replace(/[^A-Z]/g, ''): quita lo que NO sea letra A-Z (acentos, números,
    //     espacios). El "^" niega; "g" = todas las coincidencias.
    //   - replace(/[OIL]/g, ''): quita además las letras ambiguas O, I, L.
    //   - slice(0, 4): se queda con las primeras 4 letras como máximo.
    let base = firstName
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .replace(/[OIL]/g, '')
      .slice(0, 4);
    // Si el nombre dejó menos de 4 letras (p. ej. "Bo"), rellenamos con letras al
    // azar hasta tener 4. Math.random() da un decimal [0,1); al multiplicarlo por
    // la longitud y aplicar Math.floor() obtenemos un índice válido del alfabeto.
    while (base.length < 4) {
      base += alpha[Math.floor(Math.random() * alpha.length)];
    }

    // Intentamos hasta 10 veces generar un código que no exista ya en la base.
    for (let attempt = 0; attempt < 10; attempt++) {
      // Construimos un sufijo de 4 caracteres aleatorios (letras o números).
      let suffix = '';
      for (let i = 0; i < 4; i++) {
        suffix += alphanum[Math.floor(Math.random() * alphanum.length)];
      }
      // El candidato es prefijo (del nombre) + sufijo aleatorio. Ej.: "LUNA8X3K".
      const candidate = base + suffix;
      // Comprobamos si ya existe un código igual en la base de datos.
      const exists = await tx.creatorCode.findUnique({
        where: { code: candidate },
      });
      // Si NO existe (es único), lo devolvemos y terminamos.
      if (!exists) return candidate;
      // Si existía, el bucle reintenta con otro sufijo aleatorio.
    }

    // Si tras 10 intentos no logramos uno libre (muy improbable), avisamos error.
    throw new ConflictException(
      'No se pudo generar un código único, intenta de nuevo',
    );
  }
}
