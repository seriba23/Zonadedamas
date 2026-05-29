'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { formatBookingTime, formatBookingDate } from '@/lib/booking-time';
import { formatCurrency } from '@/lib/utils';
import { WhatsAppButton } from '@/components/ui/whatsapp-button';
import { buildAppointmentMessage } from '@/lib/whatsapp';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  RESCHEDULED: 'Reprogramada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Ausente',
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  CONFIRMED: { bg: '#d1fae5', color: '#059669' },
  RESCHEDULED: { bg: '#dbeafe', color: '#2563eb' },
  IN_PROGRESS: { bg: '#dbeafe', color: '#2563eb' },
  COMPLETED: { bg: '#f3f4f6', color: '#6b7280' },
  CANCELLED: { bg: '#fee2e2', color: '#dc2626' },
  NO_SHOW: { bg: '#fee2e2', color: '#dc2626' },
};

function formatDateTime(dateStr: string) {
  return {
    date: formatBookingDate(dateStr, 'long'),
    time: formatBookingTime(dateStr),
  };
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-appointments'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-appointments?filter=all&perPage=100'),
    enabled: isAuthenticated,
  });

  const appointments: any[] = (data as any)?.data || [];
  const appt = appointments.find((a) => a.id === id);

  useEffect(() => {
    if (!isLoading && !authLoading && !appt && appointments.length > 0) {
      router.replace('/marketplace/appointments');
    }
  }, [isLoading, authLoading, appt, appointments.length]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: '#008080' }} />
      </div>
    );
  }

  if (!appt) return null;

  const style = STATUS_STYLE[appt.status] || { bg: '#f3f4f6', color: '#6b7280' };
  const { date, time } = formatDateTime(appt.startTime);
  const endTime = formatBookingTime(appt.endTime || appt.startTime);
  const total = appt.items?.reduce((sum: number, i: any) => sum + Number(i.priceSnapshot || 0), 0) ?? 0;
  // Moneda del negocio; default a MXN si por algún motivo no viene.
  const currency: string = appt.tenant?.currency || 'MXN';
  const totalDuration = appt.items?.reduce((sum: number, i: any) => sum + Number(i.durationSnapshot || 0), 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pb-3 safe-top">
        <div className="max-w-2xl mx-auto pt-2 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Detalle de cita</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Business card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {appt.tenant?.logoUrl ? (
              <img src={`${API_URL}${appt.tenant.logoUrl}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-gray-400">{appt.tenant?.name?.[0]}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{appt.tenant?.name}</p>
            <button
              onClick={() => router.push(`/marketplace/${appt.tenant?.slug}`)}
              className="text-xs mt-0.5"
              style={{ color: '#008080' }}
            >
              Ver negocio →
            </button>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: style.bg, color: style.color }}
            >
              {STATUS_LABEL[appt.status] || appt.status}
            </span>
            <WhatsAppButton
              phone={appt.tenant?.businessPhone}
              message={buildAppointmentMessage({
                tenantName: appt.tenant?.name || 'el negocio',
                serviceName: (appt.items || []).map((i: any) => i.serviceNameSnapshot).join(', '),
                startTime: appt.startTime,
                appointmentId: appt.id,
              })}
              label="WhatsApp"
            />
          </div>
        </div>

        {/* Date & time */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Fecha y hora</h2>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#e0f2f1' }}>
              <svg className="w-5 h-5" style={{ color: '#008080' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 capitalize">{date}</p>
              <p className="text-xs text-gray-500">{time}{appt.endTime ? ` – ${endTime}` : ''}{totalDuration ? ` · ${totalDuration} min` : ''}</p>
            </div>
          </div>
        </div>

        {/* Employee */}
        {appt.employee && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Especialista</h2>
            <button
              onClick={() => router.push(`/marketplace/${appt.tenant?.slug}/professional/${appt.employee.id}`)}
              className="flex items-center gap-3 w-full text-left"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 text-sm font-bold"
                style={{ backgroundColor: appt.employee.color ? `${appt.employee.color}22` : '#e0f2f1', color: appt.employee.color || '#008080' }}
              >
                {appt.employee.avatarUrl ? (
                  <img src={`${API_URL}${appt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>{appt.employee.firstName?.[0]}{appt.employee.lastName?.[0]}</>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 flex-1">
                {appt.employee.firstName} {appt.employee.lastName}
              </p>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}

        {/* Services */}
        {appt.items?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Servicios</h2>
            <div className="space-y-2">
              {appt.items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900">{item.serviceNameSnapshot}</p>
                    {item.durationSnapshot && (
                      <p className="text-xs text-gray-400">{item.durationSnapshot} min</p>
                    )}
                  </div>
                  {item.priceSnapshot != null && (
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(Number(item.priceSnapshot), currency)}</p>
                  )}
                </div>
              ))}
              {Number(appt.discountAmount) > 0 && (() => {
                // Nombre del cupón: redemption (puntos), o promoción extraída
                // de las notas, o fallback genérico.
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
                  <div className="pt-2 mt-2 border-t border-gray-100">
                    <div className="flex justify-between mb-1">
                      <p className="text-sm text-gray-500">Subtotal</p>
                      <p className="text-sm text-gray-500">{formatCurrency(total, currency)}</p>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-sm text-green-600 font-medium">{label}</p>
                      <p className="text-sm text-green-600 font-medium">-{formatCurrency(Number(appt.discountAmount), currency)}</p>
                    </div>
                  </div>
                );
              })()}
              <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between">
                <p className="text-sm font-semibold text-gray-700">Total</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(Math.max(0, total - Number(appt.discountAmount || 0)), currency)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cupón aplicado — diseño completo de cupón de papel, mismo
            estilo que la sección /marketplace/coupons. Solo cuando hay
            redemption con reward completo. */}
        {appt.redemption?.reward && (
          <AppointmentCouponCard redemption={appt.redemption} currency={currency} />
        )}

        {/* Payment */}
        {appt.payments?.[0] && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Pago</h2>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 capitalize">{appt.payments[0].paymentMethod?.toLowerCase().replace('_', ' ') || '—'}</p>
              <p className="text-sm font-medium text-gray-900">{formatCurrency(Number(appt.payments[0].totalAmount || 0), appt.payments[0].currency || currency)}</p>
            </div>
          </div>
        )}

        {/* Comprobante de pago — estilo plano, sin banner ámbar */}
        {!['CANCELLED', 'NO_SHOW'].includes(appt.status) && (
          <AppointmentProofRow appt={appt} />
        )}

        {/* Notes */}
        {appt.notes && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Notas</h2>
            <p className="text-sm text-gray-600">{appt.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Tarjeta visual de cupón aplicado en la cita — mismo diseño que la
// CouponCard de /marketplace/coupons (stub teal a la izquierda con valor
// + perforaciones + separador punteado + contenido principal a la
// derecha). Sin botón CANJEAR porque ya se usó en esta cita.
function AppointmentCouponCard({ redemption, currency }: { redemption: any; currency: string }) {
  const reward = redemption.reward;
  const isDiscount = reward?.type === 'DESCUENTO';

  const valueLabel = isDiscount
    ? (reward?.discountMode === 'PERCENT' || reward?.discountMode === 'PERCENTAGE'
      ? `-${Number(reward.discountAmount)}%`
      : `-${formatCurrency(Number(reward.discountAmount || 0), currency).replace(/\s?[A-Z]{3}$/, '')}`)
    : 'GRATIS';
  const stubFontSize = valueLabel.length <= 4 ? '1.125rem' : valueLabel.length <= 6 ? '0.875rem' : '0.75rem';

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2 px-1">Cupón aplicado</h2>
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>
        {/* Stub izquierdo */}
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: '#008080' }}
        >
          <span
            className="text-white font-black leading-tight text-center break-all w-full px-2"
            style={{ fontSize: stubFontSize, wordBreak: 'break-all' }}
          >
            {valueLabel}
          </span>
          <span className="text-white/70 text-[9px] uppercase tracking-wider">
            {isDiscount ? 'descuento' : 'servicio'}
          </span>

          {/* Perforaciones */}
          <div
            className="absolute -right-3 -top-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#f9fafb' }}
          />
          <div
            className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#f9fafb' }}
          />
        </div>

        {/* Separador punteado */}
        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        {/* Contenido principal */}
        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">{reward?.name || 'Cupón'}</p>
              <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                APLICADO
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isDiscount
                ? (reward.discountMode === 'PERCENT' || reward.discountMode === 'PERCENTAGE'
                  ? `${Number(reward.discountAmount)}% de descuento`
                  : `${formatCurrency(Number(reward.discountAmount || 0), currency)} de descuento`)
                : 'Servicio gratis'}
            </p>
          </div>

          {redemption.code && (
            <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-gray-50 self-start">
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
              </svg>
              <span className="text-[10px] font-mono font-semibold text-gray-700 tracking-wider">
                {redemption.code}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Comprobante de pago en estilo plano: misma estructura que las demás
// tarjetas del detalle (border + padding). Si ya hay imagen, muestra
// preview + "Ver/Reemplazar"; si no, "Pago pendiente" con botón
// discreto para subir.
function AppointmentProofRow({ appt }: { appt: any }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = marketplaceApi.getAccessToken();
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API_URL}/api/marketplace/appointments/${appt.id}/payment-proof`, {
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
      // Full reload para garantizar que el cliente vea el nuevo estado de
      // la cita (con comprobante adjunto) sin que la query cacheada le
      // muestre el estado anterior por unos segundos.
      window.location.reload();
    },
    onError: (err: any) => setError(err?.message || 'Error al subir el comprobante'),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Comprobante de pago</h2>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: appt.paymentProofUrl ? '#059669' : '#d1d5db' }}
          />
          {appt.paymentProofUrl ? 'Pagado' : 'Pago pendiente'}
        </span>
      </div>
      {appt.paymentProofUrl ? (
        <>
          <a
            href={`${API_URL}${appt.paymentProofUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg overflow-hidden border border-gray-200 hover:border-[#008080] transition-colors"
          >
            <img src={`${API_URL}${appt.paymentProofUrl}`} alt="Comprobante" className="max-h-40 object-contain mx-auto" />
          </a>
          <label className="block mt-3 text-xs text-[#008080] cursor-pointer hover:underline">
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
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Sube la captura de tu pago (transferencia, depósito o cargo) para que el negocio confirme.
          </p>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-medium cursor-pointer transition-colors">
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
        </>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
