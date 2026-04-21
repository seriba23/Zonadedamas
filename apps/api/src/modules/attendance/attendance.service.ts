import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDateRange(tenantId: string, startDate: string, endDate: string) {
    const records = await this.prisma.attendance.findMany({
      where: {
        tenantId,
        date: {
          gte: new Date(startDate + 'T00:00:00Z'),
          lte: new Date(endDate + 'T00:00:00Z'),
        },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
      },
      orderBy: [{ date: 'desc' }, { checkInTime: 'asc' }],
    });
    return { data: records };
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
