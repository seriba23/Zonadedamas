'use client';

import { useState, useRef, useEffect } from 'react';
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
  employee?: { firstName: string; lastName: string; color?: string };
  startTime: string;
  endTime: string;
  status: string;
  items?: Array<{ serviceNameSnapshot: string; priceSnapshot?: number; durationSnapshot?: number }>;
}

interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
  color?: string;
  isActive: boolean;
}

interface ClientSummary {
  id: string;
  firstName: string;
  lastName: string;
}

interface ServiceSummary {
  id: string;
  name: string;
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

  // Filter state
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterServiceNames, setFilterServiceNames] = useState<string[]>([]);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(e.target as Node)) {
        setServiceDropdownOpen(false);
      }
    }
    if (serviceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [serviceDropdownOpen]);

  const startDate = viewMode === 'day'
    ? currentDate.format('YYYY-MM-DD')
    : currentDate.startOf('week').format('YYYY-MM-DD');
  const endDate = viewMode === 'day'
    ? currentDate.format('YYYY-MM-DD')
    : currentDate.endOf('week').format('YYYY-MM-DD');

  // Build query params
  const queryParams = new URLSearchParams({
    startDate,
    endDate,
    perPage: '100',
  });
  if (filterEmployeeId) queryParams.set('employeeId', filterEmployeeId);
  if (filterClientId) queryParams.set('clientId', filterClientId);

  const { data, refetch } = useQuery({
    queryKey: ['appointments', startDate, endDate, filterEmployeeId, filterClientId],
    queryFn: () =>
      api.get<{ data: Appointment[] }>(
        `/api/appointments?${queryParams.toString()}`,
      ),
  });

  // Fetch employees for filter dropdown and legend
  const { data: employeesData } = useQuery({
    queryKey: ['employees-calendar'],
    queryFn: () =>
      api.get<{ data: EmployeeSummary[] }>('/api/employees?perPage=100'),
  });

  // Fetch clients for filter dropdown
  const { data: clientsData } = useQuery({
    queryKey: ['clients-calendar'],
    queryFn: () =>
      api.get<{ data: ClientSummary[] }>('/api/clients?perPage=100'),
  });

  // Fetch services for filter dropdown
  const { data: servicesData } = useQuery({
    queryKey: ['services-calendar'],
    queryFn: () =>
      api.get<{ data: ServiceSummary[] }>('/api/services?perPage=100'),
  });

  const allAppointments = data?.data || [];
  const employees = employeesData?.data || [];
  const clients = clientsData?.data || [];
  const services = servicesData?.data || [];
  const activeEmployees = employees.filter((e) => e.isActive);

  // Apply frontend service filter (multi-select)
  const appointments = filterServiceNames.length > 0
    ? allAppointments.filter((apt) =>
        apt.items?.some((item) =>
          filterServiceNames.includes(item.serviceNameSnapshot),
        ),
      )
    : allAppointments;

  const hasFilters = filterEmployeeId || filterClientId || filterServiceNames.length > 0;

  function clearFilters() {
    setFilterEmployeeId('');
    setFilterClientId('');
    setFilterServiceNames([]);
  }

  function toggleServiceFilter(name: string) {
    setFilterServiceNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

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

      {/* Filters bar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 border-b border-gray-200 flex-wrap">
        <select
          value={filterEmployeeId}
          onChange={(e) => setFilterEmployeeId(e.target.value)}
          className="input-field text-sm py-1.5 w-44"
        >
          <option value="">Todos los empleados</option>
          {activeEmployees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </select>

        <select
          value={filterClientId}
          onChange={(e) => setFilterClientId(e.target.value)}
          className="input-field text-sm py-1.5 w-44"
        >
          <option value="">Todos los clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </select>

        <div className="relative" ref={serviceDropdownRef}>
          <button
            type="button"
            onClick={() => setServiceDropdownOpen((v) => !v)}
            className="input-field text-sm py-1.5 w-48 text-left flex items-center justify-between"
          >
            <span className="truncate">
              {filterServiceNames.length === 0
                ? 'Todos los servicios'
                : `${filterServiceNames.length} servicio${filterServiceNames.length > 1 ? 's' : ''}`}
            </span>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {serviceDropdownOpen && (
            <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filterServiceNames.includes(s.name)}
                    onChange={() => toggleServiceFilter(s.name)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
              {services.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-400">Sin servicios</p>
              )}
            </div>
          )}
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar filtros
          </button>
        )}

        {/* Employee color legend */}
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {activeEmployees.map((emp) => (
            <div key={emp.id} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: emp.color || '#008080' }}
              />
              <span className="text-xs text-gray-600">
                {emp.firstName} {emp.lastName.charAt(0)}.
              </span>
            </div>
          ))}
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
