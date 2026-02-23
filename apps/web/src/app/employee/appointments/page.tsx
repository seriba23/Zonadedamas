'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import dayjs from 'dayjs';

interface AppointmentItem {
  serviceNameSnapshot: string;
  priceSnapshot: string | number;
  durationSnapshot: number;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  client: { id: string; firstName: string; lastName: string };
  items: AppointmentItem[];
}

type RangeFilter = 'today' | 'week' | 'month';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'No asistió', color: 'bg-gray-100 text-gray-800' },
};

function getDateRange(range: RangeFilter): { startDate: string; endDate: string } {
  const today = dayjs();
  switch (range) {
    case 'today':
      return { startDate: today.format('YYYY-MM-DD'), endDate: today.format('YYYY-MM-DD') };
    case 'week':
      return {
        startDate: today.startOf('week').format('YYYY-MM-DD'),
        endDate: today.endOf('week').format('YYYY-MM-DD'),
      };
    case 'month':
      return {
        startDate: today.startOf('month').format('YYYY-MM-DD'),
        endDate: today.endOf('month').format('YYYY-MM-DD'),
      };
  }
}

export default function EmployeeAppointmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeFilter>('today');

  const { startDate, endDate } = getDateRange(range);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['employee-appointments', user?.employeeId, range],
    queryFn: async () => {
      if (!user?.employeeId) return [];
      const res = await api.get<{ data: Appointment[] }>(
        `/api/appointments?employeeId=${user.employeeId}&startDate=${startDate}&endDate=${endDate}`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/appointments/${id}/status`, { status: 'COMPLETED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
    },
  });

  const sorted = (appointments || [])
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis Citas</h1>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {([
            { key: 'today' as RangeFilter, label: 'Hoy' },
            { key: 'week' as RangeFilter, label: 'Semana' },
            { key: 'month' as RangeFilter, label: 'Mes' },
          ]).map((filter) => (
            <button
              key={filter.key}
              onClick={() => setRange(filter.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                range === filter.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No hay citas en este período
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sorted.map((apt) => {
              const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;
              const totalPrice = apt.items.reduce(
                (sum, i) => sum + Number(i.priceSnapshot),
                0,
              );
              const canComplete = apt.status === 'CONFIRMED';

              return (
                <li key={apt.id} className="px-5 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-gray-400">
                          {dayjs(apt.startTime).format('ddd D MMM')}
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {dayjs(apt.startTime).format('h:mm A')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {dayjs(apt.endTime).format('h:mm A')}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {apt.client.firstName} {apt.client.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(totalPrice)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                      {canComplete && (
                        <button
                          onClick={() => completeMutation.mutate(apt.id)}
                          disabled={completeMutation.isPending}
                          className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          Completar
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
