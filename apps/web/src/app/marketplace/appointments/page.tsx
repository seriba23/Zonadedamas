'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { formatCurrency } from '@/lib/utils';
import { formatBookingTime, formatBookingDate, formatBookingDay, formatBookingMonthShort, formatBookingWeekday } from '@/lib/booking-time';
import { WhatsAppButton } from '@/components/ui/whatsapp-button';
import { buildPurchaseMessage, buildAppointmentMessage, buildPaymentMessage } from '@/lib/whatsapp';
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
  const [tab, setTab] = useState<'citas' | 'compras' | 'pagos'>('citas');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-appointments'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-appointments?filter=all&perPage=100'),
    enabled: isAuthenticated && tab === 'citas',
  });

  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['marketplace-my-purchases'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-purchases'),
    enabled: isAuthenticated && tab === 'compras',
  });

  // Pagos unificados: stream combinado de pagos de citas + apartados.
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['marketplace-my-payments-all'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-payments-all'),
    enabled: isAuthenticated && tab === 'pagos',
  });

  const appointments: any[] = (data as any)?.data || [];
  const purchases: any[] = (purchasesData as any)?.data || [];
  const allPayments: any[] = (paymentsData as any)?.data || [];
  // Estados "pendientes" comunes a ambos kinds.
  const isPaymentPending = (p: any) =>
    p.kind === 'appointment'
      ? p.status === 'PENDING'
      : p.status === 'PENDING' || p.status === 'CONFIRMED' || p.status === 'READY';
  const isPaymentDone = (p: any) =>
    p.kind === 'appointment'
      ? p.status === 'COMPLETED' || p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED'
      : p.status === 'DELIVERED' || p.status === 'CANCELLED';
  const pendingPayments = allPayments.filter(isPaymentPending);
  const pastPayments = allPayments.filter(isPaymentDone);

  // Próximas: ascendente (la más cercana al ahora arriba).
  // Historial: descendente (la más reciente arriba).
  // Comparamos strings raw (substring 0..19) para no convertir TZ.
  const rawIso = (s: string | undefined) => (s || '').substring(0, 19);
  const upcoming = appointments
    .filter((a) => ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status))
    .sort((a, b) => rawIso(a.startTime).localeCompare(rawIso(b.startTime)));
  const past = appointments
    .filter((a) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status))
    .sort((a, b) => rawIso(b.startTime).localeCompare(rawIso(a.startTime)));

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
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pb-0 safe-top">
        <div className="max-w-2xl mx-auto pt-2 flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-gray-900">
            {tab === 'citas' ? 'Mis citas' : tab === 'compras' ? 'Mis compras' : 'Pagos pendientes'}
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
        {/* Tabs Citas | Compras | Pagos — estilo segmentado estandar */}
        <div className="max-w-2xl mx-auto flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            onClick={() => setTab('citas')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'citas' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Citas
          </button>
          <button
            onClick={() => setTab('compras')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
              tab === 'compras' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Compras
          </button>
          <button
            onClick={() => setTab('pagos')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
              tab === 'pagos' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Pagos
          </button>
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
        ) : tab === 'compras' ? (
          // ───── Compras tab ─────
          purchasesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: TEAL }} />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              <p className="text-gray-500">No has apartado productos todavía</p>
              <Link href="/marketplace?shop=1" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: TEAL }}>
                Explorar tiendas
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {purchases.map((p) => (
                <PurchaseCard key={p.id} purchase={p} />
              ))}
            </div>
          )
        ) : (
          // ───── Pagos tab — historial unificado de citas + compras,
          // separado en Pendientes / Realizados. ─────
          paymentsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: TEAL }} />
            </div>
          ) : pendingPayments.length === 0 && pastPayments.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375" />
              </svg>
              <p className="text-gray-500">No tienes pagos todavía</p>
              <p className="text-xs text-gray-400 max-w-[280px]">Aquí aparecerán los pagos de tus citas y compras de productos.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingPayments.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pendientes</h2>
                  <div className="space-y-3">
                    {pendingPayments.map((p) => (
                      <PaymentCard key={`${p.kind}-${p.id}`} payment={p} />
                    ))}
                  </div>
                </section>
              )}
              {pastPayments.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Historial</h2>
                  <div className="space-y-3">
                    {pastPayments.map((p) => (
                      <PaymentCard key={`${p.kind}-${p.id}`} payment={p} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// Tarjeta unificada de pago (cita o compra de producto).
function PaymentCard({ payment }: { payment: any }) {
  const isProduct = payment.kind === 'product';
  // Etiqueta + color del status
  const statusInfo = (() => {
    if (isProduct) {
      if (payment.status === 'PENDING') return { label: 'Pendiente', bg: '#fef3c7', color: '#d97706' };
      if (payment.status === 'CONFIRMED') return { label: 'Confirmado', bg: '#dbeafe', color: '#2563eb' };
      if (payment.status === 'READY') return { label: 'Listo', bg: '#ccfbf1', color: '#0d9488' };
      if (payment.status === 'DELIVERED') return { label: 'Entregado', bg: '#d1fae5', color: '#059669' };
      if (payment.status === 'CANCELLED') return { label: 'Cancelado', bg: '#fee2e2', color: '#dc2626' };
    } else {
      if (payment.status === 'PENDING') return { label: 'Pendiente', bg: '#fef3c7', color: '#d97706' };
      if (payment.status === 'COMPLETED') return { label: 'Pagado', bg: '#d1fae5', color: '#059669' };
      if (payment.status === 'REFUNDED') return { label: 'Reembolsado', bg: '#f3f4f6', color: '#6b7280' };
    }
    return { label: payment.status, bg: '#f3f4f6', color: '#6b7280' };
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0"
            style={{ backgroundColor: isProduct ? '#ecfeff' : '#f0fdfa', color: isProduct ? '#0e7490' : '#0d9488' }}
          >
            {isProduct ? 'TIENDA' : 'CITA'}
          </span>
          <p className="text-sm font-semibold text-gray-900 truncate">
            {payment.tenant?.name || 'Negocio'}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
          {statusInfo.label}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2 truncate">{payment.description}</p>
      {payment.appointmentStartTime && (
        <p className="text-[11px] text-gray-400 mb-2">
          Cita del {formatBookingDate(payment.appointmentStartTime, 'short')}
        </p>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{payment.paymentMethod || '—'}</span>
        <span className="font-bold" style={{ color: TEAL }}>
          {formatCurrency(Number(payment.amount || 0), payment.currency || 'MXN')}
        </span>
      </div>
      {/* Comprobante: ver si existe; subir/reemplazar si no */}
      <PaymentProofForPayment payment={payment} />

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10px] text-gray-400">
          {payment.code && <span className="font-mono font-semibold text-gray-500">#{payment.code} · </span>}
          {new Date(payment.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        <WhatsAppButton
          phone={payment.tenant?.businessPhone}
          message={buildPaymentMessage({
            tenantName: payment.tenant?.name || 'el negocio',
            kind: payment.kind,
            code: payment.code,
            reservationId: payment.reservationId,
            appointmentId: payment.appointmentId,
            description: payment.description,
          })}
          variant="icon-only"
        />
      </div>
    </div>
  );
}

function PurchaseCard({ purchase }: { purchase: any }) {
  const status = RESERVATION_STATUS_STYLE[purchase.status] || RESERVATION_STATUS_STYLE.PENDING;
  const total = Number(purchase.unitPrice) * purchase.quantity + (Number(purchase.shippingCost) || 0);
  const currency = purchase.product?.currency || 'MXN';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        {purchase.product?.imageUrl ? (
          <img src={`${API_URL}${purchase.product.imageUrl}`} alt={purchase.product.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{purchase.product?.name}</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0" style={{ backgroundColor: status.bg, color: status.color }}>
              {RESERVATION_STATUS_LABEL[purchase.status]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-2">{purchase.tenant?.name}</p>
          <div className="flex items-center justify-between text-xs">
            <div className="text-gray-500">
              <span>{purchase.quantity}x · {FULFILLMENT_LABELS[purchase.fulfillmentType]} · {PAYMENT_LABELS[purchase.preferredPaymentMethod]}</span>
            </div>
            <span className="font-bold" style={{ color: TEAL }}>{formatCurrency(total, currency)}</span>
          </div>
          {purchase.shippingAddress && (
            <p className="text-[10px] text-gray-400 mt-2 truncate">📍 {purchase.shippingAddress}</p>
          )}
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[10px] text-gray-400">
              {purchase.code && <span className="font-mono font-semibold text-gray-500">#{purchase.code} · </span>}
              {new Date(purchase.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
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

          {/* Leyenda según si tiene cita asociada o no */}
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

          {/* Comprobante de transferencia (SPEI): si no se subió en el
              checkout, permite subirlo ahora. Si ya se subió, muestra link. */}
          {purchase.preferredPaymentMethod === 'SPEI' && purchase.status !== 'CANCELLED' && (
            <PaymentProofSection purchase={purchase} />
          )}
        </div>
      </div>
    </div>
  );
}

// Universal: gestiona la captura del comprobante para un payment del
// tab "Pagos" — soporta kind=appointment (endpoint marketplace) y
// kind=product (endpoint shop). Si ya hay imagen, muestra link;
// si no, ofrece subirla.
function PaymentProofForPayment({ payment }: { payment: any }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = marketplaceApi.getAccessToken();
      const fd = new FormData();
      fd.append('file', file);
      const url = payment.kind === 'product'
        ? `${API_URL}/api/public/${payment.tenant.slug}/shop/reservations/${payment.reservationId}/payment-proof`
        : `${API_URL}/api/marketplace/appointments/${payment.appointmentId}/payment-proof`;
      const r = await fetch(url, {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo subir el comprobante');
      }
      return r.json();
    },
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-payments-all'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-appointments'] });
    },
    onError: (err: any) => setError(err?.message || 'Error al subir el comprobante'),
  });

  // Si la cita/compra ya está finalizada y no tiene comprobante, no
  // ofrecemos subirlo (no tiene sentido).
  const isClosed = payment.kind === 'product'
    ? ['DELIVERED', 'CANCELLED'].includes(payment.status)
    : ['REFUNDED'].includes(payment.status);

  if (payment.paymentProofUrl) {
    return (
      <div className="mt-3">
        <a
          href={`${API_URL}${payment.paymentProofUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-[#008080] hover:text-[#006666]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
          Ver comprobante
        </a>
      </div>
    );
  }

  if (isClosed) return null;

  return (
    <div className="mt-3">
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
      <p className="text-[11px] text-amber-800 mb-2 font-medium">
        ⚠ Falta tu comprobante de transferencia
      </p>
      <p className="text-[10px] text-amber-700 mb-2 leading-relaxed">
        Sube la captura para que el negocio confirme tu apartado y se genere el ticket.
      </p>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#008080] text-white text-[11px] font-medium hover:bg-[#006666] transition-colors cursor-pointer">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {uploadMutation.isPending ? 'Subiendo...' : 'Subir captura'}
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
  const style = STATUS_STYLE[appt.status] || { bg: '#f3f4f6', color: '#6b7280' };
  const services = appt.items?.map((i: any) => i.serviceNameSnapshot).join(', ') || '—';
  const empColor = appt.employee?.color || '#008080';
  const day = formatBookingDay(appt.startTime);
  const month = formatBookingMonthShort(appt.startTime);
  const time = formatTime(appt.startTime);
  const weekday = formatBookingWeekday(appt.startTime);

  return (
    <button
      onClick={onPress}
      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow"
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900 truncate">{appt.tenant?.name || '—'}</p>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {STATUS_LABEL[appt.status] || appt.status}
        </span>
      </div>

      {/* Main content */}
      <div className="flex items-center gap-3">
        {/* Employee photo */}
        {appt.employee && (
          <Link
            href={`/marketplace/${appt.tenant?.slug}/professional/${appt.employee.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden ring-2 ring-white shadow"
              style={{ backgroundColor: empColor }}
            >
              {appt.employee.avatarUrl ? (
                <img src={`${API_URL}${appt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{appt.employee.firstName?.[0]}{appt.employee.lastName?.[0]}</span>
              )}
            </div>
          </Link>
        )}

        {/* Service + Employee name */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate">{services}</p>
          {appt.employee && (
            <Link
              href={`/marketplace/${appt.tenant?.slug}/professional/${appt.employee.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium hover:underline truncate block"
              style={{ color: '#008080' }}
            >
              {appt.employee.firstName} {appt.employee.lastName}
            </Link>
          )}
        </div>

        {/* Date & Time - prominent, bottom right */}
        <div className="flex-shrink-0 text-right">
          <p className="text-2xl font-bold text-gray-900 leading-none">{day}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase">{month}</p>
          <p className="text-sm font-semibold mt-1" style={{ color: '#008080' }}>{time}</p>
          <p className="text-[10px] text-gray-400 capitalize">{weekday}</p>
        </div>
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
            <span className="text-green-700 font-bold">-{formatCurrency(Number(appt.discountAmount))}</span>
          </div>
        );
      })()}

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
