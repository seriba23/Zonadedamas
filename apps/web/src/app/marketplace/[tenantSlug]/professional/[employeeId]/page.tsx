'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PortfolioItem {
  id: string;
  imageUrl: string;
  caption: string | null;
  createdAt?: string;
  services: { id: string; name: string }[];
}

interface Professional {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  coverImageUrl?: string | null;
  color: string;
  bio: string | null;
  businessName: string;
  tenantSlug: string;
  completedAppointments: number;
  averageRating: number | null;
  totalReviews: number;
  portfolio: PortfolioItem[];
  services: {
    id: string;
    name: string;
    description?: string | null;
    durationMinutes: number;
    price: number;
    currency?: string;
    category?: string | null;
    subcategory?: string | null;
  }[];
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
  const searchParams = useSearchParams();
  // Modo preview admin: viene desde /settings/business → /marketplace/[slug]?fromAdmin=1
  // y de ahi al perfil del empleado con el mismo query param. Bloquea reservas.
  const fromAdmin = searchParams.get('fromAdmin') === '1';
  const tenantSlug = params.tenantSlug as string;
  const employeeId = params.employeeId as string;
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Tabs Trabajos/Comentarios + categoria activa dentro de Trabajos.
  const [activeSection, setActiveSection] = useState<0 | 1>(0); // 0 trabajos, 1 comentarios
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const sectionsRef = useRef<HTMLDivElement>(null);
  const sectionsAnchorRef = useRef<HTMLDivElement>(null);

  // Sticky header: track when the name block scrolls out of view
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const nameRef = useRef<HTMLHeadingElement>(null);

  function goToSection(idx: 0 | 1) {
    setActiveSection(idx);
    if (sectionsRef.current) {
      const w = sectionsRef.current.clientWidth;
      sectionsRef.current.scrollTo({ left: idx * w, behavior: 'smooth' });
    }
    // Scroll que deja las sub-pestañas visibles (no las esconde bajo el
    // sticky header). El anchor tiene scroll-margin-top, asi que el browser
    // descuenta esa distancia al hacer scrollIntoView.
    if (sectionsAnchorRef.current) {
      sectionsAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleSectionsScroll() {
    if (!sectionsRef.current) return;
    const left = sectionsRef.current.scrollLeft;
    const w = sectionsRef.current.clientWidth || 1;
    const idx = Math.round(left / w);
    if (idx === 0 || idx === 1) setActiveSection(idx as 0 | 1);
  }

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
        <div className="bg-[#008080] shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
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
              <button
                type="button"
                onClick={() => goToSection(1)}
                aria-label="Ver comentarios"
                className="flex items-center gap-1 flex-shrink-0 px-2 py-1 -mx-2 -my-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-bold text-white">{pro.averageRating}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Hero: Fixed photo background, content scrolls over it ─── */}
      <div className="relative" style={{ height: '72vh' }}>
        {/* Photo stays fixed in place */}
        <div className="fixed inset-0 z-0" style={{ height: '72vh' }}>
          {pro.coverImageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${API_URL}${pro.coverImageUrl})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
            </div>
          ) : hasAvatar ? (
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
          className="fixed left-4 z-30 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors"
          style={{ top: 'calc(env(safe-area-inset-top) + 1rem)', display: showStickyHeader ? 'none' : undefined }}
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Rating badge (over hero) — click lleva a Comentarios */}
        {pro.averageRating && (
          <button
            type="button"
            onClick={() => goToSection(1)}
            aria-label="Ver comentarios de clientes"
            className="fixed right-4 z-30 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors"
            style={{ top: 'calc(env(safe-area-inset-top) + 1rem)', display: showStickyHeader ? 'none' : undefined }}
          >
            <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xl font-bold text-white">{pro.averageRating}</span>
          </button>
        )}

        {/* Hero content — positioned at bottom, scrolls with page */}
        <div className="relative z-10 flex flex-col justify-end min-h-[72vh] px-6 pb-8 max-w-3xl mx-auto">
          {/* Business badge */}
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white/90 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#008080]" />
              {pro.businessName}
            </span>
          </div>

          {/* Name — this is the ref we track for sticky */}
          <h1
            ref={nameRef}
            className="text-xl font-bold text-white mb-1 leading-tight"
          >
            {fullName}
          </h1>

          {/* Bio */}
          {pro.bio && (
            <p
              className="text-xs text-white/75 leading-relaxed max-w-xl mb-3 max-h-28 overflow-y-auto pr-1 whitespace-pre-line"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}
            >
              {pro.bio}
            </p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-2 mb-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md">
              <svg className="w-4 h-4 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div>
                <p className="text-base font-bold text-white leading-none">{pro.completedAppointments}</p>
                <p className="text-[9px] text-white/60 uppercase tracking-wider">Trabajos realizados</p>
              </div>
            </div>

            {specialty && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-white leading-none">{specialty}</p>
                  <p className="text-[9px] text-white/60 uppercase tracking-wider">Especialidad</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Content below hero (white bg covers the fixed photo) ─── */}
      <div className="relative z-10 bg-gray-50 min-h-screen pb-20">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

          {/* Servicios que ofrece — listado completo del catálogo del
              empleado. Click en una tarjeta abre el booking con ese
              servicio + este profesional preseleccionados. */}
          {pro.services && pro.services.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Servicios de {pro.firstName}{' '}
                <span className="text-xs text-gray-400 font-normal">({pro.services.length})</span>
              </h2>
              <div className="grid gap-3">
                {pro.services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (fromAdmin) return;
                      router.push(`/marketplace/${tenantSlug}?bookEmployee=${employeeId}&service=${s.id}`);
                    }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${fromAdmin ? 'cursor-default' : 'hover:border-[#008080]/40'}`}
                    style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        {s.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">{s.description}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: s.currency || 'MXN' }).format(Number(s.price))}
                        </p>
                        <p className="text-xs text-gray-500">{s.durationMinutes} min</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ─── Tabs + swiper horizontal: Trabajos | Comentarios ─── */}
          <div
            ref={sectionsAnchorRef}
            style={{ scrollMarginTop: 'calc(env(safe-area-inset-top) + 4.5rem)' }}
          >
            {/* Tabs Trabajos | Comentarios — estilo segmentado estandar */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-3">
              <button
                type="button"
                onClick={() => goToSection(0)}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeSection === 0 ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Trabajos
                {pro.portfolio.length > 0 && (
                  <span className={`ml-1.5 text-[10px] font-normal ${activeSection === 0 ? 'text-white/70' : 'text-gray-400'}`}>({pro.portfolio.length})</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => goToSection(1)}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                  activeSection === 1 ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Comentarios
                {pro.reviews.length > 0 && (
                  <span className={`ml-1.5 text-[10px] font-normal ${activeSection === 1 ? 'text-white/70' : 'text-gray-400'}`}>({pro.reviews.length})</span>
                )}
              </button>
            </div>

            {/* Swiper horizontal (snap-x) — cada page exactamente al 100% del
                contenedor, sin overflow lateral, asi no se asoma la siguiente. */}
            <div
              ref={sectionsRef}
              onScroll={handleSectionsScroll}
              className="flex overflow-x-auto snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none' }}
            >
              {/* ─── Page 1: Trabajos ─── */}
              <div className="flex-shrink-0 w-full snap-start">
                {pro.portfolio.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      Aún no hay trabajos publicados. Las fotos aparecerán aquí automáticamente al cerrar cada cita.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Tabs de categorias (servicio) */}
                    {(() => {
                      const allCats = Array.from(
                        new Set(pro.portfolio.flatMap((p) => p.services.map((s) => s.name))),
                      ).sort((a, b) => a.localeCompare(b, 'es'));
                      return (
                        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
                          <button
                            type="button"
                            onClick={() => setActiveCategory('all')}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              activeCategory === 'all'
                                ? 'bg-[#008080] text-white border-[#008080]'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Todos
                          </button>
                          {allCats.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setActiveCategory(cat)}
                              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                activeCategory === cat
                                  ? 'bg-[#008080] text-white border-[#008080]'
                                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Grid de fotos filtradas */}
                    {(() => {
                      const filtered = activeCategory === 'all'
                        ? pro.portfolio
                        : pro.portfolio.filter((p) => p.services.some((s) => s.name === activeCategory));
                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-8 text-sm text-gray-400">
                            No hay trabajos en esta categoría aún.
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-3 gap-1">
                          {filtered.map((img) => (
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
                              {/* Etiqueta de servicios — solo en "Todos"
                                  (redundante si estamos filtrando por uno) */}
                              {activeCategory === 'all' && img.services.length > 0 && (
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                                  <p className="text-[10px] text-white/95 font-medium truncate">
                                    {img.services.map((s) => s.name).join(' · ')}
                                  </p>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* ─── Page 2: Comentarios ─── */}
              <div className="flex-shrink-0 w-full snap-start">
                {pro.reviews.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      <span className="font-medium text-gray-700">{fullName}</span> aún no cuenta con reseñas de clientes.
                    </p>
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          </div>

          {/* Empty state — solo si no hay nada en absoluto */}
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

      {/* Floating CTA — escondido en modo preview admin (no se permite reservar) */}
      {!fromAdmin && (
        <div className="fixed bottom-20 left-0 right-0 px-6 pointer-events-none z-30">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <button
              onClick={() => router.push(`/marketplace/${pro.tenantSlug}?bookEmployee=${employeeId}`)}
              className="w-full py-3 rounded-2xl font-semibold text-sm text-white shadow-lg transition-colors"
              style={{ backgroundColor: '#008080', boxShadow: '0 4px 16px rgba(0,128,128,0.4)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006666')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008080')}
            >
              Agendar cita
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
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
