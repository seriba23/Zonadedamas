'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useClientAuth } from '@/lib/hooks/use-client-auth';
import { portalApi } from '@/lib/portal-api';
import { formatCurrency, formatDate } from '@/lib/utils';
import dayjs from 'dayjs';
import PortalNav from '../portal-nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AppointmentItem {
  id: string;
  serviceNameSnapshot: string;
  priceSnapshot: string | number;
  durationSnapshot: number;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    color: string;
  };
  items: AppointmentItem[];
  review: { id: string; rating: number } | null;
  photos: { id: string }[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Ausente', color: 'bg-gray-100 text-gray-800' },
};

export default function PortalAppointmentsPage() {
  const { client, isAuthenticated, isLoading: authLoading, tenantSlug } = useClientAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/portal/${tenantSlug}/login`);
    }
  }, [authLoading, isAuthenticated, router, tenantSlug]);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-appointments', tab],
    queryFn: () =>
      portalApi.get<{ data: Appointment[] }>(`/appointments?filter=${tab}`),
    enabled: isAuthenticated,
  });

  const appointments = (data as any)?.data || [];

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900">
          Hola, {client?.firstName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Tus citas</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'upcoming' ? 'Próximas' : 'Pasadas'}
          </button>
        ))}
      </div>

      {/* Appointments list */}
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">
              {tab === 'upcoming'
                ? 'No tienes citas próximas'
                : 'No tienes citas pasadas'}
            </p>
            {tab === 'upcoming' && (
              <button
                onClick={() => router.push(`/portal/${tenantSlug}/book`)}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Reservar cita
              </button>
            )}
          </div>
        ) : (
          appointments.map((apt: Appointment) => {
            const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;
            const totalPrice = apt.items.reduce(
              (sum: number, i: AppointmentItem) => sum + Number(i.priceSnapshot),
              0,
            );

            return (
              <button
                key={apt.id}
                onClick={() =>
                  router.push(`/portal/${tenantSlug}/appointments/${apt.id}`)
                }
                className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(apt.startTime, 'ddd, D [de] MMM')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dayjs(apt.startTime).format('h:mm A')} -{' '}
                      {dayjs(apt.endTime).format('h:mm A')}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                    style={{ backgroundColor: apt.employee.color }}
                  >
                    {apt.employee.avatarUrl ? (
                      <img src={`${API_URL}${apt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <>{apt.employee.firstName[0]}{apt.employee.lastName[0]}</>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {apt.employee.firstName} {apt.employee.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">
                    {formatCurrency(totalPrice)}
                  </span>
                  {apt.photos.length > 0 && (
                    <span className="text-indigo-600">
                      {apt.photos.length} foto{apt.photos.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {apt.status === 'COMPLETED' && !apt.review && (
                    <span className="text-amber-600 font-medium">Dejar reseña</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <PortalNav />
    </div>
  );
}
