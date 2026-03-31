import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CheckAfterDto } from './dto/check-after.dto';

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
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes,
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

    // 3. Fetch business hours and closures
    const [businessHours, closures] = await Promise.all([
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

    // Build set of days the business is closed
    const businessClosedDays = new Set(
      businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek),
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
        const cacheKey = `avail:${tenantId}:${query.locationId || 'all'}:${employee.id}:${dateStr}`;

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
          15, // granularity in minutes
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
    const cacheKey = `avail:${tenantId}:${locationId}:${employeeId}:${date}`;
    await this.redis.del(cacheKey).catch(() => {});
  }

  async invalidateCacheForEmployee(
    tenantId: string,
    locationId: string,
    employeeId: string,
  ): Promise<void> {
    const pattern = `avail:${tenantId}:${locationId}:${employeeId}:*`;
    await this.redis.delPattern(pattern).catch(() => {});
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
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);

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
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes,
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

    const [businessHours, closures] = await Promise.all([
      this.prisma.businessHours.findMany({ where: { tenantId } }),
      this.prisma.businessClosure.findMany({
        where: {
          tenantId,
          endDate: { gte: new Date(afterTime.toISOString().split('T')[0] + 'T00:00:00Z') },
        },
      }),
    ]);

    const closedDays = new Set(
      businessHours.filter((h) => !h.isOpen).map((h) => h.dayOfWeek),
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
}
