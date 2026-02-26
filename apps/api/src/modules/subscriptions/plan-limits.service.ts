import { Injectable, ForbiddenException } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_LIMITS, PlanLimits } from './plan-limits.config';

@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  getLimitsForPlan(plan: SubscriptionPlan): PlanLimits {
    return PLAN_LIMITS[plan];
  }

  async getTenantPlan(tenantId: string): Promise<SubscriptionPlan> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    return subscription?.plan ?? 'BASICO';
  }

  async checkEmployeeLimit(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = PLAN_LIMITS[plan];

    const activeCount = await this.prisma.employee.count({
      where: { tenantId, isActive: true },
    });

    if (activeCount >= limits.maxEmployees) {
      throw new ForbiddenException(
        `Tu plan ${plan} permite un máximo de ${limits.maxEmployees} empleados activos. ` +
          'Actualiza tu plan para agregar más.',
      );
    }
  }

  async checkAppointmentLimit(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = PLAN_LIMITS[plan];

    if (limits.maxAppointmentsPerMonth === -1) return; // unlimited

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthlyCount = await this.prisma.appointment.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        status: { notIn: ['CANCELLED'] },
      },
    });

    if (monthlyCount >= limits.maxAppointmentsPerMonth) {
      throw new ForbiddenException(
        `Tu plan ${plan} permite un máximo de ${limits.maxAppointmentsPerMonth} citas por mes. ` +
          'Actualiza tu plan para crear más.',
      );
    }
  }

  async checkLocationLimit(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = PLAN_LIMITS[plan];

    if (limits.maxLocations === -1) return; // unlimited

    const activeCount = await this.prisma.location.count({
      where: { tenantId, isActive: true },
    });

    if (activeCount >= limits.maxLocations) {
      throw new ForbiddenException(
        `Tu plan ${plan} permite un máximo de ${limits.maxLocations} ubicaciones. ` +
          'Actualiza tu plan para agregar más.',
      );
    }
  }

  async getUsage(tenantId: string) {
    const plan = await this.getTenantPlan(tenantId);
    const limits = PLAN_LIMITS[plan];

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [employeeCount, appointmentCount, locationCount] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId, isActive: true } }),
      this.prisma.appointment.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      this.prisma.location.count({ where: { tenantId, isActive: true } }),
    ]);

    return {
      plan,
      employees: {
        current: employeeCount,
        limit: limits.maxEmployees,
        unlimited: false,
      },
      appointmentsThisMonth: {
        current: appointmentCount,
        limit: limits.maxAppointmentsPerMonth,
        unlimited: limits.maxAppointmentsPerMonth === -1,
      },
      locations: {
        current: locationCount,
        limit: limits.maxLocations,
        unlimited: limits.maxLocations === -1,
      },
      features: {
        fullReports: limits.fullReports,
        exportReports: limits.exportReports,
      },
    };
  }
}
