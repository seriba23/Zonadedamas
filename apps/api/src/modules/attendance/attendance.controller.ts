import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly prisma: PrismaService,
  ) {}

  /** Admin: list attendance for a date range */
  @Get()
  async findByDateRange(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const end = endDate || startDate;
    return this.attendanceService.findByDateRange(tenantId, startDate, end);
  }

  /** Admin: count pending reviews */
  @Get('pending-count')
  async pendingCount(@CurrentTenant() tenantId: string) {
    return this.attendanceService.getPendingCount(tenantId);
  }

  /** Employee: get my attendance today */
  @Get('me/today')
  async myToday(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const employee = await this.resolveEmployee(tenantId, user.sub);
    return this.attendanceService.getMyAttendanceToday(tenantId, employee.id);
  }

  /** Employee: check in */
  @Post('check-in')
  async checkIn(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { latitude: number; longitude: number; forceOutOfRange?: boolean },
  ) {
    const employee = await this.resolveEmployee(tenantId, user.sub);
    return this.attendanceService.checkIn(
      tenantId, employee.id, body.latitude, body.longitude, body.forceOutOfRange,
    );
  }

  /** Employee: check out */
  @Post('check-out')
  async checkOut(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { latitude: number; longitude: number; forceOutOfRange?: boolean },
  ) {
    const employee = await this.resolveEmployee(tenantId, user.sub);
    return this.attendanceService.checkOut(
      tenantId, employee.id, body.latitude, body.longitude, body.forceOutOfRange,
    );
  }

  /** Admin: approve or reject attendance */
  @Put(':id/review')
  @UseGuards(PermissionGuard)
  @RequirePermissions('employees.update')
  async review(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED' },
  ) {
    return this.attendanceService.reviewAttendance(id, tenantId, body.status, user.sub);
  }

  private async resolveEmployee(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId, isActive: true },
    });
    if (!employee) {
      throw new NotFoundException('No tienes un perfil de empleado asociado.');
    }
    return employee;
  }
}
