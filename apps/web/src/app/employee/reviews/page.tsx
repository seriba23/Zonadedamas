'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import dayjs from 'dayjs';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  client: { id: string; firstName: string; lastName: string };
  appointment: {
    id: string;
    startTime: string;
    items: { serviceNameSnapshot: string }[];
  } | null;
}

interface ReviewsData {
  reviews: Review[];
  averageRating: number | null;
  totalReviews: number;
}

function StarRating({ rating, size = 'w-4 h-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${size} ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function RatingBreakdown({ reviews }: { reviews: Review[] }) {
  const counts = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++;
  });
  const total = reviews.length || 1;

  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = counts[star - 1];
        const pct = Math.round((count / total) * 100);
        return (
          <div key={star} className="flex items-center gap-2 text-sm">
            <span className="w-3 text-gray-500 text-right">{star}</span>
            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div
                className="bg-amber-400 h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-gray-400 text-xs">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function EmployeeReviewsPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['employee-reviews', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: ReviewsData }>(
        `/api/employees/${user!.employeeId}/reviews`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  if (!user?.employeeId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
          Tu cuenta no está vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  const reviews = data?.reviews || [];
  const averageRating = data?.averageRating;
  const totalReviews = data?.totalReviews || 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis Reseñas</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start gap-8">
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-900">
                  {averageRating ?? '-'}
                </p>
                <StarRating rating={Math.round(averageRating || 0)} size="w-5 h-5" />
                <p className="text-sm text-gray-500 mt-1">
                  {totalReviews} reseña{totalReviews !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex-1">
                <RatingBreakdown reviews={reviews} />
              </div>
            </div>
          </div>

          {/* Reviews list */}
          {reviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <span className="text-4xl mb-3 block">⭐</span>
              <p className="text-gray-500">Aún no tienes reseñas</p>
              <p className="text-sm text-gray-400 mt-1">
                Las reseñas aparecerán aquí cuando tus clientes las dejen
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-xl border border-gray-200 p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">
                          {review.client.firstName[0]}{review.client.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {review.client.firstName} {review.client.lastName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {dayjs(review.createdAt).format('D [de] MMM YYYY')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>

                  {review.comment && (
                    <p className="text-sm text-gray-600 mb-3">{review.comment}</p>
                  )}

                  {review.appointment && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">
                        Servicio: {review.appointment.items.map((i) => i.serviceNameSnapshot).join(', ')}
                        {' — '}
                        {dayjs(review.appointment.startTime).format('D MMM YYYY')}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
