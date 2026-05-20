'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

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

function formatValue(reward: Redemption['reward'], currency = 'USD'): string {
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
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);

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
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-3 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-400 text-sm">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
