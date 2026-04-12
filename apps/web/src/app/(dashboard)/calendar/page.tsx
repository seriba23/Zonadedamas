'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { CalendarView, type BusinessClosure, type EmployeeTimeOff } from '@/components/calendar/calendar-view';
import { AppointmentModal } from '@/components/appointments/appointment-modal';
import { formatDate, formatCurrency } from '@/lib/utils';
import { ConfettiCelebration } from '@/components/ui/confetti-celebration';

dayjs.extend(isoWeek);

type ViewMode = 'day' | 'week' | 'month' | 'custom';

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
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [prefillClientId, setPrefillClientId] = useState<string | undefined>();
  const [prefillEmployeeId, setPrefillEmployeeId] = useState<string | undefined>();

  const [customStart, setCustomStart] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));

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

  const startDate = viewMode === 'custom'
    ? customStart
    : viewMode === 'month'
      ? currentDate.startOf('month').startOf('isoWeek').format('YYYY-MM-DD')
      : viewMode === 'week'
        ? currentDate.startOf('week').format('YYYY-MM-DD')
        : currentDate.format('YYYY-MM-DD');
  const endDate = viewMode === 'custom'
    ? customEnd
    : viewMode === 'month'
      ? currentDate.endOf('month').endOf('isoWeek').format('YYYY-MM-DD')
      : viewMode === 'week'
        ? currentDate.endOf('week').format('YYYY-MM-DD')
        : currentDate.format('YYYY-MM-DD');

  // Build query params - month view needs more results
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

  // Fetch business closures for visible range
  const { data: closuresData } = useQuery({
    queryKey: ['calendar-closures', startDate, endDate],
    queryFn: () =>
      api.get<{ data: BusinessClosure[] }>(
        `/api/tenant/closures?startDate=${startDate}&endDate=${endDate}`,
      ),
  });

  // Fetch business hours to know which days are closed
  const { data: businessHoursData } = useQuery({
    queryKey: ['business-hours'],
    queryFn: () =>
      api.get<{ data: Array<{ dayOfWeek: string; isOpen: boolean }> }>('/api/tenant/business-hours'),
  });

  const businessClosedDays = new Set(
    (businessHoursData?.data || [])
      .filter((h) => !h.isOpen)
      .map((h) => h.dayOfWeek),
  );

  // Fetch employee time-offs for visible range
  const { data: timeOffsData } = useQuery({
    queryKey: ['calendar-time-offs', startDate, endDate],
    queryFn: () =>
      api.get<{ data: EmployeeTimeOff[] }>(
        `/api/employees/time-offs?startDate=${startDate}&endDate=${endDate}`,
      ),
  });

  const allAppointments = data?.data || [];
  const employees = employeesData?.data || [];
  const clients = clientsData?.data || [];
  const services = servicesData?.data || [];
  const activeEmployees = employees.filter((e) => e.isActive);
  const closures = closuresData?.data || [];
  const employeeTimeOffs = timeOffsData?.data || [];

  // Apply frontend service filter (multi-select)
  const appointments = filterServiceNames.length > 0
    ? allAppointments.filter((apt) =>
        apt.items?.some((item) =>
          filterServiceNames.includes(item.serviceNameSnapshot),
        ),
      )
    : allAppointments;

  // Stats for current view (day/week/month)
  const viewStats = useMemo(() => {
    let total = 0, completed = 0, cancelled = 0, revenue = 0;
    for (const apt of appointments) {
      total++;
      if (apt.status === 'COMPLETED') {
        completed++;
        revenue += (apt.items || []).reduce((sum, item) => sum + Number(item.priceSnapshot || 0), 0);
      }
      if (apt.status === 'CANCELLED') cancelled++;
    }
    return { total, completed, cancelled, revenue };
  }, [appointments]);

  // Monthly view data
  const monthGridData = useMemo(() => {
    if (viewMode !== 'month') return { weeks: [], stats: { total: 0, completed: 0, cancelled: 0, revenue: 0 }, maxCount: 0 };

    const monthStart = currentDate.startOf('month');
    const monthEnd = currentDate.endOf('month');
    const gridStart = monthStart.startOf('isoWeek');
    const gridEnd = monthEnd.endOf('isoWeek');

    // Group appointments by date
    const countsByDate: Record<string, Appointment[]> = {};
    for (const apt of appointments) {
      const dateKey = dayjs(apt.startTime).format('YYYY-MM-DD');
      if (!countsByDate[dateKey]) countsByDate[dateKey] = [];
      countsByDate[dateKey].push(apt);
    }

    // Compute stats for the actual month (not overflow days)
    let total = 0;
    let completed = 0;
    let cancelled = 0;
    let revenue = 0;
    for (const apt of appointments) {
      const aptDate = dayjs(apt.startTime);
      if (aptDate.isBefore(monthStart) || aptDate.isAfter(monthEnd)) continue;
      total++;
      if (apt.status === 'COMPLETED') {
        completed++;
        revenue += (apt.items || []).reduce((sum, item) => sum + Number(item.priceSnapshot || 0), 0);
      }
      if (apt.status === 'CANCELLED') cancelled++;
    }

    // Build weeks grid
    const weeks: Array<Array<{ date: dayjs.Dayjs; isCurrentMonth: boolean; isToday: boolean; appointments: Appointment[] }>> = [];
    let day = gridStart;
    let maxCount = 0;

    while (day.isBefore(gridEnd) || day.isSame(gridEnd, 'day')) {
      const week: typeof weeks[0] = [];
      for (let i = 0; i < 7; i++) {
        const dateKey = day.format('YYYY-MM-DD');
        const dayAppts = countsByDate[dateKey] || [];
        if (dayAppts.length > maxCount) maxCount = dayAppts.length;
        week.push({
          date: day,
          isCurrentMonth: day.month() === currentDate.month(),
          isToday: day.isSame(dayjs(), 'day'),
          appointments: dayAppts,
        });
        day = day.add(1, 'day');
      }
      weeks.push(week);
    }

    return { weeks, stats: { total, completed, cancelled, revenue }, maxCount };
  }, [viewMode, currentDate, appointments]);

  function handleMonthDayClick(date: dayjs.Dayjs) {
    setCurrentDate(date);
    setViewMode('day');
  }

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
      viewMode === 'month' ? d.subtract(1, 'month') : viewMode === 'week' ? d.subtract(1, 'week') : d.subtract(1, 'day'),
    );
  }

  function goForward() {
    setCurrentDate((d) =>
      viewMode === 'month' ? d.add(1, 'month') : viewMode === 'week' ? d.add(1, 'week') : d.add(1, 'day'),
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
    setPrefillClientId(undefined);
    setPrefillEmployeeId(undefined);
  }

  function handleModalSave() {
    // Only show confetti when creating a new appointment, not on cancel/complete/reschedule
    const isCreating = !selectedAppointmentId;
    handleModalClose();
    refetch();
    if (isCreating) {
      setShowConfetti(true);
    }
  }

  function handleCreateAnother(clientId: string, employeeId: string) {
    setPrefillClientId(clientId);
    setPrefillEmployeeId(employeeId);
    setSelectedAppointmentId(null);
    setSelectedSlot(currentDate.format('YYYY-MM-DD') + 'T09:00:00');
    setIsModalOpen(true);
  }

  async function handleAppointmentDragEnd(appointmentId: string, newStartTime: string) {
    try {
      await api.post(`/api/appointments/${appointmentId}/reschedule`, { startTime: newStartTime });
      refetch();
    } catch (err) {
      console.error('Error rescheduling:', err);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Calendario" />

      <div className="px-6 py-4 bg-white border-b border-gray-200">
        {/* View mode selector — same style as Reports date range */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {([
                { key: 'day' as ViewMode, label: 'Día' },
                { key: 'week' as ViewMode, label: 'Semana' },
                { key: 'month' as ViewMode, label: 'Mes' },
                { key: 'custom' as ViewMode, label: 'Personalizado' },
              ]).map((v) => (
                <button
                  key={v.key}
                  onClick={() => setViewMode(v.key)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 ${
                    viewMode === v.key ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {viewMode === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input-field w-auto text-sm py-1.5" />
                <span className="text-gray-500">-</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input-field w-auto text-sm py-1.5" />
              </div>
            )}

            {/* Date navigation — hidden in custom mode */}
            {viewMode !== 'custom' && (
              <>
                <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Anterior">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                  Hoy
                </button>
                <button onClick={goForward} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Siguiente">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {viewMode !== 'custom' && <span className="text-base font-medium text-gray-900 capitalize">
              {viewMode === 'month'
                ? formatDate(currentDate.toDate(), 'MMMM YYYY')
                : viewMode === 'day'
                  ? formatDate(currentDate.toDate(), 'dddd, D [de] MMMM YYYY')
                  : `${formatDate(currentDate.startOf('week').toDate(), 'D MMM')} - ${formatDate(currentDate.endOf('week').toDate(), 'D MMM, YYYY')}`}
            </span>}
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

      {/* Employee pills filter */}
      <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200 flex-wrap">
        <button
          onClick={() => setFilterEmployeeId('')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
            filterEmployeeId === ''
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          Todos
        </button>
        {activeEmployees.map((emp) => (
          <button
            key={emp.id}
            onClick={() => setFilterEmployeeId(filterEmployeeId === emp.id ? '' : emp.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              filterEmployeeId === emp.id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: emp.color || '#008080' }} />
            {emp.firstName}
          </button>
        ))}

        <div className="w-px h-6 bg-gray-300 mx-1" />

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
      </div>

      {/* Quick stats row — all views */}
      <div className="grid grid-cols-4 gap-4 px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Total citas</p>
          <p className="text-xl font-bold text-gray-900">{viewStats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Completadas</p>
          <p className="text-xl font-bold text-green-600">{viewStats.completed}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Canceladas</p>
          <p className="text-xl font-bold text-red-500">{viewStats.cancelled}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Ingresos</p>
          <p className="text-xl font-bold text-primary-600">{formatCurrency(viewStats.revenue)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {viewMode === 'month' ? (
          <div className="h-full flex flex-col overflow-auto bg-white">

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${monthGridData.weeks.length}, 1fr)` }}>
              {monthGridData.weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
                  {week.map((cell) => {
                    const count = cell.appointments.length;
                    const intensity = monthGridData.maxCount > 0 ? count / monthGridData.maxCount : 0;
                    const bgColor = undefined;

                    return (
                      <button
                        key={cell.date.format('YYYY-MM-DD')}
                        onClick={() => handleMonthDayClick(cell.date)}
                        className={`relative flex flex-col items-start p-2 border-r border-gray-100 last:border-r-0 text-left transition-colors hover:bg-gray-50 min-h-[80px] ${
                          !cell.isCurrentMonth ? 'opacity-40' : ''
                        }`}
                        style={cell.isCurrentMonth ? { backgroundColor: bgColor } : undefined}
                      >
                        <span
                          className={`text-sm font-medium leading-none ${
                            cell.isToday
                              ? 'bg-primary-600 text-white w-7 h-7 rounded-full flex items-center justify-center'
                              : cell.isCurrentMonth
                                ? 'text-gray-900'
                                : 'text-gray-400'
                          }`}
                        >
                          {cell.date.date()}
                        </span>

                        {count > 0 && cell.isCurrentMonth && (
                          <div className="mt-1.5 flex flex-col gap-0.5 w-full">
                            <span className="text-xs font-semibold text-primary-700">
                              {count} cita{count !== 1 ? 's' : ''}
                            </span>
                            {/* Show up to 2 appointment previews — height proportional to duration */}
                            {cell.appointments.slice(0, 2).map((apt) => {
                              const duration = apt.items?.reduce((sum: number, item: any) => sum + (item.durationSnapshot || 30), 0) || 30;
                              const minH = Math.max(Math.round(duration / 15) * 4 + 12, 16);
                              return (
                                <div
                                  key={apt.id}
                                  className="text-[10px] leading-tight truncate rounded px-1.5 flex items-center"
                                  style={{
                                    minHeight: `${minH}px`,
                                    backgroundColor: apt.employee?.color ? `${apt.employee.color}20` : '#00808020',
                                    borderLeft: `2px solid ${apt.employee?.color || '#008080'}`,
                                  }}
                                >
                                  {dayjs(apt.startTime).format('H:mm')} {apt.client?.firstName || 'Cliente'}
                                </div>
                              );
                            })}
                            {count > 2 && (
                              <span className="text-[10px] text-gray-500">+{count - 2} más</span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === 'custom' ? (
          <div className="h-full overflow-auto p-6 bg-white">
            {appointments.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No hay citas en este período</div>
            ) : (
              <div className="space-y-2">
                {appointments.map((apt) => {
                  const totalPrice = (apt.items || []).reduce((sum, i) => sum + Number(i.priceSnapshot || 0), 0);
                  return (
                    <div
                      key={apt.id}
                      onClick={() => handleAppointmentClick(apt.id)}
                      className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      style={{ borderLeft: `3px solid ${apt.employee?.color || '#008080'}` }}
                    >
                      <div className="min-w-[100px]">
                        <p className="text-sm font-medium text-gray-900">{dayjs(apt.startTime).format('D MMM YYYY')}</p>
                        <p className="text-xs text-gray-500">{dayjs(apt.startTime).format('h:mm A')} - {dayjs(apt.endTime).format('h:mm A')}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{apt.client?.firstName} {apt.client?.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{apt.items?.map((i) => i.serviceNameSnapshot).join(', ')}</p>
                      </div>
                      <div className="text-xs text-gray-500">{apt.employee?.firstName} {apt.employee?.lastName}</div>
                      <div className="text-sm font-semibold text-gray-900">{formatCurrency(totalPrice)}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        apt.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        apt.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                        apt.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {apt.status === 'COMPLETED' ? 'Completada' : apt.status === 'CANCELLED' ? 'Cancelada' : apt.status === 'PENDING' ? 'Pendiente' : apt.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <CalendarView
            date={currentDate}
            appointments={appointments}
            viewMode={viewMode as 'day' | 'week'}
            onSlotClick={handleSlotClick}
            onAppointmentClick={handleAppointmentClick}
            onAppointmentDragEnd={handleAppointmentDragEnd}
            closures={closures}
            employeeTimeOffs={employeeTimeOffs}
          />
        )}
      </div>

      {isModalOpen && (
        <AppointmentModal
          appointmentId={selectedAppointmentId || undefined}
          initialStartTime={selectedSlot || undefined}
          initialClientId={prefillClientId}
          initialEmployeeId={prefillEmployeeId}
          onClose={handleModalClose}
          onSave={handleModalSave}
          onCreateAnother={handleCreateAnother}
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
