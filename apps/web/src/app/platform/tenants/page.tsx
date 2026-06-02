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
  tenantType: 'BUSINESS' | 'FREELANCER';
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
  const [filterTenantType, setFilterTenantType] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [page, setPage] = useState(1);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [grantModal, setGrantModal] = useState<{ tenant: Tenant; months: number; saving: boolean; error?: string; success?: string } | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  function openMenu(tenantId: string, btn: HTMLButtonElement) {
    const rect = btn.getBoundingClientRect();
    const menuHeight = 180; // estimado: ver detalle + regalar meses + separador + habilitar/deshabilitar
    const menuWidth = 224; // w-56
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < menuHeight + 16;
    setMenuPos({
      top: placeAbove ? rect.top - menuHeight - 4 : rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
    setMenuOpenId(tenantId);
  }

  function closeMenu() {
    setMenuOpenId(null);
    setMenuPos(null);
  }

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '15');
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterTenantType) params.set('tenantType', filterTenantType);
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
  }, [page, search, filterStatus, filterTenantType, sortBy]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);
  useEffect(() => { setPage(1); }, [search, filterStatus, filterTenantType, sortBy]);

  // Click fuera cierra menú + recalcular si scroll/resize
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = () => closeMenu();
    window.addEventListener('click', handler);
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [menuOpenId]);

  function daysUntilExpiry(trialEndsAt: string | null) {
    if (!trialEndsAt) return null;
    const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
    return days;
  }

  async function handleQuickStatus(t: Tenant, status: 'ACTIVE' | 'SUSPENDED') {
    setStatusBusyId(t.id);
    closeMenu();
    try {
      await platformApi.patch(`/api/platform/tenants/${t.id}/status`, { status });
      await fetchTenants();
    } catch (err) {
      console.error(err);
    } finally {
      setStatusBusyId(null);
    }
  }

  function openGrantModal(t: Tenant) {
    closeMenu();
    setGrantModal({ tenant: t, months: 1, saving: false });
  }

  async function submitGrantMonths() {
    if (!grantModal) return;
    setGrantModal((prev) => prev ? { ...prev, saving: true, error: undefined } : null);
    try {
      const res = await platformApi.post<{ data: { message: string; trialEndsAt: string } }>(
        `/api/platform/tenants/${grantModal.tenant.id}/grant-months`,
        { months: grantModal.months },
      );
      setGrantModal((prev) => prev ? { ...prev, saving: false, success: res.data.message } : null);
      await fetchTenants();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'No se pudo regalar los meses';
      setGrantModal((prev) => prev ? { ...prev, saving: false, error: msg } : null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cuentas</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select value={filterTenantType} onChange={(e) => setFilterTenantType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los tipos</option>
          <option value="BUSINESS">Negocios</option>
          <option value="FREELANCER">Independientes</option>
        </select>
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cuenta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo de cuenta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rubro</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleados</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Citas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Registro</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : tenants.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">No se encontraron cuentas</td></tr>
              ) : (
                tenants.map((t) => {
                  const days = t.subscription?.trialEndsAt ? daysUntilExpiry(t.subscription.trialEndsAt) : null;
                  const isFreelancer = t.tenantType === 'FREELANCER';
                  const isSuspended = t.subscription?.status === 'SUSPENDED';
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
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          isFreelancer ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isFreelancer ? 'bg-purple-500' : 'bg-blue-500'}`} />
                          {isFreelancer ? 'Independiente' : 'Negocio'}
                        </span>
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
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (menuOpenId === t.id) closeMenu();
                            else openMenu(t.id, e.currentTarget);
                          }}
                          disabled={statusBusyId === t.id}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                          aria-label="Acciones"
                        >
                          {statusBusyId === t.id ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          )}
                        </button>
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
            <p className="text-sm text-gray-500">{meta.total} cuentas totales</p>
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

      {/* Floating action menu (position: fixed, escapes table overflow) */}
      {menuOpenId && menuPos && (() => {
        const t = tenants.find((x) => x.id === menuOpenId);
        if (!t) return null;
        const isSuspended = t.subscription?.status === 'SUSPENDED';
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
            className="z-50 w-56 bg-white rounded-lg border border-gray-200 shadow-lg py-1"
          >
            <Link
              href={`/platform/tenants/${t.id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver detalle
            </Link>
            <button
              onClick={() => openGrantModal(t)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <svg className="w-4 h-4 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              Regalar meses
            </button>
            <div className="border-t border-gray-100 my-1" />
            {!isSuspended ? (
              <button
                onClick={() => handleQuickStatus(t, 'SUSPENDED')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
                Deshabilitar cuenta
              </button>
            ) : (
              <button
                onClick={() => handleQuickStatus(t, 'ACTIVE')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 hover:bg-green-50 text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Habilitar cuenta
              </button>
            )}
          </div>
        );
      })()}

      {/* Grant Months Modal */}
      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Regalar meses</h3>
            <p className="text-sm text-gray-500 mb-4">{grantModal.tenant.name}</p>

            {grantModal.success ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">{grantModal.success}</p>
                </div>
                <button
                  onClick={() => setGrantModal(null)}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Meses a regalar</label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[1, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        onClick={() => setGrantModal((prev) => prev ? { ...prev, months: m } : null)}
                        className={`py-2 rounded-lg text-sm font-medium border ${
                          grantModal.months === m
                            ? 'bg-[#008080] text-white border-[#008080]'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {m} {m === 1 ? 'mes' : 'meses'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={grantModal.months}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setGrantModal((prev) => prev ? { ...prev, months: Number.isFinite(v) ? v : 1 } : null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Cantidad personalizada (1-60)"
                  />
                </div>

                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800">
                  La cuenta pasará a estado <strong>Prueba</strong> y la próxima fecha de cobro se moverá {grantModal.months} mes{grantModal.months !== 1 ? 'es' : ''} más adelante. No se generarán cobros durante ese período.
                </div>

                {grantModal.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {grantModal.error}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={submitGrantMonths}
                    disabled={grantModal.saving || grantModal.months < 1 || grantModal.months > 60}
                    className="flex-1 px-4 py-2 bg-[#008080] text-white rounded-lg text-sm font-medium hover:bg-[#006666] disabled:opacity-50"
                  >
                    {grantModal.saving ? 'Aplicando...' : 'Confirmar'}
                  </button>
                  <button
                    onClick={() => setGrantModal(null)}
                    disabled={grantModal.saving}
                    className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
