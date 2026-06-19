'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-auth';

interface NotificationLog {
  id: string;
  channel: 'EMAIL' | 'WHATSAPP';
  eventName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  subject: string | null;
  status: 'SENT' | 'FAILED';
  error: string | null;
  createdAt: string;
  tenant: { id: string; name: string; slug: string } | null;
}

interface ListResponse {
  data: NotificationLog[];
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

const EVENT_LABELS: Record<string, string> = {
  'appointment.created': 'Cita creada',
  'appointment.confirmed': 'Cita confirmada',
  'appointment.rescheduled': 'Cita reagendada',
  'appointment.cancelled': 'Cita cancelada',
  'appointment.completed': 'Cita completada',
  'payment.completed': 'Pago completado',
};
const CHANNEL_LABELS: Record<string, string> = { EMAIL: 'Email', WHATSAPP: 'WhatsApp' };
const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'SENT', label: 'Enviadas' },
  { value: 'FAILED', label: 'Fallidas' },
];

export default function PlatformNotificationsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-notification-logs', statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '20');
      if (statusFilter) params.set('status', statusFilter);
      return platformApi.get<ListResponse>(`/api/platform/notification-logs?${params.toString()}`);
    },
  });

  const logs = data?.data || [];
  const meta = data?.meta;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Registros de notificaciones</h1>
      <p className="text-sm text-gray-500 mb-5">Historial global de notificaciones enviadas por todos los negocios.</p>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'bg-[#008080] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay registros de notificaciones.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Canal</th>
                  <th className="px-4 py-3 font-medium">Destinatario</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('es', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{log.tenant?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{EVENT_LABELS[log.eventName] || log.eventName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${log.channel === 'EMAIL' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {CHANNEL_LABELS[log.channel]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{log.recipientEmail || log.recipientPhone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${log.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {log.status === 'SENT' ? 'Enviada' : 'Fallida'}
                      </span>
                      {log.error && <span className="ml-2 text-xs text-red-500" title={log.error}>{log.error.slice(0, 30)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">{meta.total} registros</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Anterior</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page} / {meta.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
