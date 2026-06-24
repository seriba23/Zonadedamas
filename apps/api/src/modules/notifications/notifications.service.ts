// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De NestJS: Injectable (servicio inyectable) y NotFoundException (error 404).
import { Injectable, NotFoundException } from '@nestjs/common';
// PrismaService: puente hacia la base de datos (leer/escribir tablas).
import { PrismaService } from '../../prisma/prisma.service';
// AuditService: servicio para registrar en la bitácora de auditoría QUÉ se hizo,
// QUIÉN lo hizo y cuándo (importante en operaciones de escritura).
import { AuditService } from '../audit/audit.service';
// DTOs (moldes de datos) usados por los métodos de este servicio.
import { UpdateTemplateDto } from './dto/update-template.dto';
import { FilterTemplatesDto } from './dto/filter-templates.dto';
import { FilterLogsDto } from './dto/filter-logs.dto';
// Utilidad que arma la respuesta paginada estándar (data + metadatos de página).
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable() // <- Servicio inyectable de NestJS.
export class NotificationsService {
  // Inyección de dependencias: NestJS nos pasa Prisma (BD) y Audit (bitácora).
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // findAllTemplates: devuelve las plantillas del negocio, aplicando filtros.
  //   - Recibe: tenantId (id del negocio) y filters (filtros opcionales).
  //   - Devuelve: { data: [plantillas] }.
  async findAllTemplates(tenantId: string, filters: FilterTemplatesDto) {
    // "where" arranca filtrando SIEMPRE por el negocio (multi-tenant). El tipo
    // "any" lo deja flexible para irle añadiendo condiciones según los filtros.
    const where: any = { tenantId };
    // Si llega eventTrigger, añadimos esa condición al filtro (igualdad exacta).
    if (filters.eventTrigger) where.eventTrigger = filters.eventTrigger;
    // Si llega type, filtramos también por el tipo/canal.
    if (filters.type) where.type = filters.type;

    // findMany = "trae TODOS los registros" que cumplan el "where".
    const templates = await this.prisma.notificationTemplate.findMany({
      where,
      // orderBy con una LISTA = ordena por varios criterios en orden: primero por
      // eventTrigger ascendente ('asc' = A→Z) y, a igualdad, por type ascendente.
      orderBy: [{ eventTrigger: 'asc' }, { type: 'asc' }],
    });

    return { data: templates };
  }

  // findOneTemplate: busca UNA plantilla por id, asegurando que sea del negocio.
  async findOneTemplate(id: string, tenantId: string) {
    // findFirst = "trae el PRIMER registro" que cumpla el where. Filtramos por id
    // Y por tenantId, para que un negocio no pueda ver plantillas de otro.
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { id, tenantId },
    });
    // Si no existe (es null) -> error 404.
    if (!template) {
      throw new NotFoundException('Plantilla no encontrada');
    }
    return { data: template };
  }

  // updateTemplate: edita una plantilla y deja registro en auditoría.
  //   - userId es opcional (lleva "?"): quién hace el cambio, para la bitácora.
  async updateTemplate(
    id: string,
    dto: UpdateTemplateDto,
    tenantId: string,
    userId?: string,
  ) {
    // Primero comprobamos que la plantilla exista y sea de este negocio.
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Plantilla no encontrada');
    }

    // Actualizamos solo los campos enviados. El operador "??" (nullish
    // coalescing) significa: "si el valor de la izquierda es null o undefined,
    // usa el de la derecha". Así, si el DTO NO trae un campo, conservamos el
    // valor actual (existing.X) en lugar de borrarlo.
    const updated = await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        subject: dto.subject ?? existing.subject,
        bodyTemplate: dto.bodyTemplate ?? existing.bodyTemplate,
        isActive: dto.isActive ?? existing.isActive,
      },
    });

    // Registramos el cambio en la bitácora de auditoría: guardamos los valores
    // ANTES (oldValues) y DESPUÉS (newValues). El "as any" relaja el tipo para
    // que Prisma acepte estos objetos como JSON de auditoría.
    await this.auditService.log({
      tenantId,
      userId,
      action: 'notification_template.updated',
      entityType: 'notification_template',
      entityId: id,
      oldValues: existing as any,
      newValues: updated as any,
    });

    return { data: updated };
  }

  // findAllLogs: lista paginada del historial de notificaciones, con filtros.
  async findAllLogs(tenantId: string, filters: FilterLogsDto) {
    // Página actual: si no llega, usamos 1 (el "??" da el valor por defecto).
    const page = filters.page ?? 1;
    // Cuántos por página: por defecto 20.
    const perPage = filters.perPage ?? 20;
    // skip = cuántos registros SALTAR para llegar a la página pedida.
    // Ej.: página 3 con 20 por página -> saltar (3-1)*20 = 40 registros.
    const skip = (page - 1) * perPage;

    // Filtro base por negocio, más los filtros opcionales que vengan.
    const where: any = { tenantId };
    if (filters.eventName) where.eventName = filters.eventName;
    if (filters.channel) where.channel = filters.channel;
    if (filters.status) where.status = filters.status;

    // Promise.all ejecuta las DOS consultas EN PARALELO (a la vez) y espera a que
    // ambas terminen. Desestructuramos su resultado en [data, total]:
    //   - data: los registros de ESTA página.
    //   - total: el conteo TOTAL de registros (para calcular nº de páginas).
    const [data, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        skip, // saltar los de páginas anteriores
        take: perPage, // tomar como mucho "perPage" registros
        orderBy: { createdAt: 'desc' }, // 'desc' = más recientes primero
      }),
      this.prisma.notificationLog.count({ where }), // cuenta el total
    ]);

    // Armamos la respuesta paginada estándar con los datos, el total y los filtros.
    return buildPaginatedResponse(data, total, filters);
  }

  // getSampleVariables: devuelve variables de EJEMPLO según el evento, para la
  // vista previa de plantillas (el admin ve cómo quedaría el mensaje real).
  //   - Devuelve un objeto cuyas claves y valores son textos (Record<string,string>).
  getSampleVariables(eventTrigger: string): Record<string, string> {
    // "base" = el conjunto de variables común a la mayoría de eventos de cita.
    const base: Record<string, string> = {
      clientName: 'Maria Gonzalez',
      clientFirstName: 'Maria',
      employeeName: 'Sofia Martinez',
      services: 'Corte de cabello, Manicure',
      totalPrice: '45.00',
      date: 'lunes, 3 de marzo de 2026',
      time: '10:00',
    };

    // Para el evento de reagendado necesitamos variables EXTRA (fecha antigua y
    // nueva). "=== " compara con igualdad estricta (mismo valor y mismo tipo).
    if (eventTrigger === 'appointment.rescheduled') {
      // "...base" (spread) copia todas las variables base y luego añadimos las
      // específicas del reagendado.
      return {
        ...base,
        oldDate: 'viernes, 28 de febrero de 2026',
        newDate: base.date,
        newTime: base.time,
      };
    }

    // Para el evento de pago, las variables son DISTINTAS (monto, moneda, método),
    // así que devolvemos un conjunto propio en vez de las de cita.
    if (eventTrigger === 'payment.completed') {
      return {
        clientName: base.clientName,
        clientFirstName: base.clientFirstName,
        amount: '45.00',
        currency: 'MXN',
        paymentMethod: 'CARD',
        date: base.date,
      };
    }

    // Para cualquier otro evento, basta con las variables base.
    return base;
  }
}
