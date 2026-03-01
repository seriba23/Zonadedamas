'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import { formatCurrency } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export default function BusinessDetailPage() {
  const { isAuthenticated, enterBusiness } = useMarketplaceAuth();
  const router = useRouter();
  const params = useParams();
  const tenantSlug = params.tenantSlug as string;
  const [entering, setEntering] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-business', tenantSlug],
    queryFn: () => marketplaceApi.get<{ data: any }>(`/discover/${tenantSlug}`),
  });

  const biz = (data as any)?.data;

  const handleBook = async () => {
    if (!isAuthenticated) {
      router.push(`/marketplace/login?redirect=/marketplace/${tenantSlug}`);
      return;
    }

    setEntering(true);
    try {
      await enterBusiness(tenantSlug);
      router.push(`/portal/${tenantSlug}/book`);
    } catch (err: any) {
      alert(err.message || 'Error al entrar al negocio');
    } finally {
      setEntering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!biz) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Negocio no encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header / Cover */}
      <div className="relative">
        <div className="h-48 bg-gradient-to-r from-indigo-500 to-purple-500">
          {biz.coverImageUrl && (
            <img
              src={`${API_URL}${biz.coverImageUrl}`}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <button
          onClick={() => router.push('/marketplace')}
          className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur rounded-full hover:bg-white transition-colors"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 relative">
        {/* Business info card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow">
              {biz.logoUrl ? (
                <img src={`${API_URL}${biz.logoUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-gray-400">{biz.name[0]}</span>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">{biz.name}</h1>
              {biz.businessType && (
                <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-full mt-1">
                  {biz.businessType === 'SALON' ? 'Salón' :
                   biz.businessType === 'BARBERIA' ? 'Barbería' :
                   biz.businessType === 'CLINICA' ? 'Clínica' :
                   biz.businessType}
                </span>
              )}
              {biz.averageRating != null && (
                <div className="flex items-center gap-1 mt-2">
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700">{biz.averageRating}</span>
                  <span className="text-xs text-gray-400">({biz.totalReviews} reseñas)</span>
                </div>
              )}
            </div>
          </div>

          {biz.description && (
            <p className="text-sm text-gray-600 mt-4">{biz.description}</p>
          )}

          {/* Location */}
          {biz.locations?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              {biz.locations.map((loc: any) => (
                <div key={loc.id} className="flex items-start gap-2 text-sm text-gray-500">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>{loc.address || loc.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Services */}
        {biz.services?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Servicios</h2>
            <div className="space-y-3">
              {biz.services.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.durationMinutes} min</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(s.price))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employees */}
        {biz.employees?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Profesionales</h2>
            <div className="grid grid-cols-2 gap-3">
              {biz.employees.map((emp: any) => (
                <div key={emp.id} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: emp.color }}
                  >
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {emp.firstName} {emp.lastName}
                    </p>
                    {emp.bio && (
                      <p className="text-xs text-gray-500 truncate">{emp.bio}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business Hours */}
        {biz.businessHours?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Horario</h2>
            <div className="space-y-1.5">
              {biz.businessHours.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{DAY_LABELS[h.dayOfWeek] || h.dayOfWeek}</span>
                  {h.isOpen ? (
                    <span className="text-gray-900 font-medium">{h.openTime} - {h.closeTime}</span>
                  ) : (
                    <span className="text-gray-400">Cerrado</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {biz.reviews?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Reseñas recientes</h2>
            <div className="space-y-4">
              {biz.reviews.map((r: any) => (
                <div key={r.id} className="border-b border-gray-50 last:border-b-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{r.clientName}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-3.5 h-3.5 ${star <= r.rating ? 'text-amber-400' : 'text-gray-200'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-xs text-gray-500">{r.comment}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Con {r.employeeName}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleBook}
            disabled={entering}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {entering ? 'Entrando...' : 'Reservar cita'}
          </button>
        </div>
      </div>
    </div>
  );
}
