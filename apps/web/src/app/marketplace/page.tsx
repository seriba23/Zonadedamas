'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const CATEGORIES = [
  { value: '', label: 'Todos' },
  { value: 'SALON', label: 'Salón' },
  { value: 'BARBERIA', label: 'Barbería' },
  { value: 'SPA', label: 'SPA' },
  { value: 'CLINICA', label: 'Clínica' },
  { value: 'TATUAJES', label: 'Tatuajes' },
];

interface Business {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  businessType: string | null;
  description: string | null;
  address: string | null;
  distance: number | null;
  averageRating: number | null;
  totalReviews: number;
  completedAppointments: number;
  priceRange: { min: number; max: number } | null;
  hasImmediateAvailability: boolean;
}

type SortBy = '' | 'distance' | 'rating' | 'services';

export default function MarketplacePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useMarketplaceAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAsked, setGpsAsked] = useState(false);
  const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Filters
  const [sortBy, setSortBy] = useState<SortBy>('');
  const [availableNow, setAvailableNow] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Request GPS
  useEffect(() => {
    if (gpsAsked) return;
    setGpsAsked(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords(null),
        { timeout: 5000 },
      );
    }
  }, [gpsAsked]);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-discover', search, category, coords, sortBy, availableNow],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (coords) {
        params.set('lat', coords.lat.toString());
        params.set('lng', coords.lng.toString());
        params.set('radiusKm', '50');
      }
      if (sortBy) params.set('sortBy', sortBy);
      if (availableNow) params.set('availableNow', 'true');
      params.set('perPage', '50');
      return marketplaceApi.get<{ data: Business[]; meta: any }>(`/discover?${params}`);
    },
  });

  // Fetch favorites if authenticated
  const { data: favData } = useQuery({
    queryKey: ['marketplace-my-favorites'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-favorites'),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    const favs = (favData as any)?.data || [];
    setFavoriteSlugs(new Set(favs.map((f: any) => f.slug)));
  }, [favData]);

  const toggleFavMutation = useMutation({
    mutationFn: (slug: string) =>
      marketplaceApi.post<{ data: { favorited: boolean } }>(`/favorites/${slug}`),
    onMutate: async (slug) => {
      setFavoriteSlugs((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return next;
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-favorites'] });
    },
  });

  const handleToggleFavorite = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    if (!isAuthenticated) return;
    toggleFavMutation.mutate(slug);
  };

  const toggleSort = (s: SortBy) => {
    setSortBy(sortBy === s ? '' : s);
  };

  const allBusinesses: Business[] = (data as any)?.data || [];
  const favoriteBusinesses = allBusinesses.filter((b) => favoriteSlugs.has(b.slug));
  const businesses = showFavoritesOnly ? favoriteBusinesses : allBusinesses;

  // Group favorites by businessType for sectioned view
  const CATEGORY_LABELS: Record<string, string> = { SALON: 'Salón', BARBERIA: 'Barbería', SPA: 'SPA', CLINICA: 'Clínica', TATUAJES: 'Tatuajes' };
  const favoritesByCategory = showFavoritesOnly && !category
    ? Object.entries(
        favoriteBusinesses.reduce<Record<string, Business[]>>((acc, biz) => {
          const type = biz.businessType?.split(',')[0] || 'OTRO';
          (acc[type] ||= []).push(biz);
          return acc;
        }, {}),
      ).sort(([a], [b]) => {
        const order = ['SALON', 'BARBERIA', 'SPA', 'CLINICA', 'TATUAJES'];
        return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
      })
    : null;

  const renderBusinessCard = (biz: Business) => (
    <button
      key={biz.id}
      onClick={() => router.push(`/marketplace/${biz.slug}`)}
      className="w-full bg-white rounded-xl border border-gray-200 overflow-hidden text-left hover:shadow-md transition-shadow relative"
    >
      {/* Immediate availability badge */}
      {biz.hasImmediateAvailability && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          Disponible ahora
        </div>
      )}

      {/* Cover */}
      <div className="h-32 relative" style={{ background: 'linear-gradient(to right, #008080, #006666)' }}>
        {biz.coverImageUrl && (
          <img
            src={`${API_URL}${biz.coverImageUrl}`}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {biz.distance != null && (
            <span className="bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-medium text-gray-700">
              {biz.distance} km
            </span>
          )}
          <button
            onClick={(e) => handleToggleFavorite(e, biz.slug)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur hover:bg-white transition-colors"
            title={isAuthenticated ? (favoriteSlugs.has(biz.slug) ? 'Quitar de favoritos' : 'Guardar en favoritos') : 'Inicia sesión para guardar favoritos'}
          >
            <svg
              className="w-4.5 h-4.5"
              fill={favoriteSlugs.has(biz.slug) ? '#008080' : 'none'}
              stroke={favoriteSlugs.has(biz.slug) ? '#008080' : '#6b7280'}
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Logo */}
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 -mt-12 border-4 border-white shadow-md z-10 relative">
            {biz.logoUrl ? (
              <img
                src={`${API_URL}${biz.logoUrl}`}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-gray-400">
                {biz.name[0]}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {biz.name}
              </h3>
              {biz.businessType && biz.businessType.split(',').map((type: string) => (
                <span key={type} className="px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0" style={{ backgroundColor: '#e0f2f1', color: '#008080' }}>
                  {type === 'SALON' ? 'Salón' :
                   type === 'BARBERIA' ? 'Barbería' :
                   type === 'CLINICA' ? 'Clínica' :
                   type === 'TATUAJES' ? 'Tatuajes' :
                   type}
                </span>
              ))}
            </div>

            {/* Rating + Stats */}
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {biz.averageRating != null ? (
                  <>
                    <span className="text-sm font-medium text-gray-700">
                      {biz.averageRating}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({biz.totalReviews})
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">Nuevo</span>
                )}
              </div>
              {biz.completedAppointments > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs text-gray-500">
                    {biz.completedAppointments} servicio{biz.completedAppointments !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Price range + Address */}
            <div className="flex items-center gap-2 mt-1">
              {biz.priceRange && (
                <span className="text-xs text-gray-500">
                  ${biz.priceRange.min === biz.priceRange.max
                    ? biz.priceRange.min
                    : `${biz.priceRange.min} - $${biz.priceRange.max}`}
                </span>
              )}
              {biz.priceRange && biz.address && (
                <span className="text-xs text-gray-300">·</span>
              )}
              {biz.address && (
                <p className="text-xs text-gray-500 truncate">
                  {biz.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 pt-4 safe-top">
        {/* Search */}
        <div className="relative mb-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar negocio o servicio..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:outline-none"
            style={{ ['--tw-ring-color' as any]: '#008080' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Filter bar — 4 buttons */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
          {/* 1. Disponible ahora */}
          <button
            onClick={() => setAvailableNow(!availableNow)}
            className="relative overflow-hidden px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0"
            style={availableNow
              ? { background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: '1.5px solid transparent', boxShadow: '0 0 12px rgba(16,185,129,0.4)' }
              : { background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', color: '#059669', border: '1.5px solid #a7f3d0' }
            }
          >
            {availableNow && <span className="absolute inset-0 overflow-hidden rounded-full"><span className="absolute inset-0 animate-pulse opacity-20 bg-white" /></span>}
            <span className="relative flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Disponible ahora
            </span>
          </button>

          {/* 2. Categoría */}
          <button
            onClick={() => setShowCategorySheet(true)}
            className="px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0"
            style={category
              ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
              : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
            }
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            {category ? CATEGORIES.find(c => c.value === category)?.label : 'Categoría'}
          </button>

          {/* 3. Filtros (icon) */}
          <button
            onClick={() => setShowFiltersSheet(true)}
            className="px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0"
            style={sortBy
              ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
              : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
            }
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            {sortBy ? '1' : ''}
          </button>

          {/* 4. Favoritos */}
          {isAuthenticated && (
            <button
              onClick={() => { setShowFavoritesOnly((prev) => !prev); setCategory(''); }}
              className="px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0 ml-auto"
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

        {/* ── Bottom sheet: Categoría ── */}
        {showCategorySheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowCategorySheet(false)} />
            <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Categoría</h3>
                <button onClick={() => setShowCategorySheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-4 py-3 space-y-1 max-h-72 overflow-y-auto">
                {[{ value: '', label: 'Todas las categorías' }, ...CATEGORIES.slice(1)].map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => { setCategory(cat.value); setShowFavoritesOnly(false); setShowCategorySheet(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors"
                    style={category === cat.value
                      ? { backgroundColor: '#e0f2f1', color: '#008080', fontWeight: 600 }
                      : { color: '#374151' }
                    }
                  >
                    <span>{cat.label}</span>
                    {category === cat.value && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    )}
                  </button>
                ))}
              </div>
              <div className="px-4 py-4" />
            </div>
          </div>
        )}

        {/* ── Bottom sheet: Filtros / Ordenar ── */}
        {showFiltersSheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowFiltersSheet(false)} />
            <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
                <button onClick={() => setShowFiltersSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ordenar por</p>
                <div className="space-y-1">
                  {[
                    { value: 'distance', label: 'Más cercana', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /> },
                    { value: 'rating', label: 'Más puntuados', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /> },
                    { value: 'services', label: 'Más servicios', icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></> },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(sortBy === opt.value as SortBy ? '' : opt.value as SortBy); setShowFiltersSheet(false); }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors"
                      style={sortBy === opt.value
                        ? { backgroundColor: '#e0f2f1', color: '#008080', fontWeight: 600 }
                        : { color: '#374151' }
                      }
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

        {/* Results count */}
        {!isLoading && businesses.length > 0 && (
          <p className="text-xs text-gray-400 mb-3">
            {businesses.length} negocio{businesses.length !== 1 ? 's' : ''} encontrado{businesses.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: '#008080' }} />
            <p className="text-sm text-gray-400 mt-3">Buscando negocios...</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <p className="text-gray-400 mb-1">
              {showFavoritesOnly ? 'No tienes favoritos aún' : 'No se encontraron negocios'}
            </p>
            <p className="text-sm text-gray-400">
              {showFavoritesOnly
                ? 'Pulsa el corazón en los negocios que te gusten para guardarlos aquí'
                : availableNow
                  ? 'Ningún negocio tiene disponibilidad inmediata en este momento'
                  : search ? 'Intenta con otro término de búsqueda' : 'No hay negocios disponibles en esta zona'}
            </p>
          </div>
        ) : favoritesByCategory ? (
          /* Grouped favorites view */
          <div className="space-y-6">
            {favoritesByCategory.map(([type, bizList]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold text-gray-800">
                    {CATEGORY_LABELS[type] || type}
                  </h2>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e0f2f1', color: '#008080' }}>
                    {bizList.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {bizList.map((biz) => renderBusinessCard(biz))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {businesses.map((biz) => renderBusinessCard(biz))}
          </div>
        )}
      </div>
    </div>
  );
}
