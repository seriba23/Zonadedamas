// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos Injectable: decorador (etiqueta "@") que marca esta clase
// como un "servicio" que NestJS puede crear e inyectar en otras clases.
import { Injectable } from '@nestjs/common';

// PrismaService es nuestro "puente" hacia la base de datos. Prisma es la
// herramienta (ORM) que convierte llamadas de JavaScript en consultas SQL.
// A través de this.prisma podremos leer/escribir tablas como auditLog.
import { PrismaService } from '../../prisma/prisma.service';

// Importamos dos cosas relacionadas con la paginación (mostrar resultados por
// "páginas" en vez de todos de golpe):
//   - PaginationDto: la forma estándar de los parámetros de paginación
//     (page = número de página, perPage = cuántos por página).
//   - buildPaginatedResponse: función auxiliar que arma la respuesta final
//     con los datos + información de la paginación (total, páginas, etc.).
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES: son "moldes" o "contratos". No generan código que se ejecute;
// solo describen QUÉ campos y de QUÉ tipo debe tener un objeto. Sirven para que
// TypeScript nos avise si nos equivocamos al usarlos.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AuditLogEntry = la forma de UNA entrada de bitácora que se quiere registrar.
 * Es lo que otros módulos le pasan a este servicio cuando hacen una escritura
 * (crear/editar/borrar algo) y quieren dejar constancia de ello.
 */
export interface AuditLogEntry {
  // tenantId: a qué negocio (inquilino) pertenece la acción. OBLIGATORIO porque
  // la app es multi-tenant y TODO debe filtrarse por tenant.
  tenantId: string;
  // userId: quién hizo la acción. El "?" lo hace OPCIONAL (puede faltar, por
  // ejemplo en acciones automáticas del sistema sin usuario humano).
  userId?: string;
  // entityType: qué TIPO de cosa se tocó (ej. "Appointment", "Client", "Service").
  entityType: string;
  // entityId: el id concreto de esa cosa (qué registro exacto se tocó).
  entityId: string;
  // action: qué se hizo (ej. "CREATE", "UPDATE", "DELETE").
  action: string;
  // oldValues: cómo estaban los datos ANTES del cambio (opcional).
  // Record<string, any> = un objeto con claves de texto y valores de cualquier
  // tipo (como un diccionario libre).
  oldValues?: Record<string, any>;
  // newValues: cómo quedaron los datos DESPUÉS del cambio (opcional).
  newValues?: Record<string, any>;
  // metadata: información extra de contexto que no encaja en lo anterior (opcional).
  metadata?: Record<string, any>;
  // ipAddress: desde qué dirección IP se hizo la acción (opcional).
  ipAddress?: string;
  // userAgent: qué navegador/dispositivo usó (texto del navegador) (opcional).
  userAgent?: string;
}

/**
 * AuditFilters = la forma de los filtros para BUSCAR en la bitácora.
 * "extends PaginationDto" significa que HEREDA los campos de paginación
 * (page, perPage) y además agrega los filtros propios de aquí abajo.
 */
export interface AuditFilters extends PaginationDto {
  // entityType: filtrar por tipo de entidad (opcional).
  entityType?: string;
  // entityId: filtrar por un id concreto de entidad (opcional).
  entityId?: string;
  // userId: filtrar por el usuario que hizo la acción (opcional).
  userId?: string;
  // action: filtrar por tipo de acción (opcional).
  action?: string;
  // startDate: fecha desde la cual buscar (texto "YYYY-MM-DD") (opcional).
  startDate?: string;
  // endDate: fecha hasta la cual buscar (texto "YYYY-MM-DD") (opcional).
  endDate?: string;
}

// @Injectable() => marca la clase como servicio inyectable de NestJS.
@Injectable()
export class AuditService {
  // El constructor recibe el PrismaService que NestJS inyecta automáticamente.
  // "private readonly prisma" lo guarda como propiedad (this.prisma) de solo
  // lectura, para usarlo en todos los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // log(): graba UNA entrada en la bitácora de auditoría.
  //   - Recibe "entry": un objeto con la forma AuditLogEntry (ver arriba).
  //   - Devuelve Promise<void>: una promesa que no entrega ningún valor
  //     (void = "nada"); solo nos interesa que termine de escribir.
  // Este método lo llaman muchos otros módulos tras una operación de escritura.
  // ───────────────────────────────────────────────────────────────────────────
  async log(entry: AuditLogEntry): Promise<void> {
    // try/catch: intentamos hacer algo y, si FALLA, capturamos el error en
    // "catch" en vez de dejar que reviente. Esto es clave aquí: si escribir la
    // bitácora falla, NO queremos romper la operación principal del usuario.
    try {
      // create = "inserta UN registro nuevo" en la tabla auditLog.
      await this.prisma.auditLog.create({
        data: {
          // Copiamos los campos de "entry" a las columnas de la tabla.
          tenantId: entry.tenantId,
          userId: entry.userId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          // "entry.oldValues ?? undefined": el operador "??" (fusión de nulos)
          // significa "usa el valor de la izquierda, pero SOLO si es null o
          // undefined usa el de la derecha". Aquí, si oldValues no vino, se
          // guarda undefined (que Prisma interpreta como "no poner nada").
          // Nota: el campo en la BD se llama beforeData (datos "de antes").
          beforeData: entry.oldValues ?? undefined,
          // Igual que arriba, pero para los datos "de después" (afterData).
          afterData: entry.newValues ?? undefined,
          // Igual: metadata extra si la hubo, o undefined si no.
          metadata: entry.metadata ?? undefined,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (err) {
      // Si llegamos aquí es porque escribir la bitácora falló.
      // Audit logging should never break the main flow
      // (Traducción: el registro de auditoría nunca debe romper el flujo
      // principal). Por eso NO relanzamos el error: solo lo mostramos en la
      // consola del servidor para que quede constancia y seguimos adelante.
      console.error('Failed to write audit log:', err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): consulta la bitácora con filtros y paginación.
  //   - tenantId: negocio del que pedimos los registros (multi-tenant).
  //   - filters: filtros opcionales + datos de paginación (page, perPage).
  // Devuelve la lista de entradas de auditoría junto con info de paginación.
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters: AuditFilters) {
    // page = número de página pedida. "filters.page ?? 1" => si no vino page
    // (es null/undefined), usamos 1 (la primera página) por defecto.
    const page = filters.page ?? 1;
    // perPage = cuántos registros por página. Si no vino, usamos 20.
    const perPage = filters.perPage ?? 20;
    // skip = cuántos registros saltarnos al inicio para llegar a la página pedida.
    // Ej.: página 3 con 20 por página => saltar (3-1)*20 = 40 registros.
    const skip = (page - 1) * perPage;

    // "where" es el objeto de condiciones de la consulta. Lo tipamos como "any"
    // para poder irle añadiendo propiedades dinámicamente más abajo.
    // Arrancamos SIEMPRE filtrando por tenantId (regla multi-tenant).
    const where: any = { tenantId };

    // Cada "if" agrega un filtro SOLO si el usuario lo envió. Como un string
    // vacío o undefined es "falsy" (se evalúa como falso), el if no se cumple
    // si el filtro no vino, y así no se añade esa condición.
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;

    // FILTRO POR RANGO DE FECHAS:
    // "||" (O lógico): entramos aquí si vino startDate O vino endDate (o ambos).
    if (filters.startDate || filters.endDate) {
      // Preparamos un objeto vacío para acumular las condiciones de fecha.
      where.createdAt = {};
      // Si vino startDate, pedimos createdAt >= esa fecha (gte = "greater than
      // or equal", mayor o igual). new Date(...) convierte el texto en fecha.
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      // Si vino endDate, pedimos createdAt <= esa fecha (lte = "less than or
      // equal", menor o igual).
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    // Promise.all([...]) lanza VARIAS operaciones a la vez y espera a que TODAS
    // terminen. Aquí pedimos en paralelo: (1) la página de datos y (2) el total
    // de registros que cumplen el filtro. Hacerlo en paralelo es más rápido que
    // una tras otra. La desestructuración "[data, total]" guarda el primer
    // resultado en "data" y el segundo en "total".
    const [data, total] = await Promise.all([
      // findMany = "trae VARIOS registros" que cumplan el "where".
      this.prisma.auditLog.findMany({
        where,                          // las condiciones armadas arriba
        skip,                           // saltar registros para la paginación
        take: perPage,                  // tomar como máximo "perPage" registros
        orderBy: { createdAt: 'desc' }, // ordenar del más nuevo al más viejo
        // include = además de la entrada, trae datos de tablas relacionadas.
        include: {
          // Del usuario que hizo la acción, solo estos campos (select).
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      // count = cuenta CUÁNTOS registros cumplen el mismo "where" (sin paginar).
      // Lo necesitamos para saber cuántas páginas hay en total.
      this.prisma.auditLog.count({ where }),
    ]);

    // Armamos y devolvemos la respuesta paginada estándar: los datos de esta
    // página + el total + la info de paginación (calculada con los filtros).
    return buildPaginatedResponse(data, total, filters);
  }
}
