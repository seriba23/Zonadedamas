import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AllSlotsQueryDto } from './dto/all-slots-query.dto';
import { CheckAfterDto } from './dto/check-after.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('availability')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post('query')
  @RequirePermissions('availability.read')
  async query(
    @CurrentTenant() tenantId: string,
    @Body() query: AvailabilityQueryDto,
  ) {
    const result = await this.availabilityService.getAvailableSlots(query, tenantId);

    // Flatten nested response into array of slots with employeeId
    const flatSlots: Array<{
      startTime: string;
      endTime: string;
      employeeId: string;
      employeeName: string;
    }> = [];

    for (const day of result.data) {
      for (const emp of day.employees) {
        for (const slot of emp.slots) {
          flatSlots.push({
            startTime: `${day.date}T${slot.startTime}:00`,
            endTime: `${day.date}T${slot.endTime}:00`,
            employeeId: emp.id,
            employeeName: emp.name,
          });
        }
      }
    }

    return { data: flatSlots };
  }

  @Post('all-slots')
  @RequirePermissions('availability.read')
  async allSlots(
    @CurrentTenant() tenantId: string,
    @Body() query: AllSlotsQueryDto,
  ) {
    const result = await this.availabilityService.getAllSlotsForEmployee(
      query.employeeId,
      query.date,
      query.serviceIds,
      tenantId,
    );
    return { data: result };
  }

  @Post('check-after')
  @RequirePermissions('availability.read')
  async checkAfter(
    @CurrentTenant() tenantId: string,
    @Body() dto: CheckAfterDto,
  ) {
    const result = await this.availabilityService.checkAfterTime(dto, tenantId);
    return { data: result };
  }
}
