'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/hooks/use-auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface TodayReport {
  today: { appointments: number; revenue: number; payments: number };
  month: { appointments: number; revenue: number; noShowRate: number };
  upcomingAppointments: UpcomingAppointment[];
  last7Days: { date: string; revenue: number }[];
}

interface UpcomingAppointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  client: { firstName: string; lastName: string };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    color: string;
    avatarUrl: string | null;
  };
  items: { serviceNameSnapshot: string; priceSnapshot: number }[];
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function statusLabel(status: string) {
  const map: Record<string, { text: string; className: string }> = {
    CONFIRMED: { text: 'Confirmada', className: 'bg-green-100 text-green-700' },
    PENDING: { text: 'Pendiente', className: 'bg-yellow-100 text-yellow-700' },
    IN_PROGRESS: {
      text: 'En curso',
      className: 'bg-blue-100 text-blue-700',
    },
    COMPLETED: {
      text: 'Completada',
      className: 'bg-gray-100 text-gray-600',
    },
    CANCELLED: { text: 'Cancelada', className: 'bg-red-100 text-red-600' },
    NO_SHOW: { text: 'No-show', className: 'bg-red-100 text-red-600' },
  };
  return map[status] || { text: status, className: 'bg-gray-100 text-gray-600' };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: businessData } = useQuery({
    queryKey: ['tenant-setup-check'],
    queryFn: () => api.get<{ description: string | null; logoUrl: string | null; locations: { address: string | null }[] }>('/api/tenants/me'),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-count'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=2'),
  });

  const business = businessData?.data as any;
  const needsBusinessProfile = business && !business.description && !business.logoUrl;
  const needsEmployees = employeesData?.data && Array.isArray(employeesData.data) && employeesData.data.length <= 1;
  const showSetupWizard = needsBusinessProfile || needsEmployees;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'today'],
    queryFn: () => api.get<TodayReport>('/api/reports/today'),
    refetchInterval: 60_000,
  });

  const report = data?.data;

  return (
    <div className="space-y-6 p-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user?.firstName || 'Usuario'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {dayjs().format('dddd, D [de] MMMM [de] YYYY')}
        </p>
      </div>

      {/* Setup wizard — shown when business is new */}
      {showSetupWizard && (
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          {/* Header */}
          <div className="px-6 py-5" style={{ backgroundColor: '#008080' }}>
            <h2 className="text-lg font-bold text-white">Configura tu negocio</h2>
            <p className="text-sm text-white/70 mt-0.5">Completa estos pasos para empezar a recibir citas</p>
          </div>

          {/* Steps timeline */}
          <div className="bg-white px-6 py-5">
            {[
              { done: !needsBusinessProfile, label: 'Completa el perfil de tu negocio', desc: 'Agrega descripcion, logo y foto de portada', href: '/settings/business' },
              { done: !needsEmployees, label: 'Invita a tus empleados', desc: 'Genera un codigo de invitacion para que se unan', href: '/settings/invite-codes' },
              { done: false, label: 'Crea tus servicios', desc: 'Configura los servicios que ofreces a tus clientes', href: '/services?new=true' },
            ].map((step, i, arr) => {
              const isLast = i === arr.length - 1;
              const prevDone = i === 0 || arr[i - 1].done;
              const isCurrent = !step.done && prevDone;

              return (
                <div key={i} className="flex gap-4" onClick={() => router.push(step.href)} style={{ cursor: 'pointer' }}>
                  {/* Timeline column */}
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                      step.done
                        ? 'bg-green-500 border-green-500'
                        : isCurrent
                          ? 'bg-[#008080] border-[#008080]'
                          : 'bg-white border-gray-300'
                    }`}>
                      {step.done ? (
                        <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className={`text-sm font-bold ${isCurrent ? 'text-white' : 'text-gray-400'}`}>{i + 1}</span>
                      )}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 my-1 ${step.done ? 'bg-green-400' : 'bg-gray-200'}`} style={{ minHeight: 24 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`pb-5 flex-1 min-w-0 ${isLast ? '' : ''}`}>
                    <p className={`text-sm font-semibold ${step.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                    {isCurrent && (
                      <button className="mt-2 text-xs font-semibold text-[#008080] hover:text-[#006666] flex items-center gap-1">
                        Completar ahora
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* When setup is complete, redirect to reports */}
      {!showSetupWizard && !isLoading && (
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-900 font-semibold mb-1">Tu negocio esta configurado</p>
          <p className="text-sm text-gray-500 mb-4">Consulta tus estadisticas en Reportes</p>
          <button
            onClick={() => router.push('/reports')}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#008080' }}
          >
            Ir a Reportes
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'teal' | 'light';
}) {
  const isTeal = color === 'teal';
  return (
    <div
      className={`rounded-xl border p-5 flex items-center gap-4 ${
        isTeal ? 'bg-white border-gray-200' : 'bg-white border-gray-200'
      }`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          isTeal
            ? 'bg-[#e0f2f1] text-[#008080]'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

/* ─── Last 7 Days Bar Chart ─── */
function Last7DaysChart({ days }: { days: { date: string; revenue: number }[] }) {
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">
        Ingresos - Últimos 7 días
      </h2>
      <div className="flex items-end justify-between gap-2 h-44">
        {days.map((day) => {
          const pct = (day.revenue / maxRevenue) * 100;
          const dayLabel = DAY_LABELS[dayjs(day.date).day()];
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              {/* Revenue label on hover */}
              <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {formatCurrency(day.revenue)}
              </span>
              {/* Bar */}
              <div className="w-full flex items-end" style={{ height: '130px' }}>
                <div
                  className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    backgroundColor: day.revenue > 0 ? '#008080' : '#e5e7eb',
                  }}
                />
              </div>
              {/* Day label */}
              <span className="text-xs text-gray-500 font-medium">
                {dayLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Upcoming Appointments ─── */
function UpcomingAppointments({
  appointments,
}: {
  appointments: UpcomingAppointment[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">
        Próximas citas
      </h2>

      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <svg
            className="w-10 h-10 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm">No hay citas próximas</p>
        </div>
      ) : (
        <ul className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
          {appointments.map((apt) => {
            const totalPrice = apt.items.reduce(
              (sum, i) => sum + i.priceSnapshot,
              0,
            );
            const services = apt.items
              .map((i) => i.serviceNameSnapshot)
              .join(', ');
            const status = statusLabel(apt.status);

            return (
              <li
                key={apt.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {/* Time column */}
                <div className="flex-shrink-0 text-center min-w-[52px]">
                  <p className="text-sm font-semibold text-[#008080]">
                    {dayjs(apt.startTime).format('h:mm A')}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {dayjs(apt.endTime).format('h:mm A')}
                  </p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {apt.client.firstName} {apt.client.lastName}
                    </p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.className}`}
                    >
                      {status.text}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {services}
                  </p>
                  <Link href={`/staff/${apt.employee.id}`} className="flex items-center gap-1.5 mt-1 group w-fit">
                    <div
                      className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: apt.employee.color || '#008080' }}
                    >
                      {apt.employee.avatarUrl
                        ? <img src={apt.employee.avatarUrl.startsWith('http') ? apt.employee.avatarUrl : `${API_URL}${apt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                        : <span>{apt.employee.firstName[0]}{apt.employee.lastName[0]}</span>
                      }
                    </div>
                    <span className="text-xs text-gray-500 group-hover:underline">
                      {apt.employee.firstName} {apt.employee.lastName}
                    </span>
                  </Link>
                </div>

                {/* Price */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(totalPrice)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── Loading Skeleton ─── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-5 h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 h-64" />
        <div className="rounded-xl border border-gray-200 bg-white p-5 h-64" />
      </div>
    </div>
  );
}
