import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { BundleAvailabilityQueryDto } from './dto/bundle-availability-query.dto';
import { CompositeAvailabilityQueryDto } from './dto/composite-availability-query.dto';
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

  @Post('bundle')
  @RequirePermissions('availability.read')
  async bundleAvailability(
    @CurrentTenant() tenantId: string,
    @Body() query: BundleAvailabilityQueryDto,
  ) {
    return this.availabilityService.getBundleAvailability(query, tenantId);
  }

  @Post('composite')
  @RequirePermissions('availability.read')
  async compositeAvailability(
    @CurrentTenant() tenantId: string,
    @Body() query: CompositeAvailabilityQueryDto,
  ) {
    const result = await this.availabilityService.getCompositeAvailability(query, tenantId);
    return flattenCompositeResult(result);
  }
}

// Aplana la respuesta nested {data:[{date, slots:[{startTime, endTime, assignments}]}]}
// al mismo shape que /availability ({data:[{startTime ISO, endTime ISO,
// employeeId, employeeName, assignments}]}) para que el frontend no
// necesite codigo distinto al renderizar slots compositos vs simples.
//
// Tambien soporta la respuesta de getAvailableSlots cuando hay 1 solo
// assignment (delegacion): ese shape ya es {data:[{date, employees:[...]}]}.
function flattenCompositeResult(result: any): {
  data: Array<{
    startTime: string;
    endTime: string;
    employeeId: string;
    employeeName: string;
    assignments?: any[];
  }>;
} {
  const flatSlots: Array<{
    startTime: string;
    endTime: string;
    employeeId: string;
    employeeName: string;
    assignments?: any[];
  }> = [];

  for (const day of result.data || []) {
    if (day.slots) {
      // Composite shape
      for (const slot of day.slots) {
        const firstAssignment = slot.assignments?.[0];
        flatSlots.push({
          startTime: `${day.date}T${slot.startTime}:00`,
          endTime: `${day.date}T${slot.endTime}:00`,
          employeeId: firstAssignment?.employeeId || '',
          employeeName: firstAssignment?.employeeName || '',
          assignments: slot.assignments,
        });
      }
    } else if (day.employees) {
      // getAvailableSlots shape (delegacion en caso de 1 assignment)
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
  }

  return { data: flatSlots };
}
