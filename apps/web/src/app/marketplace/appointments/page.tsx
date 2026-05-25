'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { formatCurrency } from '@/lib/utils';
import { formatBookingTime, formatBookingDate, formatBookingDay, formatBookingMonthShort, formatBookingWeekday } from '@/lib/booking-time';
import { WhatsAppButton } from '@/components/ui/whatsapp-button';
import { buildPurchaseMessage, buildAppointmentMessage } from '@/lib/whatsapp';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';

const RESERVATION_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Apartado',
  CONFIRMED: 'Confirmado',
  READY: 'Listo para entrega',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const RESERVATION_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  CONFIRMED: { bg: '#dbeafe', color: '#2563eb' },
  READY: { bg: '#ccfbf1', color: '#0d9488' },
  DELIVERED: { bg: '#d1fae5', color: '#059669' },
  CANCELLED: { bg: '#fee2e2', color: '#dc2626' },
};

const FULFILLMENT_LABELS: Record<string, string> = { PICKUP: 'Recoger en tienda física', SHIPPING: 'Envío a domicilio' };
const PAYMENT_LABELS: Record<string, string> = { CASH: 'Efectivo', SPEI: 'SPEI', CARD: 'Tarjeta' };

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Ausente',
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  CONFIRMED: { bg: '#d1fae5', color: '#059669' },
  IN_PROGRESS: { bg: '#dbeafe', color: '#2563eb' },
  COMPLETED: { bg: '#f3f4f6', color: '#6b7280' },
  CANCELLED: { bg: '#fee2e2', color: '#dc2626' },
  NO_SHOW: { bg: '#fee2e2', color: '#dc2626' },
};

function formatDate(dateStr: string) {
  return formatBookingDate(dateStr, 'weekday-short');
}

function formatTime(dateStr: string) {
  return formatBookingTime(dateStr);
}

export default function MarketplaceAppointmentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();
  const [tab, setTab] = useState<'citas' | 'compras'>('citas');
  const [search, setSearch] = useState('');
  // Filtro de estado: '' = todos. Distintos sets por tab.
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Cache 30s + sin refetch en focus/mount evita ráfagas de requests
  // cuando el usuario alterna entre las pestañas.
  const sharedQueryOpts = {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  } as const;

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-appointments'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-appointments?filter=all&perPage=100'),
    enabled: isAuthenticated && tab === 'citas',
    ...sharedQueryOpts,
  });

  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['marketplace-my-purchases'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-purchases'),
    enabled: isAuthenticated && tab === 'compras',
    ...sharedQueryOpts,
  });

  const appointments: any[] = (data as any)?.data || [];
  const purchases: any[] = (purchasesData as any)?.data || [];

  // Buscador: matchea contra negocio, empleado y nombre de servicio (citas)
  // o contra negocio + nombre del producto (compras). Case-insensitive.
  const q = search.trim().toLowerCase();
  const matchesAppointment = (a: any) => {
    if (!q) return true;
    const fields = [
      a.tenant?.name,
      a.employee?.firstName,
      a.employee?.lastName,
      ...(a.items || []).map((i: any) => i.serviceNameSnapshot),
    ];
    return fields.some((s: any) => (s || '').toLowerCase().includes(q));
  };
  const matchesPurchase = (p: any) => {
    if (!q) return true;
    const fields = [p.tenant?.name, p.product?.name, p.code];
    return fields.some((s: any) => (s || '').toLowerCase().includes(q));
  };

  // Filtro de status: si está vacío, deja pasar todo.
  const matchesAppointmentStatus = (a: any) =>
    !statusFilter || a.status === statusFilter;
  const matchesPurchaseStatus = (p: any) =>
    !statusFilter || p.status === statusFilter;

  // Próximas: ascendente (la más cercana al ahora arriba).
  // Historial: descendente (la más reciente arriba).
  // Comparamos strings raw (substring 0..19) para no convertir TZ.
  const rawIso = (s: string | undefined) => (s || '').substring(0, 19);
  const filteredAppointments = appointments.filter((a) => matchesAppointment(a) && matchesAppointmentStatus(a));
  const upcoming = filteredAppointments
    .filter((a) => ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status))
    .sort((a, b) => rawIso(a.startTime).localeCompare(rawIso(b.startTime)));
  const past = filteredAppointments
    .filter((a) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status))
    .sort((a, b) => rawIso(b.startTime).localeCompare(rawIso(a.startTime)));
  const filteredPurchases = purchases.filter((p) => matchesPurchase(p) && matchesPurchaseStatus(p));

  // Reseteamos filtro de status cuando cambias de tab (los sets son distintos)
  const APPOINTMENT_STATUSES = [
    { value: 'CONFIRMED',   label: 'Confirmada' },
    { value: 'PENDING',     label: 'Sin confirmar' },
    { value: 'RESCHEDULED', label: 'Reprogramada' },
    { value: 'IN_PROGRESS', label: 'En curso' },
    { value: 'COMPLETED',   label: 'Completada' },
    { value: 'CANCELLED',   label: 'Cancelada' },
    { value: 'NO_SHOW',     label: 'No-show' },
  ];
  const PURCHASE_STATUSES = [
    { value: 'PENDING',   label: 'Apartado' },
    { value: 'CONFIRMED', label: 'Confirmado' },
    { value: 'READY',     label: 'Listo' },
    { value: 'DELIVERED', label: 'Entregado' },
    { value: 'CANCELLED', label: 'Cancelado' },
  ];
  const statusOptions = tab === 'citas' ? APPOINTMENT_STATUSES : PURCHASE_STATUSES;

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="bg-white border-b border-gray-100 px-4 pb-3 safe-top">
          <div className="max-w-2xl mx-auto pt-2">
            <h1 className="text-lg font-bold text-gray-900">Mis citas</h1>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p className="text-gray-500 text-sm">Inicia sesión para ver tus citas</p>
          <Link
            href="/marketplace/login"
            className="px-6 py-2.5 text-white rounded-full text-sm font-medium"
            style={{ backgroundColor: '#008080' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header — mismo patron que /marketplace: titulo + search + filtros
          arriba, segmented control (Citas|Compras) abajo. */}
      <div className="bg-gray-50 px-4 pb-3 safe-top sticky top-0 z-30">
        <div className="max-w-2xl mx-auto">
          {/* Titulo + CTA "Nueva cita" */}
          <div className="pt-2 flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold text-gray-900">
              {tab === 'citas' ? 'Mis citas' : 'Mis compras'}
            </h1>
            {tab === 'citas' && (
              <button
                onClick={() => router.push('/marketplace')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: TEAL }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nueva cita
              </button>
            )}
          </div>

          {/* Search + filtros en un renglon (mismo patron que /marketplace) */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="relative flex-1 min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === 'citas' ? 'Buscar cita, negocio, servicio...' : 'Buscar compra, producto, negocio...'}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                onFocus={(e) => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <button
              onClick={() => setShowFiltersSheet(true)}
              title="Filtros"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
              style={statusFilter
                ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
                : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
              }
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              {statusFilter && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
              )}
            </button>
          </div>

          {/* Tabs Citas | Compras */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => { setTab('citas'); setStatusFilter(''); }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'citas' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Citas
            </button>
            <button
              onClick={() => { setTab('compras'); setStatusFilter(''); }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                tab === 'compras' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Compras
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {tab === 'citas' ? (
          isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: TEAL }} />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <p className="text-gray-500">No tienes citas todavía</p>
              <Link href="/marketplace" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: TEAL }}>
                Explorar negocios
              </Link>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-500">Sin resultados para tu búsqueda</p>
            </div>
          ) : (
            <div className="space-y-6">
              {upcoming.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Próximas</h2>
                  <div className="space-y-3">
                    {upcoming.map((appt) => (
                      <AppointmentCard key={appt.id} appt={appt} onPress={() => router.push(`/marketplace/appointments/${appt.id}`)} />
                    ))}
                  </div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Historial</h2>
                  <div className="space-y-3">
                    {past.map((appt) => (
                      <AppointmentCard key={appt.id} appt={appt} onPress={() => router.push(`/marketplace/appointments/${appt.id}`)} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        ) : (
          // ───── Compras tab ─────
          purchasesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: TEAL }} />
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              <p className="text-gray-500">{purchases.length === 0 ? 'No has apartado productos todavía' : 'Sin resultados para tu búsqueda'}</p>
              {purchases.length === 0 && (
                <Link href="/marketplace?shop=1" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: TEAL }}>
                  Explorar tiendas
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPurchases.map((p) => (
                <PurchaseCard key={p.id} purchase={p} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Bottom sheet de filtros — mismo patron que /marketplace */}
      {showFiltersSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFiltersSheet(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
              <button onClick={() => setShowFiltersSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4">
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter('')}
                  className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                  style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Limpiar filtros
                </button>
              )}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estado</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => { setStatusFilter(''); setShowFiltersSheet(false); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={!statusFilter
                    ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                    : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                  }
                >
                  Todos
                </button>
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setShowFiltersSheet(false); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={statusFilter === opt.value
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-4" />
          </div>
        </div>
      )}
    </div>
  );
}

function PurchaseCard({ purchase }: { purchase: any }) {
  const total = Number(purchase.unitPrice) * purchase.quantity + (Number(purchase.shippingCost) || 0);
  const currency = purchase.product?.currency || 'MXN';
  const day = formatBookingDay(purchase.createdAt);
  const month = formatBookingMonthShort(purchase.createdAt);

  // Status info con misma paleta que UpcomingAppointments del admin.
  const statusInfo = (() => {
    const map: Record<string, { text: string; bg: string; textColor: string; dot: string }> = {
      PENDING:   { text: 'Apartado',   bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: '#eab308' },
      CONFIRMED: { text: 'Confirmado', bg: 'bg-teal-50',   textColor: 'text-teal-700',   dot: '#008080' },
      READY:     { text: 'Listo',      bg: 'bg-blue-50',   textColor: 'text-blue-700',   dot: '#2563eb' },
      DELIVERED: { text: 'Entregado',  bg: 'bg-green-50',  textColor: 'text-green-700',  dot: '#059669' },
      CANCELLED: { text: 'Cancelado',  bg: 'bg-red-50',    textColor: 'text-red-700',    dot: '#dc2626' },
    };
    return map[purchase.status] || { text: purchase.status, bg: 'bg-gray-100', textColor: 'text-gray-600', dot: '#94a3b8' };
  })();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3">
      {/* Grid 4 cols: Fecha | Imagen | Producto+precio | Detalle+status */}
      <div
        className="grid items-center gap-x-3 gap-y-1.5"
        style={{ gridTemplateColumns: 'auto auto 1fr auto' }}
      >
        {/* Col 1: fecha de apartado — rowspan 2 */}
        <div className="row-span-2 self-center text-center min-w-[44px]">
          <p className="text-base font-bold leading-none tabular-nums" style={{ color: '#008080' }}>{day}</p>
          <p className="text-[9px] font-semibold uppercase text-gray-400 mt-0.5">{month}</p>
          {purchase.code && (
            <p className="text-[9px] font-mono text-gray-400 mt-1.5 leading-none">#{purchase.code}</p>
          )}
        </div>

        {/* Col 2: imagen producto — rowspan 2 */}
        <div className="row-span-2 self-center w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-gray-300 shadow ring-1 ring-gray-100">
          {purchase.product?.imageUrl ? (
            <img src={`${API_URL}${purchase.product.imageUrl}`} alt={purchase.product.name} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159" />
            </svg>
          )}
        </div>

        {/* Col 3 row 1: producto */}
        <p className="text-sm md:text-base font-bold text-gray-900 truncate min-w-0">
          {purchase.product?.name}
        </p>

        {/* Col 4 row 1: precio */}
        <p className="text-xs md:text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap text-right">
          {formatCurrency(total, currency)}
        </p>

        {/* Col 3 row 2: tenant + cantidad + fulfillment */}
        <p
          className="text-xs text-gray-500 min-w-0 self-start leading-snug overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: 'calc(2 * 1.375em)',
          }}
        >
          {purchase.tenant?.name} · {purchase.quantity}× {FULFILLMENT_LABELS[purchase.fulfillmentType]}
        </p>

        {/* Col 4 row 2: status */}
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap self-start justify-self-end ${statusInfo.bg} ${statusInfo.textColor}`}>
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: statusInfo.dot }} />
          {statusInfo.text}
        </span>
      </div>

      {/* Dirección de envío */}
      {purchase.shippingAddress && (
        <p className="text-[10px] text-gray-400 mt-3 truncate">📍 {purchase.shippingAddress}</p>
      )}

      {/* Leyenda de pago según si tiene cita asociada o no */}
      {purchase.status === 'PENDING' && (
        <div className="mt-3 p-2.5 rounded-lg bg-teal-50 border border-teal-200">
          {purchase.appointmentId ? (
            <p className="text-[11px] text-teal-800">
              El producto debe ser pagado el día de tu cita:{' '}
              <span className="font-semibold">
                {purchase.appointment?.startTime
                  ? formatBookingDate(purchase.appointment.startTime, 'long')
                  : 'próxima cita'}
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-teal-800">
              Contacta al negocio para coordinar la entrega y pago de tu producto
            </p>
          )}
        </div>
      )}

      {/* Comprobante de pago */}
      {purchase.status !== 'CANCELLED' && purchase.status !== 'DELIVERED' && (
        <PaymentProofSection purchase={purchase} />
      )}

      {/* WhatsApp icon-only en footer */}
      <div className="mt-3 flex items-center justify-end">
        <WhatsAppButton
          phone={purchase.tenant?.businessPhone}
          message={buildPurchaseMessage({
            tenantName: purchase.tenant?.name || 'el negocio',
            productName: purchase.product?.name,
            code: purchase.code,
            reservationId: purchase.id,
          })}
          variant="icon-only"
        />
      </div>
    </div>
  );
}

// Subir captura del comprobante SPEI desde la tarjeta de compra. Si la
// compra ya tiene comprobante, muestra link; si no, ofrece subirla.
function PaymentProofSection({ purchase }: { purchase: any }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = marketplaceApi.getAccessToken();
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(
        `${API_URL}/api/public/${purchase.tenant.slug}/shop/reservations/${purchase.id}/payment-proof`,
        { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo subir el comprobante');
      }
      return r.json();
    },
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-payments-all'] });
    },
    onError: (err: any) => setError(err?.message || 'Error al subir el comprobante'),
  });

  if (purchase.paymentProofUrl) {
    return (
      <div className="mt-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
          Comprobante de pago
        </p>
        <a
          href={`${API_URL}${purchase.paymentProofUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md overflow-hidden border border-gray-200 hover:border-[#008080] transition-colors"
        >
          <img src={`${API_URL}${purchase.paymentProofUrl}`} alt="Comprobante" className="max-h-32 object-contain mx-auto" />
        </a>
        <label className="block mt-2 text-[11px] text-[#008080] cursor-pointer hover:underline">
          Reemplazar comprobante
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 5 * 1024 * 1024) { setError('La imagen no puede pesar más de 5MB'); return; }
                uploadMutation.mutate(f);
              }
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
      <p className="text-[11px] text-amber-800 mb-1 font-medium">
        Pago pendiente
      </p>
      <p className="text-[10px] text-amber-700 mb-2 leading-relaxed">
        Sube la captura de tu pago (transferencia, depósito o cargo) para que el negocio confirme tu apartado.
      </p>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#008080] text-white text-[11px] font-medium hover:bg-[#006666] transition-colors cursor-pointer">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {uploadMutation.isPending ? 'Subiendo...' : 'Subir comprobante'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={uploadMutation.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 5 * 1024 * 1024) { setError('La imagen no puede pesar más de 5MB'); return; }
              uploadMutation.mutate(f);
            }
          }}
        />
      </label>
      {error && <p className="text-[10px] text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}

// Comprobante de pago en la tarjeta de cita. Si ya se subió, link "Ver
// comprobante"; si no y la cita sigue abierta (PENDING/CONFIRMED), botón
// para subir. Reusa el endpoint POST /api/marketplace/appointments/:id/payment-proof.
function AppointmentPaymentSection({ appt }: { appt: any }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = marketplaceApi.getAccessToken();
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(
        `${API_URL}/api/marketplace/appointments/${appt.id}/payment-proof`,
        { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo subir el comprobante');
      }
      return r.json();
    },
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-appointments'] });
    },
    onError: (err: any) => setError(err?.message || 'Error al subir el comprobante'),
  });

  if (appt.paymentProofUrl) {
    return (
      <div className="mt-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
          Comprobante de pago
        </p>
        <a
          href={`${API_URL}${appt.paymentProofUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md overflow-hidden border border-gray-200 hover:border-[#008080] transition-colors"
        >
          <img src={`${API_URL}${appt.paymentProofUrl}`} alt="Comprobante" className="max-h-32 object-contain mx-auto" />
        </a>
        <label className="block mt-2 text-[11px] text-[#008080] cursor-pointer hover:underline">
          Reemplazar comprobante
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 5 * 1024 * 1024) { setError('La imagen no puede pesar más de 5MB'); return; }
                uploadMutation.mutate(f);
              }
            }}
          />
        </label>
      </div>
    );
  }

  // Cita cerrada (sin posibilidad de subir comprobante)
  if (['CANCELLED', 'NO_SHOW'].includes(appt.status)) return null;

  return (
    <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
      <p className="text-[11px] text-amber-800 mb-1 font-medium">
        Pago pendiente
      </p>
      <p className="text-[10px] text-amber-700 mb-2 leading-relaxed">
        Sube la captura del comprobante para que el negocio confirme tu pago.
      </p>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#008080] text-white text-[11px] font-medium hover:bg-[#006666] transition-colors cursor-pointer">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {uploadMutation.isPending ? 'Subiendo...' : 'Subir comprobante'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={uploadMutation.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 5 * 1024 * 1024) { setError('La imagen no puede pesar más de 5MB'); return; }
              uploadMutation.mutate(f);
            }
          }}
        />
      </label>
      {error && <p className="text-[10px] text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}

function AppointmentCard({ appt, onPress }: { appt: any; onPress: () => void }) {
  const services = appt.items?.map((i: any) => i.serviceNameSnapshot).join(', ') || '—';
  const totalPrice = (appt.items || []).reduce((s: number, i: any) => s + Number(i.priceSnapshot || 0), 0);
  // Moneda del negocio. Si por alguna razón no viene, default a MXN
  // (NUNCA USD — el default global de formatCurrency confunde).
  const currency: string = appt.tenant?.currency || 'MXN';
  const empColor = appt.employee?.color || '#008080';
  const day = formatBookingDay(appt.startTime);
  const month = formatBookingMonthShort(appt.startTime);
  const time = formatBookingTime(appt.startTime);
  const endTime = formatBookingTime(appt.endTime);

  // Status: misma paleta que el dashboard admin (upcoming-appointments).
  const statusInfo = (() => {
    const map: Record<string, { text: string; bg: string; textColor: string; dot: string }> = {
      CONFIRMED:   { text: 'Confirmada',  bg: 'bg-teal-50',   textColor: 'text-teal-700',   dot: '#008080' },
      PENDING:     { text: 'Sin confirmar', bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: '#eab308' },
      RESCHEDULED: { text: 'Reprogramada', bg: 'bg-blue-50',  textColor: 'text-blue-700',   dot: '#2563eb' },
      IN_PROGRESS: { text: 'En curso',    bg: 'bg-purple-50', textColor: 'text-purple-700', dot: '#7c3aed' },
      COMPLETED:   { text: 'Completada',  bg: 'bg-green-50',  textColor: 'text-green-700',  dot: '#059669' },
      CANCELLED:   { text: 'Cancelada',   bg: 'bg-red-50',    textColor: 'text-red-700',    dot: '#dc2626' },
      NO_SHOW:     { text: 'No-show',     bg: 'bg-gray-100',  textColor: 'text-gray-600',   dot: '#94a3b8' },
    };
    return map[appt.status] || { text: appt.status, bg: 'bg-gray-100', textColor: 'text-gray-600', dot: '#94a3b8' };
  })();

  return (
    <button
      onClick={onPress}
      className="w-full bg-white rounded-2xl border border-gray-200 p-3 text-left hover:bg-gray-50 transition-colors"
    >
      {/* Grid 4 columnas: Hora/Fecha | Avatar | Título+precio | Servicio+status */}
      <div
        className="grid items-center gap-x-3 gap-y-1.5"
        style={{ gridTemplateColumns: 'auto auto 1fr auto' }}
      >
        {/* Col 1: fecha+hora — rowspan 2 */}
        <div className="row-span-2 self-center text-center min-w-[44px]">
          <p className="text-base font-bold leading-none tabular-nums" style={{ color: '#008080' }}>{day}</p>
          <p className="text-[9px] font-semibold uppercase text-gray-400 mt-0.5">{month}</p>
          <p className="text-xs font-semibold text-gray-700 tabular-nums mt-1.5 leading-none">{time}</p>
          {endTime && (
            <p className="text-[10px] text-gray-400 tabular-nums mt-0.5 leading-none">{endTime}</p>
          )}
        </div>

        {/* Col 2: avatar empleado — rowspan 2 */}
        <div
          className="row-span-2 self-center w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-white shadow"
          style={{ backgroundColor: empColor }}
        >
          {appt.employee?.avatarUrl ? (
            <img src={`${API_URL}${appt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{appt.employee?.firstName?.[0]}{appt.employee?.lastName?.[0]}</span>
          )}
        </div>

        {/* Col 3 row 1: Negocio */}
        <p className="text-sm md:text-base font-bold text-gray-900 truncate min-w-0">
          {appt.tenant?.name || '—'}
        </p>

        {/* Col 4 row 1: precio */}
        <p className="text-xs md:text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap text-right">
          {formatCurrency(totalPrice, currency)}
        </p>

        {/* Col 3 row 2: servicios + empleado */}
        <p
          className="text-xs text-gray-500 min-w-0 self-start leading-snug overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: 'calc(2 * 1.375em)',
          }}
        >
          {services}
          {appt.employee && (
            <span className="text-[10px] text-gray-400"> · {appt.employee.firstName} {appt.employee.lastName}</span>
          )}
        </p>

        {/* Col 4 row 2: status */}
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap self-start justify-self-end ${statusInfo.bg} ${statusInfo.textColor}`}>
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: statusInfo.dot }} />
          {statusInfo.text}
        </span>
      </div>

      {/* Cupón aplicado (puede venir de redemption por puntos o de promotion) */}
      {Number(appt.discountAmount) > 0 && (() => {
        // Nombre del cupón: si vino de redemption (puntos) usar reward.name.
        // Si no, intentar extraer "[Promoción: X]" de las notas. Fallback genérico.
        const fromRedemption = appt.redemption?.reward?.name;
        const fromNotes = (() => {
          const m = (appt.notes || '').match(/\[Promoci[oó]n: ([^\]]+)\]/);
          if (m) return m[1];
          const r = (appt.notes || '').match(/\[C[oó]digo 2x1: [^—]+— Promoci[oó]n: ([^\]]+)\]/);
          if (r) return r[1];
          return null;
        })();
        const label = fromRedemption || fromNotes || 'Cupón aplicado';
        return (
          <div className="mt-3 flex items-center justify-between text-xs bg-green-50 rounded-lg px-3 py-2 border border-green-100">
            <span className="text-green-700 font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              </svg>
              {label}
            </span>
            <span className="text-green-700 font-bold">-{formatCurrency(Number(appt.discountAmount), currency)}</span>
          </div>
        );
      })()}

      {/* Comprobante de pago: visible si ya se subió, o botón para subir
          si la cita sigue abierta. */}
      <div onClick={(e) => e.stopPropagation()}>
        <AppointmentPaymentSection appt={appt} />
      </div>

      {/* WhatsApp directo al negocio + referencia corta de la cita */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10px] text-gray-400 font-mono">#{(appt.id || '').substring(0, 8).toUpperCase()}</p>
        <div onClick={(e) => e.stopPropagation()}>
          <WhatsAppButton
            phone={appt.tenant?.businessPhone}
            message={buildAppointmentMessage({
              tenantName: appt.tenant?.name || 'el negocio',
              serviceName: services,
              startTime: appt.startTime,
              appointmentId: appt.id,
            })}
            variant="icon-only"
          />
        </div>
      </div>
    </button>
  );
}
