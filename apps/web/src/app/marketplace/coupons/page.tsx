// ============================================================
// PÁGINA: Cupones y puntos del cliente marketplace
// RUTA:   /marketplace/coupons
//
// ¿Qué muestra?
//   - Dos pestañas: "Mis cupones" y "Mis puntos".
//   - Mis cupones: lista de RewardRedemptions del cliente (cupones ya canjeados).
//     Incluye buscador y filtros (activos, descuento, gratis, por vencer, historial).
//   - Mis puntos: puntos acumulados por negocio, con ordenamiento y opción de ocultar.
//   - Tarjetas de referidos: códigos 2x1 propios + códigos recibidos de otros.
//   - Los tenants ocultos y el orden de puntos se persisten en localStorage.
// ============================================================
'use client';

// useState: variables reactivas. useEffect: efectos al montar/actualizar.
// useMemo: calcula valores derivados solo cuando cambian sus dependencias (optimización).
import { useState, useEffect, useMemo } from 'react';

// useQuery: carga los cupones del usuario del backend.
import { useQuery } from '@tanstack/react-query';

// Cliente HTTP con JWT del marketplace.
import { marketplaceApi } from '@/lib/marketplace-api';

// Estado de autenticación del cliente.
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

// Link: navegación SPA entre páginas.
import Link from 'next/link';

// useRouter: para navegación programática.
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

// Claves de localStorage para persistir las preferencias del usuario entre sesiones.
// `marketplace_points_hidden_tenants`: IDs de negocios ocultos en "Mis puntos".
// `marketplace_points_sort`: criterio de ordenamiento seleccionado.
const POINTS_HIDDEN_KEY = 'marketplace_points_hidden_tenants';
const POINTS_SORT_KEY = 'marketplace_points_sort';

// Tipos unión que limitan los valores posibles de filtro y ordenamiento.
// TypeScript usa estos tipos para detectar errores si se asigna un string inválido.
type CouponFilter = 'all' | 'active' | 'discount' | 'gratis' | 'expiring' | 'history';
type PointsSort = 'points_desc' | 'points_asc' | 'name_asc' | 'name_desc';

// formatExpiry: formatea una fecha de vencimiento como "15 jun. 2026".
// `toLocaleDateString('es-MX', ...)`: usa el locale español de México.
function formatExpiry(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

// daysLeft: calcula cuántos días faltan para que venza un cupón.
// `Date.now()`: timestamp actual en milisegundos.
// `Math.ceil(...)`: redondea hacia arriba (1.2 días → 2, nunca 0).
function daysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// normalize: normaliza texto para búsqueda insensible a acentos.
// `.normalize('NFD')`: descompone los caracteres acentuados en base + acento.
// `.replace(/[̀-ͯ]/g, '')`: elimina los acentos separados.
// Ej: "café" → "cafe", "HÉROE" → "heroe". Permite que "cafe" encuentre "café".
function normalize(s: string | null | undefined): string {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Componente principal ───────────────────────────────────
export default function MarketplaceCouponsPage() {
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();

  // Pestaña activa: 'cupones' o 'puntos'.
  const [tab, setTab] = useState<'cupones' | 'puntos'>('cupones');

  // Búsqueda y filtros — el buscador se comparte entre pestañas para que el
  // usuario no pierda su texto al cambiar entre "Cupones" y "Mis puntos".
  const [search, setSearch] = useState('');
  const [couponFilter, setCouponFilter] = useState<CouponFilter>('all');
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Estado de la sección "Mis puntos":
  // `hiddenTenants`: Set de IDs de negocios que el usuario ocultó.
  //   `new Set()`: estructura de datos que garantiza elementos únicos.
  // `showCustomize`: controla el modal "Personalizar" (gestión de ocultos).
  // `pointsSort`: criterio de ordenamiento activo.
  const [hiddenTenants, setHiddenTenants] = useState<Set<string>>(new Set());
  const [showCustomize, setShowCustomize] = useState(false);
  const [pointsSort, setPointsSort] = useState<PointsSort>('points_desc');
  const [showPointsFilters, setShowPointsFilters] = useState(false);

  // Al montar el componente ([] = sin dependencias = solo una vez), cargamos
  // las preferencias guardadas en localStorage.
  // `try/catch`: si localStorage está bloqueado o el JSON está corrupto,
  // no queremos que la app falle — simplemente usamos los valores por defecto.
  useEffect(() => {
    if (typeof window === 'undefined') return; // Guard de SSR (Next.js puede renderizar en servidor)
    try {
      const raw = localStorage.getItem(POINTS_HIDDEN_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        // `Array.isArray(arr)`: validamos que el dato tenga el formato esperado.
        if (Array.isArray(arr)) setHiddenTenants(new Set(arr));
      }
    } catch {}
    try {
      // `as PointsSort | null`: type assertion que le dice a TypeScript que
      // el valor del localStorage puede ser ese tipo o null.
      const sort = localStorage.getItem(POINTS_SORT_KEY) as PointsSort | null;
      if (sort && ['points_desc', 'points_asc', 'name_asc', 'name_desc'].includes(sort)) {
        setPointsSort(sort);
      }
    } catch {}
  }, []);

  // persistHidden: actualiza el estado Y guarda en localStorage en un solo paso.
  // `Array.from(next)`: convierte el Set a array para poder serializarlo con JSON.stringify.
  // (JSON.stringify no sabe cómo serializar un Set directamente.)
  const persistHidden = (next: Set<string>) => {
    setHiddenTenants(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(POINTS_HIDDEN_KEY, JSON.stringify(Array.from(next)));
    }
  };

  // persistSort: mismo patrón — actualiza estado y guarda en localStorage.
  const persistSort = (next: PointsSort) => {
    setPointsSort(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(POINTS_SORT_KEY, next);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-rewards'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-rewards'),
    enabled: isAuthenticated,
  });

  const { data: referralsData } = useQuery({
    queryKey: ['marketplace-my-referrals'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-referrals'),
    enabled: isAuthenticated,
  });
  const referrals: any[] = (referralsData as any)?.data || [];
  const activeReferrals = referrals.filter((r) => r.status === 'ACTIVE');
  const usedReferrals = referrals.filter((r) => r.status !== 'ACTIVE');

  // Códigos de referido RECIBIDOS — guardados en localStorage por el negocio
  // cuando el cliente llega a /marketplace/[slug]?ref=CODIGO.
  // Los claves tienen formato `ref_[tenantSlug]`, valor = el código.
  // Hacemos un fetch por cada código para obtener el nombre del remitente y
  // el estado del referido (si ya fue usado, no lo mostramos).
  const [receivedReferrals, setReceivedReferrals] = useState<any[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const codes: string[] = [];
    // Iteramos todo el localStorage buscando claves con prefijo "ref_".
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ref_')) {
        const val = localStorage.getItem(key);
        if (val) codes.push(val);
      }
    }
    if (codes.length > 0) {
      // `Promise.all`: ejecuta múltiples promesas en paralelo y espera a que
      // todas terminen. Devuelve un array con el resultado de cada una.
      Promise.all(
        codes.map((code) =>
          fetch(`${API_URL}/api/marketplace/referral/${code}`)
            .then((r) => r.json())
            .then((res) => res?.data)
            .catch(() => null) // Si un referido falla, devolvemos null (lo filtramos abajo)
        )
      ).then((results) => {
        // `.filter(...)`: elimina los null y los referidos ya usados.
        setReceivedReferrals(results.filter((r) => r && r.status === 'ACTIVE'));
      });
    }
  }, []);

  // Carga los puntos del cliente agrupados por negocio. Solo cuando está en la pestaña 'puntos'.
  const { data: statsData } = useQuery({
    queryKey: ['marketplace-my-stats'],
    queryFn: () => marketplaceApi.get<{ data: any }>('/my-stats'),
    enabled: isAuthenticated && tab === 'puntos',
  });

  // `?.data?.pointsByTenant`: acceso seguro a la propiedad anidada.
  const pointsByTenant: any[] = (statsData as any)?.data?.pointsByTenant || [];

  // Separamos los cupones en activos (se pueden usar) e historial (ya usados/expirados).
  const redemptions: any[] = (data as any)?.data || [];
  const active = redemptions.filter((r) => r.status === 'ACTIVE');
  const used = redemptions.filter((r) => r.status !== 'ACTIVE');

  // ── Filtrado de cupones ─────────────────────────────────
  const q = normalize(search);
  const matchesSearch = (r: any) =>
    !q ||
    normalize(r.reward?.name).includes(q) ||
    normalize(r.tenant?.name).includes(q) ||
    normalize(r.reward?.service?.name).includes(q);

  const matchesReferralSearch = (ref: any) =>
    !q ||
    normalize(ref.promotion?.name || ref.promotionName).includes(q) ||
    normalize(ref.tenant?.name || ref.tenantName).includes(q) ||
    normalize(ref.code).includes(q);

  const filteredActive = active.filter(matchesSearch).filter((r) => {
    if (couponFilter === 'history') return false;
    if (couponFilter === 'all' || couponFilter === 'active') return true;
    if (couponFilter === 'discount') return r.reward?.type === 'DESCUENTO';
    if (couponFilter === 'gratis') return r.reward?.type === 'SERVICIO';
    if (couponFilter === 'expiring') {
      const d = daysLeft(r.expiresAt);
      return d !== null && d <= 7;
    }
    return true;
  });
  const filteredUsed = used.filter(matchesSearch);
  const filteredActiveRef = activeReferrals.filter(matchesReferralSearch);
  const filteredUsedRef = usedReferrals.filter(matchesReferralSearch);
  const filteredReceived = receivedReferrals.filter(matchesReferralSearch);

  // En "Historial" solo mostramos lo usado/expirado; en "Activos" solo
  // los disponibles; en "Todos" ambos.
  const showActiveSection = couponFilter !== 'history';
  const showHistorySection = couponFilter === 'all' || couponFilter === 'history';

  // ── Filtrado de puntos con useMemo ─────────────────────────
  // `useMemo`: memoriza el resultado del cálculo para que no se recalcule
  // en cada re-renderizado. Solo se recalcula cuando cambia una de las
  // dependencias en el array `[pointsByTenant, q, hiddenTenants, pointsSort]`.
  // Útil aquí porque la lista de negocios puede ser larga y el filtrado/ordenamiento
  // involucra varias operaciones de array.
  const visiblePoints = useMemo(() => {
    let list = pointsByTenant;
    if (q) list = list.filter((t) => normalize(t.tenantName).includes(q));
    list = list.filter((t) => !hiddenTenants.has(t.tenantId));
    // Orden: aplica al final para que respete busqueda + visibilidad
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (pointsSort === 'points_desc') return (b.points || 0) - (a.points || 0);
      if (pointsSort === 'points_asc') return (a.points || 0) - (b.points || 0);
      if (pointsSort === 'name_asc') return (a.tenantName || '').localeCompare(b.tenantName || '');
      if (pointsSort === 'name_desc') return (b.tenantName || '').localeCompare(a.tenantName || '');
      return 0;
    });
    return sorted;
  }, [pointsByTenant, q, hiddenTenants, pointsSort]);
  const hiddenCount = pointsByTenant.filter((t) => hiddenTenants.has(t.tenantId)).length;

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
          </svg>
          <p className="text-gray-500 text-sm">Inicia sesión para ver tus cupones</p>
          <Link href="/marketplace/login" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: '#008080' }}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header — search + filtros en un renglon, segmented control abajo.
          Sin titulo: igual patron que /marketplace/appointments. */}
      <div className="bg-gray-50 px-4 pt-3 pb-3 safe-top sticky top-0 z-30">
        <div className="max-w-2xl mx-auto">
          {/* Search + filtros (cupones) o personalizar (puntos) en un renglon */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="relative flex-1 min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === 'cupones' ? 'Buscar cupon, negocio, codigo...' : 'Buscar negocio...'}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                onFocus={(e) => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {tab === 'cupones' && (
              <button
                onClick={() => setShowFiltersSheet(true)}
                title="Filtros"
                aria-label="Filtros"
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
                style={couponFilter !== 'all'
                  ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
                  : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                }
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                {couponFilter !== 'all' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
                )}
              </button>
            )}

            {tab === 'puntos' && (
              <>
                {/* Filtros: ordenamiento */}
                <button
                  onClick={() => setShowPointsFilters(true)}
                  title="Filtros y orden"
                  aria-label="Filtros y orden"
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
                  style={pointsSort !== 'points_desc'
                    ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
                    : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                  }
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                  {pointsSort !== 'points_desc' && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
                  )}
                </button>

                {/* Personalizar visibilidad — solo aparece si hay tenants para
                    mostrar/ocultar (no tiene sentido sin puntos). */}
                {pointsByTenant.length > 0 && (
                  <button
                    onClick={() => setShowCustomize(true)}
                    title="Personalizar visibilidad"
                    aria-label="Personalizar visibilidad"
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
                    style={hiddenCount > 0
                      ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                    }
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    {hiddenCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Tabs Cupones | Mis puntos */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setTab('cupones')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'cupones' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cupones
            </button>
            <button
              onClick={() => setTab('puntos')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                tab === 'puntos' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Mis puntos
            </button>
          </div>
        </div>
      </div>

      {/* Bottom-sheet de filtros de cupones — mismo patron que appointments */}
      {showFiltersSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFiltersSheet(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
              <button onClick={() => setShowFiltersSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4">
              {couponFilter !== 'all' && (
                <button
                  onClick={() => setCouponFilter('all')}
                  className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                  style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Limpiar filtros
                </button>
              )}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'all', label: 'Todos' },
                  { value: 'active', label: 'Adquiridos' },
                  { value: 'discount', label: 'Descuentos' },
                  { value: 'gratis', label: 'Servicio gratis' },
                  { value: 'expiring', label: 'Por vencer (7 días)' },
                  { value: 'history', label: 'Historial' },
                ] as { value: CouponFilter; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setCouponFilter(opt.value); setShowFiltersSheet(false); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={couponFilter === opt.value
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-4" />
          </div>
        </div>
      )}

      {/* Bottom-sheet de filtros para Mis puntos — ordenamiento */}
      {showPointsFilters && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPointsFilters(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
              <button onClick={() => setShowPointsFilters(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4">
              {pointsSort !== 'points_desc' && (
                <button
                  onClick={() => persistSort('points_desc')}
                  className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                  style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Restablecer orden
                </button>
              )}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ordenar por</p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'points_desc', label: 'Mas puntos primero' },
                  { value: 'points_asc',  label: 'Menos puntos primero' },
                  { value: 'name_asc',    label: 'Nombre A-Z' },
                  { value: 'name_desc',   label: 'Nombre Z-A' },
                ] as { value: PointsSort; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { persistSort(opt.value); setShowPointsFilters(false); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={pointsSort === opt.value
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-4" />
          </div>
        </div>
      )}

      {/* Modal Personalizar: toggles para mostrar/ocultar negocios en Mis puntos */}
      {showCustomize && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowCustomize(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Personalizar Mis puntos</h3>
                <p className="text-xs text-gray-400 mt-0.5">Elige que negocios mostrar en tu lista</p>
              </div>
              <button onClick={() => setShowCustomize(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100" aria-label="Cerrar">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Toggle all */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {pointsByTenant.length - hiddenCount} de {pointsByTenant.length} visibles
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => persistHidden(new Set())}
                  disabled={hiddenCount === 0}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Mostrar todos
                </button>
                <button
                  onClick={() => persistHidden(new Set(pointsByTenant.map((t: any) => t.tenantId)))}
                  disabled={hiddenCount === pointsByTenant.length}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ocultar todos
                </button>
              </div>
            </div>

            {/* Tenant list with toggles */}
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
              {pointsByTenant.map((t: any) => {
                const isHidden = hiddenTenants.has(t.tenantId);
                return (
                  <button
                    key={t.tenantId}
                    onClick={() => {
                      const next = new Set(hiddenTenants);
                      if (isHidden) next.delete(t.tenantId);
                      else next.add(t.tenantId);
                      persistHidden(next);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
                      {t.tenantLogo ? (
                        <img src={`${API_URL}${t.tenantLogo}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        t.tenantName[0]
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.tenantName}</p>
                      <p className="text-xs text-gray-400">{t.points.toLocaleString()} pts</p>
                    </div>
                    {/* Toggle switch */}
                    <span
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                        isHidden ? 'bg-gray-300' : 'bg-[#008080]'
                      }`}
                      aria-pressed={!isHidden}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                          isHidden ? 'translate-x-0.5' : 'translate-x-[22px]'
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 safe-bottom">
              <button
                onClick={() => setShowCustomize(false)}
                className="w-full py-2.5 text-white rounded-xl text-sm font-medium"
                style={{ backgroundColor: TEAL }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Puntos tab */}
        {tab === 'puntos' && (
          <div>
            {pointsByTenant.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                <p className="text-gray-500">Aún no tienes puntos</p>
                <p className="text-xs text-gray-400 max-w-xs">Acumula puntos al completar citas en los negocios que visitas</p>
                <Link href="/marketplace" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: '#008080' }}>
                  Explorar negocios
                </Link>
              </div>
            ) : visiblePoints.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center gap-3">
                <p className="text-sm text-gray-500">
                  {search
                    ? `No encontramos negocios con "${search}"`
                    : 'Todos los negocios estan ocultos'}
                </p>
                {!search && hiddenCount > 0 && (
                  <button
                    onClick={() => persistHidden(new Set())}
                    className="text-xs font-medium px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Mostrar todos
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visiblePoints.map((t: any) => (
                  <Link
                    key={t.tenantId}
                    href={`/marketplace/${t.tenantSlug}`}
                    className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
                        {t.tenantLogo ? (
                          <img src={`${API_URL}${t.tenantLogo}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          t.tenantName[0]
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t.tenantName}</p>
                        <p className="text-xs text-gray-400">Ver recompensas disponibles</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-lg font-bold" style={{ color: TEAL }}>{t.points.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">pts</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cupones tab */}
        {tab === 'cupones' && (isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: '#008080' }} />
          </div>
        ) : (redemptions.length === 0 && activeReferrals.length === 0 && receivedReferrals.length === 0) ? (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
            <p className="text-gray-500">No tienes cupones todavía</p>
            <p className="text-xs text-gray-400 max-w-xs">Acumula puntos al reservar citas y canjéalos por descuentos o servicios gratis</p>
            <Link href="/marketplace" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: '#008080' }}>
              Explorar negocios
            </Link>
          </div>
        ) : (() => {
          const hasAny =
            (showActiveSection && (
              filteredReceived.length + filteredActiveRef.length + filteredActive.length > 0
            )) ||
            (showHistorySection && (filteredUsed.length + filteredUsedRef.length > 0));

          if (!hasAny) {
            return (
              <div className="text-center py-12 flex flex-col items-center gap-3">
                <p className="text-sm text-gray-500">
                  {search
                    ? `No encontramos cupones con "${search}"`
                    : 'No hay cupones que coincidan con este filtro'}
                </p>
                {(search || couponFilter !== 'all') && (
                  <button
                    onClick={() => { setSearch(''); setCouponFilter('all'); }}
                    className="text-xs font-medium px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {showActiveSection && filteredReceived.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Regalos recibidos · {filteredReceived.length}</h2>
                  <div className="space-y-4">
                    {filteredReceived.map((ref) => <ReceivedReferralCard key={ref.code} referral={ref} />)}
                  </div>
                </section>
              )}

              {showActiveSection && filteredActiveRef.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Códigos para compartir · {filteredActiveRef.length}</h2>
                  <div className="space-y-4">
                    {filteredActiveRef.map((ref) => <ReferralCard key={ref.id} referral={ref} />)}
                  </div>
                </section>
              )}

              {showActiveSection && filteredActive.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Disponibles · {filteredActive.length}</h2>
                  <div className="space-y-4">
                    {filteredActive.map((r) => <CouponCard key={r.id} redemption={r} />)}
                  </div>
                </section>
              )}

              {showHistorySection && (filteredUsed.length > 0 || filteredUsedRef.length > 0) && (
                <section>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Historial · {filteredUsed.length + filteredUsedRef.length}</h2>
                  <div className="space-y-4">
                    {filteredUsed.map((r) => <CouponCard key={r.id} redemption={r} disabled />)}
                    {filteredUsedRef.map((ref) => <ReferralCard key={ref.id} referral={ref} disabled />)}
                  </div>
                </section>
              )}
            </div>
          );
        })())}
      </div>
    </div>
  );
}

function CouponCard({ redemption, disabled = false }: { redemption: any; disabled?: boolean }) {
  const router = useRouter();
  const reward = redemption.reward;
  const tenant = redemption.tenant;
  const isDiscount = reward?.type === 'DESCUENTO';
  const expiry = formatExpiry(redemption.expiresAt);
  const days = daysLeft(redemption.expiresAt);
  const isUrgent = days !== null && days <= 7 && !disabled;

  const valueLabel = isDiscount
    ? (reward?.discountMode === 'PERCENT'
      ? `-${Number(reward.discountAmount)}%`
      : `$${reward?.discountAmount ?? ''}`)
    : 'GRATIS';

  const statusLabel = redemption.status === 'USED' ? 'USADO' : 'VENCIDO';
  const displayLabel = disabled ? statusLabel : valueLabel;
  const stubFontSize = displayLabel.length <= 4 ? '1.125rem' : displayLabel.length <= 6 ? '0.875rem' : '0.75rem';

  return (
    <div
      className="relative"
      style={{ filter: disabled ? 'grayscale(0.5)' : undefined, opacity: disabled ? 0.65 : 1 }}
    >
      {/* Card */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>

        {/* ── Stub izquierdo ── */}
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: disabled ? '#9ca3af' : '#008080' }}
        >
          <span
            className="text-white font-black leading-tight text-center break-all w-full px-2"
            style={{ fontSize: stubFontSize, wordBreak: 'break-all' }}
          >
            {displayLabel}
          </span>
          {!disabled && (
            <span className="text-white/70 text-[9px] uppercase tracking-wider">
              {isDiscount ? 'descuento' : 'servicio'}
            </span>
          )}

          {/* Perforación superior */}
          <div
            className="absolute -right-3 -top-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#f3f4f6' }}
          />
          {/* Perforación inferior */}
          <div
            className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#f3f4f6' }}
          />
        </div>

        {/* ── Separador perforado ── */}
        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        {/* ── Contenido principal ── */}
        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">{reward?.name || 'Cupón'}</p>
              {tenant && (
                <span className="text-[10px] font-medium text-[#008080] bg-teal-50 px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[120px]">
                  {tenant.name}
                </span>
              )}
            </div>
            {reward && (
              <p className="text-xs text-gray-500 mt-0.5">
                {isDiscount
                  ? (reward.discountMode === 'PERCENT'
                    ? `${Number(reward.discountAmount)}% de descuento`
                    : `$${reward.discountAmount} de descuento`)
                  : (reward.service?.name ? `${reward.service.name} gratis` : 'Servicio gratis')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2 gap-2">
            {/* Fecha de vencimiento */}
            {expiry && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0"
                style={isUrgent
                  ? { backgroundColor: '#fef2f2', color: '#dc2626' }
                  : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                }
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-semibold whitespace-nowrap">
                  {isUrgent ? `¡Vence en ${days}d!` : `Vence ${expiry}`}
                </span>
              </div>
            )}

            {/* Botón CANJEAR → va directo al negocio del cupón */}
            {!disabled ? (
              <button
                onClick={() => router.push(tenant?.slug ? `/marketplace/${tenant.slug}` : '/marketplace')}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white transition-transform active:scale-95"
                style={{ backgroundColor: '#008080', letterSpacing: '0.05em' }}
              >
                CANJEAR
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {statusLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferralCard({ referral, disabled = false }: { referral: any; disabled?: boolean }) {
  const tenant = referral.tenant;
  const promo = referral.promotion;
  const serviceNames: string[] = referral.serviceNames || [];
  const expiry = referral.expiresAt ? formatExpiry(referral.expiresAt) : null;
  const statusLabel = referral.status === 'USED' ? 'CANJEADO' : 'EXPIRADO';

  return (
    <div
      className="relative"
      style={{ filter: disabled ? 'grayscale(0.5)' : undefined, opacity: disabled ? 0.65 : 1 }}
    >
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>
        {/* Stub izquierdo morado */}
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: disabled ? '#9ca3af' : '#7c3aed' }}
        >
          <span className="text-white font-black text-lg leading-tight text-center">
            {disabled ? statusLabel : '2×1'}
          </span>
          {!disabled && (
            <span className="text-white/70 text-[9px] uppercase tracking-wider">regalo</span>
          )}
          <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
          <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
        </div>

        {/* Separador perforado */}
        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        {/* Contenido principal */}
        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                {promo?.name || 'Código 2×1'}
              </p>
              {tenant && (
                <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[120px]">
                  {tenant.name}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {serviceNames.length > 0
                ? `Servicio gratis: ${serviceNames.join(', ')}`
                : 'Servicio gratis para un amigo'}
            </p>
            {!disabled && (
              <div
                className="mt-1.5 bg-gray-50 rounded-md py-1.5 px-2.5 font-mono text-sm font-black tracking-[0.12em] select-all cursor-pointer text-center"
                style={{ color: '#7c3aed' }}
                onClick={() => navigator.clipboard.writeText(referral.code)}
                title="Click para copiar"
              >
                {referral.code}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-2 gap-2">
            {expiry && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-semibold whitespace-nowrap">Vence {expiry}</span>
              </div>
            )}

            {!disabled ? (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/marketplace/${tenant?.slug}?ref=${referral.code}`;
                  if (navigator.share) {
                    navigator.share({
                      title: `Código 2x1 en ${tenant?.name}`,
                      text: `Usa mi código ${referral.code} para obtener un servicio gratis en ${tenant?.name}. Reserva en:`,
                      url,
                    }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(
                      `Usa mi código ${referral.code} para un servicio gratis en ${tenant?.name}. Reserva aquí: ${url}`
                    );
                  }
                }}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white transition-transform active:scale-95 flex items-center gap-1.5"
                style={{ backgroundColor: '#7c3aed', letterSpacing: '0.05em' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                COMPARTIR
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {statusLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceivedReferralCard({ referral }: { referral: any }) {
  const router = useRouter();
  const expiry = referral.expiresAt ? formatExpiry(referral.expiresAt) : null;
  const serviceNames: string[] = referral.serviceNames || [];

  return (
    <div className="relative">
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: '#7c3aed' }}
        >
          <span className="text-white font-black text-base leading-tight text-center">GRATIS</span>
          <span className="text-white/70 text-[9px] uppercase tracking-wider">regalo</span>
          <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
          <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
        </div>

        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                {referral.promotionName || 'Servicio gratis'}
              </p>
              {referral.tenantName && (
                <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[120px]">
                  {referral.tenantName}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {referral.generatedBy
                ? `Regalo de ${referral.generatedBy}`
                : 'Servicio gratis para ti'}
              {serviceNames.length > 0 && ` · ${serviceNames.join(', ')}`}
            </p>
            <div
              className="mt-1.5 bg-gray-50 rounded-md py-1.5 px-2.5 font-mono text-sm font-black tracking-[0.12em] select-all cursor-pointer text-center"
              style={{ color: '#7c3aed' }}
              onClick={() => navigator.clipboard.writeText(referral.code)}
              title="Click para copiar"
            >
              {referral.code}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 gap-2">
            {expiry && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-semibold whitespace-nowrap">Vence {expiry}</span>
              </div>
            )}

            <button
              onClick={() => router.push(`/marketplace/${referral.tenantSlug}`)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white transition-transform active:scale-95"
              style={{ backgroundColor: '#7c3aed', letterSpacing: '0.05em' }}
            >
              RESERVAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
