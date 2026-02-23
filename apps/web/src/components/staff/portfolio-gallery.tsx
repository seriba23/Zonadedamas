'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiResponse } from '@/lib/api';

interface PortfolioImage {
  id: string;
  imageUrl: string;
  caption?: string | null;
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
              alt={img.caption || 'Portfolio'}
              className="w-full h-full object-cover"
            />
            {img.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-xs text-white truncate">{img.caption}</p>
              </div>
            )}
          </div>
        ))}

        {images.length === 0 && !canEdit && (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-400 text-sm">No hay fotos en el portfolio</p>
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
              alt={lightboxImage.caption || 'Portfolio'}
              className="w-full h-full object-contain rounded-lg"
            />
            {lightboxImage.caption && (
              <p className="text-white text-sm mt-2 text-center">
                {lightboxImage.caption}
              </p>
            )}
            <div className="absolute top-2 right-2 flex gap-2">
              {canEdit && (
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
