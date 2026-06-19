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
import { IsString, IsIn, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

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

class GrantMonthsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  months: number;
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
    @Query('tenantType') tenantType?: string,
  ) {
    return this.adminService.getTenants({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      plan,
      status,
      search,
      sortBy,
      tenantType,
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

  @Post('tenants/:id/grant-months')
  async grantFreeMonths(
    @Param('id') id: string,
    @Body() dto: GrantMonthsDto,
  ) {
    return this.adminService.grantFreeMonths(id, dto.months);
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

  // ─── NOTIFICATION LOGS ───────────────────────────────

  @Get('notification-logs')
  async getNotificationLogs(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getNotificationLogs({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      status,
    });
  }

  // ─── BUSINESS TYPES ──────────────────────────────────

  @Get('business-types')
  async getBusinessTypes() {
    return this.adminService.getBusinessTypes();
  }

  @Post('business-types')
  async createBusinessType(@Body() body: { value: string; label: string }) {
    return this.adminService.createBusinessType(body.value, body.label);
  }

  @Patch('business-types/:id')
  async updateBusinessType(@Param('id') id: string, @Body() body: { value?: string; label?: string }) {
    return this.adminService.updateBusinessType(id, body);
  }

  @Delete('business-types/:id')
  async deleteBusinessType(@Param('id') id: string) {
    return this.adminService.deleteBusinessType(id);
  }

  // ─── SERVICE CATALOG ─────────────────────────────────

  @Get('service-catalog')
  async getServiceCatalog() {
    return this.adminService.getServiceCatalog();
  }

  @Post('service-catalog')
  async createServiceCatalogItem(@Body() body: { name: string; category?: string }) {
    return this.adminService.createServiceCatalogItem(body.name, body.category);
  }

  @Patch('service-catalog/:id')
  async updateServiceCatalogItem(@Param('id') id: string, @Body() body: { name?: string; category?: string }) {
    return this.adminService.updateServiceCatalogItem(id, body);
  }

  @Patch('service-catalog/rename-category')
  async renameServiceCategory(@Body() body: { oldName: string; newName: string }) {
    return this.adminService.renameServiceCategory(body.oldName, body.newName);
  }

  @Delete('service-catalog/category/:name')
  async deleteServiceCategory(@Param('name') name: string) {
    return this.adminService.deleteServiceCategory(decodeURIComponent(name));
  }

  @Delete('service-catalog/:id')
  async deleteServiceCatalogItem(@Param('id') id: string) {
    return this.adminService.deleteServiceCatalogItem(id);
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

  @Patch('professions/:id')
  async updateProfession(@Param('id') id: string, @Body() body: { name: string }) {
    return this.adminService.updateProfession(id, body.name);
  }

  @Delete('professions/:id')
  async deleteProfession(@Param('id') id: string) {
    return this.adminService.deleteProfession(id);
  }
}
