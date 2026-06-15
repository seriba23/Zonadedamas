'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  useNotificationsList,
  useUnreadCounts,
  useMarkRead,
  useMarkAllRead,
} from '@/lib/hooks/use-staff-notifications';
import {
  pushSupported,
  pushPermission,
  registerServiceWorker,
  requestPushPermission,
  subscribePushOnServer,
} from '@/lib/push';
import { Modal } from '@/components/ui/modal';

const TEAL = '#008080';

const SECTION_LABELS: Record<string, string> = {
  appointments: 'Citas',
  shop: 'Tienda',
  payments: 'Pagos',
  reviews: 'Reseñas',
  inventory: 'Inventario',
  reservations: 'Apartados',
};

function sectionLabel(s: string): string {
  return SECTION_LABELS[s] ?? s;
}

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
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPermission(pushPermission());
  }, []);

  if (permission === null) return null;
  if (permission === 'unsupported') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 mb-4">
        Tu navegador no soporta notificaciones push. Las notificaciones in-app
        siguen funcionando aqui.
      </div>
    );
  }
  if (permission === 'granted') return null;

  async function handleEnable() {
    setBusy(true);
    try {
      await registerServiceWorker();
      const result = await requestPushPermission();
      setPermission(result);
      if (result === 'granted') {
        await subscribePushOnServer();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
      <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-teal-800">
          Activa las notificaciones del navegador
        </p>
        <p className="text-xs text-teal-700 mt-0.5">
          Recibe avisos de citas nuevas, cancelaciones y mas, aun cuando la app
          este cerrada en tu telefono o computadora.
        </p>
        <button
          onClick={handleEnable}
          disabled={busy || permission === 'denied'}
          className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50"
          style={{ backgroundColor: TEAL }}
        >
          {busy
            ? 'Activando...'
            : permission === 'denied'
              ? 'Bloqueadas en el navegador'
              : 'Activar notificaciones'}
        </button>
        {permission === 'denied' && (
          <p className="text-[11px] text-gray-500 mt-1">
            Habilita las notificaciones desde la configuracion del sitio en tu
            navegador para poder activarlas.
          </p>
        )}
      </div>
    </div>
  );
}

export function StaffInbox() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [section, setSection] = useState<string | undefined>(undefined);
  const [draftSection, setDraftSection] = useState<string | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  function openFilters() {
    setDraftSection(section);
    setShowFilters(true);
  }
  function applyFilters() {
    setSection(draftSection);
    setPage(1);
    setShowFilters(false);
  }
  function clearDraftFilters() {
    setDraftSection(undefined);
  }

  const { data: counts } = useUnreadCounts();
  const { data: list, isLoading } = useNotificationsList({
    page,
    perPage: 20,
    section,
    unreadOnly,
  });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const sectionsWithUnread = Object.keys(counts?.counts ?? {});
  const allSections = Array.from(
    new Set([...Object.keys(SECTION_LABELS), ...sectionsWithUnread]),
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {counts?.total ?? 0} sin leer
          </p>
        </div>
        {(counts?.total ?? 0) > 0 && (
          <button
            onClick={() => markAllRead.mutate(section)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Marcar todas
          </button>
        )}
      </div>

      <PermissionBanner />

      {/* Filtros: icono que abre modal con las secciones + chip "No leídas"
          que se queda fuera porque es el toggle mas usado. */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={openFilters}
          aria-label="Filtros"
          title="Filtros"
          className={`flex-shrink-0 p-2 rounded-lg border transition-colors ${
            section
              ? 'bg-[#008080] border-[#008080] text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
        {section && (
          <span className="text-xs font-medium text-[#008080] bg-teal-50 border border-teal-200 rounded-full px-2.5 py-1">
            {sectionLabel(section)}
          </span>
        )}
        <button
          onClick={() => {
            setUnreadOnly((v) => !v);
            setPage(1);
          }}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ml-auto ${
            unreadOnly
              ? 'bg-[#008080] text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          No leídas
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">Cargando...</div>
        )}
        {!isLoading && (list?.data?.length ?? 0) === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            No hay notificaciones para mostrar.
          </div>
        )}
        {!isLoading &&
          list?.data?.map((n) => {
            const wrapperClass = `block w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              n.readAt ? '' : 'bg-teal-50 border-l-[3px] border-l-[#008080] pl-[13px]'
            }`;
            const content = (
              <div className="flex gap-3">
                <span
                  className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: n.readAt ? 'transparent' : TEAL }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                  <span className="text-[10px] font-semibold text-teal-700 uppercase mt-1 inline-block">
                    {sectionLabel(n.section)}
                  </span>
                </div>
              </div>
            );
            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                }}
                className={wrapperClass}
              >
                {content}
              </Link>
            ) : (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                }}
                className={wrapperClass}
              >
                {content}
              </button>
            );
          })}
      </div>

      {/* Paginacion */}
      {list?.meta && list.meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-gray-500">
            Pagina {list.meta.page} de {list.meta.totalPages}
          </span>
          <button
            disabled={page >= list.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal de filtros — secciones (Todas/Citas/Tienda/Pagos/...) */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="md">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Sección
              </label>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setDraftSection(undefined)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-between ${
                    draftSection === undefined
                      ? 'bg-teal-50 border-teal-200 text-[#008080]'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>Todas</span>
                  {draftSection === undefined && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                {allSections.map((s) => {
                  const c = counts?.counts[s] ?? 0;
                  const active = draftSection === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDraftSection(s)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-between ${
                        active
                          ? 'bg-teal-50 border-teal-200 text-[#008080]'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>
                        {sectionLabel(s)}
                        {c > 0 && <span className="ml-1.5 font-bold">({c})</span>}
                      </span>
                      {active && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={clearDraftFilters}
                disabled={draftSection === undefined}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  draftSection !== undefined
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Limpiar
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
