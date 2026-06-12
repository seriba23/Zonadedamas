'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useNotificationsList,
  useUnreadCounts,
  useMarkRead,
  useMarkAllRead,
  type StaffNotification,
} from '@/lib/hooks/use-staff-notifications';

const TEAL = '#008080';

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

interface NotificationBellProps {
  basePath?: string; // '/employee' o '/dashboard' para el "ver todas"
}

export function NotificationBell({ basePath = '/employee' }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: counts } = useUnreadCounts();
  const { data: list, isLoading } = useNotificationsList({ perPage: 8 });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const total = counts?.total ?? 0;
  const items = list?.data ?? [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleClick(n: StaffNotification) {
    setOpen(false);
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-gray-600 hover:text-[#008080] hover:bg-[#e0f2f1] transition-colors"
        aria-label="Notificaciones"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {total > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ backgroundColor: '#dc2626' }}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[340px] max-w-[95vw] bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden"
          role="menu"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Notificaciones</span>
            {total > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate(undefined)}
                className="text-xs font-semibold transition-colors hover:underline"
                style={{ color: TEAL }}
              >
                Marcar todas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Cargando...</div>
            )}
            {!isLoading && items.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-gray-400">
                No tienes notificaciones aun.
              </div>
            )}
            {!isLoading &&
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${n.readAt ? '' : 'bg-teal-50/40'}`}
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: n.readAt ? 'transparent' : TEAL }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-gray-600 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))}
          </div>

          {/* Footer */}
          <Link
            href={`${basePath}/inbox`}
            onClick={() => setOpen(false)}
            className="block text-center text-sm font-semibold py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors"
            style={{ color: TEAL }}
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
