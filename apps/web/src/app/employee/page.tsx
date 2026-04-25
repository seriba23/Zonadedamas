'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatCurrency as rawFormatCurrency } from '@/lib/utils';
import { useCurrency } from '@/lib/hooks/use-currency';
import dayjs from 'dayjs';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AppointmentItem {
  serviceNameSnapshot: string;
  priceSnapshot: string | number;
  durationSnapshot: number;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  client: { id: string; firstName: string; lastName: string };
  items: AppointmentItem[];
}

interface Stats {
  completedAllTime: number;
  completedThisMonth: number;
  cancelledCount: number;
  noShowCount: number;
  cancellationRate: number;
  totalRevenue: number;
  totalCommissions: number;
  commissionsThisMonth: number;
  averageRating: number | null;
  totalReviews: number;
  topServices: { serviceName: string; count: number }[];
  topClients: { clientName: string; count: number }[];
  upcomingAppointments: any[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Ausente', color: 'bg-gray-100 text-gray-800' },
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const currencyHook = useCurrency();
  const formatCurrency = currencyHook?.format ?? rawFormatCurrency;
  const today = dayjs().format('YYYY-MM-DD');

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['employee-appointments-today', user?.employeeId],
    queryFn: async () => {
      if (!user?.employeeId) return [];
      const res = await api.get<{ data: Appointment[] }>(
        `/api/appointments?employeeId=${user.employeeId}&startDate=${today}&endDate=${today}`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  const { data: stats } = useQuery({
    queryKey: ['employee-stats', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: Stats }>(
        `/api/employees/${user!.employeeId}/stats`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  const sortedAppointments = (appointments || [])
    .filter((a) => a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const nextAppointment = sortedAppointments.find(
    (a) => new Date(a.startTime) > new Date() && ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(a.status),
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          {user?.avatarUrl ? (
            <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
              <img src={`${API_URL}${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-teal-50 text-[#008080] flex items-center justify-center text-lg font-bold flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Hola, {user?.firstName}
            </h1>
            <p className="text-gray-500 mt-0.5">
              {formatDate(new Date(), 'dddd, D [de] MMMM [de] YYYY')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Citas hoy</p>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '...' : sortedAppointments.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Este mes</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.completedThisMonth ?? '...'}
          </p>
          <p className="text-xs text-gray-400">completadas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Ingresos generados</p>
          <p className="text-2xl font-bold text-[#008080]">
            {stats ? formatCurrency(stats.totalRevenue) : '...'}
          </p>
          <p className="text-xs text-gray-400">total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Valoración</p>
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-bold text-amber-500">
              {stats?.averageRating ?? '-'}
            </p>
            {stats?.averageRating && (
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
          </div>
          <p className="text-xs text-gray-400">{stats?.totalReviews ?? 0} reseñas</p>
        </div>
      </div>

      {/* Quick actions — same style as admin */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Acciones rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Mis Citas', href: '/employee/appointments', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
            { label: 'Comisiones', href: '/employee/commissions', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Galería', href: '/employee/gallery', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z' },
            { label: 'Mi Horario', href: '/employee/schedule', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Reseñas', href: '/employee/reviews', icon: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z' },
            { label: 'Mi Perfil', href: '/employee/profile', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-[#e0f2f1] hover:border-[#008080]/20 text-gray-600 hover:text-[#008080] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
              </svg>
              <span className="text-xs font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Commission highlight */}
      {stats && stats.totalCommissions > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Comisiones</h2>
            <Link href="/employee/commissions" className="text-xs text-[#008080] font-medium hover:underline">
              Ver detalle
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total acumulado</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalCommissions)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Este mes</p>
              <p className="text-xl font-bold text-[#008080]">{formatCurrency(stats.commissionsThisMonth)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Next appointment highlight */}
      {nextAppointment && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#008080] mb-1">Próxima cita</p>
              <p className="text-lg font-bold text-gray-900">
                {dayjs(nextAppointment.startTime).format('h:mm A')}
              </p>
              <p className="text-sm text-gray-600">
                {nextAppointment.client.firstName} {nextAppointment.client.lastName}
                {' — '}
                {nextAppointment.items.map((i) => i.serviceNameSnapshot).join(', ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#008080]">
                {formatCurrency(nextAppointment.items.reduce((s, i) => s + Number(i.priceSnapshot), 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Today's appointments */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Citas del día</h2>
          <Link href="/employee/appointments" className="text-xs text-[#008080] font-medium hover:underline">
            Ver todas
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : sortedAppointments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No tienes citas programadas para hoy
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sortedAppointments.map((apt) => {
              const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;
              const totalPrice = apt.items.reduce(
                (sum, i) => sum + Number(i.priceSnapshot),
                0,
              );

              return (
                <li key={apt.id} className="px-5 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-sm font-semibold text-gray-900">
                          {dayjs(apt.startTime).format('h:mm A')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {dayjs(apt.endTime).format('h:mm A')}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {apt.client.firstName} {apt.client.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(totalPrice)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Top services */}
      {stats && stats.topServices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Servicios más realizados</h2>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {stats.topServices.map((s, i) => {
                const maxCount = stats.topServices[0].count;
                const pct = Math.round((s.count / maxCount) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{s.serviceName}</span>
                      <span className="font-medium text-gray-900">{s.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Top clients */}
      {stats && stats.topClients && stats.topClients.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Clientes más frecuentes</h2>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {stats.topClients.map((c, i) => {
                const maxCount = stats.topClients[0].count;
                const pct = Math.round((c.count / maxCount) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{c.clientName}</span>
                      <span className="font-medium text-gray-900">{c.count} visitas</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-amber-400 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
