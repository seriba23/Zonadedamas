'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import { KpiCard } from './kpi-card';
import { Last7DaysChart } from './last-7-days-chart';
import { UpcomingAppointments } from './upcoming-appointments';
import { AlertsPanel } from './alerts-panel';
import { QuickActions } from './quick-actions';
import { EmployeesToday } from './employees-today';

interface TodayReport {
  today: { appointments: number; revenue: number; payments: number };
  month: { appointments: number; revenue: number; noShowRate: number };
  upcomingAppointments: any[];
  last7Days: { date: string; revenue: number }[];
}

export function DashboardView() {
  const { format: formatCurrency } = useCurrency();
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'today'],
    queryFn: () => api.get<TodayReport>('/api/reports/today'),
    refetchInterval: 60_000,
  });

  const report = data?.data;

  if (isLoading || !report) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-64" />
          <div className="card h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          }
          label="Citas hoy"
          value={String(report.today.appointments)}
        />
        <KpiCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Ingresos hoy"
          value={formatCurrency(report.today.revenue)}
        />
        <KpiCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          }
          label="Pagos hoy"
          value={String(report.today.payments)}
        />
        <KpiCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          }
          label="Citas del mes"
          value={String(report.month.appointments)}
          subtitle={`${formatCurrency(report.month.revenue)} ingresos`}
        />
      </div>

      {/* Row 2: Alerts */}
      <AlertsPanel />

      {/* Row 3: Chart + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Last7DaysChart days={report.last7Days || []} />
        <UpcomingAppointments appointments={report.upcomingAppointments || []} />
      </div>

      {/* Row 4: Quick Actions + Employees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActions />
        <EmployeesToday />
      </div>
    </div>
  );
}
