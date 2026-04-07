'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  cardColor: string | null;
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

type SortBy = '' | 'rating' | 'services';

const HEARTBEAT_KEYFRAMES = `
@keyframes heartPop {
  0%   { transform: scale(1); }
  25%  { transform: scale(1.45); }
  50%  { transform: scale(0.9); }
  75%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
.heart-pop { animation: heartPop 0.5s ease-out forwards; }
`;

export default function MarketplacePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useMarketplaceAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(new Set());
  const [animatingFav, setAnimatingFav] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [sortBy, setSortBy] = useState<SortBy>('');
  const [availableNow, setAvailableNow] = useState(false);
  const searchParams = useSearchParams();
  const shopOnly = searchParams.get('shop') === '1';
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Detección silenciosa de GPS — usa @capacitor/geolocation en nativo, fallback web
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        // @capacitor/geolocation funciona en nativo (Android/iOS) y hace fallback a navigator.geolocation en web
        const { Geolocation } = await import('@capacitor/geolocation');
        await Geolocation.requestPermissions();
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // Si falla (permiso denegado o no disponible), silencioso
      }
    })();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-discover', search, category, sortBy, availableNow, shopOnly, coords?.lat, coords?.lng],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (sortBy) params.set('sortBy', sortBy);
      if (availableNow) params.set('availableNow', 'true');
      if (shopOnly) params.set('shopOnly', 'true');
      if (coords) { params.set('lat', String(coords.lat)); params.set('lng', String(coords.lng)); }
      params.set('perPage', '50');
      return marketplaceApi.get<{ data: Business[]; meta: any }>(`/discover?${params}`);
    },
  });

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
      const willFavorite = !favoriteSlugs.has(slug);
      setFavoriteSlugs((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return next;
      });
      if (willFavorite) {
        setAnimatingFav((prev) => new Set(prev).add(slug));
        setTimeout(() => {
          setAnimatingFav((prev) => {
            const next = new Set(prev);
            next.delete(slug);
            return next;
          });
        }, 550);
      }
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

  const toggleSort = (s: SortBy) => setSortBy(sortBy === s ? '' : s);

  const allBusinesses: Business[] = (data as any)?.data || [];
  const favoriteBusinesses: Business[] = (favData as any)?.data || [];
  const businesses = showFavoritesOnly ? favoriteBusinesses : allBusinesses;

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

  const renderBusinessCard = (biz: Business) => {
    const isFav = favoriteSlugs.has(biz.slug);
    const isAnimating = animatingFav.has(biz.slug);
    const hasCover = !!biz.coverImageUrl;
    const bgColor = biz.cardColor || '#008080';

    return (
      <button
        key={biz.id}
        onClick={() => router.push(shopOnly ? `/marketplace/${biz.slug}/shop` : `/marketplace/${biz.slug}`)}
        className="w-full rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform relative"
        style={{ height: 140 }}
      >
        {/* Background: cover image or solid color */}
        {hasCover ? (
          <img
            src={`${API_URL}${biz.coverImageUrl}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
        )}

        {/* Gradient: top 50% limpio, de ahí baja suave hasta denso en el borde */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.15) 50%, transparent 55%)' }}
        />


        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-3">

          {/* Top row: logo circle (left) + heart (right) */}
          <div className="flex items-start justify-between">
            {/* Logo circle — round, large, z-index above gradient */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow-md"
              style={{
                backgroundColor: bgColor,
                zIndex: 10,
                position: 'relative',
              }}
            >
              {biz.logoUrl ? (
                <img
                  src={`${API_URL}${biz.logoUrl}`}
                  alt={biz.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-black text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {biz.name[0]}
                </span>
              )}
            </div>

            {/* Heart */}
            {isAuthenticated && (
              <button
                onClick={(e) => handleToggleFavorite(e, biz.slug)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm flex-shrink-0"
                style={{ zIndex: 10, position: 'relative' }}
              >
                <svg
                  className={`w-4 h-4${isAnimating ? ' heart-pop' : ''}`}
                  fill={isFav ? '#008080' : 'none'}
                  stroke={isFav ? '#008080' : '#6b7280'}
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            )}
          </div>

          {/* Bottom: name, category, stats + distance */}
          <div>
            <p className="text-base font-black text-white leading-tight truncate" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {biz.name}
            </p>
            {biz.businessType && (
              <p className="text-xs font-semibold text-white/90 mt-0.5">
                {CATEGORY_LABELS[biz.businessType.split(',')[0]] || biz.businessType.split(',')[0]}
              </p>
            )}
            <div className="flex items-center justify-between mt-1.5">
              {/* Izquierda: distancia + disponible + NUEVO */}
              <div className="flex items-center gap-2">
                {biz.distance != null && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-black/40 px-1.5 py-0.5 rounded-full">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                    {biz.distance < 1 ? `${Math.round(biz.distance * 1000)} m` : `${biz.distance} km`}
                  </span>
                )}
                {biz.hasImmediateAvailability && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-green-500/80 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    Disponible
                  </span>
                )}
              </div>
              {/* Derecha: estrellas (solo si tiene 10+ servicios realizados) */}
              {biz.completedAppointments >= 10 && biz.averageRating != null && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-semibold text-white">{biz.averageRating}</span>
                  <span className="text-xs text-white/70">({biz.totalReviews})</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* "NUEVO" — triángulo relleno esquina inferior derecha */}
        {biz.completedAppointments < 10 && (
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
      </button>
    );
  };

  return (
    <>
      <style>{HEARTBEAT_KEYFRAMES}</style>

      <div>

        {/* ── Header ── */}
        <div className="bg-gray-50 px-4 pt-4 pb-2 safe-top">
          <div className="max-w-2xl mx-auto">
            {/* Search */}
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar negocio o servicio..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ ['--tw-ring-color' as any]: '#008080' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Filter bar */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>

              {/* Disponible ahora */}
              <button
                onClick={() => setAvailableNow(!availableNow)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0"
                style={availableNow
                  ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
                  : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                }
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                Disponible ahora
              </button>

              {/* Categoría */}
              <button
                onClick={() => setShowCategorySheet(true)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0"
                style={category
                  ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
                  : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                }
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                {category ? CATEGORIES.find(c => c.value === category)?.label : 'Categoría'}
              </button>

              {/* Filtros — solo icono, punto rojo cuando activo */}
              <button
                onClick={() => setShowFiltersSheet(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
                style={sortBy
                  ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
                  : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                }
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                {sortBy && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
                )}
              </button>

              {/* Favoritos */}
              {isAuthenticated && (
                <button
                  onClick={() => { setShowFavoritesOnly((prev) => !prev); setCategory(''); }}
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
          </div>
        </div>

        {/* ── Cards ── */}
        <div className="max-w-2xl mx-auto w-full px-4 pt-2 pb-24">
          {/* Results count */}
          {!isLoading && businesses.length > 0 && (
            <p className="text-xs text-gray-400 mb-2">
              {businesses.length} negocio{businesses.length !== 1 ? 's' : ''}
            </p>
          )}

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
                    ? 'Ningún negocio tiene disponibilidad inmediata'
                    : search ? 'Intenta con otro término de búsqueda' : 'No hay negocios disponibles en esta zona'}
              </p>
            </div>
          ) : favoritesByCategory ? (
            <div className="space-y-5">
              {favoritesByCategory.map(([type, bizList]) => (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-sm font-semibold text-gray-700">{CATEGORY_LABELS[type] || type}</h2>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#e0f2f1', color: '#008080' }}>{bizList.length}</span>
                  </div>
                  <div className="space-y-2">
                    {bizList.map((biz) => renderBusinessCard(biz))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {businesses.map((biz) => renderBusinessCard(biz))}
            </div>
          )}
        </div>

        {/* ── Bottom sheets ── */}
        {showCategorySheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowCategorySheet(false)} />
            <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
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
                    style={category === cat.value ? { backgroundColor: '#e0f2f1', color: '#008080', fontWeight: 600 } : { color: '#374151' }}
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
                {sortBy && (
                  <button
                    onClick={() => setSortBy('')}
                    className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                    style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    Limpiar filtros
                  </button>
                )}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ordenar por</p>
                <div className="space-y-1">
                  {[
                    { value: 'rating', label: 'Más puntuados', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /> },
                    { value: 'services', label: 'Más servicios', icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></> },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { toggleSort(opt.value as SortBy); setShowFiltersSheet(false); }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors"
                      style={sortBy === opt.value ? { backgroundColor: '#e0f2f1', color: '#008080', fontWeight: 600 } : { color: '#374151' }}
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
    </>
  );
}
