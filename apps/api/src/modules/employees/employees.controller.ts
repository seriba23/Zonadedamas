import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { SetSchedulesDto } from './dto/schedule.dto';
import { CreateTimeOffDto, SetServicesDto } from './dto/time-off.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

class EmployeeQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  locationId?: string;
}

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions('employees.read')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: EmployeeQueryDto,
  ) {
    return this.employeesService.findAll(tenantId, query, query.locationId);
  }

  @Post()
  @RequirePermissions('employees.create')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    const employee = await this.employeesService.create(tenantId, dto);
    return { data: employee };
  }

  @Get(':id')
  @RequirePermissions('employees.read')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const employee = await this.employeesService.findOne(id, tenantId);
    return { data: employee };
  }

  @Put(':id')
  @RequirePermissions('employees.update')
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const employee = await this.employeesService.update(id, tenantId, dto);
    return { data: employee };
  }

  @Delete(':id')
  @RequirePermissions('employees.delete')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.remove(id, tenantId);
    return { data: result };
  }

  @Get(':id/schedules')
  @RequirePermissions('employees.read')
  async getSchedules(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const schedules = await this.employeesService.getSchedules(id, tenantId);
    return { data: schedules };
  }

  @Put(':id/schedules')
  @RequirePermissions('employees.manage_schedule')
  async setSchedules(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: SetSchedulesDto,
  ) {
    const schedules = await this.employeesService.setSchedules(id, tenantId, dto);
    return { data: schedules };
  }

  @Get(':id/time-off')
  @RequirePermissions('employees.read')
  async getTimeOff(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const timeOff = await this.employeesService.getTimeOff(id, tenantId);
    return { data: timeOff };
  }

  @Post(':id/time-off')
  @RequirePermissions('employees.manage_time_off')
  async addTimeOff(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateTimeOffDto,
  ) {
    const timeOff = await this.employeesService.addTimeOff(id, tenantId, dto);
    return { data: timeOff };
  }

  @Delete(':id/time-off/:timeOffId')
  @RequirePermissions('employees.manage_time_off')
  async removeTimeOff(
    @Param('id') id: string,
    @Param('timeOffId') timeOffId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.removeTimeOff(id, tenantId, timeOffId);
    return { data: result };
  }

  @Get(':id/services')
  @RequirePermissions('employees.read')
  async getServices(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const services = await this.employeesService.getServices(id, tenantId);
    return { data: services };
  }

  @Put(':id/services')
  @RequirePermissions('employees.manage_services')
  async setServices(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: SetServicesDto,
  ) {
    const services = await this.employeesService.setServices(
      id,
      tenantId,
      dto.serviceIds,
    );
    return { data: services };
  }
}
