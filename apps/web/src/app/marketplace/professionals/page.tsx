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
  const [showJobSheet, setShowJobSheet] = useState(false);

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
  const professionals = showFavoritesOnly ? favProfessionals : allProfessionals;

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

        {/* NUEVO triangle */}
        {isNew && (
          <div
            className="absolute bottom-0 right-0 z-20"
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
      {/* Header (sticky) — identical to negocios */}
      <div className="bg-gray-50 px-4 pt-8 pb-3 safe-top sticky top-0 z-20">
        <div className="max-w-2xl mx-auto">
          {/* Search */}
          <div className="relative mb-2.5">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, especialidad o ID..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ ['--tw-ring-color' as any]: '#008080' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.25)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Tabs: Negocios | Profesionales */}
          <div className="flex border-b border-gray-200 mb-2.5">
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

          {/* Filter bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
            {/* Puesto / Profesión */}
            <button
              onClick={() => setShowJobSheet(true)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0"
              style={filterJobTitle
                ? { backgroundColor: TEAL, color: 'white', border: `1.5px solid ${TEAL}` }
                : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
              }
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {filterJobTitle || 'Profesión'}
            </button>

            {/* Favoritos */}
            {isAuthenticated && (
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={showFavoritesOnly
                  ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
                  : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                }
              >
                <svg className="w-4 h-4" fill={showFavoritesOnly ? 'white' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            )}
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

      {/* Job Title filter sheet */}
      {showJobSheet && (
        <div className="fixed inset-0 z-50" onClick={() => setShowJobSheet(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900">Filtrar por profesión</h3>
            </div>
            <div className="p-4 space-y-1">
              <button
                onClick={() => { setFilterJobTitle(''); setShowJobSheet(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${!filterJobTitle ? 'bg-teal-50 text-[#008080] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Todas las profesiones
              </button>
              {(professions || []).map((job: string) => (
                <button
                  key={job}
                  onClick={() => { setFilterJobTitle(job); setShowJobSheet(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${filterJobTitle === job ? 'bg-teal-50 text-[#008080] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {job}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
