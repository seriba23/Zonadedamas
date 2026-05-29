'use client';

import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiResponse } from '@/lib/api';

interface PortfolioImage {
  id: string;
  imageUrl: string;
  caption?: string | null;
  isHidden?: boolean;
  isFeatured?: boolean;
  services?: { id: string; name: string }[];
  createdAt: string;
}

interface PortfolioGalleryProps {
  employeeId: string;
  canEdit: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';

type VisibilityFilter = 'all' | 'visible' | 'hidden' | 'featured';
type SortKey = 'recent' | 'oldest';

export function PortfolioGallery({ employeeId, canEdit }: PortfolioGalleryProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxImage, setLightboxImage] = useState<PortfolioImage | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(''); // service id, '' = todos
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['employee-portfolio', employeeId],
    queryFn: () =>
      api.get<ApiResponse<PortfolioImage[]>>(
        `/api/employees/${employeeId}/portfolio`,
      ),
  });
  const images = data?.data || [];

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      api.upload(`/api/employees/${employeeId}/portfolio`, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-portfolio', employeeId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) =>
      api.delete(`/api/employees/${employeeId}/portfolio/${imageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-portfolio', employeeId] });
      setLightboxImage(null);
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ imageId, isHidden }: { imageId: string; isHidden: boolean }) =>
      api.patch(`/api/employees/${employeeId}/portfolio/${imageId}/visibility`, { isHidden }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-portfolio', employeeId] });
      if (lightboxImage?.id === variables.imageId) {
        setLightboxImage({ ...lightboxImage, isHidden: variables.isHidden });
      }
    },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ imageId, isFeatured }: { imageId: string; isFeatured: boolean }) =>
      api.patch(`/api/employees/${employeeId}/portfolio/${imageId}/featured`, { isFeatured }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-portfolio', employeeId] });
      if (lightboxImage?.id === variables.imageId) {
        setLightboxImage({ ...lightboxImage, isFeatured: variables.isFeatured });
      }
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Solo se permiten archivos JPEG, PNG o WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo no puede superar 5MB');
      return;
    }

    uploadMutation.mutate(file);
    e.target.value = '';
  }

  // Categorias derivadas de los services unicos de las imagenes.
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of images) {
      for (const s of img.services || []) {
        if (!map.has(s.id)) map.set(s.id, s.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [images]);

  // Pipeline de filtros: categoria + visibilidad + busqueda + sort.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = images.filter((img) => {
      if (activeCategory && !(img.services || []).some((s) => s.id === activeCategory)) return false;
      if (visibilityFilter === 'visible' && img.isHidden) return false;
      if (visibilityFilter === 'hidden' && !img.isHidden) return false;
      if (visibilityFilter === 'featured' && !img.isFeatured) return false;
      if (q) {
        const haystack = [img.caption || '', ...(img.services || []).map((s) => s.name)]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    result = [...result].sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return sortBy === 'recent' ? bt - at : at - bt;
    });
    return result;
  }, [images, activeCategory, visibilityFilter, search, sortBy]);

  const hasFilters = !!search || !!activeCategory || visibilityFilter !== 'all' || sortBy !== 'recent';

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* ─── Header: busqueda + filtros + upload ─────────── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar foto, servicio…"
            className="w-full bg-white border border-gray-200 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#008080]"
          />
        </div>
        <button
          onClick={() => setShowFiltersSheet(true)}
          title="Filtros"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
          style={hasFilters
            ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
            : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
          }
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          {hasFilters && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
          )}
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            title="Agregar foto"
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-colors"
            style={{ backgroundColor: TEAL, border: '1.5px solid ' + TEAL }}
          >
            {uploadMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </button>
        )}
      </div>

      {/* ─── Tabs categorias ─────────────────────────── */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveCategory('')}
            className="px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors flex-shrink-0"
            style={!activeCategory
              ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
              : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
            }
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors flex-shrink-0"
              style={activeCategory === cat.id
                ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
              }
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ─── Grid ─────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">
            {hasFilters ? 'Sin resultados para los filtros aplicados' : 'No hay fotos en el portafolio'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {filtered.map((img) => (
            <div
              key={img.id}
              className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
              onClick={() => setLightboxImage(img)}
            >
              <img
                src={`${API_URL}${img.imageUrl}`}
                alt={img.caption || 'Portafolio'}
                className={`w-full h-full object-cover ${img.isHidden ? 'opacity-50 grayscale' : ''}`}
              />
              {img.isFeatured && (
                <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-white text-[10px] font-bold shadow-sm">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </span>
              )}
              {img.isHidden && (
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-900/80 text-white text-[10px] font-semibold">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                </span>
              )}
              {img.services && img.services.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-[10px] text-white font-medium truncate">
                    {img.services.map((s) => s.name).join(' · ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Bottom sheet filtros ────────────────────── */}
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
              {hasFilters && (
                <button
                  onClick={() => { setSearch(''); setActiveCategory(''); setVisibilityFilter('all'); setSortBy('recent'); }}
                  className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                  style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Limpiar filtros
                </button>
              )}

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Visibilidad</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {([
                  { value: 'all', label: 'Todas' },
                  { value: 'visible', label: 'Visibles' },
                  { value: 'hidden', label: 'Ocultas' },
                  { value: 'featured', label: 'Destacadas' },
                ] as { value: VisibilityFilter; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setVisibilityFilter(opt.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={visibilityFilter === opt.value
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ordenar por</p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'recent', label: 'Más reciente' },
                  { value: 'oldest', label: 'Más antigua' },
                ] as { value: SortKey; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={sortBy === opt.value
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-4" />
          </div>
        </div>
      )}

      {/* ─── Lightbox ─────────────────────────────────── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`${API_URL}${lightboxImage.imageUrl}`}
              alt={lightboxImage.caption || 'Portafolio'}
              className="w-full h-full object-contain rounded-lg"
            />
            {lightboxImage.caption && (
              <p className="text-white text-sm mt-2 text-center">{lightboxImage.caption}</p>
            )}
            <div className="absolute top-2 right-2 flex gap-2">
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleFeaturedMutation.mutate({ imageId: lightboxImage.id, isFeatured: !lightboxImage.isFeatured })}
                    disabled={toggleFeaturedMutation.isPending}
                    className="px-3 py-2 rounded-full transition-colors text-xs font-semibold flex items-center gap-1.5"
                    style={lightboxImage.isFeatured
                      ? { backgroundColor: '#f59e0b', color: 'white' }
                      : { backgroundColor: 'rgba(255,255,255,0.9)', color: '#374151' }
                    }
                    title={lightboxImage.isFeatured ? 'Quitar destacado' : 'Destacar foto'}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill={lightboxImage.isFeatured ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    {lightboxImage.isFeatured ? 'Destacada' : 'Destacar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVisibilityMutation.mutate({ imageId: lightboxImage.id, isHidden: !lightboxImage.isHidden })}
                    disabled={toggleVisibilityMutation.isPending}
                    className="px-3 py-2 bg-white/90 text-gray-700 rounded-full hover:bg-white transition-colors text-xs font-semibold flex items-center gap-1.5"
                    title={lightboxImage.isHidden ? 'Mostrar en perfil publico' : 'Ocultar del perfil publico'}
                  >
                    {lightboxImage.isHidden ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Mostrar
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                        Ocultar
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(lightboxImage.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
