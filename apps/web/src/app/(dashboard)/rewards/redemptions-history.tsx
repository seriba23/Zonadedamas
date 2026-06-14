'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';
import { Modal } from '@/components/ui/modal';
import { KpiCard } from '@/components/dashboard/kpi-card';

interface RedemptionSummary {
  totalAll: number;
  totalActive: number;
  totalUsed: number;
  totalExpired: number;
  totalGifts: number;
  totalRedeemed: number;
  totalPointsSpent: number;
}

function CouponStatsBar({ summary }: { summary: RedemptionSummary }) {
  const ticketIcon = (
    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  );
  const checkIcon = (
    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  const usedIcon = (
    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
  const expiredIcon = (
    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
  const giftIcon = (
    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
  const coinIcon = (
    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
      <KpiCard icon={ticketIcon} label="Total emitidos" value={summary.totalAll} />
      <KpiCard icon={checkIcon} label="Activos" value={summary.totalActive} />
      <KpiCard icon={usedIcon} label="Usados" value={summary.totalUsed} />
      <KpiCard icon={expiredIcon} label="Vencidos" value={summary.totalExpired} />
      <KpiCard icon={giftIcon} label="Regalados / Canjeados" value={`${summary.totalGifts} / ${summary.totalRedeemed}`} />
      <KpiCard icon={coinIcon} label="Puntos cobrados" value={summary.totalPointsSpent.toLocaleString()} />
    </div>
  );
}

interface Redemption {
  id: string;
  code: string;
  pointsSpent: number;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  reward: {
    id: string;
    name: string;
    type: 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE';
    discountAmount: number | null;
    discountMode: 'FLAT' | 'PERCENTAGE' | null;
    pointsRequired: number | null;
    service: { id: string; name: string } | null;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    avatarUrl: string | null;
  };
  appointment: { id: string; startTime: string } | null;
}

interface Filters {
  status: string;
  source: string;
  expiresFrom: string;
  expiresTo: string;
  createdFrom: string;
  createdTo: string;
  search: string;
}

const defaultFilters: Filters = {
  status: '',
  source: '',
  expiresFrom: '',
  expiresTo: '',
  createdFrom: '',
  createdTo: '',
  search: '',
};

function formatValue(reward: Redemption['reward'], currency = 'MXN'): string {
  if (reward.type === 'SERVICIO') {
    return reward.service?.name ? `${reward.service.name} gratis` : 'Servicio gratis';
  }
  if (reward.type === 'TWO_FOR_ONE') return '2×1';
  const amt = Number(reward.discountAmount || 0);
  return reward.discountMode === 'PERCENTAGE'
    ? `${amt}% de descuento`
    : `${formatCurrency(amt, currency)} de descuento`;
}

function StatusBadge({ status, expiresAt }: { status: string; expiresAt: string }) {
  const isExpiredByDate = status === 'ACTIVE' && new Date(expiresAt) < new Date();
  const effective = isExpiredByDate ? 'EXPIRED' : status;
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-50 text-green-700 border-green-200',
    USED: 'bg-gray-100 text-gray-600 border-gray-200',
    EXPIRED: 'bg-red-50 text-red-700 border-red-200',
  };
  const label: Record<string, string> = {
    ACTIVE: 'Activo',
    USED: 'Usado',
    EXPIRED: 'Vencido',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[effective] || styles.EXPIRED}`}>
      {label[effective] || effective}
    </span>
  );
}

function SourceBadge({ pointsSpent }: { pointsSpent: number }) {
  if (pointsSpent === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
        🎁 Regalo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-[#006666] border border-teal-200">
      {pointsSpent.toLocaleString()} pts
    </span>
  );
}

export function RedemptionsHistory() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<Filters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [confirmRemove, setConfirmRemove] = useState<Redemption | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const canRemove = hasPermission('rewards.delete');

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/rewards/redemptions/${id}`),
    onSuccess: () => {
      setConfirmRemove(null);
      setRemoveError(null);
      queryClient.invalidateQueries({ queryKey: ['rewards-redemptions'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'No se pudo eliminar el cupón';
      setRemoveError(typeof msg === 'string' ? msg : 'No se pudo eliminar el cupón');
    },
  });

  const queryString = (() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('perPage', '20');
    if (filters.status) params.set('status', filters.status);
    if (filters.source) params.set('source', filters.source);
    if (filters.expiresFrom) params.set('expiresFrom', filters.expiresFrom);
    if (filters.expiresTo) params.set('expiresTo', filters.expiresTo);
    if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
    if (filters.createdTo) params.set('createdTo', filters.createdTo);
    if (filters.search) params.set('search', filters.search);
    return params.toString();
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['rewards-redemptions', queryString],
    queryFn: () =>
      api.get<{ data: Redemption[]; meta: { totalPages: number; total: number; summary: RedemptionSummary } }>(
        `/api/rewards/redemptions/all?${queryString}`,
      ),
  });

  const items: Redemption[] = data?.data || [];
  const meta = data?.meta;
  const summary = meta?.summary;
  const [showStats, setShowStats] = useState(false);

  const updateDraft = (k: keyof Filters, v: string) => {
    setDraftFilters((f) => ({ ...f, [k]: v }));
  };

  const openFilters = () => {
    setDraftFilters(filters);
    setShowFilters(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setPage(1);
    setShowFilters(false);
  };

  const clearDraftFilters = () => {
    setDraftFilters(defaultFilters);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');
  const hasDraftFilters = Object.values(draftFilters).some((v) => v !== '');

  // Boton de filtros en el topbar (a la izq del bell, igual que /reservations).
  // Solo vive mientras el componente esta montado (tab "Historial").
  useRegisterTopbarAction(
    <button
      onClick={openFilters}
      aria-label="Filtros"
      title="Filtros"
      className={`flex-shrink-0 p-2 rounded-lg border transition-colors ${
        hasActiveFilters
          ? 'bg-[#008080] border-[#008080] text-white'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    </button>,
    [hasActiveFilters, filters],
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-sm text-gray-500 flex-1">
          Historial de todos los cupones que se han emitido, usado, vencido o regalado, con el cliente que los uso.
        </p>
        <button
          type="button"
          onClick={() => setShowStats((v) => !v)}
          aria-label="Estadisticas de cupones"
          title={showStats ? 'Ocultar estadisticas' : 'Ver estadisticas'}
          className={`flex-shrink-0 p-2 rounded-lg border transition-colors ${
            showStats
              ? 'bg-[#008080] border-[#008080] text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </button>
      </div>

      {showStats && summary && <CouponStatsBar summary={summary} />}

      {hasActiveFilters && (
        <div className="mb-3 text-xs text-gray-500">
          Mostrando cupones filtrados.{' '}
          <button
            type="button"
            onClick={() => { setFilters(defaultFilters); setPage(1); }}
            className="font-semibold text-[#008080] hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Lista de cupones — tarjetas (responsive) */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
            {hasActiveFilters
              ? 'No hay cupones que coincidan con los filtros.'
              : 'Aún no se han emitido cupones.'}
          </div>
        ) : (
          items.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              {/* Cliente */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-50 text-[#008080] overflow-hidden flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {r.client.avatarUrl ? (
                    <img src={r.client.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (r.client.firstName?.[0] || '?').toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {r.client.firstName} {r.client.lastName}
                  </p>
                  {r.client.email && (
                    <p className="text-[11px] text-gray-400 truncate">{r.client.email}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <StatusBadge status={r.status} expiresAt={r.expiresAt} />
                </div>
              </div>

              {/* Cupon + codigo */}
              <div className="flex items-start justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.reward.name}</p>
                  <p className="text-[11px] text-gray-500">{formatValue(r.reward)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Codigo</p>
                  <p className="font-mono text-xs font-semibold text-gray-700">{r.code}</p>
                </div>
              </div>

              {/* Origen + fechas */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <SourceBadge pointsSpent={r.pointsSpent} />
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span title="Fecha de creacion">
                    Creado{' '}
                    <span className="font-medium text-gray-700">
                      {new Date(r.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  <span title="Fecha de vencimiento">
                    Vence{' '}
                    <span className="font-medium text-gray-700">
                      {new Date(r.expiresAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  {r.usedAt && (
                    <span title="Fecha de uso">
                      Usado{' '}
                      <span className="font-medium text-gray-700">
                        {new Date(r.usedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Accion (solo si puede retirar y aun no esta usado) */}
              {canRemove && r.status !== 'USED' && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setRemoveError(null); setConfirmRemove(r); }}
                    className="w-full sm:w-auto px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    Retirar cupon
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {/* Modal de confirmación: retirar/eliminar cupón */}
        {confirmRemove && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={() => !removeMutation.isPending && setConfirmRemove(null)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3 bg-red-50">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-1">
                ¿Retirar este cupón?
              </h3>
              <p className="text-sm text-gray-600 text-center mb-4">
                <span className="font-semibold">{confirmRemove.reward.name}</span>
                <br />
                Cliente: {confirmRemove.client.firstName} {confirmRemove.client.lastName}
                <br />
                Código: <span className="font-mono">{confirmRemove.code}</span>
              </p>

              {confirmRemove.pointsSpent > 0 ? (
                <div className="rounded-xl p-3 mb-4 bg-teal-50 border border-teal-200">
                  <p className="text-xs text-[#006666] text-center">
                    <span className="font-semibold">Reembolso automático:</span> se devolverán{' '}
                    <span className="font-bold">{confirmRemove.pointsSpent.toLocaleString()} pts</span>{' '}
                    al saldo del cliente.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl p-3 mb-4 bg-purple-50 border border-purple-200">
                  <p className="text-xs text-purple-700 text-center">
                    Este cupón fue un regalo del negocio. Al retirarlo, simplemente desaparece de los cupones del cliente.
                  </p>
                </div>
              )}

              <div className="rounded-xl p-3 mb-4 bg-amber-50 border border-amber-200">
                <p className="text-[11px] text-amber-800 text-center">
                  Esta acción no se puede deshacer. Sí queda registro en el audit log.
                </p>
              </div>

              {removeError && (
                <div className="rounded-xl p-3 mb-3 bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700 text-center">{removeError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={removeMutation.isPending}
                  onClick={() => setConfirmRemove(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(confirmRemove.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                >
                  {removeMutation.isPending ? 'Retirando…' : 'Retirar cupón'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Paginación */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-500">
            Página {page} de {meta.totalPages} · {meta.total} cupones
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Filtros (mismo patron que /reservations) */}
      {showFilters && (
        <Modal title="Filtros de cupones" onClose={() => setShowFilters(false)} size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Búsqueda</label>
              <input
                type="text"
                value={draftFilters.search}
                onChange={(e) => updateDraft('search', e.target.value)}
                placeholder="Cliente, código, cupón…"
                className="input-field text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Estado</label>
                <select
                  value={draftFilters.status}
                  onChange={(e) => updateDraft('status', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">Todos</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="USED">Usado</option>
                  <option value="EXPIRED">Vencido</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Origen</label>
                <select
                  value={draftFilters.source}
                  onChange={(e) => updateDraft('source', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">Todos</option>
                  <option value="GIFT">Regalado</option>
                  <option value="REDEEM">Canjeado con puntos</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Vence desde</label>
                <input
                  type="date"
                  value={draftFilters.expiresFrom}
                  onChange={(e) => updateDraft('expiresFrom', e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Vence hasta</label>
                <input
                  type="date"
                  value={draftFilters.expiresTo}
                  onChange={(e) => updateDraft('expiresTo', e.target.value)}
                  className="input-field text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Creado desde</label>
                <input
                  type="date"
                  value={draftFilters.createdFrom}
                  onChange={(e) => updateDraft('createdFrom', e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Creado hasta</label>
                <input
                  type="date"
                  value={draftFilters.createdTo}
                  onChange={(e) => updateDraft('createdTo', e.target.value)}
                  className="input-field text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={clearDraftFilters}
                disabled={!hasDraftFilters}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  hasDraftFilters
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Limpiar
              </button>
              <button
                type="button"
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

