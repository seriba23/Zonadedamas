'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useClientAuth } from '@/lib/hooks/use-client-auth';
import { portalApi } from '@/lib/portal-api';
import { formatDate } from '@/lib/utils';
import PortalNav from '../portal-nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ServiceGroup {
  serviceName: string;
  serviceId: string;
  totalAppointments: number;
  totalPhotos: number;
  appointments: {
    id: string;
    startTime: string;
    status: string;
    employee: { id: string; firstName: string; lastName: string };
    photos: { id: string; imageUrl: string; caption: string | null; createdAt: string }[];
    review: { id: string; rating: number; comment: string | null } | null;
    items: { serviceNameSnapshot: string }[];
  }[];
}

export default function PortalHistoryPage() {
  const { isAuthenticated, isLoading: authLoading, tenantSlug } = useClientAuth();
  const router = useRouter();
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/portal/${tenantSlug}/login`);
    }
  }, [authLoading, isAuthenticated, router, tenantSlug]);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-service-history'],
    queryFn: () => portalApi.get<{ data: ServiceGroup[] }>('/service-history'),
    enabled: isAuthenticated,
  });

  const history: ServiceGroup[] = (data as any)?.data || [];

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Historial de servicios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tus servicios completados con fotos y reseñas
        </p>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-2">No tienes servicios completados aún</p>
            <p className="text-sm text-gray-400">
              Aquí verás tu historial con fotos de resultados
            </p>
          </div>
        ) : (
          history.map((group) => {
            const isExpanded = expandedService === group.serviceName;
            return (
              <div
                key={group.serviceName}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedService(isExpanded ? null : group.serviceName)
                  }
                  className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {group.serviceName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {group.totalAppointments} cita
                      {group.totalAppointments !== 1 ? 's' : ''}
                      {group.totalPhotos > 0 &&
                        ` · ${group.totalPhotos} foto${group.totalPhotos !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {group.appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="px-5 py-4 border-b border-gray-50 last:border-b-0"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDate(apt.startTime, 'D [de] MMM YYYY')}
                            </p>
                            <p className="text-xs text-gray-500">
                              Con {apt.employee.firstName} {apt.employee.lastName}
                            </p>
                          </div>
                          {apt.review && (
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`w-3.5 h-3.5 ${
                                    star <= apt.review!.rating
                                      ? 'text-amber-400'
                                      : 'text-gray-200'
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Photos grid */}
                        {apt.photos.length > 0 && (
                          <div className="grid grid-cols-4 gap-1.5 mt-2">
                            {apt.photos.map((photo) => (
                              <button
                                key={photo.id}
                                onClick={() => setSelectedPhoto(photo.imageUrl)}
                                className="aspect-square rounded-lg overflow-hidden bg-gray-100"
                              >
                                <img
                                  src={`${API_URL}${photo.imageUrl}`}
                                  alt={photo.caption || 'Resultado'}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}

                        {apt.review?.comment && (
                          <p className="text-xs text-gray-500 mt-2 italic">
                            &ldquo;{apt.review.comment}&rdquo;
                          </p>
                        )}

                        {!apt.review && (
                          <button
                            onClick={() =>
                              router.push(
                                `/portal/${tenantSlug}/appointments/${apt.id}`,
                              )
                            }
                            className="text-xs text-amber-600 font-medium mt-2 hover:text-amber-700"
                          >
                            Dejar reseña
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setSelectedPhoto(null)}
        >
          <img
            src={`${API_URL}${selectedPhoto}`}
            alt="Resultado"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      <PortalNav />
    </div>
  );
}
