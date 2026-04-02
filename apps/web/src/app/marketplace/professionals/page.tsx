'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // GPS
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24 safe-top">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-3">Profesionales</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o especialidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-200 transition-colors"
          />
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-gray-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-3 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              </div>
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
          <div className="space-y-3">
            {!isLoading && (
              <p className="text-xs text-gray-400 mb-2">{professionals.length} profesional{professionals.length !== 1 ? 'es' : ''}</p>
            )}
            {professionals.map((pro) => (
              <Link
                key={pro.id}
                href={`/marketplace/${pro.tenantSlug}/professional/${pro.id}`}
                className="block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Cover strip */}
                <div className="h-16 relative">
                  {pro.coverImageUrl ? (
                    <img src={`${API_URL}${pro.coverImageUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${pro.color}cc 0%, ${pro.color}66 100%)` }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>

                <div className="px-4 pb-4 -mt-6 relative">
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div
                      className="w-14 h-14 rounded-xl border-2 border-white shadow-md flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: pro.color || TEAL }}
                    >
                      {pro.avatarUrl ? (
                        <img src={`${API_URL}${pro.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <>{pro.firstName[0]}{pro.lastName[0]}</>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pt-7">
                      <p className="text-sm font-semibold text-gray-900 truncate">{pro.firstName} {pro.lastName}</p>
                      {pro.jobTitle && (
                        <p className="text-xs text-[#008080] font-medium">{pro.jobTitle}</p>
                      )}
                      <p className="text-[11px] text-gray-400 truncate">{pro.businessName}</p>
                    </div>

                    {/* Rating */}
                    <div className="pt-7 flex-shrink-0 text-right">
                      {pro.averageRating ? (
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-xs font-semibold text-gray-900">{pro.averageRating}</span>
                          <span className="text-[10px] text-gray-400">({pro.totalReviews})</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">Nuevo</span>
                      )}
                    </div>
                  </div>

                  {pro.bio && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{pro.bio}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
