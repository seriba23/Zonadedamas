import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { AvailabilityService } from '../availability/availability.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { PublicAvailabilityQueryDto, PublicBookDto } from './dto/public-booking.dto';

@Injectable()
export class PublicBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly availabilityService: AvailabilityService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async resolveTenant(slug: string) {
    return this.tenantsService.findBySlug(slug);
  }

  async getServices(tenantId: string) {
    return this.prisma.service.findMany({
      where: {
        tenantId,
        isActive: true,
        employeeServices: { some: { employee: { isActive: true } } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        color: true,
        category: true,
        subcategory: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getEmployees(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        color: true,
        bio: true,
        employeeServices: {
          select: { serviceId: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getAvailability(query: PublicAvailabilityQueryDto, tenantId: string) {
    return this.availabilityService.getAvailableSlots(
      {
        serviceIds: query.serviceIds,
        startDate: query.startDate,
        endDate: query.endDate,
        employeeId: query.employeeId,
        locationId: query.locationId,
      },
      tenantId,
    );
  }

  async book(dto: PublicBookDto, tenantId: string) {
    // 1. Find-or-create client by email within tenant
    let client = await this.prisma.client.findFirst({
      where: {
        tenantId,
        email: dto.client.email,
      },
    });

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          tenantId,
          firstName: dto.client.firstName,
          lastName: dto.client.lastName,
          email: dto.client.email,
          phone: dto.client.phone,
          source: 'ONLINE',
        },
      });
    }

    // 2. Resolve employee's locationId
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, isActive: true },
      select: { id: true, locationId: true },
    });

    if (!employee) {
      throw new NotFoundException('Profesional no encontrado');
    }

    // 3. Delegate to AppointmentsService.create
    return this.appointmentsService.create(
      {
        locationId: employee.locationId,
        clientId: client.id,
        employeeId: dto.employeeId,
        serviceIds: dto.serviceIds,
        startTime: dto.startTime,
        notes: dto.notes,
        source: 'ONLINE',
        serviceAssignments: dto.serviceAssignments,
      },
      tenantId,
    );
  }
}
