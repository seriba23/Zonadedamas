import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicBookingService } from './public-booking.service';
import { PublicAvailabilityQueryDto, PublicBookDto } from './dto/public-booking.dto';

@Controller('public/:tenantSlug')
export class PublicBookingController {
  constructor(private readonly publicBookingService: PublicBookingService) {}

  @Get('services')
  async getServices(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    const services = await this.publicBookingService.getServices(tenant.id);
    return { data: services };
  }

  @Get('employees')
  async getEmployees(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    const employees = await this.publicBookingService.getEmployees(tenant.id);
    return { data: employees };
  }

  @Post('availability')
  async getAvailability(
    @Param('tenantSlug') tenantSlug: string,
    @Body() query: PublicAvailabilityQueryDto,
  ) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    const result = await this.publicBookingService.getAvailability(query, tenant.id);

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

  @Post('book')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async book(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: PublicBookDto,
  ) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    return this.publicBookingService.book(dto, tenant.id);
  }
}
