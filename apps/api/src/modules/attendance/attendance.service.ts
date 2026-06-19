import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
    filters?: { employeeId?: string; status?: string },
  ) {
    const where: any = {
      tenantId,
      date: {
        gte: new Date(startDate + 'T00:00:00Z'),
        lte: new Date(endDate + 'T00:00:00Z'),
      },
    };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status;

    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
      },
      orderBy: [{ date: 'desc' }, { checkInTime: 'asc' }],
    });

    // Adjunta el horario programado de entrada/salida de cada registro para que
    // el frontend pueda detectar tardanzas. Devolvemos el string "HH:mm" tal cual
    // (hora local del negocio); la comparación con la hora de check-in se hace en
    // el cliente con la hora local del navegador para evitar líos de zona horaria.
    const employeeIds = [...new Set(records.map((r) => r.employeeId))];
    const schedules = employeeIds.length
      ? await this.prisma.employeeSchedule.findMany({
          where: { employeeId: { in: employeeIds }, isWorking: true },
        })
      : [];
    const DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    const data = records.map((r) => {
      const recDate = new Date(r.date);
      const dow = DOW[recDate.getUTCDay()];
      const sched = schedules
        .filter(
          (s) =>
            s.employeeId === r.employeeId &&
            s.dayOfWeek === dow &&
            new Date(s.effectiveFrom) <= recDate &&
            (!s.effectiveUntil || new Date(s.effectiveUntil) >= recDate),
        )
        .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0];
      return {
        ...r,
        scheduledStartTime: sched?.startTime ?? null,
        scheduledEndTime: sched?.endTime ?? null,
      };
    });

    return { data };
  }

  async getStats(tenantId: string, startDate: string, endDate: string) {
    const where = {
      tenantId,
      date: {
        gte: new Date(startDate + 'T00:00:00Z'),
        lte: new Date(endDate + 'T00:00:00Z'),
      },
    };
    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
      },
    });

    let inShiftCount = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let totalMinutes = 0;
    const minutesByEmployee = new Map<
      string,
      { employee: any; minutes: number; days: number }
    >();

    for (const r of records) {
      if (r.status === 'PENDING_REVIEW') pendingCount++;
      else if (r.status === 'REJECTED') rejectedCount++;
      else if (r.checkOutTime) completedCount++;
      else if (r.checkInTime) inShiftCount++;

      if (r.checkInTime && r.checkOutTime) {
        const mins = Math.round(
          (new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000,
        );
        totalMinutes += mins;
        const key = r.employeeId;
        const prev = minutesByEmployee.get(key);
        if (prev) {
          prev.minutes += mins;
          prev.days += 1;
        } else {
          minutesByEmployee.set(key, { employee: r.employee, minutes: mins, days: 1 });
        }
      }
    }

    const topEmployees = Array.from(minutesByEmployee.values())
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);

    return {
      data: {
        totalRecords: records.length,
        inShift: inShiftCount,
        completed: completedCount,
        pending: pendingCount,
        rejected: rejectedCount,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        topEmployees,
      },
    };
  }

  async checkIn(
    tenantId: string,
    employeeId: string,
    latitude: number,
    longitude: number,
    forceOutOfRange = false,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, isActive: true },
      include: { location: true },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    // Calculate distance
    const location = employee.location;
    let distance: number | null = null;
    let outOfRange = false;

    if (location?.latitude != null && location?.longitude != null) {
      distance = this.haversineDistance(latitude, longitude, location.latitude, location.longitude);
      const minRadius = 50;
      const allowedRadius = Math.max(minRadius, (location.settings as any)?.attendanceRadius || minRadius);

      if (distance > allowedRadius && !forceOutOfRange) {
        throw new BadRequestException(
          JSON.stringify({
            code: 'OUT_OF_RANGE',
            distance: Math.round(distance),
            allowedRadius,
            message: `Estás a ${Math.round(distance)}m del negocio. Debes estar dentro de ${allowedRadius}m.`,
          }),
        );
      }
      if (distance > allowedRadius) {
        outOfRange = true;
      }
    }

    const today = new Date();
    const dateOnly = new Date(today.toISOString().split('T')[0] + 'T00:00:00Z');

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dateOnly } },
    });
    if (existing) {
      throw new BadRequestException('Ya registraste tu entrada hoy.');
    }

    const record = await this.prisma.attendance.create({
      data: {
        tenantId,
        employeeId,
        date: dateOnly,
        checkInTime: today,
        checkInLat: latitude,
        checkInLng: longitude,
        checkInDistance: distance ? Math.round(distance) : null,
        status: outOfRange ? 'PENDING_REVIEW' : 'APPROVED',
      },
    });

    return { data: record };
  }

  async checkOut(
    tenantId: string,
    employeeId: string,
    latitude: number,
    longitude: number,
    forceOutOfRange = false,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, isActive: true },
      include: { location: true },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    const location = employee.location;
    let distance: number | null = null;
    let outOfRange = false;

    if (location?.latitude != null && location?.longitude != null) {
      distance = this.haversineDistance(latitude, longitude, location.latitude, location.longitude);
      const minRadius = 50;
      const allowedRadius = Math.max(minRadius, (location.settings as any)?.attendanceRadius || minRadius);

      if (distance > allowedRadius && !forceOutOfRange) {
        throw new BadRequestException(
          JSON.stringify({
            code: 'OUT_OF_RANGE',
            distance: Math.round(distance),
            allowedRadius,
            message: `Estás a ${Math.round(distance)}m del negocio. Debes estar dentro de ${allowedRadius}m.`,
          }),
        );
      }
      if (distance > allowedRadius) {
        outOfRange = true;
      }
    }

    const today = new Date();
    const dateOnly = new Date(today.toISOString().split('T')[0] + 'T00:00:00Z');

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dateOnly } },
    });
    if (!existing) throw new BadRequestException('No tienes registro de entrada hoy.');
    if (existing.checkOutTime) throw new BadRequestException('Ya registraste tu salida hoy.');

    const newStatus = outOfRange ? 'PENDING_REVIEW' : existing.status;

    const record = await this.prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOutTime: today,
        checkOutLat: latitude,
        checkOutLng: longitude,
        checkOutDistance: distance ? Math.round(distance) : null,
        status: newStatus,
      },
    });

    return { data: record };
  }

  async getMyAttendanceToday(tenantId: string, employeeId: string) {
    const today = new Date();
    const dateOnly = new Date(today.toISOString().split('T')[0] + 'T00:00:00Z');

    const record = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dateOnly } },
    });

    return { data: record || null };
  }

  async reviewAttendance(id: string, tenantId: string, status: 'APPROVED' | 'REJECTED', userId: string) {
    const record = await this.prisma.attendance.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Registro no encontrado');

    const updated = await this.prisma.attendance.update({
      where: { id },
      data: { status, reviewedBy: userId, reviewedAt: new Date() },
    });

    return { data: updated };
  }

  async getPendingCount(tenantId: string) {
    const count = await this.prisma.attendance.count({
      where: { tenantId, status: 'PENDING_REVIEW' },
    });
    return { data: { count } };
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
