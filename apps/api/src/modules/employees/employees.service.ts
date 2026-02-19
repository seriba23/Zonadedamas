import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { SetSchedulesDto } from './dto/schedule.dto';
import { CreateTimeOffDto } from './dto/time-off.dto';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, pagination: PaginationDto, locationId?: string) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (locationId) where.locationId = locationId;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          location: { select: { id: true, name: true } },
          employeeServices: { include: { service: { select: { id: true, name: true } } } },
          _count: { select: { appointments: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async findOne(id: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        location: true,
        employeeServices: { include: { service: true } },
        schedules: { orderBy: { dayOfWeek: 'asc' } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    // Verify location belongs to tenant
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId },
    });
    if (!location) throw new NotFoundException('Location not found');

    return this.prisma.employee.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        bio: dto.bio,
        locationId: dto.locationId,
        tenantId,
        bufferBeforeMinutes: dto.bufferBeforeMinutes ?? 0,
        bufferAfterMinutes: dto.bufferAfterMinutes ?? 0,
        isActive: dto.isActive ?? true,
        userId: dto.userId,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateEmployeeDto) {
    await this.findOne(id, tenantId);
    return this.prisma.employee.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Employee deactivated' };
  }

  async getSchedules(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeSchedule.findMany({
      where: { employeeId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async setSchedules(employeeId: string, tenantId: string, dto: SetSchedulesDto) {
    await this.findOne(employeeId, tenantId);

    return this.prisma.$transaction(async (tx) => {
      // Delete existing schedules for the same effectiveFrom date
      const effectiveDates = [
        ...new Set(dto.schedules.map((s) => s.effectiveFrom)),
      ];

      for (const date of effectiveDates) {
        await tx.employeeSchedule.deleteMany({
          where: {
            employeeId,
            effectiveFrom: new Date(date),
          },
        });
      }

      // Create new schedules
      const created = await tx.employeeSchedule.createMany({
        data: dto.schedules.map((s) => ({
          employeeId,
          dayOfWeek: s.dayOfWeek,
          isWorking: s.isWorking,
          startTime: s.startTime || '09:00',
          endTime: s.endTime || '18:00',
          effectiveFrom: new Date(s.effectiveFrom),
          effectiveUntil: s.effectiveUntil ? new Date(s.effectiveUntil) : undefined,
        })),
      });

      return tx.employeeSchedule.findMany({
        where: { employeeId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  async getTimeOff(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeTimeOff.findMany({
      where: { employeeId },
      orderBy: { startDatetime: 'asc' },
    });
  }

  async addTimeOff(
    employeeId: string,
    tenantId: string,
    dto: CreateTimeOffDto,
  ) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeTimeOff.create({
      data: {
        employeeId,
        startDatetime: new Date(dto.startDatetime),
        endDatetime: new Date(dto.endDatetime),
        reason: dto.reason,
      },
    });
  }

  async removeTimeOff(
    employeeId: string,
    tenantId: string,
    timeOffId: string,
  ) {
    await this.findOne(employeeId, tenantId);
    const timeOff = await this.prisma.employeeTimeOff.findFirst({
      where: { id: timeOffId, employeeId },
    });
    if (!timeOff) throw new NotFoundException('Time off record not found');

    await this.prisma.employeeTimeOff.delete({ where: { id: timeOffId } });
    return { message: 'Time off removed' };
  }

  async getServices(employeeId: string, tenantId: string) {
    await this.findOne(employeeId, tenantId);
    return this.prisma.employeeService.findMany({
      where: { employeeId },
      include: { service: true },
    });
  }

  async setServices(
    employeeId: string,
    tenantId: string,
    serviceIds: string[],
  ) {
    await this.findOne(employeeId, tenantId);

    return this.prisma.$transaction(async (tx) => {
      // Delete existing assignments
      await tx.employeeService.deleteMany({ where: { employeeId } });

      if (serviceIds.length > 0) {
        // Verify services belong to tenant
        const services = await tx.service.findMany({
          where: { id: { in: serviceIds }, tenantId },
        });

        await tx.employeeService.createMany({
          data: services.map((s) => ({
            employeeId,
            serviceId: s.id,
          })),
        });
      }

      return tx.employeeService.findMany({
        where: { employeeId },
        include: { service: true },
      });
    });
  }
}
