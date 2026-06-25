// NOTA: este archivo tiene errores TypeScript preexistentes — no se modifican.
// 'use client': componente de navegador (necesita useQuery, useRouter, etc.).
'use client';

// useRouter: hook de Next.js para navegar programáticamente entre páginas.
import { useRouter } from 'next/navigation';
// useQuery: para cargar datos del backend con caché y refresco automático.
import { useQuery } from '@tanstack/react-query';
// api: cliente HTTP del proyecto.
import { api } from '@/lib/api';
// useCurrency: hook que devuelve formatCurrency (formatea números como moneda).
import { useCurrency } from '@/lib/hooks/use-currency';
// Sub-componentes del dashboard. Cada uno muestra una sección específica.
import { KpiCard } from './kpi-card';
import { SalesBreakdownGrid } from './sales-breakdown-grid';
import { Last7DaysChart } from './last-7-days-chart';
import { UpcomingAppointments } from './upcoming-appointments';
import { AlertsPanel } from './alerts-panel';
import { RemindersCard } from './reminders-card';
import { QuickActions } from './quick-actions';
import { EmployeesToday } from './employees-today';

// TodayReport: interfaz con la forma de la respuesta del endpoint /api/reports/today.
// Tiene datos de HOY (appointments, revenue, payments) y del MES (appointments, revenue…).
// any[]: los datos de citas próximas no tienen interfaz tipada (se pasan directo al componente).
interface TodayReport {
  today: { appointments: number; revenue: number; payments: number };
  month: {
    appointments: number;
    completedAppointments: number;
    revenue: number;
    averageTicket: number;
    noShowRate: number;
  };
  upcomingAppointments: any[];
  last7Days: { date: string; revenue: number }[];
}

// DashboardView: orquestador de la pantalla principal del dashboard.
// Carga el reporte del día y compone todos los sub-componentes del dashboard.
export function DashboardView() {
  // useRouter: para navegar al hacer click en las KPI cards.
  const router = useRouter();
  // formatCurrency: convierte número a moneda (p. ej. $1,500.00).
  const { format: formatCurrency } = useCurrency();

  // Carga el reporte del día con refresco automático cada 60 segundos.
  // isLoading: true mientras llega la primera respuesta del servidor.
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'today'],
    queryFn: () => api.get<TodayReport>('/api/reports/today'),
    refetchInterval: 60_000, // Refresca cada 60.000 ms = 1 minuto (60_000 con separador visual)
  });

  // report: los datos del reporte (puede ser undefined si aún está cargando).
  const report = data?.data;

  // monthBounds: rango de fechas "desde el 1ro del mes hasta hoy".
  // Se calcula con una IIFE (función auto-invocada) para poder usar variables locales.
  // (now.getMonth() + 1): getMonth() devuelve 0–11; sumamos 1 para obtener 1–12.
  // .padStart(2, '0'): añade "0" si el número es de 1 dígito ("6" → "06").
  // .toISOString().split('T')[0]: obtiene "YYYY-MM-DD" del ISO "2026-06-24T...".
  // Rango "este mes" para el grid Venta Total — coherente con los KPIs de mes
  // del row inferior (citas del mes, ticket promedio). Se evalua una sola vez
  // por render; el cambio de dia natural reabre la vista igualmente.
  const monthBounds = (() => {
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end = now.toISOString().split('T')[0];
    return { start, end };
  })();

  // Mientras carga o no hay datos → mostrar esqueleto animado.
  // "Skeleton loader": bloques grises que pulsan (animate-pulse) para
  // indicar que el contenido está llegando. Mejora la percepción de velocidad.
  if (isLoading || !report) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* 4 tarjetas KPI en esqueleto */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* [1, 2, 3, 4].map() genera 4 rectángulos; key={i} es obligatorio. */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-20" />
          ))}
        </div>
        {/* 2 paneles grandes en esqueleto */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-64" />
          <div className="card h-64" />
        </div>
      </div>
    );
  }

  // ── Render del dashboard completo ─────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Row 0: Desglose de ventas del mes (servicios + paquetes + productos).
          monthBounds.start/end: rango de fechas calculado arriba. */}
      {/* Row 0: Venta total del mes (servicios + paquetes + productos) */}
      <SalesBreakdownGrid
        startDate={monthBounds.start}
        endDate={monthBounds.end}
        periodLabel="Este mes"
      />

      {/* Row 1: 4 KPI cards con números clave del negocio.
          KpiCard recibe onClick (navega a otra página), icon (SVG), label y value.
          String(...): convierte número a string para mostrarlo como texto. */}
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Citas de hoy: click → calendario con filtro "solo con citas" */}
        <KpiCard
          onClick={() => router.push('/calendar?view=day&onlyWithAppointments=true')}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          }
          label="Citas hoy"
          value={String(report.today.appointments)}
        />
        {/* Ingresos de hoy: click → reporte diario */}
        <KpiCard
          onClick={() => router.push('/reports?range=today')}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Ingresos hoy"
          value={formatCurrency(report.today.revenue)}
        />
        {/* Ticket promedio del mes. || 0: si averageTicket es null, usa 0. */}
        <KpiCard
          onClick={() => router.push('/reports?range=month')}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          }
          label="Ticket promedio"
          value={formatCurrency(report.month.averageTicket || 0)}
          subtitle="por cita completada este mes"
        />
        {/* Citas del mes con ingresos como subtítulo. Template literal: `${valor}` */}
        <KpiCard
          onClick={() => router.push('/calendar?view=month')}
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

      {/* Row 2: Panel de alertas (citas sin confirmar) + recordatorios pendientes. */}
      {/* Row 2: Alerts + Reminders */}
      <AlertsPanel />
      <RemindersCard />

      {/* Row 3: Gráfica de ingresos últimos 7 días + próximas citas del día.
          report.last7Days || []: si last7Days es null, usa array vacío. */}
      {/* Row 3: Chart + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Last7DaysChart days={report.last7Days || []} />
        <UpcomingAppointments appointments={report.upcomingAppointments || []} />
      </div>

      {/* Row 4: Acciones rápidas (crear cita, cliente, etc.) + empleados del día. */}
      {/* Row 4: Quick Actions + Employees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActions />
        <EmployeesToday />
      </div>
    </div>
  );
}
