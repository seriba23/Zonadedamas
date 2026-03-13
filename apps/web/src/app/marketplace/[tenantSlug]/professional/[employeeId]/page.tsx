'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Professional {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  color: string;
  bio: string | null;
  businessName: string;
  tenantSlug: string;
  completedAppointments: number;
  averageRating: number | null;
  totalReviews: number;
  portfolio: { id: string; imageUrl: string; caption: string | null }[];
  topServices: { serviceName: string; count: number }[];
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    clientName: string;
    clientAvatarUrl: string | null;
  }[];
}

export default function ProfessionalProfilePage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const employeeId = params.employeeId as string;
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Sticky header: track when the name block scrolls out of view
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const nameRef = useRef<HTMLHeadingElement>(null);

  const handleScroll = useCallback(() => {
    if (!nameRef.current) return;
    const rect = nameRef.current.getBoundingClientRect();
    // Show sticky when the name is scrolled above the viewport
    setShowStickyHeader(rect.bottom < 0);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const { data: pro, isLoading, error } = useQuery({
    queryKey: ['professional-profile', tenantSlug, employeeId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/marketplace/professional/${tenantSlug}/${employeeId}`);
      if (!res.ok) throw new Error('Not found');
      const json = await res.json();
      return json.data as Professional;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-gray-200 border-t-[#008080] rounded-full" />
      </div>
    );
  }

  if (error || !pro) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <p className="text-gray-500 mb-4">Profesional no encontrado</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-[#008080] text-white rounded-lg text-sm font-medium"
        >
          Volver
        </button>
      </div>
    );
  }

  const hasAvatar = !!pro.avatarUrl;
  const fullName = `${pro.firstName} ${pro.lastName}`;
  const initials = `${pro.firstName[0]}${pro.lastName[0]}`;
  const specialty = pro.topServices.length > 0 ? pro.topServices[0].serviceName : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Sticky header (slides down when name leaves viewport) ─── */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ease-in-out ${
          showStickyHeader
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-[#008080] shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.back()}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 hover:bg-white/30 transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <p className="text-base font-bold text-white truncate">{fullName}</p>
            </div>
            {pro.averageRating && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-bold text-white">{pro.averageRating}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Hero: Fixed photo background, content scrolls over it ─── */}
      <div className="relative" style={{ height: '100vh' }}>
        {/* Photo stays fixed in place */}
        <div className="fixed inset-0 z-0" style={{ height: '100vh' }}>
          {hasAvatar ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${API_URL}${pro.avatarUrl})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${pro.color}dd 0%, ${pro.color}44 50%, #1a1a2e 100%)`,
              }}
            />
          )}
        </div>

        {/* Back button (over hero) */}
        <button
          onClick={() => router.back()}
          className="fixed top-4 left-4 z-30 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors"
          style={{ display: showStickyHeader ? 'none' : undefined }}
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Rating badge (over hero) */}
        {pro.averageRating && (
          <div
            className="fixed top-4 right-4 z-30 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/20 backdrop-blur-md"
            style={{ display: showStickyHeader ? 'none' : undefined }}
          >
            <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xl font-bold text-white">{pro.averageRating}</span>
          </div>
        )}

        {/* Hero content — positioned at bottom, scrolls with page */}
        <div className="relative z-10 flex flex-col justify-end min-h-screen px-6 pb-8 max-w-3xl mx-auto">
          {/* Business badge */}
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#008080]" />
              {pro.businessName}
            </span>
          </div>

          {/* Name — this is the ref we track for sticky */}
          <h1
            ref={nameRef}
            className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight"
          >
            {fullName}
          </h1>

          {/* Bio */}
          {pro.bio && (
            <p className="text-base md:text-lg text-white/85 leading-relaxed max-w-xl mb-6">
              {pro.bio}
            </p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md">
              <svg className="w-5 h-5 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div>
                <p className="text-2xl font-bold text-white">{pro.completedAppointments}</p>
                <p className="text-[10px] text-white/60 uppercase tracking-wider">Trabajos realizados</p>
              </div>
            </div>

            {specialty && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-white">{specialty}</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-wider">Especialidad</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Content below hero (white bg covers the fixed photo) ─── */}
      <div className="relative z-10 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

          {/* Portfolio gallery */}
          {pro.portfolio.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
                Portfolio
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {pro.portfolio.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setLightboxImg(`${API_URL}${img.imageUrl}`)}
                    className="relative aspect-square rounded-xl overflow-hidden group"
                  >
                    <img
                      src={`${API_URL}${img.imageUrl}`}
                      alt={img.caption || ''}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {img.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white truncate">{img.caption}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Comentarios de clientes ─── */}
          {pro.reviews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Comentarios de clientes
                </h2>
                <span className="text-xs text-gray-400">{pro.reviews.length} comentarios</span>
              </div>
              <div className="space-y-3">
                {pro.reviews.map((review) => (
                  <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {review.clientAvatarUrl ? (
                          <img
                            src={`${API_URL}${review.clientAvatarUrl}`}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-semibold text-gray-500">
                            {review.clientName[0]}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">{review.clientName}</span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <svg
                                key={i}
                                className={`w-3.5 h-3.5 ${i < review.rating ? 'text-amber-400' : 'text-gray-200'}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-2">
                          {new Date(review.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!pro.bio && pro.portfolio.length === 0 && pro.reviews.length === 0 && (
            <div className="text-center py-12">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-white"
                style={{ backgroundColor: pro.color }}
              >
                {initials}
              </div>
              <p className="text-gray-500 text-sm">
                {fullName} aun no ha completado su perfil profesional.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxImg}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
