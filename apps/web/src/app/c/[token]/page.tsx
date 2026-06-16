'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';

/**
 * Pagina publica del recordatorio de cita. El cliente abre el link
 * que recibio por WhatsApp y aqui puede:
 *  - Confirmar la cita
 *  - Reagendar a otro horario disponible del mismo empleado
 *  - Cancelar
 *
 * Sin auth. El token (en la URL) es la unica credencial.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AppointmentItem {
  serviceNameSnapshot: string;
  priceSnapshot: number;
  durationSnapshot: number;
  serviceId: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  color?: string | null;
}

interface Location {
  name: string;
  address?: string | null;
  phone?: string | null;
}

interface Tenant {
  name: string;
  slug: string;
  logoUrl?: string | null;
  tenantType?: string;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  confirmedAt?: string | null;
  client: { firstName: string; lastName: string };
  employee: Employee;
  items: AppointmentItem[];
  location: Location;
  tenant: Tenant;
}

interface Slot {
  startTime: string;
  available: boolean;
}

const TEAL = '#008080';

type View = 'detail' | 'reschedule' | 'cancel' | 'success';
type SuccessKind = 'confirmed' | 'rescheduled' | 'cancelled';

export default function ReminderPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [view, setView] = useState<View>('detail');
  const [successKind, setSuccessKind] = useState<SuccessKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados de reagenda
  const [pickedDate, setPickedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);

  // Cancelacion
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reminder', token],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/public/c/${token}`);
      if (!res.ok) throw new Error('not found');
      const json = await res.json();
      return json.data as Appointment;
    },
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/public/c/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo confirmar');
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccessKind('confirmed');
      setView('success');
      refetch();
    },
    onError: (err: Error) => setError(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/public/c/${token}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo cancelar');
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccessKind('cancelled');
      setView('success');
      refetch();
    },
    onError: (err: Error) => setError(err.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!pickedSlot) throw new Error('Elige un horario');
      const res = await fetch(`${API_URL}/api/public/c/${token}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: pickedSlot }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo reagendar');
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccessKind('rescheduled');
      setView('success');
      refetch();
    },
    onError: (err: Error) => setError(err.message),
  });

  const { data: availability, isLoading: loadingSlots } = useQuery({
    queryKey: ['reminder-availability', token, pickedDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/api/public/c/${token}/availability?date=${pickedDate}`,
      );
      if (!res.ok) throw new Error('availability error');
      const json = await res.json();
      return json.data as { slots: Slot[] };
    },
    enabled: view === 'reschedule',
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-[#008080] rounded-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-sm text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-gray-900 mb-1">Enlace no válido</h1>
          <p className="text-sm text-gray-500">
            El enlace que abriste es inválido o ha expirado. Si tienes dudas, contacta al negocio.
          </p>
        </div>
      </div>
    );
  }

  const apt = data;
  const fullName = `${apt.employee.firstName} ${apt.employee.lastName}`;
  const services = apt.items.map((it) => it.serviceNameSnapshot).join(', ');
  const totalDuration = apt.items.reduce((s, it) => s + (it.durationSnapshot || 0), 0);
  const totalPrice = apt.items.reduce((s, it) => s + Number(it.priceSnapshot || 0), 0);
  const startDate = new Date(apt.startTime);
  const isInactiveStatus = ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(apt.status);
  const isAlreadyConfirmed = apt.status === 'CONFIRMED' && !!apt.confirmedAt;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header del negocio */}
      <div className="bg-[#008080] text-white safe-top">
        <div className="max-w-md mx-auto px-5 py-5 flex items-center gap-3">
          {apt.tenant.logoUrl ? (
            <img
              src={`${API_URL}${apt.tenant.logoUrl}`}
              alt=""
              className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
              {apt.tenant.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Recordatorio</p>
            <h1 className="text-base font-bold truncate">{apt.tenant.name}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-3">
        {/* Tarjeta de detalle de la cita */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Tu cita</p>
            <p className="text-lg font-semibold text-gray-900">
              {startDate.toLocaleDateString('es', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {startDate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              {totalDuration > 0 && ` · ${totalDuration} min`}
            </p>
          </div>

          {/* Servicios */}
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Servicio</p>
            <p className="text-sm text-gray-900">{services}</p>
            {totalPrice > 0 && (
              <p className="text-sm font-semibold text-[#008080] mt-0.5">
                ${totalPrice.toLocaleString('es-MX')}
              </p>
            )}
          </div>

          {/* Profesional */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: apt.employee.color || TEAL }}
            >
              {apt.employee.avatarUrl ? (
                <img src={`${API_URL}${apt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <>{apt.employee.firstName[0]}{apt.employee.lastName[0]}</>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Profesional</p>
              <p className="text-sm font-medium text-gray-900">{fullName}</p>
            </div>
          </div>

          {/* Dirección */}
          {apt.location && apt.location.address && (
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                Dirección · {apt.location.name}
              </p>
              <p className="text-sm text-gray-700">{apt.location.address}</p>
              {apt.location.phone && (
                <a
                  href={`tel:${apt.location.phone}`}
                  className="text-xs text-[#008080] font-medium mt-1 inline-flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {apt.location.phone}
                </a>
              )}
            </div>
          )}

          {/* Estado actual / banner */}
          {isInactiveStatus && (
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500">
                Estado: {apt.status === 'CANCELLED' ? 'Cancelada' : apt.status === 'COMPLETED' ? 'Completada' : 'No asistió'}
              </p>
            </div>
          )}

          {isAlreadyConfirmed && (
            <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs font-medium text-green-800">¡Cita confirmada! Te esperamos.</p>
            </div>
          )}
        </div>

        {/* Acciones — solo si la cita está activa */}
        {!isInactiveStatus && view === 'detail' && (
          <div className="mt-4 space-y-2">
            {!isAlreadyConfirmed && (
              <button
                type="button"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="w-full py-3.5 rounded-xl bg-[#008080] text-white font-semibold hover:bg-[#006666] disabled:opacity-50 transition-colors"
              >
                {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar mi cita'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setView('reschedule'); setError(null); }}
              className="w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Reagendar
            </button>
            <button
              type="button"
              onClick={() => { setView('cancel'); setError(null); }}
              className="w-full py-3 rounded-xl border border-red-200 bg-white text-red-600 font-medium hover:bg-red-50 transition-colors"
            >
              Cancelar cita
            </button>
          </div>
        )}

        {/* ──── Reagendar ──── */}
        {view === 'reschedule' && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              Elige nueva fecha y hora con {apt.employee.firstName}
            </p>

            <label className="text-xs text-gray-500 block mb-1">Fecha</label>
            <input
              type="date"
              value={pickedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => { setPickedDate(e.target.value); setPickedSlot(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
            />

            <label className="text-xs text-gray-500 block mb-1">Horarios disponibles</label>
            {loadingSlots ? (
              <p className="text-xs text-gray-400 py-3">Buscando horarios...</p>
            ) : !availability?.slots?.length ? (
              <p className="text-xs text-gray-400 py-3">No hay horarios para esa fecha.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 mb-3 max-h-48 overflow-y-auto">
                {availability.slots.filter((s) => s.available).map((slot) => {
                  const dt = new Date(slot.startTime);
                  const label = dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
                  const isSelected = pickedSlot === slot.startTime;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => setPickedSlot(slot.startTime)}
                      className={`text-xs py-1.5 rounded border transition-colors ${
                        isSelected
                          ? 'bg-[#008080] text-white border-[#008080]'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-[#008080]/50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 mb-2">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setView('detail'); setError(null); setPickedSlot(null); }}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => { setError(null); rescheduleMutation.mutate(); }}
                disabled={!pickedSlot || rescheduleMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666] disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? 'Reagendando...' : 'Reagendar'}
              </button>
            </div>
          </div>
        )}

        {/* ──── Cancelar ──── */}
        {view === 'cancel' && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-1">
              ¿Seguro que quieres cancelar?
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Esta acción no se puede deshacer. El negocio será notificado.
            </p>
            <label className="text-xs text-gray-500 block mb-1">Motivo (opcional)</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="Por qué necesitas cancelar..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 resize-none"
            />

            {error && (
              <p className="text-xs text-red-600 mb-2">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setView('detail'); setError(null); }}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => { setError(null); cancelMutation.mutate(); }}
                disabled={cancelMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}

        {/* ──── Success ──── */}
        {view === 'success' && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{
                backgroundColor: successKind === 'cancelled' ? '#fee2e2' : '#d1fae5',
                color: successKind === 'cancelled' ? '#dc2626' : '#059669',
              }}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                {successKind === 'cancelled' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                )}
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              {successKind === 'confirmed' && '¡Cita confirmada!'}
              {successKind === 'rescheduled' && '¡Cita reagendada!'}
              {successKind === 'cancelled' && 'Cita cancelada'}
            </h2>
            <p className="text-sm text-gray-500">
              {successKind === 'confirmed' && `${apt.tenant.name} te esperará.`}
              {successKind === 'rescheduled' && 'Te enviaremos un nuevo recordatorio antes.'}
              {successKind === 'cancelled' && 'Esperamos verte pronto.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
