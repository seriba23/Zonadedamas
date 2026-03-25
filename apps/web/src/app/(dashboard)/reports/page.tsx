'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { formatCurrency, formatDate } from '@/lib/utils';
import dayjs from 'dayjs';

type DateRange = 'today' | '7d' | '30d' | 'month' | 'custom';

interface DashboardData {
  kpis: {
    totalRevenue: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowCount: number;
    noShowRate: number;
    averageTicket: number;
    newClients: number;
    totalClients: number;
  };
  revenueByDay: Array<{ date: string; revenue: number; count: number }>;
  topServices: Array<{ name: string; count: number; revenue: number }>;
  topEmployees: Array<{ id: string; name: string; appointments: number; revenue: number }>;
  paymentMethods: Record<string, { count: number; total: number }>;
  clientMetrics: {
    totalClients: number;
    newClients: number;
    returningClients: number;
    retentionRate: number;
    topClients: Array<{ id: string; name: string; visits: number; spent: number }>;
    bySource: Record<string, number>;
  };
}

const SOURCE_LABELS: Record<string, string> = {
  ONLINE: 'Online',
  WALK_IN: 'Presencial',
  MARKETPLACE: 'Marketplace',
  PHONE: 'Telefono',
  REFERRAL: 'Referido',
};

const PAYMENT_LABELS: Record<string, string> = {
  STRIPE: 'Tarjeta',
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

const PAYMENT_COLORS: Record<string, string> = {
  STRIPE: '#008080',
  CASH: '#f59e0b',
  TRANSFER: '#6366f1',
  OTHER: '#9ca3af',
};

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [customStart, setCustomStart] = useState(
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
  );
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));

  function getDateBounds() {
    const today = dayjs();
    switch (dateRange) {
      case 'today':
        return { start: today.format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
      case '7d':
        return { start: today.subtract(7, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
      case '30d':
        return { start: today.subtract(30, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
      case 'month':
        return { start: today.startOf('month').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
      case 'custom':
        return { start: customStart, end: customEnd };
    }
  }

  const bounds = getDateBounds();

  const { data, isLoading } = useQuery({
    queryKey: ['reports-dashboard', bounds.start, bounds.end],
    queryFn: () =>
      api.get<{ data: DashboardData }>(
        `/api/reports/dashboard?startDate=${bounds.start}&endDate=${bounds.end}`,
      ),
  });

  const emptyData: DashboardData = {
    kpis: {
      totalRevenue: 0, totalAppointments: 0, completedAppointments: 0,
      cancelledAppointments: 0, noShowCount: 0, noShowRate: 0,
      averageTicket: 0, newClients: 0, totalClients: 0,
    },
    revenueByDay: [],
    topServices: [],
    topEmployees: [],
    paymentMethods: {},
    clientMetrics: {
      totalClients: 0, newClients: 0, returningClients: 0, retentionRate: 0,
      topClients: [], bySource: {},
    },
  };

  const stats: DashboardData = data?.data || emptyData;

  const statCards = [
    {
      label: 'Ingresos totales',
      value: formatCurrency(stats.kpis.totalRevenue),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-700 bg-green-50',
    },
    {
      label: 'Citas totales',
      value: String(stats.kpis.totalAppointments),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'text-blue-700 bg-blue-50',
    },
    {
      label: 'Ticket promedio',
      value: formatCurrency(stats.kpis.averageTicket),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      ),
      color: 'text-purple-700 bg-purple-50',
    },
    {
      label: 'Tasa de no-show',
      value: `${stats.kpis.noShowRate.toFixed(1)}%`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      ),
      color: 'text-red-700 bg-red-50',
    },
  ];

  const maxRevenue = Math.max(
    ...stats.revenueByDay.map((d) => d.revenue),
    1,
  );

  // Payment methods total for proportional bar
  const paymentEntries = Object.entries(stats.paymentMethods);
  const paymentTotal = paymentEntries.reduce((sum, [, v]) => sum + v.total, 0) || 1;

  // Client source total
  const sourceEntries = Object.entries(stats.clientMetrics.bySource);
  const sourceTotal = sourceEntries.reduce((sum, [, v]) => sum + v, 0) || 1;

  const rangeOptions: { key: DateRange; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: 'month', label: 'Este mes' },
    { key: 'custom', label: 'Personalizado' },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Reportes" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Date range selector */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {rangeOptions.map((r) => (
              <button
                key={r.key}
                onClick={() => setDateRange(r.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 ${
                  dateRange === r.key
                    ? 'bg-[#008080] text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input-field w-auto"
              />
              <span className="text-gray-500">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-field w-auto"
              />
            </div>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`inline-flex p-2 rounded-lg mb-3 ${card.color}`}>
                {card.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? (
                  <span className="inline-block h-7 w-24 bg-gray-200 rounded animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
              <p className="text-sm text-gray-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Revenue chart + Top services */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Ingresos por dia
            </h3>
            {isLoading ? (
              <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
            ) : stats.revenueByDay.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                No hay datos para este periodo
              </div>
            ) : (
              <div className="flex items-end gap-1 h-48">
                {stats.revenueByDay.map((day) => (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <div className="relative w-full">
                      <div
                        className="w-full rounded-t transition-colors cursor-pointer"
                        style={{
                          height: `${Math.max((day.revenue / maxRevenue) * 160, 4)}px`,
                          backgroundColor: '#008080',
                          opacity: 0.7,
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.7'; }}
                        title={`${formatDate(day.date)}: ${formatCurrency(day.revenue)} (${day.count} citas)`}
                      />
                    </div>
                    <span className="text-xs text-gray-400 hidden lg:block">
                      {dayjs(day.date).format('D')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top services */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Servicios mas populares
            </h3>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : stats.topServices.length === 0 ? (
              <p className="text-sm text-gray-400">No hay datos disponibles</p>
            ) : (
              <div className="space-y-3">
                {stats.topServices.slice(0, 8).map((service, idx) => (
                  <div key={service.name} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {service.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {service.count} cita{service.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {formatCurrency(service.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top employees + Payment methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top employees */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Empleados destacados
            </h3>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : stats.topEmployees.length === 0 ? (
              <p className="text-sm text-gray-400">No hay datos disponibles</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium">#</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Empleado</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Citas</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topEmployees.slice(0, 8).map((emp, idx) => (
                      <tr key={emp.id} className="border-b border-gray-50">
                        <td className="py-2.5 text-gray-400 font-medium w-6">{idx + 1}</td>
                        <td className="py-2.5 text-gray-900 font-medium">{emp.name}</td>
                        <td className="py-2.5 text-right text-gray-600">{emp.appointments}</td>
                        <td className="py-2.5 text-right font-semibold text-gray-700">{formatCurrency(emp.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment methods */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Metodos de pago
            </h3>
            {isLoading ? (
              <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ) : paymentEntries.length === 0 ? (
              <p className="text-sm text-gray-400">No hay datos disponibles</p>
            ) : (
              <div>
                {/* Proportional bar */}
                <div className="flex h-8 rounded-lg overflow-hidden mb-4">
                  {paymentEntries.map(([method, val]) => (
                    <div
                      key={method}
                      style={{
                        width: `${(val.total / paymentTotal) * 100}%`,
                        backgroundColor: PAYMENT_COLORS[method] || '#9ca3af',
                      }}
                      className="transition-all"
                      title={`${PAYMENT_LABELS[method] || method}: ${formatCurrency(val.total)}`}
                    />
                  ))}
                </div>
                {/* Legend */}
                <div className="space-y-2">
                  {paymentEntries.map(([method, val]) => (
                    <div key={method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: PAYMENT_COLORS[method] || '#9ca3af' }}
                        />
                        <span className="text-sm text-gray-700">{PAYMENT_LABELS[method] || method}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(val.total)}</span>
                        <span className="text-xs text-gray-500 ml-2">({val.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Client metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New vs Returning + Retention */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Clientes
            </h3>
            {isLoading ? (
              <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <div className="space-y-4">
                {/* Retention rate */}
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold" style={{ color: '#008080' }}>
                    {stats.clientMetrics.retentionRate.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Tasa de retencion</p>
                </div>

                {/* New vs returning */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-xl font-bold text-green-700">{stats.clientMetrics.newClients}</p>
                    <p className="text-xs text-green-600 mt-0.5">Nuevos</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-xl font-bold text-blue-700">{stats.clientMetrics.returningClients}</p>
                    <p className="text-xs text-blue-600 mt-0.5">Recurrentes</p>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    Total: <span className="font-semibold text-gray-900">{stats.clientMetrics.totalClients}</span> clientes
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Top clients by spend */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Mejores clientes
            </h3>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : stats.clientMetrics.topClients.length === 0 ? (
              <p className="text-sm text-gray-400">No hay datos disponibles</p>
            ) : (
              <div className="space-y-3">
                {stats.clientMetrics.topClients.slice(0, 8).map((client, idx) => (
                  <div key={client.id} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.visits} visita{client.visits !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {formatCurrency(client.spent)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Client source breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Origen de clientes
            </h3>
            {isLoading ? (
              <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ) : sourceEntries.length === 0 ? (
              <p className="text-sm text-gray-400">No hay datos disponibles</p>
            ) : (
              <div className="space-y-3">
                {sourceEntries.map(([source, count]) => (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{SOURCE_LABELS[source] || source}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {count} <span className="text-xs text-gray-400 font-normal">({((count / sourceTotal) * 100).toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${(count / sourceTotal) * 100}%`,
                          backgroundColor: '#008080',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
