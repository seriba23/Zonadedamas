'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import dayjs from 'dayjs';
import { DatePicker } from '@/components/ui/date-picker';
import { CloseAppointmentWizard } from './close-wizard';

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
  notes: string | null;
  photoConsent: boolean | null;
  client: { id: string; firstName: string; lastName: string; email?: string; phone?: string };
  items: AppointmentItem[];
}

type RangeFilter = 'today' | 'week' | 'month' | 'custom';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Ausente', color: 'bg-gray-100 text-gray-800' },
};

function getDateRange(range: RangeFilter, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const today = dayjs();
  switch (range) {
    case 'today':
      return { startDate: today.format('YYYY-MM-DD'), endDate: today.format('YYYY-MM-DD') };
    case 'week':
      return { startDate: today.startOf('week').format('YYYY-MM-DD'), endDate: today.endOf('week').format('YYYY-MM-DD') };
    case 'month':
      return { startDate: today.startOf('month').format('YYYY-MM-DD'), endDate: today.endOf('month').format('YYYY-MM-DD') };
    case 'custom':
      return { startDate: customStart || today.format('YYYY-MM-DD'), endDate: customEnd || today.format('YYYY-MM-DD') };
  }
}

export default function EmployeeAppointmentsPage() {
  const { user } = useAuth();
  const currency = useCurrency();
  const formatCurrency = currency.format || ((v: number) => `$${Number(v).toFixed(2)}`);
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeFilter>('today');
  const [customStart, setCustomStart] = useState(dayjs().format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [wizardApt, setWizardApt] = useState<Appointment | null>(null);

  const { startDate, endDate } = getDateRange(range, customStart, customEnd);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['employee-appointments', user?.employeeId, startDate, endDate],
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
      api.post(`/api/appointments/${id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
      setSelectedApt(null);
    },
  });

  const handleWizardDone = () => {
    queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
    setWizardApt(null);
    setSelectedApt(null);
  };

  const noShowMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/appointments/${id}/no-show`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
      setSelectedApt(null);
    },
  });

  const sorted = (appointments || [])
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Group by date for week/month view
  const grouped = new Map<string, Appointment[]>();
  sorted.forEach((apt) => {
    const dateKey = dayjs(apt.startTime).format('YYYY-MM-DD');
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(apt);
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Mis Citas</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {([
              { key: 'today' as RangeFilter, label: 'Día' },
              { key: 'week' as RangeFilter, label: 'Semana' },
              { key: 'month' as RangeFilter, label: 'Mes' },
              { key: 'custom' as RangeFilter, label: 'Personalizado' },
            ]).map((filter) => (
              <button
                key={filter.key}
                onClick={() => setRange(filter.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 ${
                  range === filter.key
                    ? 'bg-[#008080] text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input-field w-auto text-sm py-1.5" />
              <span className="text-gray-500">-</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input-field w-auto text-sm py-1.5" />
            </div>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {!isLoading && sorted.length > 0 && (
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-500">
            {sorted.length} cita{sorted.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            {sorted.filter((a) => a.status === 'COMPLETED').length} completada{sorted.filter((a) => a.status === 'COMPLETED').length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-700">
            {formatCurrency(sorted.filter((a) => a.status === 'COMPLETED').reduce((s, a) => s + a.items.reduce((ss, i) => ss + Number(i.priceSnapshot), 0), 0))} generados
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No hay citas en este período
          </div>
        ) : range === 'today' ? (
          <ul className="divide-y divide-gray-100">
            {sorted.map((apt) => (
              <AppointmentRow
                key={apt.id}
                apt={apt}
                showDate={false}
                onClick={() => setSelectedApt(apt)}
              />
            ))}
          </ul>
        ) : (
          <div>
            {Array.from(grouped.entries()).map(([dateKey, apts]) => (
              <div key={dateKey}>
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    {dayjs(dateKey).format('dddd, D [de] MMMM')}
                  </p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {apts.map((apt) => (
                    <AppointmentRow
                      key={apt.id}
                      apt={apt}
                      showDate={false}
                      onClick={() => setSelectedApt(apt)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedApt && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setSelectedApt(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Detalle de cita</h3>
                <button
                  onClick={() => setSelectedApt(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status */}
              {(() => {
                const st = STATUS_LABELS[selectedApt.status] || STATUS_LABELS.PENDING;
                return (
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 ${st.color}`}>
                    {st.label}
                  </span>
                );
              })()}

              {/* Date/Time */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {dayjs(selectedApt.startTime).format('dddd, D [de] MMMM YYYY')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dayjs(selectedApt.startTime).format('h:mm A')} - {dayjs(selectedApt.endTime).format('h:mm A')}
                    </p>
                  </div>
                </div>

                {/* Client */}
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedApt.client.firstName} {selectedApt.client.lastName}
                    </p>
                    {selectedApt.client.phone && (
                      <p className="text-xs text-gray-500">{selectedApt.client.phone}</p>
                    )}
                    {selectedApt.client.email && (
                      <p className="text-xs text-gray-500">{selectedApt.client.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Services */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Servicios</p>
                {selectedApt.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm text-gray-700">{item.serviceNameSnapshot}</p>
                      <p className="text-xs text-gray-400">{item.durationSnapshot} min</p>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(Number(item.priceSnapshot))}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">Total</span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatCurrency(selectedApt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0))}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {selectedApt.notes && (
                <div className="border-t border-gray-100 pt-4 mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Notas</p>
                  <p className="text-sm text-gray-600">{selectedApt.notes}</p>
                </div>
              )}

              {/* Actions */}
              {['CONFIRMED', 'IN_PROGRESS'].includes(selectedApt.status) && (
                <div className="border-t border-gray-100 pt-4 flex gap-2">
                  <button
                    onClick={() => setWizardApt(selectedApt)}
                    className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors"
                    style={{ backgroundColor: '#008080' }}
                  >
                    Cerrar cita
                  </button>
                  <button
                    onClick={() => noShowMutation.mutate(selectedApt.id)}
                    disabled={noShowMutation.isPending}
                    className="py-2.5 px-4 text-sm font-medium border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Ausente
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Close Wizard */}
      {wizardApt && (
        <CloseAppointmentWizard
          appointment={wizardApt}
          onDone={handleWizardDone}
          onClose={() => setWizardApt(null)}
        />
      )}
    </div>
  );
}

function AppointmentRow({
  apt,
  showDate,
  onClick,
}: {
  apt: Appointment;
  showDate: boolean;
  onClick: () => void;
}) {
  const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;
  const totalPrice = apt.items.reduce(
    (sum, i) => sum + Number(i.priceSnapshot),
    0,
  );

  return (
    <li
      className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[80px]">
            {showDate && (
              <p className="text-xs text-gray-400">
                {dayjs(apt.startTime).format('ddd D MMM')}
              </p>
            )}
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
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </li>
  );
}
