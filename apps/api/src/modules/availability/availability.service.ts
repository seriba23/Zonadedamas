import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { BundleAvailabilityQueryDto } from './dto/bundle-availability-query.dto';
import { CompositeAvailabilityQueryDto } from './dto/composite-availability-query.dto';
import { CheckAfterDto } from './dto/check-after.dto';
import * as crypto from 'crypto';

type TimeBlock = { start: Date; end: Date };

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAvailableSlots(query: AvailabilityQueryDto, tenantId: string) {
    // 1. Fetch services and calculate total duration
    const services = await this.prisma.service.findMany({
      where: { id: { in: query.serviceIds }, tenantId },
    });
    // CRÍTICO: incluir bufferAfterMinutes. El create de appointments lo
    // suma para calcular endTime y validar overlap. Si availability lo
    // omite, un slot puede aparecer libre y al crear caer en conflicto
    // contra la siguiente cita.
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );

    if (totalDuration === 0) {
      return { data: [] };
    }

    // 2. Resolve employees
    let employees: any[];

    const employeeWhere: any = {
      tenantId,
      isActive: true,
    };
    if (query.locationId) {
      employeeWhere.locationId = query.locationId;
    }

    if (query.employeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: {
          id: query.employeeId,
          ...employeeWhere,
        },
      });
      if (!emp) return { data: [] };
      employees = [emp];
    } else {
      // Find employees who offer ALL requested services
      const candidates = await this.prisma.employee.findMany({
        where: {
          ...employeeWhere,
          employeeServices: {
            some: { serviceId: { in: query.serviceIds } },
          },
        },
        include: { employeeServices: true },
      });

      employees = candidates.filter((emp) =>
        query.serviceIds.every((sid) =>
          emp.employeeServices.some((es: any) => es.serviceId === sid),
        ),
      );
    }

    if (employees.length === 0) {
      return { data: [] };
    }

    // 3. Fetch tenant, business hours and closures.
    // Para FREELANCER no aplican los businessHours del "negocio" — el
    // freelancer controla su disponibilidad solo con su employeeSchedule.
    // Saltar dias enteros por businessHours haria desaparecer dias en los
    // que el freelancer si trabaja (ej. viernes cerrado por default).
    const [tenant, businessHours, closures] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { tenantType: true },
      }),
      this.prisma.businessHours.findMany({
        where: { tenantId },
      }),
      this.prisma.businessClosure.findMany({
        where: {
          tenantId,
          startDate: { lte: new Date(query.endDate + 'T23:59:59Z') },
          endDate: { gte: new Date(query.startDate + 'T00:00:00Z') },
        },
      }),
    ]);

    // Build set of days the business is closed. Vacio para freelancer.
    const businessClosedDays = new Set(
      tenant?.tenantType === 'FREELANCER'
        ? []
        : businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek),
    );

    // 4. Iterate over date range
    const results: Array<{
      date: string;
      employees: Array<{
        id: string;
        name: string;
        slots: Array<{ startTime: string; endTime: string }>;
      }>;
    }> = [];

    const startDate = new Date(query.startDate + 'T00:00:00Z');
    const endDate = new Date(query.endDate + 'T00:00:00Z');

    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      const dateStr = date.toISOString().split('T')[0];

      // Skip days the business is closed (weekly schedule)
      const dayOfWeekForDate = this.getDayOfWeek(date);
      if (businessClosedDays.has(dayOfWeekForDate)) continue;

      // Skip temporary closure days
      const isClosed = closures.some((c) => {
        const cStart = c.startDate.toISOString().split('T')[0];
        const cEnd = c.endDate.toISOString().split('T')[0];
        return dateStr >= cStart && dateStr <= cEnd;
      });
      if (isClosed) continue;
      const dayEmployees: Array<{
        id: string;
        name: string;
        slots: Array<{ startTime: string; endTime: string }>;
      }> = [];

      for (const employee of employees) {
        // IMPORTANTE: la duracion total entra a la cache key. Antes faltaba
        // y causaba que slots cacheados con 1 servicio (ej. 30min) se
        // devolvieran al pedir 2 servicios (ej. 90min), mostrando slots
        // que no caben en el horario real.
        const cacheKey = `avail:${tenantId}:${query.locationId || 'all'}:${employee.id}:${dateStr}:${totalDuration}`;

        try {
          const cached = await this.redis.get(cacheKey);
          if (cached !== null) {
            const slots = JSON.parse(cached) as Array<{
              startTime: string;
              endTime: string;
            }>;
            if (slots.length > 0) {
              dayEmployees.push({
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName}`,
                slots,
              });
            }
            continue;
          }
        } catch (err) {
          this.logger.warn(`Redis cache miss for ${cacheKey}`);
        }

        // Get schedule for this specific day
        const dayOfWeek = this.getDayOfWeek(date);
        const schedule = await this.prisma.employeeSchedule.findFirst({
          where: {
            employeeId: employee.id,
            dayOfWeek,
            isWorking: true,
            effectiveFrom: { lte: date },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
          },
        });

        if (!schedule) {
          await this.redis.set(cacheKey, '[]', 300).catch(() => {});
          continue;
        }

        // Get occupied blocks for this day
        const dayStart = new Date(`${dateStr}T00:00:00Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59Z`);

        const [appointments, timeOffs] = await Promise.all([
          this.prisma.appointment.findMany({
            where: {
              employeeId: employee.id,
              tenantId,
              startTime: { gte: dayStart, lt: dayEnd },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
            orderBy: { startTime: 'asc' },
          }),
          this.prisma.employeeTimeOff.findMany({
            where: {
              employeeId: employee.id,
              startDatetime: { lt: dayEnd },
              endDatetime: { gt: dayStart },
            },
          }),
        ]);

        // Build occupied blocks with buffers
        const occupiedBlocks: TimeBlock[] = [];

        for (const appt of appointments) {
          occupiedBlocks.push({
            start: new Date(
              appt.startTime.getTime() -
                employee.bufferBeforeMinutes * 60000,
            ),
            end: new Date(
              appt.endTime.getTime() + employee.bufferAfterMinutes * 60000,
            ),
          });
        }

        for (const to of timeOffs) {
          occupiedBlocks.push({
            start: to.startDatetime,
            end: to.endDatetime,
          });
        }

        // Sort and merge blocks
        occupiedBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
        const merged = this.mergeBlocks(occupiedBlocks);

        // Generate time slots
        const slots = this.generateSlots(
          schedule.startTime as string,
          schedule.endTime as string,
          dateStr,
          merged,
          totalDuration,
          30, // granularity in minutes
        );

        // Cache result (5 minutes TTL)
        await this.redis.set(cacheKey, JSON.stringify(slots), 300).catch(() => {});

        if (slots.length > 0) {
          dayEmployees.push({
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            slots,
          });
        }
      }

      if (dayEmployees.length > 0) {
        results.push({ date: dateStr, employees: dayEmployees });
      }
    }

    return { data: results };
  }

  async invalidateCache(
    tenantId: string,
    locationId: string,
    employeeId: string,
    date: string,
  ): Promise<void> {
    // El cache key usa locationId real cuando se filtra por location, o
    // "all" cuando no. Para invalidar correctamente desde el create de
    // appointment (que pasa locationId real), usamos wildcard tambien en
    // la posicion de location, asi matcheamos la key con "all" ademas de
    // la del propio locationId. Tambien wildcard al final por totalDuration.
    const pattern = `avail:${tenantId}:*:${employeeId}:${date}:*`;
    await this.redis.delPattern(pattern).catch(() => {});
    // Composite no incluye employeeId en el key (incluye un hash del
    // mapping), asi que cuando cualquier cita del tenant cambia tenemos
    // que limpiar todas las composites del tenant para ser conservadores.
    await this.redis.delPattern(`composite:${tenantId}:*`).catch(() => {});
  }

  async invalidateCacheForEmployee(
    tenantId: string,
    locationId: string,
    employeeId: string,
  ): Promise<void> {
    const pattern = `avail:${tenantId}:${locationId}:${employeeId}:*`;
    await this.redis.delPattern(pattern).catch(() => {});
    await this.redis.delPattern(`composite:${tenantId}:*`).catch(() => {});
  }

  private getDayOfWeek(date: Date): 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY' {
    const days: ('SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY')[] = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    return days[date.getUTCDay()];
  }

  private mergeBlocks(blocks: TimeBlock[]): TimeBlock[] {
    if (blocks.length === 0) return [];

    const merged: TimeBlock[] = [{ ...blocks[0] }];

    for (let i = 1; i < blocks.length; i++) {
      const current = blocks[i];
      const last = merged[merged.length - 1];

      if (current.start <= last.end) {
        if (current.end > last.end) {
          last.end = current.end;
        }
      } else {
        merged.push({ ...current });
      }
    }

    return merged;
  }

  async getAllSlotsForEmployee(
    employeeId: string,
    date: string,
    serviceIds: string[],
    tenantId: string,
  ) {
    // 1a. Check if business is closed on this day of the week
    const dateObj2 = new Date(date + 'T00:00:00Z');
    const dayOfWeekForDate = this.getDayOfWeek(dateObj2);
    const businessHour = await this.prisma.businessHours.findFirst({
      where: { tenantId, dayOfWeek: dayOfWeekForDate },
    });
    if (businessHour && !businessHour.isOpen) {
      return { scheduleStart: null, scheduleEnd: null, slots: [], closureReason: 'Negocio cerrado este día' };
    }

    // 1b. Check if business has a temporary closure on this date
    const closure = await this.prisma.businessClosure.findFirst({
      where: {
        tenantId,
        startDate: { lte: new Date(date + 'T23:59:59Z') },
        endDate: { gte: new Date(date + 'T00:00:00Z') },
      },
    });
    if (closure) {
      return { scheduleStart: null, scheduleEnd: null, slots: [], closureReason: closure.reason };
    }

    // 2. Fetch services and calculate total duration
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });
    // CRÍTICO: incluir bufferAfterMinutes para mantener paridad con el
    // cálculo de endTime en appointments.service.create. Sin esto, un
    // slot puede aparecer libre y al confirmar entrar en conflicto.
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );

    if (totalDuration === 0) {
      return { scheduleStart: null, scheduleEnd: null, slots: [] };
    }

    // 3. Get employee
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, isActive: true },
    });
    if (!employee) {
      return { scheduleStart: null, scheduleEnd: null, slots: [] };
    }

    // 4. Get schedule for this day
    const dateObj = new Date(date + 'T00:00:00Z');
    const dayOfWeek = this.getDayOfWeek(dateObj);
    const schedule = await this.prisma.employeeSchedule.findFirst({
      where: {
        employeeId,
        dayOfWeek,
        isWorking: true,
        effectiveFrom: { lte: dateObj },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: dateObj } }],
      },
    });

    if (!schedule) {
      return { scheduleStart: null, scheduleEnd: null, slots: [] };
    }

    // 4. Get occupied blocks
    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59Z`);

    const [appointments, timeOffs] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          employeeId,
          tenantId,
          startTime: { gte: dayStart, lt: dayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.employeeTimeOff.findMany({
        where: {
          employeeId,
          startDatetime: { lt: dayEnd },
          endDatetime: { gt: dayStart },
        },
      }),
    ]);

    const occupiedBlocks: TimeBlock[] = [];
    for (const appt of appointments) {
      occupiedBlocks.push({
        start: new Date(appt.startTime.getTime() - employee.bufferBeforeMinutes * 60000),
        end: new Date(appt.endTime.getTime() + employee.bufferAfterMinutes * 60000),
      });
    }
    for (const to of timeOffs) {
      occupiedBlocks.push({ start: to.startDatetime, end: to.endDatetime });
    }

    occupiedBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
    const merged = this.mergeBlocks(occupiedBlocks);

    // 5. Generate ALL slots marking availability
    const granularity = 15;
    const scheduleStart = schedule.startTime as string;
    const scheduleEnd = schedule.endTime as string;
    const windowStart = new Date(`${date}T${scheduleStart}:00Z`);
    const windowEnd = new Date(`${date}T${scheduleEnd}:00Z`);

    const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
    let current = new Date(windowStart);

    while (current.getTime() + totalDuration * 60000 <= windowEnd.getTime()) {
      const slotEnd = new Date(current.getTime() + totalDuration * 60000);
      let conflict = false;

      for (const block of merged) {
        if (current < block.end && slotEnd > block.start) {
          conflict = true;
          break;
        }
      }

      slots.push({
        startTime: current.toISOString().substring(11, 16),
        endTime: slotEnd.toISOString().substring(11, 16),
        available: !conflict,
      });

      current = new Date(current.getTime() + granularity * 60000);
    }

    return { scheduleStart, scheduleEnd, slots };
  }

  async checkAfterTime(dto: CheckAfterDto, tenantId: string) {
    // 1. Calculate total duration of requested services
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds }, tenantId },
    });
    // Incluye buffer para coincidir con el cálculo de endTime en create.
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );
    if (totalDuration === 0) {
      return {
        immediatelyAvailable: false,
        immediateSlot: null,
        nextAvailable: null,
      };
    }

    const afterTime = new Date(dto.afterTime);
    const afterDateStr = afterTime.toISOString().split('T')[0];

    // 2. Direct conflict check: see if the slot right after the appointment is free
    //    This works even if the employee has no formal schedule (e.g., admin-created appointment).
    const proposedEnd = new Date(afterTime.getTime() + totalDuration * 60000);
    const dayStart = new Date(`${afterDateStr}T00:00:00Z`);
    const dayEnd = new Date(`${afterDateStr}T23:59:59Z`);

    const conflictingAppointments = await this.prisma.appointment.findMany({
      where: {
        employeeId: dto.employeeId,
        tenantId,
        startTime: { gte: dayStart, lt: dayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      orderBy: { startTime: 'asc' },
    });

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, isActive: true },
    });
    const bufferAfter = employee?.bufferAfterMinutes || 0;
    const bufferBefore = employee?.bufferBeforeMinutes || 0;

    // Build occupied blocks — exclude any appointment that ends at or before afterTime
    // (i.e., the appointment we're extending). Only FUTURE appointments can conflict.
    const occupiedBlocks: TimeBlock[] = [];
    for (const appt of conflictingAppointments) {
      if (new Date(appt.endTime) <= afterTime) continue; // ends before/at our start → no conflict
      occupiedBlocks.push({
        start: new Date(appt.startTime.getTime() - bufferBefore * 60000),
        end: new Date(appt.endTime.getTime() + bufferAfter * 60000),
      });
    }
    const merged = this.mergeBlocks(occupiedBlocks);

    // Check if the slot [afterTime, afterTime + totalDuration] is free of conflicts
    const directSlotStart = afterTime;
    const directSlotEnd = proposedEnd;
    let directConflict = false;
    for (const block of merged) {
      if (directSlotStart < block.end && directSlotEnd > block.start) {
        directConflict = true;
        break;
      }
    }

    if (!directConflict) {
      const startStr = afterTime.toISOString().substring(11, 16);
      const endStr = proposedEnd.toISOString().substring(11, 16);
      return {
        immediatelyAvailable: true,
        immediateSlot: {
          startTime: `${afterDateStr}T${startStr}:00Z`,
          endTime: `${afterDateStr}T${endStr}:00Z`,
        },
        nextAvailable: null,
      };
    }

    // 3. Try schedule-based slot search for same day (finds next gap)
    const sameDayResult = await this.getAllSlotsForEmployee(
      dto.employeeId,
      afterDateStr,
      dto.serviceIds,
      tenantId,
    );

    if (sameDayResult.slots && sameDayResult.slots.length > 0) {
      const afterTimeStr = afterTime.toISOString().substring(11, 16);
      // Find a slot that starts at or after the requested time
      const immediateSlot = sameDayResult.slots.find(
        (s) => s.available && s.startTime >= afterTimeStr,
      );
      if (immediateSlot) {
        const isImmediate = immediateSlot.startTime === afterTimeStr;
        return {
          immediatelyAvailable: isImmediate,
          immediateSlot: {
            startTime: `${afterDateStr}T${immediateSlot.startTime}:00Z`,
            endTime: `${afterDateStr}T${immediateSlot.endTime}:00Z`,
          },
          nextAvailable: isImmediate
            ? null
            : {
                date: afterDateStr,
                startTime: immediateSlot.startTime,
                endTime: immediateSlot.endTime,
              },
        };
      }
    }

    // 4. Search next 14 days for first available slot
    const searchStart = new Date(afterTime);
    searchStart.setUTCDate(searchStart.getUTCDate() + 1);

    for (let i = 0; i < 14; i++) {
      const searchDate = new Date(searchStart);
      searchDate.setUTCDate(searchDate.getUTCDate() + i);
      const searchDateStr = searchDate.toISOString().split('T')[0];

      const dayResult = await this.getAllSlotsForEmployee(
        dto.employeeId,
        searchDateStr,
        dto.serviceIds,
        tenantId,
      );

      if (dayResult.slots && dayResult.slots.length > 0) {
        const firstAvailable = dayResult.slots.find((s) => s.available);
        if (firstAvailable) {
          return {
            immediatelyAvailable: false,
            immediateSlot: null,
            nextAvailable: {
              date: searchDateStr,
              startTime: firstAvailable.startTime,
              endTime: firstAvailable.endTime,
            },
          };
        }
      }
    }

    // 5. Nothing found in 14 days
    return {
      immediatelyAvailable: false,
      immediateSlot: null,
      nextAvailable: null,
    };
  }

  async isAvailableAtTime(
    employeeId: string,
    startTime: Date,
    endTime: Date,
    tenantId: string,
  ): Promise<boolean> {
    const dateStr = startTime.toISOString().split('T')[0];
    const dayOfWeek = this.getDayOfWeek(new Date(dateStr + 'T00:00:00Z'));

    // Check employee works this day
    const schedule = await this.prisma.employeeSchedule.findFirst({
      where: {
        employeeId,
        dayOfWeek,
        isWorking: true,
        effectiveFrom: { lte: new Date(dateStr + 'T00:00:00Z') },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date(dateStr + 'T00:00:00Z') } }],
      },
    });
    if (!schedule) return false;

    // Check time is within schedule window
    const schedStart = new Date(`${dateStr}T${schedule.startTime}:00Z`);
    const schedEnd = new Date(`${dateStr}T${schedule.endTime}:00Z`);
    if (startTime < schedStart || endTime > schedEnd) return false;

    // Check no overlapping appointments
    const overlap = await this.prisma.appointment.findFirst({
      where: {
        employeeId,
        tenantId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (overlap) return false;

    // Check no time-offs
    const timeOff = await this.prisma.employeeTimeOff.findFirst({
      where: {
        employeeId,
        startDatetime: { lt: endTime },
        endDatetime: { gt: startTime },
      },
    });
    if (timeOff) return false;

    return true;
  }

  async findEarliestSlot(
    employeeId: string,
    totalDuration: number,
    afterTime: Date,
    tenantId: string,
    extraOccupied?: Array<{ start: Date; end: Date }>,
    maxDays: number = 30,
  ): Promise<{ startTime: Date; endTime: Date } | null> {
    if (totalDuration === 0) return null;

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, isActive: true },
    });
    if (!employee) return null;

    const now = new Date();

    const [tenant, businessHours, closures] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { tenantType: true },
      }),
      this.prisma.businessHours.findMany({ where: { tenantId } }),
      this.prisma.businessClosure.findMany({
        where: {
          tenantId,
          endDate: { gte: new Date(afterTime.toISOString().split('T')[0] + 'T00:00:00Z') },
        },
      }),
    ]);

    // Para FREELANCER no aplican businessHours del negocio.
    const closedDays = new Set(
      tenant?.tenantType === 'FREELANCER'
        ? []
        : businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek),
    );

    for (let i = 0; i < maxDays; i++) {
      const searchDate = new Date(afterTime);
      searchDate.setUTCDate(searchDate.getUTCDate() + i);
      const dateStr = searchDate.toISOString().split('T')[0];

      const dayOfWeek = this.getDayOfWeek(new Date(dateStr + 'T00:00:00Z'));
      if (closedDays.has(dayOfWeek)) continue;

      const isClosed = closures.some((c) => {
        const cStart = c.startDate.toISOString().split('T')[0];
        const cEnd = c.endDate.toISOString().split('T')[0];
        return dateStr >= cStart && dateStr <= cEnd;
      });
      if (isClosed) continue;

      const schedule = await this.prisma.employeeSchedule.findFirst({
        where: {
          employeeId,
          dayOfWeek,
          isWorking: true,
          effectiveFrom: { lte: new Date(dateStr + 'T00:00:00Z') },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date(dateStr + 'T00:00:00Z') } }],
        },
      });
      if (!schedule) continue;

      const dayStart = new Date(`${dateStr}T00:00:00Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59Z`);

      const [appointments, timeOffs] = await Promise.all([
        this.prisma.appointment.findMany({
          where: {
            employeeId,
            tenantId,
            startTime: { gte: dayStart, lt: dayEnd },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          },
          orderBy: { startTime: 'asc' },
        }),
        this.prisma.employeeTimeOff.findMany({
          where: {
            employeeId,
            startDatetime: { lt: dayEnd },
            endDatetime: { gt: dayStart },
          },
        }),
      ]);

      const occupiedBlocks: TimeBlock[] = [];
      for (const appt of appointments) {
        occupiedBlocks.push({
          start: new Date(appt.startTime.getTime() - employee.bufferBeforeMinutes * 60000),
          end: new Date(appt.endTime.getTime() + employee.bufferAfterMinutes * 60000),
        });
      }
      for (const to of timeOffs) {
        occupiedBlocks.push({ start: to.startDatetime, end: to.endDatetime });
      }

      // Add shadow bookings for this employee on this day
      if (extraOccupied) {
        for (const block of extraOccupied) {
          if (block.start >= dayStart && block.start < dayEnd) {
            occupiedBlocks.push(block);
          }
        }
      }

      occupiedBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
      const merged = this.mergeBlocks(occupiedBlocks);

      const windowStart = new Date(`${dateStr}T${schedule.startTime}:00Z`);
      const windowEnd = new Date(`${dateStr}T${schedule.endTime}:00Z`);
      const granularity = 15;

      // Always start from schedule start, but never in the past
      const nowMs = Math.ceil(now.getTime() / (granularity * 60000)) * (granularity * 60000);
      const current = new Date(Math.max(nowMs, windowStart.getTime()));

      while (current.getTime() + totalDuration * 60000 <= windowEnd.getTime()) {
        const slotEnd = new Date(current.getTime() + totalDuration * 60000);
        let conflict = false;

        for (const block of merged) {
          if (current < block.end && slotEnd > block.start) {
            conflict = true;
            current.setTime(
              Math.ceil(block.end.getTime() / (granularity * 60000)) * (granularity * 60000),
            );
            break;
          }
        }

        if (!conflict) {
          return { startTime: new Date(current), endTime: slotEnd };
        }
      }
    }

    return null;
  }

  private generateSlots(
    scheduleStart: string,
    scheduleEnd: string,
    dateStr: string,
    occupiedBlocks: TimeBlock[],
    durationMinutes: number,
    granularity: number,
  ): Array<{ startTime: string; endTime: string }> {
    const slots: Array<{ startTime: string; endTime: string }> = [];

    const windowStart = new Date(`${dateStr}T${scheduleStart}:00Z`);
    const windowEnd = new Date(`${dateStr}T${scheduleEnd}:00Z`);

    let current = new Date(windowStart);

    while (
      current.getTime() + durationMinutes * 60000 <=
      windowEnd.getTime()
    ) {
      const slotEnd = new Date(current.getTime() + durationMinutes * 60000);
      let conflict = false;

      for (const block of occupiedBlocks) {
        if (current < block.end && slotEnd > block.start) {
          conflict = true;
          // Jump to after the block end, rounded up to granularity
          current = new Date(
            Math.ceil(block.end.getTime() / (granularity * 60000)) *
              (granularity * 60000),
          );
          break;
        }
      }

      if (!conflict) {
        slots.push({
          startTime: current.toISOString().substring(11, 16),
          endTime: slotEnd.toISOString().substring(11, 16),
        });
        current = new Date(current.getTime() + granularity * 60000);
      }
    }

    return slots;
  }

  /**
   * Multi-employee bundle availability.
   * Finds time slots where each service in the bundle can be handled back-to-back
   * by different employees (respecting the configured order).
   */
  async getBundleAvailability(
    query: BundleAvailabilityQueryDto,
    tenantId: string,
  ) {
    // 1. Fetch bundle
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id: query.bundleId, tenantId, isActive: true },
    });
    if (!bundle) throw new NotFoundException('Paquete no encontrado');

    const serviceIds = bundle.serviceIds as string[];
    const flexibleOrder = bundle.flexibleOrder;

    // 2. Fetch services in bundle order
    const allServices = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });
    const serviceMap = new Map(allServices.map((s) => [s.id, s]));
    const orderedServices = serviceIds.map((id) => serviceMap.get(id)).filter(Boolean) as any[];

    if (orderedServices.length === 0) return { data: [] };

    // 3. Fetch employees who can do each service
    const employeeServices = await this.prisma.employeeService.findMany({
      where: {
        serviceId: { in: serviceIds },
        employee: { tenantId, isActive: true, ...(query.locationId && { locationId: query.locationId }) },
      },
      include: { employee: true },
    });

    // Map: serviceId -> employee[]
    const employeesByService = new Map<string, any[]>();
    for (const es of employeeServices) {
      const list = employeesByService.get(es.serviceId) || [];
      list.push(es.employee);
      employeesByService.set(es.serviceId, list);
    }

    // Check all services have at least one employee
    for (const svc of orderedServices) {
      if (!employeesByService.has(svc.id) || employeesByService.get(svc.id)!.length === 0) {
        return { data: [] };
      }
    }

    // 4. For each date in range, find valid combinations
    const results: Array<{
      date: string;
      slots: Array<{
        startTime: string;
        endTime: string;
        assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }>;
      }>;
    }> = [];

    const startDate = new Date(query.startDate + 'T00:00:00Z');
    const endDate = new Date(query.endDate + 'T00:00:00Z');
    const granularity = 30;

    // Get business hours and closures
    const [businessHours, closures] = await Promise.all([
      this.prisma.businessHours.findMany({ where: { tenantId } }),
      this.prisma.businessClosure.findMany({
        where: {
          tenantId,
          startDate: { lte: new Date(query.endDate + 'T23:59:59Z') },
          endDate: { gte: new Date(query.startDate + 'T00:00:00Z') },
        },
      }),
    ]);
    const closedDays = new Set(businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek));

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = this.getDayOfWeek(date);
      if (closedDays.has(dayOfWeek)) continue;

      const isClosed = closures.some((c) => {
        const cStart = c.startDate.toISOString().split('T')[0];
        const cEnd = c.endDate.toISOString().split('T')[0];
        return dateStr >= cStart && dateStr <= cEnd;
      });
      if (isClosed) continue;

      // Pre-load schedules and occupied blocks for all relevant employees
      const allRelevantEmployees = new Map<string, any>();
      for (const [, emps] of employeesByService) {
        for (const emp of emps) {
          allRelevantEmployees.set(emp.id, emp);
        }
      }

      const employeeAvailability = new Map<string, { schedule: any; occupied: TimeBlock[] }>();

      for (const [empId, emp] of allRelevantEmployees) {
        const schedule = await this.prisma.employeeSchedule.findFirst({
          where: {
            employeeId: empId,
            dayOfWeek,
            isWorking: true,
            effectiveFrom: { lte: date },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
          },
        });
        if (!schedule) continue;

        const dayStart = new Date(`${dateStr}T00:00:00Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59Z`);

        const [appointments, timeOffs] = await Promise.all([
          this.prisma.appointment.findMany({
            where: {
              employeeId: empId,
              tenantId,
              startTime: { gte: dayStart, lt: dayEnd },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
            orderBy: { startTime: 'asc' },
          }),
          this.prisma.employeeTimeOff.findMany({
            where: { employeeId: empId, startDatetime: { lt: dayEnd }, endDatetime: { gt: dayStart } },
          }),
        ]);

        const occupied: TimeBlock[] = [];
        for (const appt of appointments) {
          occupied.push({
            start: new Date(appt.startTime.getTime() - emp.bufferBeforeMinutes * 60000),
            end: new Date(appt.endTime.getTime() + emp.bufferAfterMinutes * 60000),
          });
        }
        for (const to of timeOffs) {
          occupied.push({ start: to.startDatetime, end: to.endDatetime });
        }
        occupied.sort((a, b) => a.start.getTime() - b.start.getTime());

        employeeAvailability.set(empId, { schedule, occupied: this.mergeBlocks(occupied) });
      }

      // Helper: check if employee is free in [start, end)
      const isEmployeeFree = (empId: string, start: Date, end: Date): boolean => {
        const avail = employeeAvailability.get(empId);
        if (!avail) return false;
        const schedStart = new Date(`${dateStr}T${avail.schedule.startTime}:00Z`);
        const schedEnd = new Date(`${dateStr}T${avail.schedule.endTime}:00Z`);
        if (start < schedStart || end > schedEnd) return false;
        for (const block of avail.occupied) {
          if (start < block.end && end > block.start) return false;
        }
        return true;
      };

      // Find earliest business hour start as window
      let windowStart: Date | null = null;
      let windowEnd: Date | null = null;
      for (const [, avail] of employeeAvailability) {
        const s = new Date(`${dateStr}T${avail.schedule.startTime}:00Z`);
        const e = new Date(`${dateStr}T${avail.schedule.endTime}:00Z`);
        if (!windowStart || s < windowStart) windowStart = s;
        if (!windowEnd || e > windowEnd) windowEnd = e;
      }
      if (!windowStart || !windowEnd) continue;

      // Incluye buffer para paridad con appointments.service.create.
      const totalDuration = orderedServices.reduce(
        (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
        0,
      );
      const daySlots: Array<{
        startTime: string;
        endTime: string;
        assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }>;
      }> = [];

      let currentSlotStart = new Date(windowStart);

      while (currentSlotStart.getTime() + totalDuration * 60000 <= windowEnd.getTime()) {
        // Try to assign all services sequentially starting from currentSlotStart
        const serviceOrder = flexibleOrder
          ? this.findBestOrder(orderedServices, currentSlotStart, dateStr, employeesByService, isEmployeeFree)
          : orderedServices;

        const assignments = this.tryAssignSequential(
          serviceOrder,
          currentSlotStart,
          dateStr,
          employeesByService,
          isEmployeeFree,
        );

        if (assignments) {
          const slotEnd = new Date(currentSlotStart.getTime() + totalDuration * 60000);
          daySlots.push({
            startTime: currentSlotStart.toISOString().substring(11, 16),
            endTime: slotEnd.toISOString().substring(11, 16),
            assignments,
          });
        }

        currentSlotStart = new Date(currentSlotStart.getTime() + granularity * 60000);
      }

      if (daySlots.length > 0) {
        results.push({ date: dateStr, slots: daySlots });
      }
    }

    return { data: results };
  }

  /**
   * Composite availability — variante restringida de bundle donde cada
   * servicio tiene un empleado fijo (asignado por el cliente en el flow de
   * booking del marketplace cuando varios profesionales pueden hacer un
   * mismo servicio).
   *
   * Resuelve el bug donde el frontend hacia N queries separadas + merge
   * manual y fallaba con duraciones no multiplos de 30 minutos: aqui usamos
   * granularidad fina (5 min) y reusamos `tryAssignSequential` que ya
   * verifica disponibilidad real (schedule + appointments + buffers).
   */
  async getCompositeAvailability(
    query: CompositeAvailabilityQueryDto,
    tenantId: string,
  ) {
    const assignments = query.serviceAssignments;

    // Caso trivial: 1 servicio → delegamos al endpoint normal
    if (assignments.length === 1) {
      return this.getAvailableSlots(
        {
          serviceIds: [assignments[0].serviceId],
          employeeId: assignments[0].employeeId,
          startDate: query.startDate,
          endDate: query.endDate,
          locationId: query.locationId,
        },
        tenantId,
      );
    }

    // Cache key
    const assignmentsKey = crypto
      .createHash('sha1')
      .update(JSON.stringify(assignments))
      .digest('hex')
      .substring(0, 16);
    const cacheKey = `composite:${tenantId}:${query.locationId || 'all'}:${query.startDate}:${query.endDate}:${assignmentsKey}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return JSON.parse(cached);
      }
    } catch {
      this.logger.warn(`Redis cache miss for ${cacheKey}`);
    }

    // 1. Fetch services + validar que cada empleado pueda hacer su servicio asignado
    const serviceIds = [...new Set(assignments.map((a) => a.serviceId))];
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // Ordered list of {service, employeeId} respetando el orden del cliente
    const orderedAssignments = assignments
      .map((a) => ({ service: serviceMap.get(a.serviceId), employeeId: a.employeeId }))
      .filter((x) => !!x.service);
    if (orderedAssignments.length !== assignments.length) {
      return { data: [] };
    }
    const orderedServices = orderedAssignments.map((a) => a.service!);

    // Cargar empleados unicos y validar que ofrezcan su servicio asignado
    const uniqueEmpIds = [...new Set(assignments.map((a) => a.employeeId))];
    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: uniqueEmpIds },
        tenantId,
        isActive: true,
        ...(query.locationId && { locationId: query.locationId }),
      },
      include: { employeeServices: true },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    for (const a of assignments) {
      const emp = employeeMap.get(a.employeeId);
      if (!emp) return { data: [] };
      if (!emp.employeeServices.some((es) => es.serviceId === a.serviceId)) {
        return { data: [] };
      }
    }

    // employeesByService con EXACTAMENTE 1 candidato por servicio (el asignado)
    // Nota: si el mismo serviceId aparece dos veces en assignments con
    // empleados distintos, esto solo guarda el ultimo — pero el flow del
    // marketplace nunca asigna el mismo servicio dos veces.
    const employeesByService = new Map<string, any[]>();
    for (const a of orderedAssignments) {
      employeesByService.set(a.service!.id, [employeeMap.get(a.employeeId)]);
    }

    // 2. Iterar dias en el rango
    const results: Array<{
      date: string;
      slots: Array<{
        startTime: string;
        endTime: string;
        assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }>;
      }>;
    }> = [];

    const startDate = new Date(query.startDate + 'T00:00:00Z');
    const endDate = new Date(query.endDate + 'T00:00:00Z');
    // Granularidad 30 min para alinear con el grid del frontend (SlotGrid
    // muestra slots cada 30 min entre apertura y cierre). Antes usaba 5 min
    // pensando que era necesario para duraciones no multiplo de 30, pero
    // isEmployeeFree verifica rangos arbitrarios sin necesitar grilla fina:
    // un slot a las 9:00 con limpieza 45min + masaje 60min checa
    // [9:45, 10:45] para Renata directamente, sin importar que 9:45 no sea
    // multiplo de 30. La grilla fina generaba slots redundantes (9:00,
    // 9:05, 9:10...) que el frontend ignoraba pero contaba en el total.
    const granularity = 30;

    const [businessHours, closures] = await Promise.all([
      this.prisma.businessHours.findMany({ where: { tenantId } }),
      this.prisma.businessClosure.findMany({
        where: {
          tenantId,
          startDate: { lte: new Date(query.endDate + 'T23:59:59Z') },
          endDate: { gte: new Date(query.startDate + 'T00:00:00Z') },
        },
      }),
    ]);
    const closedDays = new Set(businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek));

    // Incluye buffer para paridad con appointments.service.create.
    const totalDuration = orderedServices.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = this.getDayOfWeek(date);
      if (closedDays.has(dayOfWeek)) continue;

      const isClosed = closures.some((c) => {
        const cStart = c.startDate.toISOString().split('T')[0];
        const cEnd = c.endDate.toISOString().split('T')[0];
        return dateStr >= cStart && dateStr <= cEnd;
      });
      if (isClosed) continue;

      // Pre-cargar schedule + occupied blocks de los empleados requeridos
      const employeeAvailability = new Map<string, { schedule: any; occupied: TimeBlock[] }>();
      let missingEmployee = false;

      for (const empId of uniqueEmpIds) {
        const emp = employeeMap.get(empId)!;
        const schedule = await this.prisma.employeeSchedule.findFirst({
          where: {
            employeeId: empId,
            dayOfWeek,
            isWorking: true,
            effectiveFrom: { lte: date },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
          },
        });
        if (!schedule) {
          // Cualquier empleado requerido sin schedule ese dia → no hay slot
          missingEmployee = true;
          break;
        }

        const dayStart = new Date(`${dateStr}T00:00:00Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59Z`);

        const [appointments, timeOffs] = await Promise.all([
          this.prisma.appointment.findMany({
            where: {
              employeeId: empId,
              tenantId,
              startTime: { gte: dayStart, lt: dayEnd },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
            orderBy: { startTime: 'asc' },
          }),
          this.prisma.employeeTimeOff.findMany({
            where: { employeeId: empId, startDatetime: { lt: dayEnd }, endDatetime: { gt: dayStart } },
          }),
        ]);

        const occupied: TimeBlock[] = [];
        for (const appt of appointments) {
          occupied.push({
            start: new Date(appt.startTime.getTime() - emp.bufferBeforeMinutes * 60000),
            end: new Date(appt.endTime.getTime() + emp.bufferAfterMinutes * 60000),
          });
        }
        for (const to of timeOffs) {
          occupied.push({ start: to.startDatetime, end: to.endDatetime });
        }
        occupied.sort((a, b) => a.start.getTime() - b.start.getTime());

        employeeAvailability.set(empId, { schedule, occupied: this.mergeBlocks(occupied) });
      }

      if (missingEmployee) continue;

      const isEmployeeFree = (empId: string, start: Date, end: Date): boolean => {
        const avail = employeeAvailability.get(empId);
        if (!avail) return false;
        const schedStart = new Date(`${dateStr}T${avail.schedule.startTime}:00Z`);
        const schedEnd = new Date(`${dateStr}T${avail.schedule.endTime}:00Z`);
        if (start < schedStart || end > schedEnd) return false;
        for (const block of avail.occupied) {
          if (start < block.end && end > block.start) return false;
        }
        return true;
      };

      // Ventana = interseccion de:
      //  - horarios de TODOS los empleados requeridos (max starts, min ends)
      //  - horario del negocio para este dia (businessHours)
      // Sin la interseccion con businessHours, un empleado que trabaja
      // antes/despues del horario del negocio (ej. emp 8-19 con negocio
      // 9-18) generaba slots que el frontend ignoraba pero contaba en el
      // total, causando que el contador no coincidiera con el grid.
      let windowStart: Date | null = null;
      let windowEnd: Date | null = null;
      for (const [, avail] of employeeAvailability) {
        const s = new Date(`${dateStr}T${avail.schedule.startTime}:00Z`);
        const e = new Date(`${dateStr}T${avail.schedule.endTime}:00Z`);
        if (!windowStart || s > windowStart) windowStart = s;
        if (!windowEnd || e < windowEnd) windowEnd = e;
      }

      const dayHours = businessHours.find((h) => h.dayOfWeek === dayOfWeek && h.isOpen);
      if (dayHours && dayHours.openTime && dayHours.closeTime) {
        const bizOpen = new Date(`${dateStr}T${dayHours.openTime}:00Z`);
        const bizClose = new Date(`${dateStr}T${dayHours.closeTime}:00Z`);
        if (!windowStart || bizOpen > windowStart) windowStart = bizOpen;
        if (!windowEnd || bizClose < windowEnd) windowEnd = bizClose;
      }

      if (!windowStart || !windowEnd) continue;

      const daySlots: Array<{
        startTime: string;
        endTime: string;
        assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }>;
      }> = [];

      let currentSlotStart = new Date(windowStart);

      while (currentSlotStart.getTime() + totalDuration * 60000 <= windowEnd.getTime()) {
        const slotAssignments = this.tryAssignSequential(
          orderedServices,
          currentSlotStart,
          dateStr,
          employeesByService,
          isEmployeeFree,
        );

        if (slotAssignments) {
          const slotEnd = new Date(currentSlotStart.getTime() + totalDuration * 60000);
          daySlots.push({
            startTime: currentSlotStart.toISOString().substring(11, 16),
            endTime: slotEnd.toISOString().substring(11, 16),
            assignments: slotAssignments,
          });
        }

        currentSlotStart = new Date(currentSlotStart.getTime() + granularity * 60000);
      }

      if (daySlots.length > 0) {
        results.push({ date: dateStr, slots: daySlots });
      }
    }

    const response = { data: results };
    await this.redis.set(cacheKey, JSON.stringify(response), 300).catch(() => {});
    return response;
  }

  /**
   * Try to assign each service sequentially to an available employee.
   * Returns assignments array or null if no valid combination found.
   */
  private tryAssignSequential(
    services: any[],
    startTime: Date,
    dateStr: string,
    employeesByService: Map<string, any[]>,
    isEmployeeFree: (empId: string, start: Date, end: Date) => boolean,
  ): Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }> | null {
    const assignments: Array<{ serviceId: string; serviceName: string; employeeId: string; employeeName: string; startTime: string; endTime: string }> = [];
    let currentStart = new Date(startTime);
    // Track which employee is busy in which time window (for same-slot double-assignment prevention)
    const employeeBusy: Array<{ empId: string; start: Date; end: Date }> = [];

    for (const svc of services) {
      const svcEnd = new Date(currentStart.getTime() + svc.durationMinutes * 60000);
      const candidates = employeesByService.get(svc.id) || [];
      let assigned = false;

      for (const emp of candidates) {
        // Check employee is free in the real calendar
        if (!isEmployeeFree(emp.id, currentStart, svcEnd)) continue;

        // Check employee is not already assigned in an overlapping window within this same bundle slot
        const doubleBooked = employeeBusy.some(
          (b) => b.empId === emp.id && currentStart < b.end && svcEnd > b.start,
        );
        if (doubleBooked) continue;

        assignments.push({
          serviceId: svc.id,
          serviceName: svc.name,
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          startTime: currentStart.toISOString().substring(11, 16),
          endTime: svcEnd.toISOString().substring(11, 16),
        });
        employeeBusy.push({ empId: emp.id, start: new Date(currentStart), end: new Date(svcEnd) });
        assigned = true;
        break;
      }

      if (!assigned) return null;
      currentStart = new Date(svcEnd);
    }

    return assignments;
  }

  /**
   * For flexible order bundles, try permutations to find one that works.
   * Uses a greedy approach: try the default order first, then swap services that fail.
   */
  private findBestOrder(
    services: any[],
    startTime: Date,
    dateStr: string,
    employeesByService: Map<string, any[]>,
    isEmployeeFree: (empId: string, start: Date, end: Date) => boolean,
  ): any[] {
    // Try original order first
    const result = this.tryAssignSequential(services, startTime, dateStr, employeesByService, isEmployeeFree);
    if (result) return services;

    // For small bundles (<=5 services), try permutations with early exit
    if (services.length <= 5) {
      const permutations = this.getPermutations(services);
      for (const perm of permutations) {
        const attempt = this.tryAssignSequential(perm, startTime, dateStr, employeesByService, isEmployeeFree);
        if (attempt) return perm;
      }
    }

    return services;
  }

  private getPermutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length && result.length < 120; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of this.getPermutations(rest)) {
        result.push([arr[i], ...perm]);
        if (result.length >= 120) break; // Cap permutations
      }
    }
    return result;
  }
}
