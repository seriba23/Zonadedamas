'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiResponse } from '@/lib/api';

interface PortfolioImage {
  id: string;
  imageUrl: string;
  caption?: string | null;
  isHidden?: boolean;
  createdAt: string;
}

interface PortfolioGalleryProps {
  employeeId: string;
  canEdit: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function PortfolioGallery({ employeeId, canEdit }: PortfolioGalleryProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxImage, setLightboxImage] = useState<PortfolioImage | null>(null);

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
      // Mantenemos el lightbox abierto pero con el estado actualizado.
      if (lightboxImage?.id === variables.imageId) {
        setLightboxImage({ ...lightboxImage, isHidden: variables.isHidden });
      }
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
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
    e.target.value = ''; // Reset input
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {canEdit && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-400 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary-500 transition-colors"
          >
            {uploadMutation.isPending ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            ) : (
              <>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">Agregar foto</span>
              </>
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

        {images.map((img) => (
          <div
            key={img.id}
            className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer"
            onClick={() => setLightboxImage(img)}
          >
            <img
              src={`${API_URL}${img.imageUrl}`}
              alt={img.caption || 'Portafolio'}
              className={`w-full h-full object-cover ${img.isHidden ? 'opacity-50 grayscale' : ''}`}
            />
            {img.isHidden && (
              <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-900/80 text-white text-[10px] font-semibold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
                Oculta
              </span>
            )}
            {img.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-xs text-white truncate">{img.caption}</p>
              </div>
            )}
          </div>
        ))}

        {images.length === 0 && !canEdit && (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-400 text-sm">No hay fotos en el portafolio</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
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
              <p className="text-white text-sm mt-2 text-center">
                {lightboxImage.caption}
              </p>
            )}
            <div className="absolute top-2 right-2 flex gap-2">
              {canEdit && (
                <>
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
