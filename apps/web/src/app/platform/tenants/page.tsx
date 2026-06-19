'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { platformApi } from '@/lib/platform-auth';
import { Modal } from '@/components/ui/modal';

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
  const router = useRouter();
  const initialStatus = searchParams.get('status') || '';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(initialStatus);
  const [filterTenantType, setFilterTenantType] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

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

      {/* Buscador + filtros */}
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Limpiar"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          aria-label="Filtros"
          className={`shrink-0 p-2.5 rounded-lg border transition-colors ${
            (filterTenantType || filterStatus || sortBy)
              ? 'bg-[#008080] border-[#008080] text-white'
              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Modal de filtros */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="sm">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo de cuenta</label>
              <select value={filterTenantType} onChange={(e) => setFilterTenantType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]">
                <option value="">Todos los tipos</option>
                <option value="BUSINESS">Negocios</option>
                <option value="FREELANCER">Independientes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]">
                <option value="">Todos los estados</option>
                <option value="TRIAL">En prueba</option>
                <option value="ACTIVE">Activo</option>
                <option value="PAST_DUE">Pago pendiente</option>
                <option value="SUSPENDED">Suspendido</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ordenar por</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]">
                <option value="">Más recientes</option>
                <option value="trial_expiry">Por vencimiento de prueba</option>
                <option value="name">Nombre A-Z</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setFilterTenantType(''); setFilterStatus(''); setSortBy(''); }}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Limpiar
              </button>
              <button onClick={() => setShowFilters(false)}
                className="flex-1 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#008080' }}>
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Tarjetas — el color de la tarjeta indica el tipo de cuenta
          (independiente = morado, negocio = azul) en lugar de una etiqueta. */}
      {loading ? (
        <div className="p-8 text-center text-gray-400">Cargando...</div>
      ) : tenants.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">No se encontraron cuentas</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tenants.map((t) => {
            const days = t.subscription?.trialEndsAt ? daysUntilExpiry(t.subscription.trialEndsAt) : null;
            const isFreelancer = t.tenantType === 'FREELANCER';
            const typeCard = isFreelancer
              ? 'bg-purple-50 border-purple-200 hover:border-purple-300'
              : 'bg-blue-50 border-blue-200 hover:border-blue-300';
            const accent = isFreelancer ? '#7c3aed' : '#2563eb';
            const owner = t.users?.[0];
            return (
              <div
                key={t.id}
                onClick={() => router.push(`/platform/tenants/${t.id}`)}
                className={`relative rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${typeCard}`}
              >
                {/* Menú de acciones */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (menuOpenId === t.id) closeMenu();
                    else openMenu(t.id, e.currentTarget);
                  }}
                  disabled={statusBusyId === t.id}
                  className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/70 text-gray-500 disabled:opacity-50"
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

                {/* Identidad: ícono por tipo + nombre + dueño */}
                <div className="flex items-center gap-3 pr-8">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: accent }}>
                    {isFreelancer ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m6-14h1m-1 4h1m4-4h1m-1 4h1m-5 6h4v4h-4v-4z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                    {owner && (
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {owner.firstName} {owner.lastName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Contacto con íconos */}
                <div className="flex items-center gap-2 mt-3">
                  <a href={`mailto:${t.email}`} onClick={(e) => e.stopPropagation()} title={t.email}
                    className="w-8 h-8 rounded-lg border border-gray-200 bg-white/60 text-gray-500 hover:text-[#008080] flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </a>
                  {t.phone && (
                    <>
                      <a href={`https://wa.me/${t.phone.replace(/\D/g, '').length === 10 ? '52' + t.phone.replace(/\D/g, '') : t.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title={`WhatsApp ${t.phone}`}
                        className="w-8 h-8 rounded-lg border border-gray-200 bg-white/60 text-gray-500 hover:text-green-600 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.748-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                        </svg>
                      </a>
                      <a href={`tel:${t.phone}`} onClick={(e) => e.stopPropagation()} title={`Llamar ${t.phone}`}
                        className="w-8 h-8 rounded-lg border border-gray-200 bg-white/60 text-gray-500 hover:text-[#008080] flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                    </>
                  )}
                </div>

                {/* Rubro + estado */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-200/70">
                  <span className="text-xs text-gray-600 truncate">
                    {t.businessType ? t.businessType.split(',').map((bt) => BUSINESS_LABELS[bt] || bt).join(', ') : 'Sin rubro'}
                  </span>
                  {t.subscription && (
                    <span className="shrink-0 text-right">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGES[t.subscription.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[t.subscription.status] || t.subscription.status}
                      </span>
                      {t.subscription.status === 'TRIAL' && days !== null && (
                        <span className={`block text-[10px] mt-0.5 ${days <= 5 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          {days > 0 ? `${days} días` : 'Vencido'}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
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
