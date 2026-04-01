'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { platformApi } from '@/lib/platform-auth';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  businessType: string | null;
  createdAt: string;
  subscription: {
    plan: string;
    status: string;
    monthlyAmountUsd: string;
    nextBillingDate: string;
    trialEndsAt: string | null;
  } | null;
  users?: { firstName: string; lastName: string }[];
  _count: { users: number; employees: number; appointments: number };
}

interface Meta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  TRIAL: 'Prueba', ACTIVE: 'Activo', PAST_DUE: 'Pago pendiente',
  SUSPENDED: 'Suspendido', CANCELLED: 'Cancelado',
};
const STATUS_BADGES: Record<string, string> = {
  TRIAL: 'bg-teal-100 text-teal-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
};
const BUSINESS_LABELS: Record<string, string> = {
  SALON: 'Salón', BARBERIA: 'Barbería', SPA: 'Spa', CLINICA: 'Clínica', TATUAJES: 'Tatuajes',
};

export default function TenantsPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(initialStatus);
  const [sortBy, setSortBy] = useState('');
  const [page, setPage] = useState(1);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '15');
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (sortBy) params.set('sortBy', sortBy);

      const res = await platformApi.get<{ data: Tenant[]; meta: Meta }>(
        `/api/platform/tenants?${params.toString()}`,
      );
      setTenants(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, sortBy]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);
  useEffect(() => { setPage(1); }, [search, filterStatus, sortBy]);

  function daysUntilExpiry(trialEndsAt: string | null) {
    if (!trialEndsAt) return null;
    const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
    return days;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Negocios</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los estados</option>
          <option value="TRIAL">En prueba</option>
          <option value="ACTIVE">Activo</option>
          <option value="PAST_DUE">Pago pendiente</option>
          <option value="SUSPENDED">Suspendido</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Más recientes</option>
          <option value="trial_expiry">Por vencimiento de prueba</option>
          <option value="name">Nombre A-Z</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Negocio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleados</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Citas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Registro</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : tenants.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No se encontraron negocios</td></tr>
              ) : (
                tenants.map((t) => {
                  const days = t.subscription?.trialEndsAt ? daysUntilExpiry(t.subscription.trialEndsAt) : null;
                  return (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono text-gray-400">{t.id.slice(0, 8)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/platform/tenants/${t.id}`} className="hover:text-primary-600">
                          <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {t.users?.[0] && <p className="text-xs font-medium text-gray-700">{t.users[0].firstName} {t.users[0].lastName}</p>}
                        <p className="text-xs text-gray-500">{t.email}</p>
                        {t.phone && <p className="text-xs text-gray-400">{t.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {t.businessType ? t.businessType.split(',').map(bt => BUSINESS_LABELS[bt] || bt).join(', ') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {t.subscription ? (
                          <div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGES[t.subscription.status] || 'bg-gray-100'}`}>
                              {STATUS_LABELS[t.subscription.status] || t.subscription.status}
                            </span>
                            {t.subscription.status === 'TRIAL' && days !== null && (
                              <p className={`text-[10px] mt-0.5 ${days <= 5 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                {days > 0 ? `${days} días restantes` : 'Vencido'}
                              </p>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{t._count.employees}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{t._count.appointments}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(t.createdAt).toLocaleDateString('es')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">{meta.total} negocios totales</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Anterior</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page} / {meta.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
