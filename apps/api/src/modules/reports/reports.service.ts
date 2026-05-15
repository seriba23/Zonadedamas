import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LOW_STOCK_WHERE, isLowStockRow } from '../products/products.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardReport(tenantId: string, startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    const [
      appointments,
      payments,
      clients,
      newClients,
      recentActivity,
    ] = await Promise.all([
      // All appointments in range
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          startTime: { gte: start, lte: end },
        },
        include: {
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true } },
          employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true } },
          client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, source: true } },
          payments: { select: { status: true, totalAmount: true, paymentMethod: true } },
        },
      }),
      // Completed payments in range
      this.prisma.payment.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
        },
        select: { totalAmount: true, paymentMethod: true, createdAt: true },
      }),
      // Total clients
      this.prisma.client.count({ where: { tenantId } }),
      // New clients in range
      this.prisma.client.count({
        where: { tenantId, createdAt: { gte: start, lte: end } },
      }),
      // Recent domain events
      this.prisma.domainEvent.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { eventName: true, payload: true, createdAt: true },
      }),
    ]);

    // ─── KPIs ───────────────────────────────────────
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter((a) => a.status === 'COMPLETED').length;
    const cancelledAppointments = appointments.filter((a) => a.status === 'CANCELLED').length;
    const noShowCount = appointments.filter((a) => a.status === 'NO_SHOW').length;
    const noShowRate = totalAppointments > 0 ? Math.round((noShowCount / totalAppointments) * 1000) / 10 : 0;

    // Revenue from completed appointment items (source of truth)
    const completedApts = appointments.filter((a) => a.status === 'COMPLETED');
    const totalRevenue = completedApts.reduce(
      (sum, a) => sum + a.items.reduce((s, i) => s + Number(i.priceSnapshot), 0), 0,
    );
    const averageTicket = completedAppointments > 0 ? Math.round((totalRevenue / completedAppointments) * 100) / 100 : 0;

    // ─── Revenue by day (from completed appointments) ──
    const revenueByDay: Record<string, { revenue: number; count: number }> = {};
    for (const apt of completedApts) {
      const day = apt.startTime.toISOString().split('T')[0];
      if (!revenueByDay[day]) revenueByDay[day] = { revenue: 0, count: 0 };
      revenueByDay[day].revenue += apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
      revenueByDay[day].count += 1;
    }
    // Also include days with non-completed appointments (so the chart shows all active days)
    for (const a of appointments) {
      const day = a.startTime.toISOString().split('T')[0];
      if (!revenueByDay[day]) revenueByDay[day] = { revenue: 0, count: 0 };
    }
    const revenueByDayArray = Object.entries(revenueByDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ─── Top services ───────────────────────────────
    const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const apt of appointments.filter((a) => a.status === 'COMPLETED')) {
      for (const item of apt.items) {
        const name = item.serviceNameSnapshot;
        if (!serviceMap[name]) serviceMap[name] = { name, count: 0, revenue: 0 };
        serviceMap[name].count += 1;
        serviceMap[name].revenue += Number(item.priceSnapshot);
      }
    }
    const topServices = Object.values(serviceMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ─── Top employees ──────────────────────────────
    const empMap: Record<string, { id: string; name: string; avatarUrl: string | null; color: string | null; appointments: number; revenue: number }> = {};
    for (const apt of appointments.filter((a) => a.status === 'COMPLETED')) {
      const emp = apt.employee;
      if (!emp) continue;
      if (!empMap[emp.id]) empMap[emp.id] = {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        avatarUrl: emp.avatarUrl ?? null,
        color: emp.color ?? null,
        appointments: 0,
        revenue: 0,
      };
      empMap[emp.id].appointments += 1;
      empMap[emp.id].revenue += apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
    }
    const topEmployees = Object.values(empMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ─── Payment methods ────────────────────────────
    const paymentMethods: Record<string, { count: number; total: number }> = {};
    for (const p of payments) {
      const method = p.paymentMethod;
      if (!paymentMethods[method]) paymentMethods[method] = { count: 0, total: 0 };
      paymentMethods[method].count += 1;
      paymentMethods[method].total += Number(p.totalAmount);
    }

    // ─── Client metrics ─────────────────────────────
    const clientIds = new Set(appointments.map((a) => a.client?.id).filter(Boolean));
    const returningClientsResult = await this.prisma.appointment.groupBy({
      by: ['clientId'],
      where: {
        tenantId,
        status: 'COMPLETED',
        clientId: { in: [...clientIds] as string[] },
      },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    const returningClients = returningClientsResult.length;
    const retentionRate = clientIds.size > 0 ? Math.round((returningClients / clientIds.size) * 1000) / 10 : 0;

    // Top clients by spend
    const clientSpend: Record<string, { id: string; name: string; avatarUrl: string | null; visits: number; spent: number }> = {};
    for (const apt of appointments.filter((a) => a.status === 'COMPLETED')) {
      const c = apt.client;
      if (!c) continue;
      if (!clientSpend[c.id]) clientSpend[c.id] = {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        avatarUrl: c.avatarUrl ?? null,
        visits: 0,
        spent: 0,
      };
      clientSpend[c.id].visits += 1;
      clientSpend[c.id].spent += apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
    }
    const topClients = Object.values(clientSpend)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10);

    // By source
    const bySource: Record<string, number> = {};
    for (const apt of appointments) {
      const source = apt.client?.source || 'UNKNOWN';
      bySource[source] = (bySource[source] || 0) + 1;
    }

    // ─── Recent activity ────────────────────────────
    const activityItems = recentActivity.map((e) => {
      let description = e.eventName;
      if (e.eventName === 'appointment.created') description = `Nueva cita`;
      else if (e.eventName === 'appointment.cancelled') description = `Cita cancelada`;
      else if (e.eventName === 'appointment.completed') description = `Cita completada`;
      else if (e.eventName === 'payment.completed') description = `Pago recibido`;
      else if (e.eventName === 'client.created') description = `Nuevo cliente`;

      return {
        type: e.eventName,
        description,
        time: e.createdAt,
      };
    });

    return {
      kpis: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowCount,
        noShowRate,
        averageTicket,
        newClients,
        totalClients: clients,
      },
      revenueByDay: revenueByDayArray,
      topServices,
      topEmployees,
      paymentMethods,
      clientMetrics: {
        totalClients: clients,
        newClients,
        returningClients,
        retentionRate,
        topClients,
        bySource,
      },
      recentActivity: activityItems,
    };
  }

  async getTodaySummary(tenantId: string) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startOfDay = new Date(`${todayStr}T00:00:00Z`);
    const endOfDay = new Date(`${todayStr}T23:59:59Z`);

    const [todayAppointments, todayPayments, upcomingAppointments] = await Promise.all([
      this.prisma.appointment.count({
        where: { tenantId, startTime: { gte: startOfDay, lte: endOfDay } },
      }),
      this.prisma.payment.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: startOfDay, lte: endOfDay } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // "Próximas citas": cualquier cita futura (incluyendo días posteriores),
      // no solo las del día de hoy. Mostrar las 5 mas proximas.
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          startTime: { gte: now },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        include: {
          client: { select: { firstName: true, lastName: true, avatarUrl: true } },
          employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
      }),
    ]);

    // Month KPIs
    const monthStart = new Date(`${todayStr.substring(0, 7)}-01T00:00:00Z`);
    const [monthAppointments, monthRevenue, monthNoShows, monthCompleted] = await Promise.all([
      this.prisma.appointment.count({
        where: { tenantId, startTime: { gte: monthStart, lte: endOfDay } },
      }),
      this.prisma.payment.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: monthStart, lte: endOfDay } },
        _sum: { totalAmount: true },
      }),
      this.prisma.appointment.count({
        where: { tenantId, status: 'NO_SHOW', startTime: { gte: monthStart, lte: endOfDay } },
      }),
      // Necesario para ticket promedio coherente con /reports (= revenue / completedAppointments).
      this.prisma.appointment.count({
        where: { tenantId, status: 'COMPLETED', startTime: { gte: monthStart, lte: endOfDay } },
      }),
    ]);

    // Last 7 days revenue
    const last7Days: { date: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayStart = new Date(`${dateStr}T00:00:00Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59Z`);
      const dayRevenue = await this.prisma.payment.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: dayStart, lte: dayEnd } },
        _sum: { totalAmount: true },
      });
      last7Days.push({ date: dateStr, revenue: Number(dayRevenue._sum.totalAmount || 0) });
    }

    return {
      today: {
        appointments: todayAppointments,
        revenue: Number(todayPayments._sum.totalAmount || 0),
        payments: todayPayments._count.id,
      },
      month: {
        appointments: monthAppointments,
        completedAppointments: monthCompleted,
        revenue: Number(monthRevenue._sum.totalAmount || 0),
        // Ticket promedio coherente con /reports: solo cuenta citas completadas.
        averageTicket: monthCompleted > 0
          ? Math.round((Number(monthRevenue._sum.totalAmount || 0) / monthCompleted) * 100) / 100
          : 0,
        noShowRate: monthAppointments > 0 ? Math.round((monthNoShows / monthAppointments) * 1000) / 10 : 0,
      },
      upcomingAppointments,
      last7Days,
    };
  }

  async getAlertCounts(tenantId: string) {
    const now = new Date();

    const [lowStockCount, pendingReservations, unconfirmedAppointments] = await Promise.all([
      // Mismo helper que ProductsService.findLowStock para garantizar que
      // el conteo del alert coincide exactamente con lo que se muestra al
      // filtrar en /inventory.
      this.prisma.product
        .findMany({
          where: LOW_STOCK_WHERE(tenantId),
          select: { stock: true, minStock: true },
        })
        .then((all) => all.filter(isLowStockRow).length)
        .catch(() => 0),
      this.prisma.productReservation.count({
        where: { tenantId, status: 'PENDING' },
      }).catch(() => 0),
      // Todas las citas sin confirmar (futuras), no solo las de hoy. El
      // alert se enlaza a /calendar?status=PENDING y debe coincidir con
      // lo que el calendario muestra al filtrar.
      this.prisma.appointment.count({
        where: {
          tenantId,
          status: 'PENDING',
          startTime: { gte: now },
        },
      }),
    ]);

    // Rango (min/max) de las citas PENDING futuras — el frontend usa esto
    // para abrir el calendario en vista Personalizada cubriendo justo el
    // periodo donde están todas las citas sin confirmar.
    const pendingRange =
      unconfirmedAppointments > 0
        ? await this.prisma.appointment.aggregate({
            where: { tenantId, status: 'PENDING', startTime: { gte: now } },
            _min: { startTime: true },
            _max: { startTime: true },
          })
        : { _min: { startTime: null }, _max: { startTime: null } };

    return {
      lowStockCount,
      pendingReservations,
      unconfirmedAppointments,
      unconfirmedRange: {
        from: pendingRange._min.startTime
          ? pendingRange._min.startTime.toISOString().split('T')[0]
          : null,
        to: pendingRange._max.startTime
          ? pendingRange._max.startTime.toISOString().split('T')[0]
          : null,
      },
    };
  }
}
