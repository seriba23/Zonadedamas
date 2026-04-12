'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Modal } from '@/components/ui/modal';
import { formatCurrency, formatDate } from '@/lib/utils';
import dayjs from 'dayjs';
import Link from 'next/link';
import { QuickActions } from '@/components/dashboard/quick-actions';

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
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'No asistio', color: 'bg-gray-100 text-gray-800' },
};

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
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
        const needsClients = detail === 'newClients';

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
          const res = await api.get<{ data: Client[] }>(
            `/api/clients?perPage=100&createdAfter=${bounds.start}&createdBefore=${bounds.end}`,
          );
          if (!cancelled) setDetailClients(res.data);
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
    kpis: { totalRevenue: 0, totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0, noShowCount: 0, noShowRate: 0, averageTicket: 0, newClients: 0, totalClients: 0 },
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
    if (detail === 'noshow') return 'No-Shows';
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

  function renderDetailContent() {
    // Payment method detail -> show payments
    if (typeof detail === 'object' && detail?.type === 'paymentMethod') {
      const payments = detailPayments || [];
      if (detailLoading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
      if (payments.length === 0) return <div className="p-8 text-center text-gray-400">No hay pagos con este metodo en este periodo</div>;
      const total = payments.reduce((s, p) => s + Number(p.totalAmount), 0);
      return (
        <div>
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between">
            <span className="text-sm font-medium text-gray-600">{payments.length} pago{payments.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-bold text-green-700">{formatCurrency(total)}</span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {payments.map((p) => (
              <li key={p.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.client.firstName} {p.client.lastName}</p>
                    <p className="text-xs text-gray-500">{dayjs(p.createdAt).format('DD/MM/YYYY HH:mm')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(p.totalAmount))}</p>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                      {PAYMENT_LABELS[p.paymentMethod] || p.paymentMethod}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    // Revenue detail -> show completed appointments (revenue comes from completed appointment items)
    if (detail === 'revenue') {
      const apts = (detailAppointments || []).filter((a) => a.status === 'COMPLETED');
      if (detailLoading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
      if (apts.length === 0) return <div className="p-8 text-center text-gray-400">No hay citas completadas en este periodo</div>;
      const totalRevenue = apts.reduce((s, a) => s + a.items.reduce((is, i) => is + Number(i.priceSnapshot), 0), 0);
      return (
        <div>
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between">
            <span className="text-sm font-medium text-gray-600">{apts.length} cita{apts.length !== 1 ? 's' : ''} completada{apts.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-bold text-green-700">{formatCurrency(totalRevenue)}</span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {apts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map((apt) => {
              const total = apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
              return (
                <li key={apt.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: apt.employee?.color || '#008080' }} />
                      <p className="text-sm font-medium text-gray-900">{apt.client.firstName} {apt.client.lastName}</p>
                    </div>
                    <p className="text-sm font-bold text-green-700">{formatCurrency(total)}</p>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-gray-500">{dayjs(apt.startTime).format('DD/MM/YYYY')} &middot; {dayjs(apt.startTime).format('HH:mm')} - {dayjs(apt.endTime).format('HH:mm')}</p>
                      <p className="text-xs text-gray-500">{apt.employee.firstName} {apt.employee.lastName} &middot; {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    // Appointments detail (all, cancelled, no-show, by employee, by client, by service)
    if (detail === 'appointments' || detail === 'cancelled' || detail === 'noshow'
      || (typeof detail === 'object' && detail !== null && (detail.type === 'employee' || detail.type === 'client' || detail.type === 'service'))) {
      const apts = getFilteredAppointments();
      if (detailLoading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
      if (apts.length === 0) return <div className="p-8 text-center text-gray-400">No hay citas en este periodo</div>;
      const totalRevenue = apts.reduce((s, a) => s + a.items.reduce((is, i) => is + Number(i.priceSnapshot), 0), 0);
      return (
        <div>
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between">
            <span className="text-sm font-medium text-gray-600">{apts.length} cita{apts.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-bold text-green-700">{formatCurrency(totalRevenue)}</span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {apts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map((apt) => {
              const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;
              const total = apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
              return (
                <li key={apt.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: apt.employee?.color || '#008080' }} />
                      <p className="text-sm font-medium text-gray-900">
                        {apt.client.firstName} {apt.client.lastName}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>{status.label}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-gray-500">
                        {dayjs(apt.startTime).format('DD/MM/YYYY')} &middot; {dayjs(apt.startTime).format('HH:mm')} - {dayjs(apt.endTime).format('HH:mm')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {apt.employee.firstName} {apt.employee.lastName} &middot; {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">{formatCurrency(total)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    // New clients detail
    if (detail === 'newClients') {
      const clients = detailClients || [];
      if (detailLoading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
      if (clients.length === 0) return <div className="p-8 text-center text-gray-400">No hay clientes nuevos en este periodo</div>;
      return (
        <div>
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-600">{clients.length} cliente{clients.length !== 1 ? 's' : ''} nuevo{clients.length !== 1 ? 's' : ''}</span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {clients.map((c) => (
              <li key={c.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-gray-500">{c.email || c.phone || 'Sin contacto'}</p>
                  </div>
                  <p className="text-xs text-gray-400">{dayjs(c.createdAt).format('DD/MM/YYYY')}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return null;
  }

  const clickableCard = 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all';

  return (
    <div className="flex flex-col h-full">
      <Header title="Reportes" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Quick Actions */}
        <div className="mb-6">
          <QuickActions />
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {rangeOptions.map((r) => (
              <button
                key={r.key}
                onClick={() => setDateRange(r.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 ${
                  dateRange === r.key ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input-field w-auto" />
              <span className="text-gray-500">-</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input-field w-auto" />
            </div>
          )}
        </div>

        {/* KPI cards - INTERACTIVE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Ingresos */}
          <div
            onClick={() => setDetail('revenue')}
            className={`bg-white rounded-xl border border-gray-200 p-5 ${clickableCard}`}
          >
            <div className="inline-flex p-2 rounded-lg mb-3 text-green-700 bg-green-50">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{isLoading ? <span className="inline-block h-7 w-24 bg-gray-200 rounded animate-pulse" /> : formatCurrency(stats.kpis.totalRevenue)}</p>
            <p className="text-sm text-gray-500 mt-1">Ingresos totales</p>
            <p className="text-xs text-primary-600 mt-2 font-medium">Ver detalle &rarr;</p>
          </div>

          {/* Citas totales */}
          <div
            onClick={() => setDetail('appointments')}
            className={`bg-white rounded-xl border border-gray-200 p-5 ${clickableCard}`}
          >
            <div className="inline-flex p-2 rounded-lg mb-3 text-blue-700 bg-blue-50">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{isLoading ? <span className="inline-block h-7 w-24 bg-gray-200 rounded animate-pulse" /> : stats.kpis.totalAppointments}</p>
            <p className="text-sm text-gray-500 mt-1">Citas totales</p>
            <div className="flex gap-3 mt-2">
              <button onClick={(e) => { e.stopPropagation(); setDetail('cancelled'); }} className="text-xs text-red-600 font-medium hover:underline">
                {stats.kpis.cancelledAppointments} canceladas
              </button>
              <button onClick={(e) => { e.stopPropagation(); setDetail('noshow'); }} className="text-xs text-gray-600 font-medium hover:underline">
                {stats.kpis.noShowCount} no-show
              </button>
            </div>
          </div>

          {/* Ticket promedio */}
          <div
            onClick={() => setDetail('revenue')}
            className={`bg-white rounded-xl border border-gray-200 p-5 ${clickableCard}`}
          >
            <div className="inline-flex p-2 rounded-lg mb-3 text-purple-700 bg-purple-50">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{isLoading ? <span className="inline-block h-7 w-24 bg-gray-200 rounded animate-pulse" /> : formatCurrency(stats.kpis.averageTicket)}</p>
            <p className="text-sm text-gray-500 mt-1">Ticket promedio</p>
            <p className="text-xs text-primary-600 mt-2 font-medium">Ver pagos &rarr;</p>
          </div>

          {/* No-show */}
          <div
            onClick={() => setDetail('noshow')}
            className={`bg-white rounded-xl border border-gray-200 p-5 ${clickableCard}`}
          >
            <div className="inline-flex p-2 rounded-lg mb-3 text-red-700 bg-red-50">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{isLoading ? <span className="inline-block h-7 w-24 bg-gray-200 rounded animate-pulse" /> : `${stats.kpis.noShowRate.toFixed(1)}%`}</p>
            <p className="text-sm text-gray-500 mt-1">Tasa de no-show</p>
            <p className="text-xs text-red-600 mt-2 font-medium">{stats.kpis.noShowCount} cita{stats.kpis.noShowCount !== 1 ? 's' : ''} &rarr;</p>
          </div>
        </div>

        {/* Revenue chart + Top services */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Ingresos por día</h3>
            {isLoading ? (
              <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
            ) : stats.revenueByDay.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No hay datos para este periodo</div>
            ) : (
              <div className="flex items-end gap-1 h-48">
                {stats.revenueByDay.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                    onClick={() => {
                      setDateRange('custom');
                      setCustomStart(day.date);
                      setCustomEnd(day.date);
                      setDetail('appointments');
                    }}
                  >
                    <div className="relative w-full">
                      <div
                        className="w-full rounded-t transition-all group-hover:opacity-100"
                        style={{ height: `${Math.max((day.revenue / maxRevenue) * 160, 4)}px`, backgroundColor: '#008080', opacity: 0.7 }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 hidden lg:block">{dayjs(day.date).format('D')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top services - INTERACTIVE */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Servicios más populares</h3>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : stats.topServices.length === 0 ? (
              <p className="text-sm text-gray-400">No hay datos disponibles</p>
            ) : (
              <div className="space-y-2">
                {stats.topServices.slice(0, 8).map((service, idx) => (
                  <div
                    key={service.name}
                    onClick={() => setDetail({ type: 'service', name: service.name })}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-500 w-5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{service.name}</p>
                      <p className="text-xs text-gray-500">{service.count} cita{service.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{formatCurrency(service.revenue)}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top employees + Payment methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top employees - INTERACTIVE */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Empleados destacados</h3>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
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
                      <tr
                        key={emp.id}
                        onClick={() => setDetail({ type: 'employee', id: emp.id, name: emp.name })}
                        className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2.5 text-gray-400 font-medium w-6">{idx + 1}</td>
                        <td className="py-2.5 text-gray-900 font-medium">
                          <span className="hover:text-primary-700">{emp.name}</span>
                        </td>
                        <td className="py-2.5 text-right text-gray-600">{emp.appointments}</td>
                        <td className="py-2.5 text-right font-semibold text-gray-700">{formatCurrency(emp.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment methods - INTERACTIVE */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Métodos de pago</h3>
            {isLoading ? (
              <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ) : paymentEntries.length === 0 ? (
              <p className="text-sm text-gray-400">No hay datos disponibles</p>
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
                      className="flex items-center justify-between p-2 -mx-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[method] || '#9ca3af' }} />
                        <span className="text-sm text-gray-700">{PAYMENT_LABELS[method] || method}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(val.total)}</span>
                        <span className="text-xs text-gray-500">({val.count})</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
          {/* Retention + New vs Returning - INTERACTIVE */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Clientes</h3>
            {isLoading ? (
              <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold" style={{ color: '#008080' }}>{stats.clientMetrics.retentionRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-500 mt-1">Tasa de retención</p>
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
                  <p className="text-sm text-gray-500">Total: <span className="font-semibold text-gray-900">{stats.clientMetrics.totalClients}</span> clientes</p>
                </div>
              </div>
            )}
          </div>

          {/* Top clients - INTERACTIVE */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Mejores clientes</h3>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : stats.clientMetrics.topClients.length === 0 ? (
              <p className="text-sm text-gray-400">No hay datos disponibles</p>
            ) : (
              <div className="space-y-2">
                {stats.clientMetrics.topClients.slice(0, 8).map((client, idx) => (
                  <div
                    key={client.id}
                    onClick={() => setDetail({ type: 'client', id: client.id, name: client.name })}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-500 w-5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.visits} visita{client.visits !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{formatCurrency(client.spent)}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Client source breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Origen de clientes</h3>
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
        <Modal title={getDetailTitle()} onClose={() => setDetail(null)}>
          {renderDetailContent()}
        </Modal>
      )}
    </div>
  );
}
