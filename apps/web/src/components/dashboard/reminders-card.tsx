'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { buildReminderMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { useAuth } from '@/lib/hooks/use-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';

interface PendingReminderAppointment {
  id: string;
  startTime: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl?: string | null;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    color?: string | null;
    avatarUrl?: string | null;
  };
  items: { serviceNameSnapshot: string; durationSnapshot: number }[];
}

/**
 * Card "Recordatorios pendientes" para el dashboard. Lista las citas
 * proximas (next 36h) sin recordatorio enviado. Click en el boton de
 * WhatsApp marca como enviado y abre wa.me con el mensaje preescrito
 * que incluye el link a /c/:token.
 */
export function RemindersCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantName = (user as any)?.tenantName || 'tu negocio';
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reminders-pending'],
    queryFn: () =>
      api.get<{ data: PendingReminderAppointment[] }>(
        `/api/appointments/reminders/pending?hoursAhead=36`,
      ),
  });

  const markSentMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      api.post<{ data: { token: string; reminderSentAt: string } }>(
        `/api/appointments/${appointmentId}/mark-reminder-sent`,
        {},
      ),
  });

  const reminders = data?.data || [];

  async function handleSend(apt: PendingReminderAppointment) {
    if (!apt.client.phone) return;
    setBusy(apt.id);
    try {
      const res = await markSentMutation.mutateAsync(apt.id);
      const msg = buildReminderMessage({
        clientFirstName: apt.client.firstName,
        tenantName,
        serviceName: apt.items[0]?.serviceNameSnapshot,
        employeeFirstName: apt.employee.firstName,
        startTime: apt.startTime,
        token: res.data.token,
      });
      const url = buildWhatsAppUrl(apt.client.phone, msg);
      if (url) window.open(url, '_blank');
      queryClient.invalidateQueries({ queryKey: ['reminders-pending'] });
    } finally {
      setBusy(null);
    }
  }

  // Si no hay nada que recordar y carga termino, ocultamos la card para
  // no contaminar el dashboard. Aparece automaticamente cuando hay citas.
  if (!isLoading && reminders.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-xl border p-4 md:p-5"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary-tint)', color: 'var(--primary-tint-fg)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>
          <h3 className="text-sm md:text-base font-semibold text-[var(--text-primary)]">
            Recordatorios pendientes
          </h3>
          {reminders.length > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--primary-tint)', color: 'var(--primary-tint-fg)' }}
            >
              {reminders.length}
            </span>
          )}
        </div>
        <Link href="/reminders" className="text-xs font-medium text-[#008080] hover:underline">
          Ver todo →
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-[var(--bg-muted)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.slice(0, 5).map((apt) => {
            const startDate = new Date(apt.startTime);
            const day = startDate.toLocaleDateString('es', { weekday: 'short' });
            const time = startDate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
            const services = apt.items.map((it) => it.serviceNameSnapshot).join(', ');
            const hasPhone = !!apt.client.phone;
            return (
              <div
                key={apt.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-muted)] transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: apt.employee.color || TEAL }}
                >
                  {apt.client.avatarUrl ? (
                    <img src={`${API_URL}${apt.client.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <>{apt.client.firstName[0]}{apt.client.lastName[0]}</>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {apt.client.firstName} {apt.client.lastName}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">
                    {day} · {time}
                    {services && ` · ${services}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSend(apt)}
                  disabled={!hasPhone || busy === apt.id}
                  title={hasPhone ? 'Enviar recordatorio por WhatsApp' : 'Cliente sin teléfono'}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: hasPhone ? '#25D366' : '#e5e7eb',
                    color: 'white',
                  }}
                >
                  {busy === apt.id ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
          {reminders.length > 5 && (
            <Link
              href="/reminders"
              className="block text-center text-xs font-medium text-[#008080] hover:underline py-2"
            >
              Ver {reminders.length - 5} más →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
