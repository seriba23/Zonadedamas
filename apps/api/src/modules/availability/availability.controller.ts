import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
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
    return this.availabilityService.getAvailableSlots(query, tenantId);
  }
}
