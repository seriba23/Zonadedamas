'use client';

import { StarRating } from './star-rating';
import { formatDate } from '@/lib/utils';

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
    client: { firstName: string; lastName: string };
    appointment: {
      startTime: string;
      items: Array<{ serviceNameSnapshot: string }>;
    };
  };
}

export function ReviewCard({ review }: ReviewCardProps) {
  const services = review.appointment.items
    .map((i) => i.serviceNameSnapshot)
    .join(', ');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 text-sm">
            {review.client.firstName} {review.client.lastName}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Cita del {formatDate(review.appointment.startTime, 'D MMM YYYY')}
          </p>
        </div>
        <StarRating rating={review.rating} size="sm" />
      </div>

      {services && (
        <div className="mt-2 flex flex-wrap gap-1">
          {review.appointment.items.map((item, i) => (
            <span
              key={i}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
            >
              {item.serviceNameSnapshot}
            </span>
          ))}
        </div>
      )}

      {review.comment && (
        <p className="mt-2 text-sm text-gray-600">{review.comment}</p>
      )}
    </div>
  );
}
