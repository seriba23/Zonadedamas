// Injectable: marca la clase como servicio inyectable de NestJS.
import { Injectable } from '@nestjs/common';
// PrismaService: puente hacia la base de datos (consultas SQL vía Prisma).
import { PrismaService } from '../../prisma/prisma.service';
// DTOs (formas de los datos de entrada) ya documentados en la carpeta dto/.
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { SubscribePushDto } from './dto/subscribe-push.dto';

// Servicio con TODA la lógica de las notificaciones del personal (staff):
// listarlas, contar las no leídas, marcarlas como leídas y gestionar las
// suscripciones a push del navegador.
@Injectable()
export class StaffNotificationsService {
  // NestJS inyecta PrismaService y lo guardamos como this.prisma (solo lectura).
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // list(): devuelve las notificaciones de un usuario, paginadas y filtradas.
  // Recibe el userId (de quién son) y los filtros (página, sección, etc.).
  // ───────────────────────────────────────────────────────────────────────────
  async list(userId: string, filters: ListNotificationsDto) {
    // "filters.page ?? 1": el "??" usa 1 solo si page es null/undefined.
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    // "skip" = cuántos registros saltar para llegar a la página pedida.
    // Página 1 salta 0; página 2 salta perPage; página 3 salta 2*perPage, etc.
    const skip = (page - 1) * perPage;

    // "where" es el objeto de condiciones de la consulta. Empieza filtrando
    // por el usuario dueño. ": any" relaja el tipo para poder ir agregándole
    // campos condicionalmente más abajo.
    const where: any = { userId };
    // Si vino una sección, la añadimos al filtro.
    if (filters.section) where.section = filters.section;
    // Si pidieron solo no leídas, filtramos por readAt === null (sin fecha de
    // lectura = todavía no se ha leído).
    if (filters.unreadOnly === 'true') where.readAt = null;

    // Promise.all lanza las dos consultas EN PARALELO (más rápido que una tras
    // otra). La desestructuración "[items, total]" guarda el primer resultado
    // en "items" y el segundo en "total".
    const [items, total] = await Promise.all([
      // 1) La página de notificaciones, ordenadas de la más nueva a la más vieja.
      this.prisma.staffNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' }, // desc = descendente (recientes primero)
        skip,        // saltar las de páginas anteriores
        take: perPage, // tomar solo "perPage" registros
      }),
      // 2) El total de notificaciones que cumplen el mismo filtro (para paginar).
      this.prisma.staffNotification.count({ where }),
    ]);

    // Devolvemos los datos + "meta" con la info de paginación.
    // Math.ceil(total / perPage) redondea HACIA ARRIBA para saber cuántas
    // páginas hay (ej. 21 resultados / 20 = 1.05 -> 2 páginas).
    return {
      data: items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // unreadCounts(): cuenta cuántas notificaciones NO leídas hay, agrupadas por
  // sección (para pintar los "badges" rojos del menú). Devuelve el desglose
  // por sección y el total.
  // ───────────────────────────────────────────────────────────────────────────
  async unreadCounts(userId: string) {
    // groupBy agrupa registros por un campo (aquí "section") y permite contar
    // cuántos hay en cada grupo. Solo contamos las no leídas (readAt: null).
    const grouped = await this.prisma.staffNotification.groupBy({
      by: ['section'],              // agrupar por sección
      where: { userId, readAt: null },
      _count: { _all: true },       // _all: true = cuenta todas las filas del grupo
    });

    // "Record<string, number>" = un objeto cuyas claves son texto y sus valores
    // números (ej. { appointments: 3, shop: 1 }). Empieza vacío.
    const counts: Record<string, number> = {};
    // "let" (no const) porque "total" irá cambiando dentro del bucle.
    let total = 0;
    // Recorremos cada grupo devuelto por groupBy.
    for (const row of grouped) {
      // Guardamos el conteo de esa sección en el objeto.
      counts[row.section] = row._count._all;
      // Y lo sumamos al total general.
      total += row._count._all;
    }
    return { data: { counts, total } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // markRead(): marca UNA notificación como leída (le pone la fecha de lectura).
  // ───────────────────────────────────────────────────────────────────────────
  async markRead(userId: string, id: string) {
    // updateMany actualiza todas las filas que cumplan el "where". Filtramos por
    // id + userId (seguridad: que solo afecte a notificaciones del propio
    // usuario) + readAt: null (solo si aún no estaba leída). new Date() = ahora.
    await this.prisma.staffNotification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { data: { ok: true } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // markAllRead(): marca como leídas TODAS las no leídas del usuario (o solo las
  // de una sección concreta si se pasa "section").
  // ───────────────────────────────────────────────────────────────────────────
  async markAllRead(userId: string, section?: string) {
    // Filtro base: del usuario y aún no leídas.
    const where: any = { userId, readAt: null };
    // Si se indicó una sección, restringimos el filtro a ella.
    if (section) where.section = section;
    // Actualizamos todas las que coincidan y guardamos el resultado para saber
    // cuántas se marcaron (result.count).
    const result = await this.prisma.staffNotification.updateMany({
      where,
      data: { readAt: new Date() },
    });
    return { data: { count: result.count } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // subscribePush(): registra (o actualiza) la suscripción push del navegador
  // del usuario para poder enviarle notificaciones más tarde.
  // ───────────────────────────────────────────────────────────────────────────
  async subscribePush(userId: string, dto: SubscribePushDto) {
    // Upsert por endpoint (un endpoint = un device). Si el mismo endpoint
    // pertenecia a otro user, se reasigna.
    // "upsert" = UPDATE + INSERT: si ya existe una fila con ese endpoint la
    // actualiza ("update"); si no existe, la crea ("create").
    const sub = await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint }, // identificamos el device por su endpoint
      // Datos para CREAR si no existía:
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        // "dto.userAgent ?? null": guarda el userAgent si vino, o null si no.
        userAgent: dto.userAgent ?? null,
      },
      // Datos para ACTUALIZAR si ya existía (reasignamos al usuario actual y
      // refrescamos claves y fecha de último uso):
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
        lastUsedAt: new Date(),
      },
    });
    return { data: { id: sub.id } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // unsubscribePush(): borra la suscripción push (cuando el usuario desactiva
  // las notificaciones en ese navegador).
  // ───────────────────────────────────────────────────────────────────────────
  async unsubscribePush(userId: string, endpoint: string) {
    // deleteMany borra todas las filas que cumplan el filtro. Exigimos que
    // coincidan userId Y endpoint (que solo borre las del propio usuario).
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { data: { ok: true } };
  }
}
