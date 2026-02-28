import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { FilterTemplatesDto } from './dto/filter-templates.dto';
import { FilterLogsDto } from './dto/filter-logs.dto';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAllTemplates(tenantId: string, filters: FilterTemplatesDto) {
    const where: any = { tenantId };
    if (filters.eventTrigger) where.eventTrigger = filters.eventTrigger;
    if (filters.type) where.type = filters.type;

    const templates = await this.prisma.notificationTemplate.findMany({
      where,
      orderBy: [{ eventTrigger: 'asc' }, { type: 'asc' }],
    });

    return { data: templates };
  }

  async findOneTemplate(id: string, tenantId: string) {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) {
      throw new NotFoundException('Plantilla no encontrada');
    }
    return { data: template };
  }

  async updateTemplate(
    id: string,
    dto: UpdateTemplateDto,
    tenantId: string,
    userId?: string,
  ) {
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Plantilla no encontrada');
    }

    const updated = await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        subject: dto.subject ?? existing.subject,
        bodyTemplate: dto.bodyTemplate ?? existing.bodyTemplate,
        isActive: dto.isActive ?? existing.isActive,
      },
    });

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

  async findAllLogs(tenantId: string, filters: FilterLogsDto) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (filters.eventName) where.eventName = filters.eventName;
    if (filters.channel) where.channel = filters.channel;
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, filters);
  }

  getSampleVariables(eventTrigger: string): Record<string, string> {
    const base: Record<string, string> = {
      clientName: 'Maria Gonzalez',
      clientFirstName: 'Maria',
      employeeName: 'Sofia Martinez',
      services: 'Corte de cabello, Manicure',
      totalPrice: '45.00',
      date: 'lunes, 3 de marzo de 2026',
      time: '10:00',
    };

    if (eventTrigger === 'appointment.rescheduled') {
      return {
        ...base,
        oldDate: 'viernes, 28 de febrero de 2026',
        newDate: base.date,
        newTime: base.time,
      };
    }

    if (eventTrigger === 'payment.completed') {
      return {
        clientName: base.clientName,
        clientFirstName: base.clientFirstName,
        amount: '45.00',
        currency: 'USD',
        paymentMethod: 'CARD',
        date: base.date,
      };
    }

    return base;
  }
}
