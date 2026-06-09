'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';

interface TenantReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}

interface EmployeeReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  businessRating: number | null;
  businessComment: string | null;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null; color: string | null };
  client: { id: string; firstName: string; lastName: string };
  appointment: { id: string; startTime: string; items: { serviceNameSnapshot: string }[] } | null;
}

interface ReviewsPayload {
  summary: {
    businessAverage: number | null;
    businessTotal: number;
    employeeAverage: number | null;
    employeeTotal: number;
  };
  tenantReviews: TenantReviewItem[];
  employeeReviews: EmployeeReviewItem[];
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

function Initials({ firstName, lastName, color }: { firstName: string; lastName: string; color?: string | null }) {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const bg = color ? `${color}22` : '#e5e7eb';
  const fg = color || '#374151';
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{ backgroundColor: bg, color: fg }}
    >
      {initials}
    </div>
  );
}

function Avatar({
  firstName,
  lastName,
  avatarUrl,
  color,
}: {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  color?: string | null;
}) {
  if (avatarUrl) {
    return (
      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
        <img src={`${API_URL}${avatarUrl}`} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return <Initials firstName={firstName} lastName={lastName} color={color} />;
}

export default function ReviewsPage() {
  const [tab, setTab] = useState<'business' | 'employees'>('business');

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-reviews-owner'],
    queryFn: async () => {
      const res = await api.get<{ data: ReviewsPayload }>('/api/tenants/reviews');
      return res.data;
    },
  });

  const summary = data?.summary;
  const tenantReviews = data?.tenantReviews || [];
  const employeeReviews = data?.employeeReviews || [];

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Reseñas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Calificaciones que tu negocio y tu equipo han recibido de los clientes.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-[#008080] rounded-full" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Negocio</p>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-3xl font-bold text-gray-900">
                  {summary?.businessAverage ?? '—'}
                </p>
                <StarRating rating={Math.round(summary?.businessAverage || 0)} />
              </div>
              <p className="text-xs text-gray-400">
                {summary?.businessTotal || 0} reseña{summary?.businessTotal === 1 ? '' : 's'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Equipo</p>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-3xl font-bold text-gray-900">
                  {summary?.employeeAverage ?? '—'}
                </p>
                <StarRating rating={Math.round(summary?.employeeAverage || 0)} />
              </div>
              <p className="text-xs text-gray-400">
                {summary?.employeeTotal || 0} reseña{summary?.employeeTotal === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setTab('business')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === 'business'
                  ? 'bg-[#008080] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Del negocio ({tenantReviews.length + employeeReviews.filter((r) => r.businessRating != null).length})
            </button>
            <button
              type="button"
              onClick={() => setTab('employees')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === 'employees'
                  ? 'bg-[#008080] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Del equipo ({employeeReviews.length})
            </button>
          </div>

          {tab === 'business' && (
            <BusinessReviewsList tenantReviews={tenantReviews} employeeReviews={employeeReviews} />
          )}
          {tab === 'employees' && <EmployeeReviewsList reviews={employeeReviews} />}
        </>
      )}
    </div>
  );
}

function BusinessReviewsList({
  tenantReviews,
  employeeReviews,
}: {
  tenantReviews: TenantReviewItem[];
  employeeReviews: EmployeeReviewItem[];
}) {
  // Reseñas combinadas: TenantReview directas + EmployeeReview con businessRating no nulo.
  type Combined = {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    authorName: string;
    authorAvatarUrl: string | null;
    source: 'tenant' | 'employee';
  };

  const combined: Combined[] = [
    ...tenantReviews.map((r) => ({
      id: `t-${r.id}`,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      authorName: `${r.user.firstName} ${r.user.lastName}`,
      authorAvatarUrl: r.user.avatarUrl,
      source: 'tenant' as const,
    })),
    ...employeeReviews
      .filter((r) => r.businessRating != null)
      .map((r) => ({
        id: `e-${r.id}`,
        rating: r.businessRating!,
        comment: r.businessComment,
        createdAt: r.createdAt,
        authorName: `${r.client.firstName} ${r.client.lastName}`,
        authorAvatarUrl: null,
        source: 'employee' as const,
      })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (combined.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">Aún no tienes reseñas del negocio</p>
        <p className="text-sm text-gray-400 mt-1">
          Aparecerán cuando tus clientes califiquen el negocio o las citas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {combined.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar firstName={r.authorName.split(' ')[0]} lastName={r.authorName.split(' ')[1] || ''} avatarUrl={r.authorAvatarUrl} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.authorName}</p>
                <p className="text-xs text-gray-400">
                  {dayjs(r.createdAt).format('D [de] MMM YYYY')}
                  {r.source === 'employee' && ' · desde una cita'}
                </p>
              </div>
            </div>
            <StarRating rating={r.rating} />
          </div>
          {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}

function EmployeeReviewsList({ reviews }: { reviews: EmployeeReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">Aún no hay reseñas de tu equipo</p>
        <p className="text-sm text-gray-400 mt-1">
          Aparecerán cuando los clientes califiquen sus citas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                firstName={r.employee.firstName}
                lastName={r.employee.lastName}
                avatarUrl={r.employee.avatarUrl}
                color={r.employee.color}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {r.employee.firstName} {r.employee.lastName}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  Cliente: {r.client.firstName} {r.client.lastName}
                  {' · '}
                  {dayjs(r.createdAt).format('D [de] MMM YYYY')}
                </p>
              </div>
            </div>
            <StarRating rating={r.rating} />
          </div>
          {r.comment && <p className="text-sm text-gray-600 mb-2">{r.comment}</p>}
          {r.appointment && r.appointment.items.length > 0 && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">
                Servicio: {r.appointment.items.map((i) => i.serviceNameSnapshot).join(', ')}
                {' · '}
                {dayjs.utc(r.appointment.startTime).format('D MMM YYYY')}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
