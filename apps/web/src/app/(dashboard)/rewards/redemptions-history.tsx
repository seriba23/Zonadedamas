'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';

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

interface Summary {
  totalAll: number;
  totalActive: number;
  totalUsed: number;
  totalExpired: number;
  totalGifts: number;
  totalRedeemed: number;
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
      api.get<{ data: Redemption[]; meta: { totalPages: number; total: number; summary: Summary } }>(
        `/api/rewards/redemptions/all?${queryString}`,
      ),
  });

  const items: Redemption[] = data?.data || [];
  const meta = data?.meta;
  const summary = meta?.summary;

  const updateFilter = (k: keyof Filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div>
      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <SummaryCard label="Total emitidos" value={summary.totalAll} color="gray" />
          <SummaryCard label="Activos" value={summary.totalActive} color="green" />
          <SummaryCard label="Usados" value={summary.totalUsed} color="teal" />
          <SummaryCard label="Vencidos" value={summary.totalExpired} color="red" />
          <SummaryCard label="Regalados / Canjeados" value={`${summary.totalGifts} / ${summary.totalRedeemed}`} color="purple" />
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Filtros</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-[#008080] hover:text-[#006666] font-medium"
            >
              Limpiar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Búsqueda</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Cliente, código, cupón…"
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
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
              value={filters.source}
              onChange={(e) => updateFilter('source', e.target.value)}
              className="input-field text-sm"
            >
              <option value="">Todos</option>
              <option value="GIFT">Regalado</option>
              <option value="REDEEM">Canjeado con puntos</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Vence desde</label>
              <input
                type="date"
                value={filters.expiresFrom}
                onChange={(e) => updateFilter('expiresFrom', e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Vence hasta</label>
              <input
                type="date"
                value={filters.expiresTo}
                onChange={(e) => updateFilter('expiresTo', e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Creado desde</label>
              <input
                type="date"
                value={filters.createdFrom}
                onChange={(e) => updateFilter('createdFrom', e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Creado hasta</label>
              <input
                type="date"
                value={filters.createdTo}
                onChange={(e) => updateFilter('createdTo', e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th>Cliente</Th>
                <Th>Cupón</Th>
                <Th>Origen</Th>
                <Th>Código</Th>
                <Th>Estado</Th>
                <Th>Creado</Th>
                <Th>Vence</Th>
                <Th>Usado</Th>
                {canRemove && <Th>Acciones</Th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: canRemove ? 9 : 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-3 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={canRemove ? 9 : 8} className="px-3 py-12 text-center text-gray-400 text-sm">
                    {hasActiveFilters ? 'No hay cupones que coincidan con los filtros.' : 'Aún no se han emitido cupones.'}
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                          {r.client.avatarUrl ? (
                            <img src={r.client.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (r.client.firstName?.[0] || '?').toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {r.client.firstName} {r.client.lastName}
                          </p>
                          {r.client.email && (
                            <p className="text-[11px] text-gray-400 truncate">{r.client.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{r.reward.name}</p>
                      <p className="text-[11px] text-gray-500">{formatValue(r.reward)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <SourceBadge pointsSpent={r.pointsSpent} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-gray-700">{r.code}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={r.status} expiresAt={r.expiresAt} />
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {new Date(r.expiresAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {r.usedAt
                        ? new Date(r.usedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    {canRemove && (
                      <td className="px-3 py-3">
                        {r.status === 'USED' ? (
                          <span className="text-[10px] text-gray-400 italic">Ya usado</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setRemoveError(null);
                              setConfirmRemove(r);
                            }}
                            className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline whitespace-nowrap"
                          >
                            Retirar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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

        {/* Paginación */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              Página {page} de {meta.totalPages} · {meta.total} cupones
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: 'gray' | 'green' | 'teal' | 'red' | 'purple';
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    gray: { bg: 'bg-gray-50', text: 'text-gray-700' },
    green: { bg: 'bg-green-50', text: 'text-green-700' },
    teal: { bg: 'bg-teal-50', text: 'text-[#006666]' },
    red: { bg: 'bg-red-50', text: 'text-red-700' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700' },
  };
  const c = colors[color];
  return (
    <div className={`${c.bg} rounded-xl p-3 border border-transparent`}>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
    </div>
  );
}
