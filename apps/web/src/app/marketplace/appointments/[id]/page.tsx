'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

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
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-appointments'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-appointments'),
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
  const endTime = new Date(appt.endTime || appt.startTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const total = appt.items?.reduce((sum: number, i: any) => sum + Number(i.priceSnapshot || 0), 0) ?? 0;
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
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: style.bg, color: style.color }}
          >
            {STATUS_LABEL[appt.status] || appt.status}
          </span>
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
                    <p className="text-sm font-medium text-gray-900">${item.priceSnapshot}</p>
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
                      <p className="text-sm text-gray-500">${total}</p>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-sm text-green-600 font-medium">{label}</p>
                      <p className="text-sm text-green-600 font-medium">-${Number(appt.discountAmount)}</p>
                    </div>
                  </div>
                );
              })()}
              <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between">
                <p className="text-sm font-semibold text-gray-700">Total</p>
                <p className="text-sm font-semibold text-gray-900">
                  ${Math.max(0, total - Number(appt.discountAmount || 0))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment */}
        {appt.payments?.[0] && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Pago</h2>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 capitalize">{appt.payments[0].paymentMethod?.toLowerCase().replace('_', ' ') || '—'}</p>
              <p className="text-sm font-medium text-gray-900">${appt.payments[0].totalAmount}</p>
            </div>
          </div>
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
