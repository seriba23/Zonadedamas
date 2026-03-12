'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import MarketplaceHeader from './marketplace-header';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const CATEGORIES = [
  { value: '', label: 'Todos' },
  { value: 'SALON', label: 'Salón' },
  { value: 'BARBERIA', label: 'Barbería' },
  { value: 'SPA', label: 'SPA' },
  { value: 'CLINICA', label: 'Clínica' },
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
  const [availableToday, setAvailableToday] = useState(false);
  const [availableNow, setAvailableNow] = useState(false);

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
    queryKey: ['marketplace-discover', search, category, coords, sortBy, availableToday, availableNow],
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
      if (availableToday) params.set('availableToday', 'true');
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
  const CATEGORY_LABELS: Record<string, string> = { SALON: 'Salón', BARBERIA: 'Barbería', SPA: 'SPA', CLINICA: 'Clínica' };
  const favoritesByCategory = showFavoritesOnly && !category
    ? Object.entries(
        favoriteBusinesses.reduce<Record<string, Business[]>>((acc, biz) => {
          const type = biz.businessType?.split(',')[0] || 'OTRO';
          (acc[type] ||= []).push(biz);
          return acc;
        }, {}),
      ).sort(([a], [b]) => {
        const order = ['SALON', 'BARBERIA', 'SPA', 'CLINICA'];
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
      <MarketplaceHeader />

      <div className="max-w-2xl mx-auto px-4 py-4">
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

        {/* Category pills */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => { setCategory(cat.value); setShowFavoritesOnly(false); }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                category === cat.value && !showFavoritesOnly
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-gray-600'
              }`}
              style={
                category === cat.value && !showFavoritesOnly
                  ? { backgroundColor: '#008080' }
                  : undefined
              }
              onMouseEnter={(e) => {
                if (category !== cat.value || showFavoritesOnly) e.currentTarget.style.borderColor = '#008080';
              }}
              onMouseLeave={(e) => {
                if (category !== cat.value || showFavoritesOnly) e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              {cat.label}
            </button>
          ))}
          {isAuthenticated && (
            <button
              onClick={() => setShowFavoritesOnly((prev) => !prev)}
              className={`ml-auto px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                showFavoritesOnly
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-gray-600'
              }`}
              style={showFavoritesOnly ? { backgroundColor: '#008080' } : undefined}
              onMouseEnter={(e) => {
                if (!showFavoritesOnly) e.currentTarget.style.borderColor = '#008080';
              }}
              onMouseLeave={(e) => {
                if (!showFavoritesOnly) e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              <svg className="w-4 h-4" fill={showFavoritesOnly ? 'white' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              Favoritos
            </button>
          )}
        </div>

        {/* Filter pills row */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {/* Disponible ahora — the star filter */}
          <button
            onClick={() => setAvailableNow(!availableNow)}
            className="relative overflow-hidden px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5"
            style={availableNow
              ? {
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: '1.5px solid transparent',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)',
                }
              : {
                  background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                  color: '#059669',
                  border: '1.5px solid #a7f3d0',
                }
            }
          >
            {availableNow && (
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <span className="absolute inset-0 animate-pulse opacity-20 bg-white" />
              </span>
            )}
            <span className="relative flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Disponible ahora
            </span>
          </button>

          {/* Disponible hoy */}
          <button
            onClick={() => setAvailableToday(!availableToday)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              availableToday
                ? 'text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={availableToday ? { backgroundColor: '#008080' } : undefined}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            Abierto hoy
          </button>

          {/* Cerca de mí */}
          {coords && (
            <button
              onClick={() => toggleSort('distance')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                sortBy === 'distance'
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={sortBy === 'distance' ? { backgroundColor: '#008080' } : undefined}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Cerca de mí
            </button>
          )}

          {/* Más puntuados */}
          <button
            onClick={() => toggleSort('rating')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              sortBy === 'rating'
                ? 'text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={sortBy === 'rating' ? { backgroundColor: '#008080' } : undefined}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Más puntuados
          </button>

          {/* Más servicios */}
          <button
            onClick={() => toggleSort('services')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              sortBy === 'services'
                ? 'text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={sortBy === 'services' ? { backgroundColor: '#008080' } : undefined}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Más servicios
          </button>
        </div>

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
