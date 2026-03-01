'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';

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
}

export default function MarketplacePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAsked, setGpsAsked] = useState(false);

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
    queryKey: ['marketplace-discover', search, category, coords],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (coords) {
        params.set('lat', coords.lat.toString());
        params.set('lng', coords.lng.toString());
        params.set('radiusKm', '50');
      }
      params.set('perPage', '50');
      return marketplaceApi.get<{ data: Business[]; meta: any }>(`/discover?${params}`);
    },
  });

  const businesses: Business[] = (data as any)?.data || [];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-indigo-600 tracking-tight">ZONADEDAMAS</h1>
            <p className="text-xs text-gray-500">Tu plataforma de belleza</p>
          </div>
          {authLoading ? null : isAuthenticated ? (
            <button
              onClick={() => router.push('/marketplace/login')}
              className="flex items-center gap-2 text-sm text-gray-700"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
            </button>
          ) : (
            <button
              onClick={() => router.push('/marketplace/login')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Iniciar sesión
            </button>
          )}
        </div>
      </div>

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
            placeholder="Buscar salón, barbería, spa..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                category === cat.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
            <p className="text-sm text-gray-400 mt-3">Buscando negocios...</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-1">No se encontraron negocios</p>
            <p className="text-sm text-gray-400">
              {search ? 'Intenta con otro término de búsqueda' : 'No hay negocios disponibles en esta zona'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {businesses.map((biz) => (
              <button
                key={biz.id}
                onClick={() => router.push(`/marketplace/${biz.slug}`)}
                className="w-full bg-white rounded-xl border border-gray-200 overflow-hidden text-left hover:shadow-md transition-shadow"
              >
                {/* Cover */}
                <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-500 relative">
                  {biz.coverImageUrl && (
                    <img
                      src={`${API_URL}${biz.coverImageUrl}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                  {biz.distance != null && (
                    <span className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-medium text-gray-700">
                      {biz.distance} km
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Logo */}
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 -mt-8 border-2 border-white shadow-sm">
                      {biz.logoUrl ? (
                        <img
                          src={`${API_URL}${biz.logoUrl}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-gray-400">
                          {biz.name[0]}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {biz.name}
                        </h3>
                        {biz.businessType && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-full flex-shrink-0">
                            {biz.businessType === 'SALON' ? 'Salón' :
                             biz.businessType === 'BARBERIA' ? 'Barbería' :
                             biz.businessType === 'CLINICA' ? 'Clínica' :
                             biz.businessType}
                          </span>
                        )}
                      </div>

                      {/* Rating */}
                      {biz.averageRating != null && (
                        <div className="flex items-center gap-1 mt-1">
                          <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">
                            {biz.averageRating}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({biz.totalReviews})
                          </span>
                        </div>
                      )}

                      {/* Address */}
                      {biz.address && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {biz.address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
