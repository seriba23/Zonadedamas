import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleDto, CancelDto } from './dto/reschedule.dto';
import { FilterAppointmentsDto } from './dto/filter-appointments.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('appointments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @RequirePermissions('appointments.read')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() filters: FilterAppointmentsDto,
  ) {
    return this.appointmentsService.findAll(tenantId, filters);
  }

  @Post()
  @RequirePermissions('appointments.create')
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(dto, tenantId, user.userId);
  }

  @Get(':id')
  @RequirePermissions('appointments.read')
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.findOne(id, tenantId);
  }

  @Put(':id')
  @RequirePermissions('appointments.update')
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(id, dto, tenantId, user.userId);
  }

  @Post(':id/reschedule')
  @RequirePermissions('appointments.reschedule')
  async reschedule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.appointmentsService.reschedule(id, dto, tenantId, user.userId);
  }

  @Post(':id/cancel')
  @RequirePermissions('appointments.cancel')
  async cancel(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ) {
    return this.appointmentsService.cancel(id, dto, tenantId, user.userId);
  }

  @Post(':id/confirm')
  @RequirePermissions('appointments.update')
  async confirm(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.confirm(id, tenantId, user.userId);
  }

  @Post(':id/complete')
  @RequirePermissions('appointments.complete')
  async complete(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.complete(id, tenantId, user.userId);
  }

  @Post(':id/no-show')
  @RequirePermissions('appointments.update')
  async noShow(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.noShow(id, tenantId, user.userId);
  }
}
