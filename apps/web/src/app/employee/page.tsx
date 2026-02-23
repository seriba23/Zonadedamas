'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'No asistió', color: 'bg-gray-100 text-gray-800' },
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const today = dayjs().format('YYYY-MM-DD');

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['employee-appointments-today', user?.employeeId],
    queryFn: async () => {
      if (!user?.employeeId) return [];
      const res = await api.get<{ data: Appointment[] }>(
        `/api/appointments?employeeId=${user.employeeId}&startDate=${today}&endDate=${today}`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  const sortedAppointments = (appointments || [])
    .filter((a) => a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const nextAppointment = sortedAppointments.find(
    (a) => new Date(a.startTime) > new Date() && (a.status === 'PENDING' || a.status === 'CONFIRMED'),
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user?.firstName}
        </h1>
        <p className="text-gray-500 mt-1">
          {formatDate(new Date(), 'dddd, D [de] MMMM [de] YYYY')}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📅</span>
            <h3 className="text-sm font-medium text-gray-500">Citas de hoy</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {isLoading ? '...' : sortedAppointments.length}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⏰</span>
            <h3 className="text-sm font-medium text-gray-500">Próxima cita</h3>
          </div>
          {nextAppointment ? (
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {dayjs(nextAppointment.startTime).format('h:mm A')}
              </p>
              <p className="text-sm text-gray-500">
                {nextAppointment.client.firstName} {nextAppointment.client.lastName}
                {' - '}
                {nextAppointment.items.map((i) => i.serviceNameSnapshot).join(', ')}
              </p>
            </div>
          ) : (
            <p className="text-lg text-gray-400">Sin citas pendientes</p>
          )}
        </div>
      </div>

      {/* Today's appointments */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Citas del día</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : sortedAppointments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No tienes citas programadas para hoy
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sortedAppointments.map((apt) => {
              const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;
              const totalPrice = apt.items.reduce(
                (sum, i) => sum + Number(i.priceSnapshot),
                0,
              );

              return (
                <li key={apt.id} className="px-5 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
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
