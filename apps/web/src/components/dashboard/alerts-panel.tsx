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
      icon: '📦',
      href: '/inventory?stockBajo=true',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-700',
      badgeColor: 'bg-amber-500',
    },
    {
      count: alerts.pendingReservations,
      label: 'apartados pendientes',
      icon: '🛒',
      href: '/reservations',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      badgeColor: 'bg-blue-500',
    },
    {
      count: alerts.unconfirmedAppointments,
      label: 'citas sin confirmar',
      icon: '📅',
      href: '/calendar',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
      badgeColor: 'bg-yellow-500',
    },
  ].filter((a) => a.count > 0);

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`${item.bgColor} ${item.borderColor} border rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow`}
        >
          <span className="text-2xl">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`${item.badgeColor} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                {item.count}
              </span>
            </div>
            <p className={`text-xs ${item.textColor} mt-1 font-medium`}>{item.label}</p>
          </div>
          <svg className={`w-4 h-4 ${item.textColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
