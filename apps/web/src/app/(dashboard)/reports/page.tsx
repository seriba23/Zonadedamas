'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { formatCurrency, formatDate } from '@/lib/utils';
import dayjs from 'dayjs';

type DateRange = '7d' | '30d' | 'custom';

interface ReportStats {
  totalRevenue: number;
  totalAppointments: number;
  noShowRate: number;
  averageTicket: number;
  topServices: Array<{ name: string; count: number; revenue: number }>;
  revenueByDay: Array<{ date: string; revenue: number }>;
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [customStart, setCustomStart] = useState(
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
  );
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));

  function getDateBounds() {
    if (dateRange === '7d') {
      return {
        start: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
        end: dayjs().format('YYYY-MM-DD'),
      };
    }
    if (dateRange === '30d') {
      return {
        start: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
        end: dayjs().format('YYYY-MM-DD'),
      };
    }
    return { start: customStart, end: customEnd };
  }

  const bounds = getDateBounds();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', bounds.start, bounds.end],
    queryFn: () =>
      api.get<{ data: ReportStats }>(
        `/api/reports?startDate=${bounds.start}&endDate=${bounds.end}`,
      ),
    retry: false,
  });

  const stats: ReportStats = data?.data || {
    totalRevenue: 0,
    totalAppointments: 0,
    noShowRate: 0,
    averageTicket: 0,
    topServices: [],
    revenueByDay: [],
  };

  const statCards = [
    {
      label: 'Ingresos totales',
      value: formatCurrency(stats.totalRevenue),
      icon: '💰',
      color: 'text-green-700 bg-green-50',
    },
    {
      label: 'Citas totales',
      value: String(stats.totalAppointments),
      icon: '📅',
      color: 'text-blue-700 bg-blue-50',
    },
    {
      label: 'Tasa de no-show',
      value: `${(stats.noShowRate * 100).toFixed(1)}%`,
      icon: '📉',
      color: 'text-red-700 bg-red-50',
    },
    {
      label: 'Ticket promedio',
      value: formatCurrency(stats.averageTicket),
      icon: '🎫',
      color: 'text-purple-700 bg-purple-50',
    },
  ];

  const maxRevenue = Math.max(
    ...stats.revenueByDay.map((d) => d.revenue),
    1,
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="Reportes" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Date range selector */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {(['7d', '30d', 'custom'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 ${
                  dateRange === r
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {r === '7d' ? 'Últimos 7 días' : r === '30d' ? 'Últimos 30 días' : 'Personalizado'}
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
              <span className="text-gray-500">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-field w-auto"
              />
            </div>
          )}
        </div>

        {/* Info banner when API is not available */}
        {isError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Modulo de reportes en desarrollo
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Los reportes avanzados estaran disponibles proximamente. Puedes ver las estadisticas basicas en el panel de cada empleado.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="card">
              <div className={`inline-flex p-2 rounded-lg text-2xl mb-3 ${card.color}`}>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue chart */}
          <div className="lg:col-span-2 card">
            <h3 className="font-semibold text-gray-900 mb-4">
              Ingresos por día
            </h3>
            {isLoading ? (
              <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
            ) : stats.revenueByDay.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                No hay datos para este período
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
                        className="w-full bg-primary-200 hover:bg-primary-400 rounded-t transition-colors cursor-pointer"
                        style={{
                          height: `${Math.max((day.revenue / maxRevenue) * 160, 4)}px`,
                        }}
                        title={`${formatDate(day.date)}: ${formatCurrency(day.revenue)}`}
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
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">
              Servicios más populares
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
      </div>
    </div>
  );
}
