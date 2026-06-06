import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions('reports.revenue')
  async getDashboardReport(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    // Default to current month if not provided
    const now = new Date();
    const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end = endDate || now.toISOString().split('T')[0];

    const data = await this.reportsService.getDashboardReport(req.user.tenantId, start, end);
    return { data };
  }

  @Get('sales-breakdown')
  @RequirePermissions('reports.revenue')
  async getSalesBreakdown(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const now = new Date();
    const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end = endDate || now.toISOString().split('T')[0];
    const data = await this.reportsService.getSalesBreakdown(req.user.tenantId, start, end);
    return { data };
  }

  @Get('today')
  @RequirePermissions('reports.revenue')
  async getTodaySummary(@Req() req: any) {
    const data = await this.reportsService.getTodaySummary(req.user.tenantId);
    return { data };
  }

  @Get('alerts')
  @RequirePermissions('reports.revenue')
  async getAlerts(@Req() req: any) {
    const data = await this.reportsService.getAlertCounts(req.user.tenantId);
    return { data };
  }
}
