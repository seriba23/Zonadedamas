import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AbuseReportsService } from './abuse-reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Cuerpo para crear un reporte desde el dashboard del negocio/empleado.
class CreateReportDto {
  @IsOptional()
  @IsString()
  targetType?: string; // por defecto CLIENT

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
  targetName?: string;

  @IsString()
  @MinLength(1)
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// POST /api/reports — el negocio/empleado reporta a la plataforma (normalmente
// a un cliente). Protegido por el JWT principal.
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class AbuseReportsController {
  constructor(private readonly reports: AbuseReportsService) {}

  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateReportDto,
  ) {
    const fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null;
    return this.reports.createFromBusiness(tenantId, fallbackName, dto);
  }
}
