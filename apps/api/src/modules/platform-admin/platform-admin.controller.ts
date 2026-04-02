import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { IsString, IsIn, IsOptional, IsEnum } from 'class-validator';

class UpdateStatusDto {
  @IsIn(['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'])
  status: SubscriptionStatus;
}

class UpdatePlanDto {
  @IsIn(['BASICO', 'PLUS', 'PRO'])
  plan: SubscriptionPlan;
}

class DeactivateEmployeeByAdminDto {
  @IsIn(['KEEP', 'CANCEL', 'SMART_RESCHEDULE'])
  strategy: 'KEEP' | 'CANCEL' | 'SMART_RESCHEDULE';
}

@UseGuards(PlatformJwtAuthGuard)
@Controller('platform')
export class PlatformAdminController {
  constructor(private readonly adminService: PlatformAdminService) {}

  @Get('dashboard')
  async getDashboard() {
    const data = await this.adminService.getDashboard();
    return { data };
  }

  @Get('tenants')
  async getTenants(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('plan') plan?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.adminService.getTenants({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      plan,
      status,
      search,
      sortBy,
    });
  }

  @Get('tenants/:id')
  async getTenantDetail(@Param('id') id: string) {
    const data = await this.adminService.getTenantDetail(id);
    return { data };
  }

  @Patch('tenants/:id/status')
  async updateTenantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    const data = await this.adminService.updateTenantStatus(id, dto.status);
    return { data };
  }

  @Patch('tenants/:id/plan')
  async updateTenantPlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    const data = await this.adminService.updateTenantPlan(id, dto.plan);
    return { data };
  }

  @Get('invoices')
  async getInvoices(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllInvoices({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      status,
    });
  }

  @Post('invoices/:id/mark-paid')
  async markInvoicePaid(@Param('id') id: string) {
    const data = await this.adminService.markInvoicePaid(id);
    return { data };
  }

  @Post('invoices/:id/mark-overdue')
  async markInvoiceOverdue(@Param('id') id: string) {
    const data = await this.adminService.markInvoiceOverdue(id);
    return { data };
  }

  @Get('tenants/:tenantId/employees/:employeeId/pending-count')
  async getEmployeePendingCount(
    @Param('tenantId') tenantId: string,
    @Param('employeeId') employeeId: string,
  ) {
    const data = await this.adminService.getEmployeePendingCount(tenantId, employeeId);
    return { data };
  }

  @Post('tenants/:tenantId/employees/:employeeId/deactivate')
  async deactivateEmployee(
    @Param('tenantId') tenantId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: DeactivateEmployeeByAdminDto,
  ) {
    const data = await this.adminService.deactivateEmployee(tenantId, employeeId, dto.strategy);
    return { data };
  }

  // ─── PROFESSIONS CATALOG ────────────────────────────

  @Get('professions')
  async getProfessions() {
    return this.adminService.getProfessions();
  }

  @Post('professions')
  async createProfession(@Body() body: { name: string }) {
    return this.adminService.createProfession(body.name);
  }

  @Delete('professions/:id')
  async deleteProfession(@Param('id') id: string) {
    return this.adminService.deleteProfession(id);
  }
}
