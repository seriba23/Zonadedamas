'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { formatCurrency } from '@/lib/utils';
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
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export default function MarketplaceAppointmentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();
  const [tab, setTab] = useState<'citas' | 'compras'>('citas');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-appointments'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-appointments'),
    enabled: isAuthenticated && tab === 'citas',
  });

  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['marketplace-my-purchases'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-purchases'),
    enabled: isAuthenticated && tab === 'compras',
  });

  const appointments: any[] = (data as any)?.data || [];
  const purchases: any[] = (purchasesData as any)?.data || [];

  const upcoming = appointments.filter((a) =>
    ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status),
  );
  const past = appointments.filter((a) =>
    ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status),
  );

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
          <h1 className="text-lg font-bold text-gray-900">{tab === 'citas' ? 'Mis citas' : 'Mis compras'}</h1>
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
        {/* Tabs */}
        <div className="max-w-2xl mx-auto flex gap-1 -mb-px">
          <button
            onClick={() => setTab('citas')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'citas' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            style={tab === 'citas' ? { borderColor: TEAL, color: TEAL } : undefined}
          >
            Citas
          </button>
          <button
            onClick={() => setTab('compras')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'compras' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            style={tab === 'compras' ? { borderColor: TEAL, color: TEAL } : undefined}
          >
            Compras
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
        ) : (
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
        )}
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
          <p className="text-[10px] text-gray-400 mt-1">{new Date(purchase.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</p>

          {/* Leyenda según si tiene cita asociada o no */}
          {purchase.status === 'PENDING' && (
            <div className="mt-3 p-2.5 rounded-lg bg-teal-50 border border-teal-200 flex items-start gap-2">
              <svg className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              {purchase.appointmentId ? (
                <p className="text-[11px] text-teal-800">
                  El producto debe ser pagado el día de tu cita:{' '}
                  <span className="font-semibold">
                    {purchase.appointment?.startTime
                      ? new Date(purchase.appointment.startTime).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                      : 'próxima cita'}
                  </span>
                </p>
              ) : (
                <div className="flex items-center justify-between gap-2 flex-1">
                  <p className="text-[11px] text-teal-800">
                    Contacta al negocio para coordinar la entrega y pago de tu producto
                  </p>
                  <button
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#008080] text-white text-[11px] font-medium hover:bg-[#006666] transition-colors"
                    onClick={() => {/* Fase 2: abrir chat con negocio */}}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    Mensaje
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppointmentCard({ appt, onPress }: { appt: any; onPress: () => void }) {
  const style = STATUS_STYLE[appt.status] || { bg: '#f3f4f6', color: '#6b7280' };
  const services = appt.items?.map((i: any) => i.serviceNameSnapshot).join(', ') || '—';

  return (
    <button
      onClick={onPress}
      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{appt.tenant?.name || '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{services}</p>
          <div className="flex items-center gap-2 mt-2">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75" />
            </svg>
            <span className="text-xs text-gray-600">
              {formatDate(appt.startTime)} · {formatTime(appt.startTime)}
            </span>
          </div>
          {appt.employee && (
            <Link
              href={`/marketplace/${appt.tenant?.slug}/professional/${appt.employee.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs mt-1 inline-flex items-center gap-1"
              style={{ color: '#008080' }}
            >
              {appt.employee.firstName} {appt.employee.lastName}
            </Link>
          )}
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {STATUS_LABEL[appt.status] || appt.status}
        </span>
      </div>
    </button>
  );
}
