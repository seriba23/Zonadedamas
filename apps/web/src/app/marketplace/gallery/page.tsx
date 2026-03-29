'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface GalleryPhoto {
  id: string;
  imageUrl: string;
  serviceName: string;
  date: string;
  tenantName: string;
  tenantSlug: string;
}

interface GalleryCategory {
  name: string;
  photos: GalleryPhoto[];
}

export default function MarketplaceGalleryPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-gallery'],
    queryFn: () => marketplaceApi.get<{ data: GalleryCategory[] }>('/my-gallery'),
    enabled: isAuthenticated,
  });

  const categories: GalleryCategory[] = (data as any)?.data || [];
  const totalPhotos = categories.reduce((sum, c) => sum + c.photos.length, 0);

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="bg-white border-b border-gray-100 px-4 pb-3 safe-top">
          <div className="max-w-2xl mx-auto pt-2">
            <h1 className="text-lg font-bold text-gray-900">Mi galería</h1>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <p className="text-gray-500 text-sm">Inicia sesión para ver tu galería</p>
          <Link
            href="/marketplace/login"
            className="px-6 py-2.5 text-white rounded-full text-sm font-medium"
            style={{ backgroundColor: '#008080' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pb-3 safe-top">
        <div className="max-w-2xl mx-auto pt-2 flex items-end justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Mi galería</h1>
            {!isLoading && totalPhotos > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{totalPhotos} foto{totalPhotos !== 1 ? 's' : ''} de resultados</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: '#008080' }} />
          </div>
        ) : totalPhotos === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p className="text-gray-500">Tu galería está vacía</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Cuando un especialista suba fotos de tu resultado después de una cita, aparecerán aquí
            </p>
            <Link
              href="/marketplace"
              className="px-6 py-2.5 text-white rounded-full text-sm font-medium"
              style={{ backgroundColor: '#008080' }}
            >
              Reservar una cita
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((cat) => (
              <section key={cat.name}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">{cat.name}</h2>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#e0f2f1', color: '#008080' }}
                  >
                    {cat.photos.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {cat.photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => setLightbox(photo)}
                      className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group"
                    >
                      <img
                        src={`${API_URL}${photo.imageUrl}`}
                        alt={photo.serviceName}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black"
          onClick={() => setLightbox(null)}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 safe-top" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-white text-sm font-semibold">{lightbox.serviceName}</p>
              <p className="text-white/60 text-xs">
                {lightbox.tenantName} · {new Date(lightbox.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => setLightbox(null)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center px-4" onClick={() => setLightbox(null)}>
            <img
              src={`${API_URL}${lightbox.imageUrl}`}
              alt={lightbox.serviceName}
              className="max-w-full max-h-full rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Link to business */}
          <div className="px-4 py-4 safe-bottom" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setLightbox(null); router.push(`/marketplace/${lightbox.tenantSlug}`); }}
              className="w-full py-3 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: '#008080' }}
            >
              Ver negocio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
