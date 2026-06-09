'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { formatDate, resolveImageUrl } from '@/lib/utils';
import { useCurrency } from '@/lib/hooks/use-currency';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SalesBreakdownGrid } from '@/components/dashboard/sales-breakdown-grid';
import dayjs from 'dayjs';
import Link from 'next/link';

// Donut chart inline para "Citas por estado".
function DonutChart({
  slices,
  size = 140,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let cumulative = 0;
  const segments = slices.map((s) => {
    const dash = (s.value / total) * c;
    const seg = { dash, offset: -cumulative, color: s.color };
    cumulative += dash;
    return seg;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-canvas)" strokeWidth="14" />
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth="14"
          strokeDasharray={`${s.dash} ${c}`}
          strokeDashoffset={s.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
      <text
        x={size / 2}
        y={size / 2 - 2}
        textAnchor="middle"
        style={{
          fontSize: 22,
          fontWeight: 800,
          fill: 'var(--text-primary)',
          fontFamily: 'inherit',
          letterSpacing: '-.01em',
        }}
      >
        {slices.reduce((s, x) => s + x.value, 0)}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 16}
        textAnchor="middle"
        style={{
          fontSize: 10,
          fill: 'var(--text-muted)',
          fontFamily: 'inherit',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
        }}
      >
        Total
      </text>
    </svg>
  );
}

type DateRange = 'today' | '7d' | '30d' | 'month' | 'custom';

type DetailView =
  | null
  | 'revenue'
  | 'appointments'
  | 'cancelled'
  | 'noshow'
  | 'newClients'
  | 'returningClients'
  | { type: 'service'; name: string }
  | { type: 'employee'; id: string; name: string }
  | { type: 'client'; id: string; name: string }
  | { type: 'paymentMethod'; method: string };

interface DashboardData {
  kpis: {
    totalRevenue: number;
    // Fase A — desglose para combined revenue + profit
    productRevenue: number;
    productCost: number;
    serviceCommissions: number;
    totalRevenueAll: number;
    totalProfit: number;
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
  topEmployees: Array<{ id: string; name: string; avatarUrl: string | null; color: string | null; appointments: number; revenue: number }>;
  paymentMethods: Record<string, { count: number; total: number }>;
  clientMetrics: {
    totalClients: number;
    newClients: number;
    returningClients: number;
    retentionRate: number;
    topClients: Array<{ id: string; name: string; avatarUrl: string | null; visits: number; spent: number }>;
    bySource: Record<string, number>;
  };
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  client: { id: string; firstName: string; lastName: string };
  employee: { id: string; firstName: string; lastName: string; color: string };
  items: Array<{ serviceNameSnapshot: string; priceSnapshot: string | number; durationSnapshot: number }>;
}

interface Payment {
  id: string;
  amount: string | number;
  totalAmount: string | number;
  currency: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  client: { firstName: string; lastName: string };
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  createdAt: string;
  _count?: { appointments: number };
}

const SOURCE_LABELS: Record<string, string> = {
  ONLINE: 'Online',
  WALK_IN: 'Presencial',
  MARKETPLACE: 'Marketplace',
  PHONE: 'Telefono',
  MANUAL: 'Agendado por staff',
  REFERRAL: 'Referido',
};

const PAYMENT_LABELS: Record<string, string> = {
  STRIPE: 'Tarjeta',
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  OTHER: 'Otro',
};

const PAYMENT_COLORS: Record<string, string> = {
  STRIPE: '#008080',
  CASH: '#f59e0b',
  TRANSFER: '#6366f1',
  CARD: '#008080',
  OTHER: '#9ca3af',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-teal-50 text-teal-700' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Ausente', color: 'bg-[var(--bg-muted)] text-[var(--text-primary)]' },
};

export default function ReportsPage() {
  const { format: formatCurrency } = useCurrency();
  const searchParams = useSearchParams();
  const initialRange: DateRange = (() => {
    const r = (searchParams?.get('range') || '').toLowerCase();
    if (r === 'today' || r === '7d' || r === '30d' || r === 'month' || r === 'custom') return r;
    return '30d';
  })();
  const [dateRange, setDateRange] = useState<DateRange>(initialRange);
  const [customStart, setCustomStart] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const [detail, setDetail] = useState<DetailView>(null);

  function getDateBounds() {
    const today = dayjs();
    switch (dateRange) {
      case 'today': return { start: today.format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
      case '7d': return { start: today.subtract(7, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
      case '30d': return { start: today.subtract(30, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
      case 'month': return { start: today.startOf('month').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
      case 'custom': return { start: customStart, end: customEnd };
    }
  }

  const bounds = getDateBounds();

  const { data, isLoading } = useQuery({
    queryKey: ['reports-dashboard', bounds.start, bounds.end],
    queryFn: () => api.get<{ data: DashboardData }>(`/api/reports/dashboard?startDate=${bounds.start}&endDate=${bounds.end}`),
  });

  // Detail data fetched imperatively when modal opens
  const [detailAppointments, setDetailAppointments] = useState<Appointment[]>([]);
  const [detailPayments, setDetailPayments] = useState<Payment[]>([]);
  const [detailClients, setDetailClients] = useState<Client[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!detail) {
      setDetailAppointments([]);
      setDetailPayments([]);
      setDetailClients([]);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    async function fetchDetail() {
      try {
        // Build appointment URL with filters
        let statusFilter = '';
        if (detail === 'cancelled') statusFilter = '&status=CANCELLED';
        else if (detail === 'noshow') statusFilter = '&status=NO_SHOW';

        let extraFilter = '';
        if (typeof detail === 'object' && detail) {
          if (detail.type === 'employee') extraFilter = `&employeeId=${detail.id}`;
          else if (detail.type === 'client') extraFilter = `&clientId=${detail.id}`;
        }

        const needsAppointments = detail === 'revenue' || detail === 'appointments' || detail === 'cancelled' || detail === 'noshow'
          || (typeof detail === 'object' && detail !== null && (detail.type === 'employee' || detail.type === 'client' || detail.type === 'service'));

        const needsPayments = typeof detail === 'object' && detail?.type === 'paymentMethod';
        const needsClients = detail === 'newClients' || detail === 'returningClients';

        if (needsAppointments) {
          const res = await api.get<any>(
            `/api/appointments?startDate=${bounds.start}&endDate=${bounds.end}&perPage=100${statusFilter}${extraFilter}`,
          );
          const appointments = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
          if (!cancelled) setDetailAppointments(appointments);
        }

        if (needsPayments) {
          const methodFilter = `&paymentMethod=${(detail as { type: 'paymentMethod'; method: string }).method}`;
          const res = await api.get<{ data: Payment[] }>(
            `/api/payments?startDate=${bounds.start}&endDate=${bounds.end}&perPage=200${methodFilter}`,
          );
          if (!cancelled) setDetailPayments(res.data);
        }

        if (needsClients) {
          const url = detail === 'newClients'
            ? `/api/clients?perPage=100&createdAfter=${bounds.start}&createdBefore=${bounds.end}`
            : `/api/clients?perPage=100`;
          const res = await api.get<{ data: Client[] }>(url);
          let clients = res.data || [];
          if (detail === 'returningClients') {
            clients = clients.filter((c) => (c._count?.appointments || 0) > 1);
          }
          if (!cancelled) setDetailClients(clients);
        }
      } catch (err) {
        console.error('Error fetching detail:', err);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    fetchDetail();
    return () => { cancelled = true; };
  }, [detail, bounds.start, bounds.end]);

  const emptyData: DashboardData = {
    kpis: { totalRevenue: 0, productRevenue: 0, productCost: 0, serviceCommissions: 0, totalRevenueAll: 0, totalProfit: 0, totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0, noShowCount: 0, noShowRate: 0, averageTicket: 0, newClients: 0, totalClients: 0 },
    revenueByDay: [], topServices: [], topEmployees: [], paymentMethods: {},
    clientMetrics: { totalClients: 0, newClients: 0, returningClients: 0, retentionRate: 0, topClients: [], bySource: {} },
  };

  const stats: DashboardData = data?.data || emptyData;

  const maxRevenue = Math.max(...stats.revenueByDay.map((d) => d.revenue), 1);
  const paymentEntries = Object.entries(stats.paymentMethods);
  const paymentTotal = paymentEntries.reduce((sum, [, v]) => sum + v.total, 0) || 1;
  const sourceEntries = Object.entries(stats.clientMetrics.bySource);
  const sourceTotal = sourceEntries.reduce((sum, [, v]) => sum + v, 0) || 1;

  const rangeOptions: { key: DateRange; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: 'month', label: 'Este mes' },
    { key: 'custom', label: 'Personalizado' },
  ];

  // Filter appointments for service detail
  function getFilteredAppointments(): Appointment[] {
    const apts = detailAppointments || [];
    if (typeof detail === 'object' && detail?.type === 'service') {
      return apts.filter((a) => a.items.some((i) => i.serviceNameSnapshot === detail.name));
    }
    return apts;
  }

  function getDetailTitle(): string {
    if (detail === 'revenue') return 'Ingresos - Citas Completadas';
    if (detail === 'appointments') return 'Todas las Citas';
    if (detail === 'cancelled') return 'Citas Canceladas';
    if (detail === 'noshow') return 'Ausencias';
    if (detail === 'newClients') return 'Clientes Nuevos';
    if (detail === 'returningClients') return 'Clientes Recurrentes';
    if (typeof detail === 'object' && detail) {
      if (detail.type === 'service') return `Servicio: ${detail.name}`;
      if (detail.type === 'employee') return `Empleado: ${detail.name}`;
      if (detail.type === 'client') return `Cliente: ${detail.name}`;
      if (detail.type === 'paymentMethod') return `Pagos: ${PAYMENT_LABELS[detail.method] || detail.method}`;
    }
    return 'Detalle';
  }

  function renderAppointmentsTable(apts: Appointment[], totalRevenue: number, revenueOnly: boolean) {
    return (
      <div>
        <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border)] flex justify-between items-center">
          <span className="text-sm font-medium text-[var(--text-secondary)]">{apts.length} cita{apts.length !== 1 ? 's' : ''}</span>
          <span className="text-sm font-bold text-green-700">Total: {formatCurrency(totalRevenue)}</span>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {/* Mobile: card list */}
          <div className="md:hidden divide-y divide-gray-100">
            {apts.map((apt) => {
              const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;
              const total = apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
              return (
                <div
                  key={apt.id}
                  className="p-3 hover:bg-[var(--bg-muted)] cursor-pointer"
                  onClick={() => { setDetail(null); window.location.href = `/calendar?appointmentId=${apt.id}`; }}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{dayjs.utc(apt.startTime).format('DD/MM/YYYY')} · {dayjs.utc(apt.startTime).format('HH:mm')}</p>
                    <span className="text-sm font-semibold text-[var(--text-primary)] flex-shrink-0 ml-2">{formatCurrency(total)}</span>
                  </div>
                  <dl className="space-y-1 text-xs">
                    <div className="flex">
                      <dt className="w-20 text-[var(--text-secondary)] flex-shrink-0">Cliente</dt>
                      <dd className="text-[var(--text-primary)] font-medium flex-1 min-w-0 truncate">{apt.client.firstName} {apt.client.lastName}</dd>
                    </div>
                    <div className="flex items-center">
                      <dt className="w-20 text-[var(--text-secondary)] flex-shrink-0">Empleado</dt>
                      <dd className="text-[var(--text-secondary)] flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: apt.employee?.color || '#008080' }} />
                        <span className="truncate">{apt.employee.firstName} {apt.employee.lastName}</span>
                      </dd>
                    </div>
                    <div className="flex">
                      <dt className="w-20 text-[var(--text-secondary)] flex-shrink-0">Servicios</dt>
                      <dd className="text-[var(--text-secondary)] flex-1 min-w-0">{apt.items.map((i) => i.serviceNameSnapshot).join(', ')}</dd>
                    </div>
                    {!revenueOnly && (
                      <div className="flex items-center pt-0.5">
                        <dt className="w-20 text-[var(--text-secondary)] flex-shrink-0">Estado</dt>
                        <dd>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${status.color}`}>{status.label}</span>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              );
            })}
          </div>

          {/* Desktop: tabla */}
          <table className="hidden md:table w-full">
            <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--border)]">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Fecha</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Horario</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Cliente</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Empleado</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Servicios</th>
                {!revenueOnly && <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Estado</th>}
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apts.map((apt) => {
                const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;
                const total = apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
                return (
                  <tr key={apt.id} className="hover:bg-[var(--bg-muted)] cursor-pointer" onClick={() => { setDetail(null); window.location.href = `/calendar?appointmentId=${apt.id}`; }}>
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)] whitespace-nowrap">{dayjs.utc(apt.startTime).format('DD/MM/YYYY')}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">{dayjs.utc(apt.startTime).format('HH:mm')} - {dayjs.utc(apt.endTime).format('HH:mm')}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{apt.client.firstName} {apt.client.lastName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: apt.employee?.color || '#008080' }} />
                        <span className="text-sm text-[var(--text-secondary)]">{apt.employee.firstName} {apt.employee.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] max-w-[200px] truncate">{apt.items.map((i) => i.serviceNameSnapshot).join(', ')}</td>
                    {!revenueOnly && (
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>{status.label}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)] text-right whitespace-nowrap">{formatCurrency(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderDetailContent() {
    // Payment method detail -> show payments
    if (typeof detail === 'object' && detail?.type === 'paymentMethod') {
      const payments = detailPayments || [];
      if (detailLoading) return <div className="p-8 text-center text-[var(--text-muted)]">Cargando...</div>;
      if (payments.length === 0) return <div className="p-8 text-center text-[var(--text-muted)]">No hay pagos con este método en este período</div>;
      const total = payments.reduce((s, p) => s + Number(p.totalAmount), 0);
      return (
        <div>
          <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border)] flex justify-between items-center">
            <span className="text-sm font-medium text-[var(--text-secondary)]">{payments.length} pago{payments.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-bold text-green-700">Total: {formatCurrency(total)}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--border)]">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Método</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Estado</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--bg-muted)]">
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)] whitespace-nowrap">{dayjs(p.createdAt).format('DD/MM/YYYY HH:mm')}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{p.client.firstName} {p.client.lastName}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-muted)] text-[var(--text-secondary)]">{PAYMENT_LABELS[p.paymentMethod] || p.paymentMethod}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{p.status === 'COMPLETED' ? 'Completado' : p.status}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)] text-right whitespace-nowrap">{formatCurrency(Number(p.totalAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Revenue detail -> show completed appointments
    if (detail === 'revenue') {
      const apts = (detailAppointments || []).filter((a) => a.status === 'COMPLETED');
      if (detailLoading) return <div className="p-8 text-center text-[var(--text-muted)]">Cargando...</div>;
      if (apts.length === 0) return <div className="p-8 text-center text-[var(--text-muted)]">No hay citas completadas en este período</div>;
      const totalRevenue = apts.reduce((s, a) => s + a.items.reduce((is, i) => is + Number(i.priceSnapshot), 0), 0);
      return renderAppointmentsTable(apts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()), totalRevenue, true);
    }

    // Appointments detail (all, cancelled, no-show, by employee, by client, by service)
    if (detail === 'appointments' || detail === 'cancelled' || detail === 'noshow'
      || (typeof detail === 'object' && detail !== null && (detail.type === 'employee' || detail.type === 'client' || detail.type === 'service'))) {
      const apts = getFilteredAppointments();
      if (detailLoading) return <div className="p-8 text-center text-[var(--text-muted)]">Cargando...</div>;
      if (apts.length === 0) return <div className="p-8 text-center text-[var(--text-muted)]">No hay citas en este período</div>;
      const totalRevenue = apts.reduce((s, a) => s + a.items.reduce((is, i) => is + Number(i.priceSnapshot), 0), 0);
      return renderAppointmentsTable(apts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()), totalRevenue, false);
    }

    // New clients detail
    if (detail === 'newClients' || detail === 'returningClients') {
      const clients = detailClients || [];
      if (detailLoading) return <div className="p-8 text-center text-[var(--text-muted)]">Cargando...</div>;
      if (clients.length === 0) return <div className="p-8 text-center text-[var(--text-muted)]">{detail === 'newClients' ? 'No hay clientes nuevos en este período' : 'No hay clientes recurrentes'}</div>;
      return (
        <div>
          <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--text-secondary)]">{clients.length} cliente{clients.length !== 1 ? 's' : ''} nuevo{clients.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--border)]">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Nombre</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Teléfono</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Citas</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] uppercase">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--bg-muted)]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{c.firstName} {c.lastName}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{c._count?.appointments || 0}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">{dayjs(c.createdAt).format('DD/MM/YYYY')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="flex flex-col h-full">

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Date range selector */}
        <div className="mb-4 md:mb-6 space-y-2">
          <div className="w-full md:w-auto flex rounded-lg border border-[var(--border)] overflow-hidden md:inline-flex">
            {rangeOptions.map((r) => (
              <button
                key={r.key}
                onClick={() => setDateRange(r.key)}
                className={`${r.key === 'custom' ? 'flex-[1.6] md:flex-none' : 'flex-1 md:flex-none'} px-1 md:px-4 py-1.5 md:py-2 text-[11px] md:text-sm font-medium whitespace-nowrap transition-colors border-r border-[var(--border)] last:border-r-0 ${
                  dateRange === r.key ? 'bg-[#008080] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="w-full md:w-auto flex items-center gap-1.5 md:gap-2 md:inline-flex">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 md:flex-none min-w-0 md:w-auto px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] focus:outline-none focus:border-[#008080]"
              />
              <span className="text-[var(--text-secondary)] text-[11px] md:text-sm flex-shrink-0">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 md:flex-none min-w-0 md:w-auto px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] focus:outline-none focus:border-[#008080]"
              />
            </div>
          )}
        </div>

        {/* KPI cards — usando el componente compartido */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <KpiCard
            onClick={() => setDetail('revenue')}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Ingresos del período"
            value={isLoading ? <span className="inline-block h-6 w-24 bg-[var(--border)] rounded animate-pulse" /> : formatCurrency(stats.kpis.totalRevenue)}
            subtitle={stats.kpis.totalAppointments > 0 ? `${stats.kpis.completedAppointments} completadas` : undefined}
          />
          <KpiCard
            onClick={() => setDetail('appointments')}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
            label="Citas"
            value={isLoading ? <span className="inline-block h-6 w-12 bg-[var(--border)] rounded animate-pulse" /> : String(stats.kpis.totalAppointments)}
            subtitle={`${stats.kpis.completedAppointments} ok · ${stats.kpis.cancelledAppointments} canc.`}
          />
          <KpiCard
            onClick={() => setDetail('newClients')}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
            label="Clientes activos"
            value={isLoading ? <span className="inline-block h-6 w-12 bg-[var(--border)] rounded animate-pulse" /> : String(stats.clientMetrics.totalClients)}
            trend={stats.clientMetrics.newClients > 0 ? `+${stats.clientMetrics.newClients} nuevos` : undefined}
          />
          <KpiCard
            onClick={() => setDetail('revenue')}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}
            label="Ticket promedio"
            value={isLoading ? <span className="inline-block h-6 w-20 bg-[var(--border)] rounded animate-pulse" /> : formatCurrency(stats.kpis.averageTicket)}
            subtitle={`${stats.kpis.noShowRate.toFixed(1)}% no-show`}
          />
        </div>

        {/* Grid "Venta Total" — total + desglose por fuente (servicios, paquetes, productos) */}
        <div className="mb-4 md:mb-6">
          <h2 className="text-[11px] md:text-xs font-semibold uppercase tracking-wide mb-2 md:mb-3" style={{ color: 'var(--text-muted)' }}>
            Venta total
          </h2>
          <SalesBreakdownGrid
            startDate={bounds.start}
            endDate={bounds.end}
            periodLabel={rangeOptions.find((r) => r.key === dateRange)?.label}
          />
        </div>

        {/* Ganancia neta del periodo */}
        <div className="mb-4 md:mb-6">
          <KpiCard
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}
            label="Todas las ganancias"
            value={isLoading ? <span className="inline-block h-6 w-32 bg-[var(--border)] rounded animate-pulse" /> : formatCurrency(stats.kpis.totalProfit)}
            subtitle={`− Comisiones ${formatCurrency(stats.kpis.serviceCommissions)} − Costo prod. ${formatCurrency(stats.kpis.productCost)}`}
          />
        </div>

        {/* Revenue chart + Citas por estado (donut) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 mb-3 md:mb-6">
          {/* Revenue chart con header rico */}
          <div className="lg:col-span-2 rounded-xl border border-[var(--border)] p-4 md:p-5 overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Ingresos · {rangeOptions.find((r) => r.key === dateRange)?.label || ''}
                </p>
                <p className="text-2xl md:text-3xl font-extrabold mt-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {isLoading ? <span className="inline-block h-8 w-32 bg-[var(--border)] rounded animate-pulse" /> : formatCurrency(stats.kpis.totalRevenue)}
                </p>
              </div>
              {(() => {
                const best = stats.revenueByDay.reduce<{ date: string; revenue: number } | null>(
                  (acc, d) => (!acc || d.revenue > acc.revenue ? d : acc),
                  null,
                );
                if (!best || best.revenue === 0) return null;
                return (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Mejor día</p>
                    <p className="text-base font-bold text-primary-600 tabular-nums">{formatCurrency(best.revenue)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{dayjs(best.date).format('D MMM')}</p>
                  </div>
                );
              })()}
            </div>
            {isLoading ? (
              <div className="h-48 bg-[var(--bg-muted)] rounded-lg animate-pulse" />
            ) : stats.revenueByDay.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No hay datos para este periodo</div>
            ) : (
              <div className="flex items-end gap-1 h-48 mt-2">
                {stats.revenueByDay.map((day) => {
                  const pct = (day.revenue / maxRevenue) * 100;
                  const isBest = stats.revenueByDay.every((d) => d.revenue <= day.revenue) && day.revenue > 0;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 min-w-0 flex flex-col items-center gap-1 group cursor-pointer relative"
                      onClick={() => {
                        setDateRange('custom');
                        setCustomStart(day.date);
                        setCustomEnd(day.date);
                        setDetail('appointments');
                      }}
                    >
                      <span
                        className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none px-1.5 py-0.5 rounded shadow-sm z-10 border"
                        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                      >
                        {formatCurrency(day.revenue)}
                      </span>
                      <div className="w-full flex items-end" style={{ height: 'calc(100% - 18px)' }}>
                        <div
                          className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-100"
                          style={{
                            height: `${Math.max(pct, 2)}%`,
                            backgroundColor: day.revenue > 0 ? '#008080' : 'var(--border)',
                            opacity: isBest ? 1 : day.revenue > 0 ? 0.65 : 1,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{dayjs(day.date).format('D')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Citas por estado (donut) */}
          <div className="rounded-xl border border-[var(--border)] p-4 md:p-5" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <p className="text-xs uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              Citas por estado
            </p>
            {isLoading ? (
              <div className="h-40 bg-[var(--bg-muted)] rounded-lg animate-pulse" />
            ) : stats.kpis.totalAppointments === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Sin citas</p>
            ) : (() => {
              const completed = stats.kpis.completedAppointments;
              const cancelled = stats.kpis.cancelledAppointments;
              const noshow = stats.kpis.noShowCount;
              const otros = Math.max(0, stats.kpis.totalAppointments - completed - cancelled - noshow);
              const slices = [
                { label: 'Completadas', value: completed, color: '#059669' },
                { label: 'Pendientes', value: otros, color: '#008080' },
                { label: 'Canceladas', value: cancelled, color: '#dc2626' },
                { label: 'Ausente', value: noshow, color: '#94a3b8' },
              ].filter((s) => s.value > 0);
              return (
                <div className="flex items-center gap-3 mt-2">
                  <DonutChart slices={slices} size={130} />
                  <div className="flex-1 min-w-0 space-y-2">
                    {slices.map((s) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Top services con barras de progreso */}
        <div className="mb-3 md:mb-6 rounded-xl border border-[var(--border)] p-4 md:p-5" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <p className="text-xs uppercase tracking-wide font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
            Top servicios
          </p>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-[var(--bg-muted)] rounded animate-pulse" />)}</div>
          ) : stats.topServices.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay datos disponibles</p>
          ) : (() => {
            const maxCount = Math.max(...stats.topServices.map((s) => s.count), 1);
            const palette = ['#008080', '#7c3aed', '#d97706', '#059669', '#3b82f6', '#0891b2', '#db2777', '#9333ea'];
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {stats.topServices.slice(0, 8).map((service, idx) => (
                  <div
                    key={service.name}
                    onClick={() => setDetail({ type: 'service', name: service.name })}
                    className="cursor-pointer"
                  >
                    <div className="flex items-baseline justify-between mb-1 gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{service.name}</span>
                      <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{formatCurrency(service.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-muted)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${(service.count / maxCount) * 100}%`, backgroundColor: palette[idx % palette.length] }} />
                      </div>
                      <span className="text-xs tabular-nums w-16 text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {service.count} cita{service.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Top employees + Payment methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6 mb-3 md:mb-6">
          {/* Top employees - INTERACTIVE */}
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-3 md:p-5">
            <h3 className="text-sm md:text-base font-semibold text-[var(--text-primary)] mb-2 md:mb-4">Empleados destacados</h3>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-[var(--bg-muted)] rounded animate-pulse" />)}</div>
            ) : stats.topEmployees.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No hay datos disponibles</p>
            ) : (
              <>
                {/* Header columnas */}
                <div className="flex items-center gap-2 px-2 pb-1.5 border-b border-[var(--border)] text-[10px] md:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  <span className="w-5 flex-shrink-0">#</span>
                  <span className="w-8 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">Empleado</span>
                  <span className="w-12 text-right flex-shrink-0">Citas</span>
                  <span className="w-20 text-right flex-shrink-0">Ingresos</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {stats.topEmployees.slice(0, 8).map((emp, idx) => (
                    <div
                      key={emp.id}
                      onClick={() => setDetail({ type: 'employee', id: emp.id, name: emp.name })}
                      className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-[var(--bg-muted)] transition-colors"
                    >
                      <span className="w-5 text-[var(--text-muted)] font-medium text-xs md:text-sm flex-shrink-0">{idx + 1}</span>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 text-xs font-semibold"
                        style={{
                          backgroundColor: `${emp.color || '#008080'}20`,
                          color: emp.color || '#008080',
                        }}
                      >
                        {emp.avatarUrl ? (
                          <img src={resolveImageUrl(emp.avatarUrl) || ''} alt="" className="w-full h-full object-cover" />
                        ) : (
                          emp.name.split(' ').map((n) => n[0]).slice(0, 2).join('')
                        )}
                      </div>
                      <span className="flex-1 min-w-0 truncate text-xs md:text-sm font-medium text-[var(--text-primary)]">{emp.name}</span>
                      <span className="w-12 text-right text-xs md:text-sm text-[var(--text-secondary)] flex-shrink-0">{emp.appointments}</span>
                      <span className="w-20 text-right text-xs md:text-sm font-semibold text-[var(--text-secondary)] flex-shrink-0">{formatCurrency(emp.revenue)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Payment methods - INTERACTIVE */}
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-3 md:p-5">
            <h3 className="text-sm md:text-base font-semibold text-[var(--text-primary)] mb-2 md:mb-4">Métodos de pago</h3>
            {isLoading ? (
              <div className="h-32 bg-[var(--bg-muted)] rounded-lg animate-pulse" />
            ) : paymentEntries.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No hay datos disponibles</p>
            ) : (
              <div>
                <div className="flex h-8 rounded-lg overflow-hidden mb-4">
                  {paymentEntries.map(([method, val]) => (
                    <div
                      key={method}
                      style={{ width: `${(val.total / paymentTotal) * 100}%`, backgroundColor: PAYMENT_COLORS[method] || '#9ca3af' }}
                      className="transition-all cursor-pointer hover:opacity-80"
                      onClick={() => setDetail({ type: 'paymentMethod', method })}
                      title={`${PAYMENT_LABELS[method] || method}: ${formatCurrency(val.total)}`}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  {paymentEntries.map(([method, val]) => (
                    <div
                      key={method}
                      onClick={() => setDetail({ type: 'paymentMethod', method })}
                      className="flex items-center justify-between p-2 -mx-2 rounded-lg cursor-pointer hover:bg-[var(--bg-muted)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[method] || '#9ca3af' }} />
                        <span className="text-sm text-[var(--text-secondary)]">{PAYMENT_LABELS[method] || method}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(val.total)}</span>
                        <span className="text-xs text-[var(--text-secondary)]">({val.count})</span>
                        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product Sales */}
        <SalesCard />

        {/* Client metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Retention + New vs Returning - INTERACTIVE */}
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-3 md:p-5">
            <h3 className="text-sm md:text-base font-semibold text-[var(--text-primary)] mb-2 md:mb-4">Clientes</h3>
            {isLoading ? (
              <div className="h-32 bg-[var(--bg-muted)] rounded-lg animate-pulse" />
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 bg-[var(--bg-subtle)] rounded-lg">
                  <p className="text-3xl font-bold" style={{ color: '#008080' }}>{stats.clientMetrics.retentionRate.toFixed(1)}%</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Tasa de retención</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setDetail('newClients')}
                    className="text-center p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                  >
                    <p className="text-xl font-bold text-green-700">{stats.clientMetrics.newClients}</p>
                    <p className="text-xs text-green-600 mt-0.5">Nuevos &rarr;</p>
                  </div>
                  <div
                    onClick={() => setDetail('returningClients')}
                    className="text-center p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                  >
                    <p className="text-xl font-bold text-blue-700">{stats.clientMetrics.returningClients}</p>
                    <p className="text-xs text-blue-600 mt-0.5">Recurrentes &rarr;</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[var(--text-secondary)]">Total: <span className="font-semibold text-[var(--text-primary)]">{stats.clientMetrics.totalClients}</span> clientes</p>
                </div>
              </div>
            )}
          </div>

          {/* Top clients - INTERACTIVE */}
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-3 md:p-5">
            <h3 className="text-sm md:text-base font-semibold text-[var(--text-primary)] mb-2 md:mb-4">Mejores clientes</h3>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-[var(--bg-muted)] rounded animate-pulse" />)}</div>
            ) : stats.clientMetrics.topClients.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No hay datos disponibles</p>
            ) : (
              <>
                {/* Header columnas */}
                <div className="flex items-center gap-2 px-2 pb-1.5 border-b border-[var(--border)] text-[10px] md:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  <span className="w-5 flex-shrink-0">#</span>
                  <span className="w-8 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">Cliente</span>
                  <span className="w-12 text-right flex-shrink-0">Visitas</span>
                  <span className="w-20 text-right flex-shrink-0">Gastado</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {stats.clientMetrics.topClients.slice(0, 8).map((client, idx) => (
                    <div
                      key={client.id}
                      onClick={() => setDetail({ type: 'client', id: client.id, name: client.name })}
                      className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-[var(--bg-muted)] transition-colors"
                    >
                      <span className="w-5 text-[var(--text-muted)] font-medium text-xs md:text-sm flex-shrink-0">{idx + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center overflow-hidden flex-shrink-0 text-xs font-semibold">
                        {client.avatarUrl ? (
                          <img src={resolveImageUrl(client.avatarUrl) || ''} alt="" className="w-full h-full object-cover" />
                        ) : (
                          client.name.split(' ').map((n) => n[0]).slice(0, 2).join('')
                        )}
                      </div>
                      <span className="flex-1 min-w-0 truncate text-xs md:text-sm font-medium text-[var(--text-primary)]">{client.name}</span>
                      <span className="w-12 text-right text-xs md:text-sm text-[var(--text-secondary)] flex-shrink-0">{client.visits}</span>
                      <span className="w-20 text-right text-xs md:text-sm font-semibold text-[var(--text-secondary)] flex-shrink-0">{formatCurrency(client.spent)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Client source breakdown */}
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-3 md:p-5">
            <h3 className="text-sm md:text-base font-semibold text-[var(--text-primary)] mb-2 md:mb-4">Origen de clientes</h3>
            {isLoading ? (
              <div className="h-32 bg-[var(--bg-muted)] rounded-lg animate-pulse" />
            ) : sourceEntries.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No hay datos disponibles</p>
            ) : (
              <div className="space-y-3">
                {sourceEntries.map(([source, count]) => (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[var(--text-secondary)]">{SOURCE_LABELS[source] || source}</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {count} <span className="text-xs text-[var(--text-muted)] font-normal">({((count / sourceTotal) * 100).toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-[var(--bg-muted)] rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${(count / sourceTotal) * 100}%`, backgroundColor: '#008080' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <Modal title={getDetailTitle()} onClose={() => setDetail(null)} size="full">
          {renderDetailContent()}
        </Modal>
      )}
    </div>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function SalesCard() {
  const { format: formatCurrency } = useCurrency();

  const { data: salesData } = useQuery({
    queryKey: ['sales-stats'],
    queryFn: () => api.get<{ data: any }>('/api/products/sales-stats'),
  });

  const sales = salesData?.data || { today: { count: 0, revenue: 0 }, month: { count: 0, revenue: 0 }, total: { count: 0, revenue: 0 }, recent: [] };

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-3 md:p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Ventas de productos</h3>
        <Link href="/reservations" className="text-xs text-[#008080] hover:underline">Ver apartados</Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-[var(--bg-subtle)] rounded-lg p-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Hoy</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{formatCurrency(sales.today.revenue)}</p>
          <p className="text-xs text-[var(--text-muted)]">{sales.today.count} venta{sales.today.count !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-[var(--bg-subtle)] rounded-lg p-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Este mes</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{formatCurrency(sales.month.revenue)}</p>
          <p className="text-xs text-[var(--text-muted)]">{sales.month.count} venta{sales.month.count !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-[var(--bg-subtle)] rounded-lg p-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Total</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{formatCurrency(sales.total.revenue)}</p>
          <p className="text-xs text-[var(--text-muted)]">{sales.total.count} venta{sales.total.count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {sales.recent.length > 0 ? (
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase mb-2">Ventas recientes</p>
          <div className="space-y-2">
            {sales.recent.map((sale: any) => (
              <div key={sale.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--bg-muted)] flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {sale.product?.imageUrl ? (
                    <img src={`${API_URL}${sale.product.imageUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-4 h-4 text-[var(--border)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-secondary)] truncate">{sale.product?.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{sale.customerName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(Number(sale.unitPrice) * sale.quantity)}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{new Date(sale.updatedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)] text-center py-4">Aún no hay ventas concretadas</p>
      )}
    </div>
  );
}
