'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import Link from 'next/link';

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
  const { isAuthenticated } = useMarketplaceAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

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

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-professionals', debouncedSearch, coords?.lat, coords?.lng],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (coords) {
        params.set('lat', String(coords.lat));
        params.set('lng', String(coords.lng));
      }
      params.set('perPage', '50');
      return marketplaceApi.get<{ data: Professional[] }>(`/professionals?${params}`);
    },
  });

  const professionals: Professional[] = (data as any)?.data || [];

  function renderCard(pro: Professional) {
    const bgColor = pro.color || TEAL;
    const hasCover = !!pro.coverImageUrl;
    const isNew = pro._count.appointments < 10;
    const shortId = pro.id.slice(0, 6).toUpperCase();

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

            {/* ID badge */}
            <span className="text-[9px] font-mono text-white/60 bg-black/30 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              #{shortId}
            </span>
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
    <div className="min-h-screen bg-gray-50 pb-24 safe-top">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Profesionales</h1>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Nombre, especialidad o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-200 transition-colors"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {isAuthenticated && (
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0"
              style={showFavoritesOnly
                ? { backgroundColor: '#e0f2f1', color: TEAL, fontWeight: 600 }
                : { backgroundColor: 'white', border: '1px solid #e5e7eb', color: '#6b7280' }}
            >
              <svg className="w-3.5 h-3.5" fill={showFavoritesOnly ? TEAL : 'none'} stroke={showFavoritesOnly ? TEAL : 'currentColor'} viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              Favoritos
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-4">
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
          <>
            <p className="text-xs text-gray-400 mb-3">{professionals.length} profesional{professionals.length !== 1 ? 'es' : ''}</p>
            <div className="grid grid-cols-1 gap-3">
              {professionals.map((pro) => renderCard(pro))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
