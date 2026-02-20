'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { CalendarView } from '@/components/calendar/calendar-view';
import { AppointmentModal } from '@/components/appointments/appointment-modal';
import { formatDate } from '@/lib/utils';
import { ConfettiCelebration } from '@/components/ui/confetti-celebration';

type ViewMode = 'day' | 'week';

interface Appointment {
  id: string;
  clientId: string;
  client?: { firstName: string; lastName: string };
  employeeId: string;
  employee?: { firstName: string; lastName: string };
  startTime: string;
  endTime: string;
  status: string;
  items?: Array<{ service?: { name: string; color?: string } }>;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const startDate = viewMode === 'day'
    ? currentDate.startOf('day').toISOString()
    : currentDate.startOf('week').toISOString();
  const endDate = viewMode === 'day'
    ? currentDate.endOf('day').toISOString()
    : currentDate.endOf('week').toISOString();

  const { data, refetch } = useQuery({
    queryKey: ['appointments', startDate, endDate],
    queryFn: () =>
      api.get<{ data: Appointment[] }>(
        `/api/appointments?startDate=${startDate}&endDate=${endDate}`,
      ),
  });

  const appointments = data?.data || [];

  function goToToday() {
    setCurrentDate(dayjs());
  }

  function goBack() {
    setCurrentDate((d) =>
      viewMode === 'day' ? d.subtract(1, 'day') : d.subtract(1, 'week'),
    );
  }

  function goForward() {
    setCurrentDate((d) =>
      viewMode === 'day' ? d.add(1, 'day') : d.add(1, 'week'),
    );
  }

  function handleSlotClick(time: string) {
    setSelectedSlot(time);
    setSelectedAppointmentId(null);
    setIsModalOpen(true);
  }

  function handleAppointmentClick(appointment: Appointment) {
    setSelectedAppointmentId(appointment.id);
    setSelectedSlot(null);
    setIsModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setSelectedSlot(null);
    setSelectedAppointmentId(null);
  }

  function handleModalSave() {
    handleModalClose();
    refetch();
    setShowConfetti(true);
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Calendario" />

      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        {/* Date navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Anterior"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={goToToday}
            className="btn-secondary text-sm px-3 py-1.5"
          >
            Hoy
          </button>

          <button
            onClick={goForward}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Siguiente"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <span className="text-base font-medium text-gray-900">
            {viewMode === 'day'
              ? formatDate(currentDate.toDate(), 'dddd, D [de] MMMM YYYY')
              : `${formatDate(currentDate.startOf('week').toDate(), 'D MMM')} - ${formatDate(currentDate.endOf('week').toDate(), 'D MMM, YYYY')}`}
          </span>
        </div>

        {/* View mode + New appointment */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'day'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Día
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${
                viewMode === 'week'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Semana
            </button>
          </div>

          <button
            onClick={() => {
              setSelectedSlot(currentDate.format('YYYY-MM-DD') + 'T09:00:00');
              setSelectedAppointmentId(null);
              setIsModalOpen(true);
            }}
            className="btn-primary text-sm"
          >
            + Nueva cita
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <CalendarView
          date={currentDate}
          appointments={appointments}
          viewMode={viewMode}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
        />
      </div>

      {isModalOpen && (
        <AppointmentModal
          appointmentId={selectedAppointmentId || undefined}
          initialStartTime={selectedSlot || undefined}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}

      <ConfettiCelebration
        show={showConfetti}
        duration={10000}
        onComplete={() => setShowConfetti(false)}
      />
    </div>
  );
}
