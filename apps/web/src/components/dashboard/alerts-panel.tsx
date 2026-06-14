'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AlertCounts {
  lowStockCount: number;
  pendingReservations: number;
  unconfirmedAppointments: number;
  unconfirmedRange: { from: string | null; to: string | null };
}

export function AlertsPanel() {
  const { data } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => api.get<AlertCounts>('/api/reports/alerts'),
    refetchInterval: 60_000,
  });

  const alerts = data?.data;
  if (!alerts) return null;

  // stock bajo y apartados pendientes ya se entregan al staff via el
  // sistema de notificaciones (bell + push); ya no se duplican aqui.
  // Solo se mantiene "citas sin confirmar" porque es un estado acumulado
  // (no un evento puntual) y conviene tenerlo visible en el home.
  const items = [
    {
      count: alerts.unconfirmedAppointments,
      label: 'citas sin confirmar',
      action: 'Ver citas',
      // Si conocemos el rango exacto, abrir el calendario en vista
      // Personalizada con from-to ajustados para mostrar las N citas.
      href: alerts.unconfirmedRange?.from && alerts.unconfirmedRange?.to
        ? `/calendar?status=PENDING&view=custom&from=${alerts.unconfirmedRange.from}&to=${alerts.unconfirmedRange.to}`
        : '/calendar?status=PENDING',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
  ].filter((a) => a.count > 0);

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="card card-highlight flex items-center gap-3 hover:shadow-sm transition-shadow"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--primary-tint)', color: 'var(--primary-tint-fg)' }}
          >
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--primary-tint-fg)' }}>
              <span className="text-base font-bold">{item.count}</span> {item.label}
            </p>
            <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--primary-tint-fg)' }}>{item.action} →</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
