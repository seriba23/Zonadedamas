import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicBookingService } from './public-booking.service';
import { PublicAvailabilityQueryDto, PublicBookDto } from './dto/public-booking.dto';
import { CompositeAvailabilityQueryDto } from '../availability/dto/composite-availability-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';

@Controller('public/:tenantSlug')
export class PublicBookingController {
  constructor(
    private readonly publicBookingService: PublicBookingService,
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) {}

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

  @Post('bundle-availability')
  async getBundleAvailability(
    @Param('tenantSlug') tenantSlug: string,
    @Body() body: { bundleId: string; startDate: string; endDate: string; locationId?: string },
  ) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    return this.availabilityService.getBundleAvailability(
      { bundleId: body.bundleId, startDate: body.startDate, endDate: body.endDate, locationId: body.locationId },
      tenant.id,
    );
  }

  // Composite availability: cuando el cliente seleccionó N servicios y asignó
  // un profesional especifico a cada uno (porque varios podian hacerlo).
  // Devuelve slots donde la cadena completa cabe respetando schedules,
  // citas y buffers de cada empleado. Mismo shape de output que /availability.
  @Post('composite-availability')
  async getCompositeAvailability(
    @Param('tenantSlug') tenantSlug: string,
    @Body() query: CompositeAvailabilityQueryDto,
  ) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    const result = await this.availabilityService.getCompositeAvailability(query, tenant.id);

    const flatSlots: Array<{
      startTime: string;
      endTime: string;
      employeeId: string;
      employeeName: string;
      assignments?: any[];
    }> = [];

    for (const day of (result.data || []) as any[]) {
      if (day.slots) {
        for (const slot of day.slots) {
          const first = slot.assignments?.[0];
          flatSlots.push({
            startTime: `${day.date}T${slot.startTime}:00`,
            endTime: `${day.date}T${slot.endTime}:00`,
            employeeId: first?.employeeId || '',
            employeeName: first?.employeeName || '',
            assignments: slot.assignments,
          });
        }
      } else if (day.employees) {
        // Delegacion al endpoint normal (1 solo assignment): mismo shape
        // que /availability.
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

  @Post('book')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async book(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: PublicBookDto,
  ) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);
    return this.publicBookingService.book(dto, tenant.id);
  }

  @Get('reputation')
  async getReputation(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.publicBookingService.resolveTenant(tenantSlug);

    const overallAgg = await this.prisma.employeeReview.aggregate({
      where: { tenantId: tenant.id, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    const employeeRatings = await this.prisma.employeeReview.groupBy({
      by: ['employeeId'],
      where: { tenantId: tenant.id, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    const employeeIds = employeeRatings.map((r) => r.employeeId);
    const employees = employeeIds.length
      ? await this.prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    return {
      data: {
        business: {
          id: tenant.id,
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          averageRating: overallAgg._avg.rating
            ? Math.round(overallAgg._avg.rating * 10) / 10
            : null,
          totalReviews: overallAgg._count.id,
        },
        employees: employeeRatings.map((r) => {
          const emp = employeeMap.get(r.employeeId);
          return {
            id: r.employeeId,
            firstName: emp?.firstName || '',
            lastName: emp?.lastName || '',
            avatarUrl: emp?.avatarUrl || null,
            averageRating: r._avg.rating
              ? Math.round(r._avg.rating * 10) / 10
              : null,
            totalReviews: r._count.id,
          };
        }),
      },
    };
  }
}
