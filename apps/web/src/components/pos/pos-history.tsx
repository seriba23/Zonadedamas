'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import { formatBookingTime, formatBookingDay, formatBookingMonthShort } from '@/lib/booking-time';
import { DetailSheet } from '@/components/ui/detail-sheet';
import { SalesBreakdownGrid } from '@/components/dashboard/sales-breakdown-grid';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Period = 'today' | 'week' | 'month' | 'all';
type Method = '' | 'CASH' | 'CARD' | 'TRANSFER';

interface PaymentItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
  itemType: 'SERVICE' | 'PRODUCT';
}

interface Payment {
  id: string;
  appointmentId: string | null;
  clientId: string | null;
  client: { id: string; firstName: string; lastName: string } | null;
  items: PaymentItem[];
  // En Prisma el subtotal vive en `amount` (no `subtotalAmount`). Mantener
  // los nombres del backend para evitar NaN al castear.
  amount: number | string;
  discountAmount: number | string;
  tipAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
  notes: string | null;
  createdAt: string;
}

interface PaymentDetail extends Payment {
  appointment?: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
  };
}

const METHOD_LABEL: Record<Payment['paymentMethod'], string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
};

const METHOD_BADGE: Record<Payment['paymentMethod'], string> = {
  CASH: 'bg-green-50 text-green-700',
  CARD: 'bg-blue-50 text-blue-700',
  TRANSFER: 'bg-purple-50 text-purple-700',
};

// Formato YYYY-MM-DD usando fecha LOCAL del navegador (no UTC). El backend
// recibe esto, lo parsea como UTC al `new Date(...)` y le pega `T23:59:59Z`
// al endDate, así que ampliamos +/- 1 día y volvemos a filtrar en frontend
// con el rango local exacto. Sin esto las ventas de la noche desaparecen
// porque el día UTC ya cambió.
function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDateRange(period: Period): { startDate?: string; endDate?: string; localStart?: Date; localEnd?: Date } {
  if (period === 'all') return {};
  const now = new Date();
  const localStart = new Date(now);
  localStart.setHours(0, 0, 0, 0);
  const localEnd = new Date(now);
  localEnd.setHours(23, 59, 59, 999);

  if (period === 'week') {
    localStart.setDate(localStart.getDate() - 6);
  } else if (period === 'month') {
    localStart.setMonth(localStart.getMonth() - 1);
  }

  // Ampliamos +/- 1 día contra el backend para cubrir la diferencia de
  // timezone con UTC; el filtrado fino se hace en frontend con localStart/End.
  const backendStart = new Date(localStart);
  backendStart.setDate(backendStart.getDate() - 1);
  const backendEnd = new Date(localEnd);
  backendEnd.setDate(backendEnd.getDate() + 1);

  return {
    startDate: fmtLocal(backendStart),
    endDate: fmtLocal(backendEnd),
    localStart,
    localEnd,
  };
}

const PERIOD_LABEL: Record<Period, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
  all: 'Todo',
};

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'all', label: 'Todo' },
];

// Orden en el grid 2x2 del filtro: fila 1 = Efectivo | Transferencia,
// fila 2 = Tarjeta | Todos. (Tailwind grid llena por filas.)
const METHOD_OPTIONS: { key: Method; label: string }[] = [
  { key: 'CASH', label: 'Efectivo' },
  { key: 'TRANSFER', label: 'Transferencia' },
  { key: 'CARD', label: 'Tarjeta' },
  { key: '', label: 'Todos' },
];

export function PosHistory() {
  const { format: formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  // Default 'all': muestra todas las ventas; el usuario filtra por período
  // desde el sheet si quiere. Evita que un timezone offset oculte ventas
  // recientes al entrar.
  const [period, setPeriod] = useState<Period>('all');
  const [method, setMethod] = useState<Method>('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const range = useMemo(() => buildDateRange(period), [period]);

  // Rango (YYYY-MM-DD local) para el grid Venta Total. Sigue el período activo
  // del POS history. Si "Todo" → desde 2020-01-01 hasta hoy.
  const breakdownRange = useMemo(() => {
    const today = new Date();
    const end = fmtLocal(today);
    if (period === 'today') return { start: end, end };
    if (period === 'week') {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: fmtLocal(s), end };
    }
    if (period === 'month') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmtLocal(s), end };
    }
    return { start: '2020-01-01', end };
  }, [period]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pos-history', range.startDate, range.endDate, method],
    queryFn: () => {
      const params = new URLSearchParams({ perPage: '100' });
      if (range.startDate) params.set('startDate', range.startDate);
      if (range.endDate) params.set('endDate', range.endDate);
      if (method) params.set('paymentMethod', method);
      return api.get<{ data: Payment[]; meta?: any }>(`/api/payments?${params.toString()}`);
    },
    // Refetch siempre que el componente se monte (al volver al tab Historial)
    // para que no muestre cache anterior cuando acaban de registrarse ventas.
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const payments = data?.data || [];

  // Filtro fino en frontend por fecha local exacta (el backend amplió +/- 1
  // día por timezone) + búsqueda libre.
  const filtered = useMemo(() => {
    let list = payments;
    if (range.localStart && range.localEnd) {
      const startMs = range.localStart.getTime();
      const endMs = range.localEnd.getTime();
      list = list.filter((p) => {
        const t = new Date(p.createdAt).getTime();
        return t >= startMs && t <= endMs;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => {
        const clientName = `${p.client?.firstName || ''} ${p.client?.lastName || ''}`.toLowerCase();
        const itemNames = p.items.map((i) => i.description.toLowerCase()).join(' ');
        const total = String(p.totalAmount);
        return clientName.includes(q) || itemNames.includes(q) || total.includes(q);
      });
    }
    return list;
  }, [payments, search, range.localStart, range.localEnd]);

  const periodTotal = filtered.reduce((s, p) => s + Number(p.totalAmount), 0);
  const periodCount = filtered.length;

  // Contador de filtros activos (excluye búsqueda libre, que tiene su input).
  const activeFiltersCount = (period !== 'all' ? 1 : 0) + (method !== '' ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {/* Search + botón filtros — patrón de /marketplace/appointments */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, servicio, monto..."
                className="w-full text-sm border border-gray-200 rounded-full pl-9 pr-3 py-2 bg-white focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
              />
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className="relative w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
              aria-label="Filtros"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: '#008080' }}>
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Chips de filtros activos para que el usuario vea qué está aplicando */}
          {activeFiltersCount > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {period !== 'all' && (
                <button
                  onClick={() => setPeriod('all')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-[#008080] border border-teal-200 hover:bg-teal-100"
                >
                  {PERIOD_LABEL[period]}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {method !== '' && (
                <button
                  onClick={() => setMethod('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-[#008080] border border-teal-200 hover:bg-teal-100"
                >
                  {METHOD_LABEL[method as keyof typeof METHOD_LABEL]}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Venta total del periodo — servicios + paquetes + productos del negocio */}
          <div className="mb-3">
            <SalesBreakdownGrid
              startDate={breakdownRange.start}
              endDate={breakdownRange.end}
              periodLabel={PERIOD_LABEL[period]}
            />
          </div>

          {/* Resumen del período */}
          {!isLoading && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{periodCount} {periodCount === 1 ? 'venta' : 'ventas'}</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(periodTotal)}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m-13.5-9H6m1.5 9H6" />
                </svg>
              </div>
            </div>
          )}

          {/* Lista */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 mx-auto border-4 border-gray-200 border-t-[#008080] rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">No se encontraron ventas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => (
                <PaymentCard key={p.id} payment={p} onClick={() => setDetailId(p.id)} formatCurrency={formatCurrency} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom sheet de filtros — mismo patrón que /marketplace/appointments */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setFiltersOpen(false)}>
          <div
            className="w-full bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar + header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 pt-2 pb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">Filtros</h3>
                <button
                  onClick={() => { setPeriod('all'); setMethod(''); }}
                  className="text-xs font-medium text-[#008080]"
                  disabled={activeFiltersCount === 0}
                  style={{ opacity: activeFiltersCount === 0 ? 0.4 : 1 }}
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Período */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Período</p>
                <div className="grid grid-cols-2 gap-2">
                  {PERIOD_OPTIONS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPeriod(p.key)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        period === p.key
                          ? 'bg-[#008080] text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Método de pago */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Método de pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {METHOD_OPTIONS.map((m) => (
                    <button
                      key={m.key || 'all'}
                      onClick={() => setMethod(m.key)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        method === m.key
                          ? 'bg-[#008080] text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setFiltersOpen(false)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#008080' }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {detailId && <PaymentDetailModal paymentId={detailId} onClose={() => setDetailId(null)} formatCurrency={formatCurrency} />}
    </div>
  );
}

function PaymentCard({ payment, onClick, formatCurrency }: { payment: Payment; onClick: () => void; formatCurrency: (n: number) => string }) {
  const clientName = payment.client ? `${payment.client.firstName} ${payment.client.lastName}` : 'Cliente';
  const initials = payment.client
    ? `${payment.client.firstName?.[0] || ''}${payment.client.lastName?.[0] || ''}`.toUpperCase()
    : '?';
  const itemsPreview = payment.items.slice(0, 2).map((i) => i.description).join(', ');
  const more = payment.items.length - 2;
  const day = formatBookingDay(payment.createdAt);
  const month = formatBookingMonthShort(payment.createdAt);
  const time = formatBookingTime(payment.createdAt);
  const methodLabel = METHOD_LABEL[payment.paymentMethod];
  const methodBadge = METHOD_BADGE[payment.paymentMethod];

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-200 p-3 text-left hover:bg-gray-50 transition-colors"
    >
      <div className="grid items-center gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: 'auto auto 1fr auto' }}>
        {/* Col 1: fecha + hora */}
        <div className="row-span-2 self-center text-center min-w-[44px]">
          <p className="text-base font-bold leading-none tabular-nums" style={{ color: '#008080' }}>{day}</p>
          <p className="text-[9px] font-semibold uppercase text-gray-400 mt-0.5">{month}</p>
          <p className="text-xs font-semibold text-gray-700 tabular-nums mt-1.5 leading-none">{time}</p>
        </div>

        {/* Col 2: avatar cliente */}
        <div className="row-span-2 self-center w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-white shadow" style={{ backgroundColor: '#008080' }}>
          <span>{initials}</span>
        </div>

        {/* Col 3 row 1: cliente */}
        <p className="text-sm font-bold text-gray-900 truncate min-w-0">{clientName}</p>

        {/* Col 4 row 1: total */}
        <p className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap text-right">{formatCurrency(Number(payment.totalAmount))}</p>

        {/* Col 3 row 2: items */}
        <p className="text-xs text-gray-500 min-w-0 self-start leading-snug truncate">
          {itemsPreview}
          {more > 0 && <span className="text-gray-400"> +{more} más</span>}
        </p>

        {/* Col 4 row 2: método */}
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap self-start justify-self-end ${methodBadge}`}>
          {methodLabel}
        </span>
      </div>
    </button>
  );
}

function PaymentDetailModal({ paymentId, onClose, formatCurrency }: { paymentId: string; onClose: () => void; formatCurrency: (n: number) => string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['pos-history-detail', paymentId],
    queryFn: () => api.get<{ data: PaymentDetail }>(`/api/payments/${paymentId}`),
  });
  const payment = data?.data;

  const phone = useMemo(() => {
    if (!payment?.notes) return null;
    const m = payment.notes.match(/Recibo al:\s*(\d{10})/);
    return m ? m[1] : null;
  }, [payment]);

  const whatsappUrl = useMemo(() => {
    if (!payment || !phone) return null;
    const clientName = payment.client ? `${payment.client.firstName} ${payment.client.lastName}` : '';
    const services = payment.items.filter((i) => i.itemType === 'SERVICE');
    const products = payment.items.filter((i) => i.itemType === 'PRODUCT');
    const msg = [
      '*Comprobante de tu pedido*',
      clientName ? `Cliente: ${clientName}` : '',
      services.length > 0 ? `\n*Servicios:*\n${services.map((i) => `• ${i.quantity}× ${i.description} — ${formatCurrency(Number(i.unitPrice) * i.quantity)}`).join('\n')}` : '',
      products.length > 0 ? `\n*Productos:*\n${products.map((i) => `• ${i.quantity}× ${i.description} — ${formatCurrency(Number(i.unitPrice) * i.quantity)}`).join('\n')}` : '',
      Number(payment.discountAmount) > 0 ? `\nDescuento: -${formatCurrency(Number(payment.discountAmount))}` : '',
      Number(payment.tipAmount) > 0 ? `Propina: ${formatCurrency(Number(payment.tipAmount))}` : '',
      `\n*Total pagado: ${formatCurrency(Number(payment.totalAmount))}*`,
      `Método de pago: ${METHOD_LABEL[payment.paymentMethod]}`,
      '\n¡Gracias por tu compra!',
    ].filter(Boolean).join('\n');
    return `https://wa.me/52${phone}?text=${encodeURIComponent(msg)}`;
  }, [payment, phone, formatCurrency]);

  return (
    <DetailSheet title="Detalle de la venta" onClose={onClose}>
      {isLoading || !payment ? (
        <div className="text-center py-8">
          <div className="animate-spin h-6 w-6 mx-auto border-4 border-gray-200 border-t-[#008080] rounded-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center">
            <p className="text-xs text-gray-500">{new Date(payment.createdAt).toLocaleString('es')}</p>
            <p className="text-3xl font-bold text-[#008080] mt-1">{formatCurrency(Number(payment.totalAmount))}</p>
            <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${METHOD_BADGE[payment.paymentMethod]}`}>
              {METHOD_LABEL[payment.paymentMethod]}
            </span>
          </div>

          {/* Cliente */}
          {payment.client && (
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#008080' }}>
                {payment.client.firstName?.[0]}{payment.client.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">Cliente</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{payment.client.firstName} {payment.client.lastName}</p>
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Items</p>
            <div className="space-y-1.5">
              {payment.items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm">
                  <span className="text-gray-700 flex-1 mr-2">{it.quantity}× {it.description}</span>
                  <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(Number(it.unitPrice) * it.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{formatCurrency(Number(payment.amount))}</span></div>
            {Number(payment.discountAmount) > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Descuento</span><span className="font-medium text-green-600">-{formatCurrency(Number(payment.discountAmount))}</span></div>
            )}
            {Number(payment.tipAmount) > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Propina</span><span className="font-medium">{formatCurrency(Number(payment.tipAmount))}</span></div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-[#008080]">{formatCurrency(Number(payment.totalAmount))}</span>
            </div>
          </div>

          {/* Reenviar comprobante por WhatsApp */}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.476A11.929 11.929 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.115 0-4.142-.657-5.85-1.898l-.42-.298-2.744.877.87-2.684-.32-.438A9.723 9.723 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
              Reenviar comprobante por WhatsApp
            </a>
          )}
        </div>
      )}
    </DetailSheet>
  );
}
