'use client';

import Link from 'next/link';
import dayjs from 'dayjs';
import { useCurrency } from '@/lib/hooks/use-currency';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UpcomingAppointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  client: { firstName: string; lastName: string; avatarUrl?: string | null };
  employee: { id: string; firstName: string; lastName: string; color: string; avatarUrl: string | null };
  items: { serviceNameSnapshot: string; priceSnapshot: number }[];
}

function statusInfo(status: string): { text: string; bg: string; textColor: string; dot: string } {
  const map: Record<string, { text: string; bg: string; textColor: string; dot: string }> = {
    CONFIRMED: { text: 'Confirmada', bg: 'bg-primary-50', textColor: 'text-primary-700', dot: '#008080' },
    PENDING: { text: 'Sin confirmar', bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: '#eab308' },
    IN_PROGRESS: { text: 'En curso', bg: 'bg-purple-50', textColor: 'text-purple-700', dot: '#7c3aed' },
    COMPLETED: { text: 'Completada', bg: 'bg-green-50', textColor: 'text-green-700', dot: '#059669' },
    CANCELLED: { text: 'Cancelada', bg: 'bg-red-50', textColor: 'text-red-700', dot: '#dc2626' },
    NO_SHOW: { text: 'No-show', bg: 'bg-[var(--bg-muted)]', textColor: 'text-[var(--text-secondary)]', dot: '#94a3b8' },
  };
  return map[status] || { text: status, bg: 'bg-[var(--bg-muted)]', textColor: 'text-[var(--text-secondary)]', dot: '#94a3b8' };
}

export function UpcomingAppointments({ appointments }: { appointments: UpcomingAppointment[] }) {
  const { format: formatCurrency } = useCurrency();
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Próximas citas</h2>
        <Link href="/calendar" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
          Ver todas
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
          <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No hay citas próximas</p>
        </div>
      ) : (
        <ul className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {appointments.map((apt) => {
            const totalPrice = apt.items.reduce((sum, i) => sum + i.priceSnapshot, 0);
            const services = apt.items.map((i) => i.serviceNameSnapshot).join(', ');
            const st = statusInfo(apt.status);
            const clientAvatar = apt.client.avatarUrl;
            const clientInitials = `${apt.client.firstName?.[0] || ''}${apt.client.lastName?.[0] || ''}`.toUpperCase();

            return (
              <li
                key={apt.id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              >
                {/* Hora inicio / fin (compacto) */}
                <div className="flex-shrink-0 min-w-[42px] text-center">
                  <p className="text-sm font-bold text-primary-600 tabular-nums leading-none">
                    {dayjs(apt.startTime).format('HH:mm')}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] tabular-nums mt-1">
                    {dayjs(apt.endTime).format('HH:mm')}
                  </p>
                </div>

                {/* Avatar del cliente */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: '#008080' }}
                >
                  {clientAvatar ? (
                    <img
                      src={clientAvatar.startsWith('http') ? clientAvatar : `${API_URL}${clientAvatar}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{clientInitials}</span>
                  )}
                </div>

                {/* Centro: nombre + badge (fila), precio (a la derecha), servicios (multilinea) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <p className="text-sm font-bold text-[var(--text-primary)] break-words">
                        {apt.client.firstName} {apt.client.lastName}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.textColor}`}>
                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: st.dot }} />
                        {st.text}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--text-primary)] tabular-nums whitespace-nowrap flex-shrink-0">
                      {formatCurrency(totalPrice)}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 break-words">{services}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
