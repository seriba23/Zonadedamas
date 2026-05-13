'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AlertCounts {
  lowStockCount: number;
  pendingReservations: number;
  unconfirmedAppointments: number;
}

export function AlertsPanel() {
  const { data } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => api.get<AlertCounts>('/api/reports/alerts'),
    refetchInterval: 60_000,
  });

  const alerts = data?.data;
  if (!alerts) return null;

  const items = [
    {
      count: alerts.lowStockCount,
      label: 'productos con stock bajo',
      action: 'Ver inventario',
      href: '/inventory?stockBajo=true',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
    },
    {
      count: alerts.pendingReservations,
      label: 'apartados pendientes',
      action: 'Ver apartados',
      href: '/reservations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      ),
    },
    {
      count: alerts.unconfirmedAppointments,
      label: 'citas sin confirmar',
      action: 'Ver citas',
      href: '/calendar',
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
