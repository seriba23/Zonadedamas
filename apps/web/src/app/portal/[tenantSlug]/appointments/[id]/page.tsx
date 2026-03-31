'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientAuth } from '@/lib/hooks/use-client-auth';
import { portalApi } from '@/lib/portal-api';
import { formatCurrency, formatDate } from '@/lib/utils';
import dayjs from 'dayjs';
import { DualReviewModal } from '@/components/ui/dual-review-modal';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'No asistió', color: 'bg-gray-100 text-gray-800' },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AppointmentDetailPage() {
  const { isAuthenticated, isLoading: authLoading, tenantSlug } = useClientAuth();
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;
  const queryClient = useQueryClient();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/portal/${tenantSlug}/login`);
    }
  }, [authLoading, isAuthenticated, router, tenantSlug]);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-appointment', appointmentId],
    queryFn: () => portalApi.get<{ data: any }>(`/appointments/${appointmentId}`),
    enabled: isAuthenticated,
  });

  const appointment = (data as any)?.data;

  // Auto-show review modal when appointment is COMPLETED and has no review
  useEffect(() => {
    if (appointment?.status === 'COMPLETED' && !appointment?.review) {
      setShowReviewModal(true);
    }
  }, [appointment?.status, appointment?.review]);

  const cancelMutation = useMutation({
    mutationFn: () =>
      portalApi.post(`/appointments/${appointmentId}/cancel`, {
        reason: cancelReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-appointment'] });
      queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
      setShowCancelModal(false);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { rating: number; comment?: string; businessRating?: number; businessComment?: string }) =>
      portalApi.post(`/appointments/${appointmentId}/review`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-appointment'] });
      setShowReviewModal(false);
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!appointment) return null;

  const status = STATUS_LABELS[appointment.status] || STATUS_LABELS.PENDING;
  const totalPrice = appointment.items.reduce(
    (sum: number, i: any) => sum + Number(i.priceSnapshot),
    0,
  );
  const canCancel = ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(appointment.status);
  const canReview = appointment.status === 'COMPLETED' && !appointment.review;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Detalle de cita</h1>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Status + Date */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-lg font-bold text-gray-900">
                {formatDate(appointment.startTime, 'ddd, D [de] MMMM')}
              </p>
              <p className="text-sm text-gray-500">
                {dayjs(appointment.startTime).format('h:mm A')} -{' '}
                {dayjs(appointment.endTime).format('h:mm A')}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>

          {/* Employee */}
          <div className="flex items-center gap-3 py-3 border-t border-gray-100">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
              style={{ backgroundColor: appointment.employee.color }}
            >
              {appointment.employee.avatarUrl ? (
                <img src={`${API_URL}${appointment.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <>{appointment.employee.firstName[0]}{appointment.employee.lastName[0]}</>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {appointment.employee.firstName} {appointment.employee.lastName}
              </p>
              <p className="text-xs text-gray-500">Profesional</p>
            </div>
          </div>

          {/* Services */}
          <div className="py-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Servicios</p>
            {appointment.items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-700">{item.serviceNameSnapshot}</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(Number(item.priceSnapshot))}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(totalPrice)}
              </span>
            </div>
          </div>

          {/* Location */}
          {appointment.location && (
            <div className="py-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1">Ubicación</p>
              <p className="text-sm text-gray-700">{appointment.location.name}</p>
              {appointment.location.address && (
                <p className="text-xs text-gray-500">{appointment.location.address}</p>
              )}
            </div>
          )}
        </div>

        {/* Photos */}
        {appointment.photos?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              Fotos de resultado
            </p>
            <div className="grid grid-cols-3 gap-2">
              {appointment.photos.map((photo: any) => (
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
          </div>
        )}

        {/* Review */}
        {appointment.review && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-2">Tu reseña</p>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className={`w-5 h-5 ${
                    star <= appointment.review.rating
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
            {appointment.review.comment && (
              <p className="text-sm text-gray-600">{appointment.review.comment}</p>
            )}
          </div>
        )}

        {/* Invite to review */}
        {canReview && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            ⭐ Dejar una calificación
          </button>
        )}

        {/* Actions */}
        {canCancel && (
          <div className="space-y-2">
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Cancelar cita
            </button>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Cancelar cita?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Esta acción no se puede deshacer.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo de cancelación (opcional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-20 mb-4 focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dual Review Modal */}
      <DualReviewModal
        show={showReviewModal}
        employeeName={appointment?.employee ? `${appointment.employee.firstName} ${appointment.employee.lastName}` : 'el profesional'}
        businessName={appointment?.tenant?.name || 'el negocio'}
        onSubmit={(data) => reviewMutation.mutate(data)}
        onSkip={() => setShowReviewModal(false)}
        isLoading={reviewMutation.isPending}
      />

      {/* Photo Lightbox */}
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
    </div>
  );
}
