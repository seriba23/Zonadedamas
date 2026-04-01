import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_LIMITS } from '../subscriptions/plan-limits.config';
import { EmployeesService } from '../employees/employees.service';
import { DeactivateAction } from '../employees/dto/deactivate-employee.dto';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
  ) {}

  async getDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      pastDueTenants,
      newTenantsThisMonth,
      totalRevenue,
      revenueThisMonth,
      subscriptionsByPlan,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { status: 'TRIAL' } }),
      this.prisma.subscription.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
      this.prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.invoice.aggregate({
        where: { status: 'PAID' },
        _sum: { amountUsd: true },
      }),
      this.prisma.invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { amountUsd: true },
      }),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        _count: { plan: true },
      }),
    ]);

    // Recent registrations
    const recentRegistrations = await this.prisma.tenant.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        businessType: true,
        createdAt: true,
        subscription: { select: { plan: true, status: true } },
      },
    });

    return {
      kpis: {
        totalTenants,
        activeTenants,
        trialTenants,
        suspendedTenants,
        pastDueTenants,
        newTenantsThisMonth,
        totalRevenue: Number(totalRevenue._sum.amountUsd ?? 0),
        revenueThisMonth: Number(revenueThisMonth._sum.amountUsd ?? 0),
      },
      subscriptionsByPlan: subscriptionsByPlan.map((s) => ({
        plan: s.plan,
        count: s._count.plan,
      })),
      recentRegistrations,
    };
  }

  async getTenants(filters: {
    page?: number;
    perPage?: number;
    plan?: string;
    status?: string;
    search?: string;
    sortBy?: string;
  }) {
    const page = filters.page || 1;
    const perPage = Math.min(filters.perPage || 20, 100);
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { email: { contains: filters.search } },
        { slug: { contains: filters.search } },
      ];
    }

    // Build subscription filter
    const subscriptionWhere: any = {};
    if (filters.plan) subscriptionWhere.plan = filters.plan;
    if (filters.status) subscriptionWhere.status = filters.status;

    if (Object.keys(subscriptionWhere).length > 0) {
      where.subscription = subscriptionWhere;
    }

    let orderBy: any = { createdAt: 'desc' };
    if (filters.sortBy === 'trial_expiry') {
      orderBy = { subscription: { trialEndsAt: 'asc' } };
    } else if (filters.sortBy === 'name') {
      orderBy = { name: 'asc' };
    }

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: perPage,
        orderBy,
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          businessType: true,
          createdAt: true,
          subscription: {
            select: { plan: true, status: true, monthlyAmountUsd: true, nextBillingDate: true, trialEndsAt: true },
          },
          _count: { select: { users: true, employees: true, appointments: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getTenantDetail(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: true,
        _count: {
          select: {
            users: true,
            employees: true,
            appointments: true,
            clients: true,
            services: true,
            locations: true,
          },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Negocio no encontrado');

    // Usage stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const appointmentsThisMonth = await this.prisma.appointment.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
        status: { notIn: ['CANCELLED'] },
      },
    });

    const activeEmployees = await this.prisma.employee.count({
      where: { tenantId, isActive: true },
    });

    const activeLocations = await this.prisma.location.count({
      where: { tenantId, isActive: true },
    });

    // Recent invoices
    const recentInvoices = await this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Users with roles
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        userRoles: { include: { role: { select: { name: true } } } },
        employee: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Employees with location and appointment count
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        color: true,
        location: { select: { id: true, name: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
    });

    return {
      ...tenant,
      usage: {
        activeEmployees,
        appointmentsThisMonth,
        activeLocations,
      },
      recentInvoices,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        roles: u.userRoles.map((ur) => ur.role.name),
        hasEmployee: !!u.employee,
      })),
      employees: employees.map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        isActive: e.isActive,
        color: e.color,
        locationName: e.location?.name ?? null,
        appointmentsCount: e._count.appointments,
      })),
    };
  }

  async updateTenantStatus(tenantId: string, status: SubscriptionStatus) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) throw new NotFoundException('Suscripción no encontrada');

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status,
        ...(status === 'SUSPENDED' ? { gracePeriodEndsAt: null } : {}),
        ...(status === 'ACTIVE' ? { gracePeriodEndsAt: null } : {}),
      },
    });

    // Update denormalized status on tenant
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: status.toLowerCase() },
    });

    return updated;
  }

  async updateTenantPlan(tenantId: string, plan: SubscriptionPlan) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) throw new NotFoundException('Suscripción no encontrada');

    const limits = PLAN_LIMITS[plan];

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        plan,
        monthlyAmountUsd: limits.monthlyPriceUsd,
      },
    });

    // Update denormalized plan on tenant
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionPlan: plan },
    });

    return updated;
  }

  async getAllInvoices(filters: {
    page?: number;
    perPage?: number;
    status?: string;
  }) {
    const page = filters.page || 1;
    const perPage = Math.min(filters.perPage || 20, 100);
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  }

  async markInvoicePaid(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');

    const now = new Date();

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: now },
    });

    // If subscription was PAST_DUE, reactivate it
    if (invoice.subscription.status === 'PAST_DUE' || invoice.subscription.status === 'SUSPENDED') {
      await this.prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: 'ACTIVE',
          lastPaymentDate: now,
          gracePeriodEndsAt: null,
        },
      });
      await this.prisma.tenant.update({
        where: { id: invoice.tenantId },
        data: { subscriptionStatus: 'active' },
      });
    }

    return { message: 'Factura marcada como pagada' };
  }

  async markInvoiceOverdue(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'OVERDUE' },
    });

    // Set subscription to PAST_DUE with 24h grace period
    const gracePeriodEnds = new Date();
    gracePeriodEnds.setHours(gracePeriodEnds.getHours() + 24);

    await this.prisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        status: 'PAST_DUE',
        gracePeriodEndsAt: gracePeriodEnds,
      },
    });

    await this.prisma.tenant.update({
      where: { id: invoice.tenantId },
      data: { subscriptionStatus: 'past_due' },
    });

    return { message: 'Factura marcada como vencida, negocio en período de gracia de 24h' };
  }

  async getEmployeePendingCount(tenantId: string, employeeId: string) {
    // Verify employee belongs to tenant
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado en este negocio');

    const count = await this.prisma.appointment.count({
      where: {
        employeeId,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { gte: new Date() },
      },
    });

    return { employeeId, employeeName: `${employee.firstName} ${employee.lastName}`, pendingCount: count };
  }

  async deactivateEmployee(
    tenantId: string,
    employeeId: string,
    strategy: 'KEEP' | 'CANCEL' | 'SMART_RESCHEDULE',
  ) {
    // Verify employee belongs to tenant
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado en este negocio');
    if (!employee.isActive) throw new BadRequestException('El empleado ya está desactivado');

    const actionMap: Record<string, DeactivateAction> = {
      KEEP: DeactivateAction.KEEP,
      CANCEL: DeactivateAction.CANCEL,
      SMART_RESCHEDULE: DeactivateAction.SMART_RESCHEDULE,
    };

    // Use 'platform-admin' as userId for audit trail
    return this.employeesService.deactivate(
      employeeId,
      tenantId,
      { action: actionMap[strategy] },
      'platform-admin',
    );
  }
}
