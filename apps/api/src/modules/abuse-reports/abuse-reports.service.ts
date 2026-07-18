import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportStatus } from '@prisma/client';

// Datos para crear un reporte/denuncia a la plataforma.
export interface CreateReportInput {
  reporterType: string; // TENANT | EMPLOYEE | CLIENT | MARKETPLACE_USER
  reporterId?: string | null;
  reporterName?: string | null;
  targetType: string;   // CLIENT | TENANT | EMPLOYEE | OTHER
  targetId?: string | null;
  targetName?: string | null;
  tenantId?: string | null;
  reason: string;
  description?: string | null;
}

@Injectable()
export class AbuseReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // create(): registra un reporte. Lo usan los distintos flujos (negocio/
  // empleado, marketplace) tras derivar quién reporta desde su sesión.
  async create(input: CreateReportInput) {
    const report = await this.prisma.report.create({
      data: {
        reporterType: input.reporterType,
        reporterId: input.reporterId ?? null,
        reporterName: input.reporterName ?? null,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        targetName: input.targetName ?? null,
        tenantId: input.tenantId ?? null,
        reason: input.reason.trim(),
        description: input.description?.trim() || null,
      },
    });
    return { data: report };
  }

  // createFromBusiness(): un negocio/empleado (sesión del dashboard) reporta,
  // normalmente a un cliente suyo. Toma el nombre del negocio como reporter.
  async createFromBusiness(
    tenantId: string,
    fallbackName: string | null,
    dto: { targetType?: string; targetId?: string; targetName?: string; reason: string; description?: string },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    return this.create({
      reporterType: 'TENANT',
      reporterId: tenantId,
      reporterName: tenant?.name ?? fallbackName ?? null,
      targetType: dto.targetType || 'CLIENT',
      targetId: dto.targetId ?? null,
      targetName: dto.targetName ?? null,
      tenantId,
      reason: dto.reason,
      description: dto.description ?? null,
    });
  }

  // createFromMarketplaceUser(): un cliente del marketplace reporta, normalmente
  // a un negocio/profesional.
  async createFromMarketplaceUser(
    userId: string,
    reporterName: string | null,
    dto: { targetType?: string; targetId?: string; targetName?: string; tenantId?: string; reason: string; description?: string },
  ) {
    return this.create({
      reporterType: 'MARKETPLACE_USER',
      reporterId: userId,
      reporterName,
      targetType: dto.targetType || 'TENANT',
      targetId: dto.targetId ?? null,
      targetName: dto.targetName ?? null,
      tenantId: dto.tenantId ?? null,
      reason: dto.reason,
      description: dto.description ?? null,
    });
  }

  // ─── Super-admin ───────────────────────────────────────────────────────────
  async listForPlatform(status?: string) {
    const where: any = {};
    if (status && ['PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN'].includes(status)) {
      where.status = status as ReportStatus;
    }
    const reports = await this.prisma.report.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return { data: reports };
  }

  async updateStatus(id: string, status: string, adminNotes?: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: status as ReportStatus,
        adminNotes: adminNotes !== undefined ? (adminNotes?.trim() || null) : undefined,
      },
    });
    return { data: updated };
  }
}
