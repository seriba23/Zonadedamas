'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/hooks/use-auth';
import { buildReminderMessage, buildWhatsAppUrl } from '@/lib/whatsapp';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';

interface ReminderAppointment {
  id: string;
  startTime: string;
  reminderSentAt?: string | null;
  status: string;
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

type Tab = 'pending' | 'sent';

export default function RemindersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantName = (user as any)?.tenantName || 'tu negocio';

  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reminders', tab],
    queryFn: () =>
      api.get<{ data: ReminderAppointment[] }>(
        `/api/appointments/reminders/pending?hoursAhead=72&sentToday=${tab === 'sent'}`,
      ),
  });

  const markSentMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      api.post<{ data: { token: string; reminderSentAt: string } }>(
        `/api/appointments/${appointmentId}/mark-reminder-sent`,
        {},
      ),
  });

  const all = data?.data || [];

  const filtered = useMemo(() => {
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter((a) => {
      const name = `${a.client.firstName} ${a.client.lastName}`.toLowerCase();
      return name.includes(q);
    });
  }, [all, search]);

  async function handleSend(apt: ReminderAppointment) {
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
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-pending'] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4">
        {/* Buscador */}
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ ['--tw-ring-color' as any]: '#008080' }}
          />
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden max-w-md">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'pending' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Pendientes
          </button>
          <button
            type="button"
            onClick={() => setTab('sent')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'sent' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Enviados hoy
          </button>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-500">
              {tab === 'pending'
                ? 'No hay recordatorios pendientes por ahora.'
                : 'No se han enviado recordatorios hoy.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((apt) => {
              const start = new Date(apt.startTime);
              const dateStr = start.toLocaleDateString('es', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              });
              const timeStr = start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
              const services = apt.items.map((it) => it.serviceNameSnapshot).join(', ');
              const hasPhone = !!apt.client.phone;
              return (
                <div
                  key={apt.id}
                  className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: apt.employee.color || TEAL }}
                  >
                    {apt.client.avatarUrl ? (
                      <img src={`${API_URL}${apt.client.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <>{apt.client.firstName[0]}{apt.client.lastName[0]}</>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {apt.client.firstName} {apt.client.lastName}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {dateStr} · {timeStr}
                      {services && ` · ${services}`}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      con {apt.employee.firstName} {apt.employee.lastName}
                      {!hasPhone && <span className="text-red-500 ml-1">· sin teléfono</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSend(apt)}
                    disabled={!hasPhone || busy === apt.id}
                    title={apt.reminderSentAt ? 'Reenviar recordatorio' : 'Enviar recordatorio'}
                    className="px-3 py-2 rounded-full flex items-center gap-1.5 text-white text-xs font-semibold flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#25D366' }}
                  >
                    {busy === apt.id ? (
                      <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        {apt.reminderSentAt && tab === 'sent' ? 'Reenviar' : 'Enviar'}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
