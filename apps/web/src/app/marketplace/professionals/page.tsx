'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';

interface Professional {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  color: string;
  bio: string | null;
  jobTitle: string | null;
  businessName: string;
  tenantSlug: string;
  address: string | null;
  averageRating: number | null;
  totalReviews: number;
  _count: { appointments: number; reviews: number };
}

export default function ProfessionalsPage() {
  const router = useRouter();
  const { isAuthenticated } = useMarketplaceAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [filterJobTitle, setFilterJobTitle] = useState('');
  // showJobSheet eliminado: la profesión se elige dentro del modal de Filtros.
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [availableNow, setAvailableNow] = useState(false);
  const [sortBy, setSortBy] = useState<'' | 'rating' | 'appointments'>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 },
      );
    }
  }, []);

  const { data: professionsData } = useQuery({
    queryKey: ['professions-catalog'],
    queryFn: () => marketplaceApi.get<{ data: string[] }>('/professions'),
  });
  const professions: string[] = (professionsData as any)?.data || [];

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-professionals', debouncedSearch, filterJobTitle, coords?.lat, coords?.lng],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterJobTitle) params.set('jobTitle', filterJobTitle);
      if (coords) {
        params.set('lat', String(coords.lat));
        params.set('lng', String(coords.lng));
      }
      params.set('perPage', '50');
      return marketplaceApi.get<{ data: Professional[] }>(`/professionals?${params}`);
    },
  });

  const { data: favData } = useQuery({
    queryKey: ['pro-favorites'],
    queryFn: () => marketplaceApi.get<{ data: Professional[] }>('/professionals/my-favorites'),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    const favs = (favData as any)?.data || [];
    setFavIds(new Set(favs.map((f: any) => f.id)));
  }, [favData]);

  const toggleFavMutation = useMutation({
    mutationFn: (employeeId: string) =>
      marketplaceApi.post<{ data: { favorited: boolean } }>(`/professionals/favorites/${employeeId}`),
    onMutate: (employeeId) => {
      setFavIds((prev) => {
        const next = new Set(prev);
        if (next.has(employeeId)) next.delete(employeeId);
        else next.add(employeeId);
        return next;
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pro-favorites'] });
    },
  });

  const allProfessionals: Professional[] = (data as any)?.data || [];
  const favProfessionals: Professional[] = (favData as any)?.data || [];
  const baseList = showFavoritesOnly ? favProfessionals : allProfessionals;

  // Filtros + orden client-side. availableNow es un proxy: profesionales con
  // al menos una cita completada en historial (= activos en el sistema).
  // Un filtro real requeriría calcular slots libres ahora mismo en backend.
  const professionals = (() => {
    let list = baseList;
    if (availableNow) {
      list = list.filter((p) => (p._count?.appointments ?? 0) > 0);
    }
    if (sortBy === 'rating') {
      list = [...list].sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
    } else if (sortBy === 'appointments') {
      list = [...list].sort((a, b) => (b._count?.appointments ?? 0) - (a._count?.appointments ?? 0));
    }
    return list;
  })();

  function renderCard(pro: Professional) {
    const bgColor = pro.color || TEAL;
    const hasCover = !!pro.coverImageUrl;
    const isNew = pro._count.appointments < 10;
    const numericId = parseInt(pro.id.replace(/-/g, '').slice(0, 8), 16) % 1000000;
    const shortId = String(numericId).padStart(6, '0');

    return (
      <Link
        key={pro.id}
        href={`/marketplace/${pro.tenantSlug}/professional/${pro.id}`}
        className="w-full rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform relative block"
        style={{ height: 140 }}
      >
        {/* Background */}
        {hasCover ? (
          <img src={`${API_URL}${pro.coverImageUrl}`} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
        )}

        {/* Gradient */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.15) 50%, transparent 55%)' }}
        />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-3">
          {/* Top: avatar circle + heart */}
          <div className="flex items-start justify-between">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow-md relative z-10"
              style={{ backgroundColor: bgColor }}
            >
              {pro.avatarUrl ? (
                <img src={`${API_URL}${pro.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-black text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {pro.firstName[0]}{pro.lastName[0]}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Heart */}
              {isAuthenticated && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavMutation.mutate(pro.id); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm relative z-10"
                >
                  <svg
                    className="w-4 h-4"
                    fill={favIds.has(pro.id) ? TEAL : 'none'}
                    stroke={favIds.has(pro.id) ? TEAL : '#6b7280'}
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Bottom: name, job, business, stats */}
          <div>
            <p className="text-base font-black text-white leading-tight truncate" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {pro.firstName} {pro.lastName}
            </p>
            {pro.jobTitle && (
              <p className="text-xs font-semibold text-white/90 mt-0.5">{pro.jobTitle}</p>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/70 truncate max-w-[140px]">{pro.businessName}</span>
              </div>
              {!isNew && pro.averageRating != null && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-semibold text-white">{pro.averageRating}</span>
                  <span className="text-xs text-white/70">({pro.totalReviews})</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* NUEVO triangle — z-10 para no taparse con el header sticky (z-30) */}
        {isNew && (
          <div
            className="absolute bottom-0 right-0 z-10"
            style={{
              width: 70,
              height: 70,
              clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
              backgroundColor: 'rgba(34,197,94,0.85)',
            }}
          >
            <span
              className="absolute font-black text-white"
              style={{
                fontSize: 11,
                letterSpacing: '0.06em',
                top: '64%',
                left: '64%',
                transform: 'translate(-50%, -50%) rotate(-45deg)',
              }}
            >
              NUEVO
            </span>
          </div>
        )}
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header (sticky) — mismo layout que negocios */}
      <div className="bg-gray-50 px-4 pt-6 pb-3 safe-top sticky top-0 z-30">
        <div className="max-w-2xl mx-auto">
          {/* Search + filters en un renglon */}
          <div className="flex items-center gap-2 mb-2.5">
            {/* Search compacto */}
            <div className="relative flex-1 min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, especialidad o ID..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ ['--tw-ring-color' as any]: '#008080' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Rayo — Disponible ahora */}
            <button
              onClick={() => setAvailableNow(!availableNow)}
              title="Disponible ahora"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={availableNow
                ? { backgroundColor: TEAL, color: 'white', border: `1.5px solid ${TEAL}` }
                : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
              }
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Ajustes/Filtros — profesion + ordenamiento */}
            <button
              onClick={() => setShowFiltersSheet(true)}
              title="Filtros"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
              style={sortBy || filterJobTitle
                ? { backgroundColor: TEAL, color: 'white', border: `1.5px solid ${TEAL}` }
                : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
              }
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              {(sortBy || filterJobTitle) && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
              )}
            </button>

            {/* Favoritos */}
            {isAuthenticated && (
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                title="Favoritos"
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={showFavoritesOnly
                  ? { backgroundColor: TEAL, color: 'white', border: `1.5px solid ${TEAL}` }
                  : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                }
              >
                <svg className="w-4 h-4" fill={showFavoritesOnly ? 'white' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            )}
          </div>

          {/* Tabs: Negocios | Profesionales */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => router.push('/marketplace')}
              className="flex-1 pb-1.5 text-[13px] font-medium border-b-2 border-transparent text-gray-500"
            >
              Negocios
            </button>
            <button
              className="flex-1 pb-1.5 text-[13px] font-medium border-b-2 border-[#008080] text-[#008080]"
            >
              Profesionales
            </button>
          </div>

          {/* Contador dentro del header sticky */}
          {!isLoading && professionals.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {professionals.length} profesional{professionals.length !== 1 ? 'es' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-2 pb-24">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-200 rounded-2xl animate-pulse" style={{ height: 140 }} />
            ))}
          </div>
        ) : professionals.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-gray-500 text-sm">
              {debouncedSearch ? 'No se encontraron profesionales' : 'No hay profesionales disponibles'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {professionals.map((pro) => renderCard(pro))}
          </div>
        )}
      </div>

      {/* Modal Filtros — profesion + ordenar por (mismo estilo que negocios) */}
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
              {(sortBy || filterJobTitle) && (
                <button
                  onClick={() => { setSortBy(''); setFilterJobTitle(''); }}
                  className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                  style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Limpiar filtros
                </button>
              )}

              {/* Profesión */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Profesión</p>
              <div className="flex flex-wrap gap-1.5 mb-5 max-h-40 overflow-y-auto">
                <button
                  onClick={() => setFilterJobTitle('')}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={!filterJobTitle
                    ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                    : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                  }
                >
                  Todas
                </button>
                {(professions || []).map((job: string) => (
                  <button
                    key={job}
                    onClick={() => setFilterJobTitle(job)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={filterJobTitle === job
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {job}
                  </button>
                ))}
              </div>

              {/* Ordenar por */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ordenar por</p>
              <div className="space-y-1">
                {[
                  { value: 'rating', label: 'Más puntuados', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /> },
                  { value: 'appointments', label: 'Más experiencia', icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></> },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(sortBy === opt.value ? '' : opt.value as any)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors"
                    style={sortBy === opt.value ? { backgroundColor: '#e0f2f1', color: TEAL, fontWeight: 600 } : { color: '#374151' }}
                  >
                    <span className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">{opt.icon}</svg>
                      {opt.label}
                    </span>
                    {sortBy === opt.value && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-4" />
          </div>
        </div>
      )}
    </div>
  );
}
