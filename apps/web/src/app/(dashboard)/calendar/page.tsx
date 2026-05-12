'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { api } from '@/lib/api';
import { CalendarView, type BusinessClosure, type EmployeeTimeOff } from '@/components/calendar/calendar-view';
import { AppointmentModal } from '@/components/appointments/appointment-modal';
import { formatDate, resolveImageUrl } from '@/lib/utils';
import { useCurrency } from '@/lib/hooks/use-currency';
import { ConfettiCelebration } from '@/components/ui/confetti-celebration';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';

dayjs.extend(isoWeek);

type ViewMode = 'day' | 'week' | 'month' | 'custom';
type MainView = 'calendario' | 'registro';

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
  avatarUrl?: string | null;
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
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [mainView, setMainView] = useState<MainView>('calendario');
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

  // Registro filters
  const [regDateFrom, setRegDateFrom] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [regDateTo, setRegDateTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [regClient, setRegClient] = useState('');
  const [regEmployee, setRegEmployee] = useState('');
  const [regStatus, setRegStatus] = useState('');
  const [regSearch, setRegSearch] = useState('');

  // Open appointment from URL param (e.g. from reports detail)
  useEffect(() => {
    const aptId = searchParams.get('appointmentId');
    if (aptId) {
      setSelectedAppointmentId(aptId);
      setIsModalOpen(true);
      return;
    }
    // ?new=1 → open modal directly in create mode (used from "Nueva cita" shortcut)
    if (searchParams.get('new') === '1') {
      setSelectedAppointmentId(null);
      setIsModalOpen(true);
    }
  }, [searchParams]);

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
      api.get<{ data: Array<{ dayOfWeek: string; isOpen: boolean; startTime?: string; endTime?: string }> }>('/api/tenant/business-hours'),
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

  // Registro query - all appointments for the date range
  const regParams = new URLSearchParams({ startDate: regDateFrom, endDate: regDateTo, perPage: '100' });
  if (regEmployee) regParams.set('employeeId', regEmployee);
  if (regClient) regParams.set('clientId', regClient);
  if (regStatus) regParams.set('status', regStatus);

  const { data: regData } = useQuery({
    queryKey: ['appointments-registro', regDateFrom, regDateTo, regEmployee, regClient, regStatus],
    queryFn: () => api.get<{ data: Appointment[] }>(`/api/appointments?${regParams.toString()}`),
    enabled: mainView === 'registro',
  });
  const regAppointments = (regData?.data || []).filter((apt) => {
    if (!regSearch) return true;
    const q = regSearch.toLowerCase().trim();
    if (!q) return true;
    const clientName = `${apt.client?.firstName || ''} ${apt.client?.lastName || ''}`.toLowerCase();
    const empName = `${apt.employee?.firstName || ''} ${apt.employee?.lastName || ''}`.toLowerCase();
    const services = (apt.items || []).map((i) => i.serviceNameSnapshot || '').join(' ').toLowerCase();
    return clientName.includes(q) || empName.includes(q) || services.includes(q);
  });
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

  function openNewAppointment() {
    setSelectedSlot(currentDate.format('YYYY-MM-DD') + 'T09:00:00');
    setSelectedAppointmentId(null);
    setIsModalOpen(true);
  }

  // Registrar boton "+ Nueva cita" en el topbar global (solo en vista calendario).
  useRegisterTopbarAction(
    mainView === 'calendario' ? (
      <button
        onClick={openNewAppointment}
        className="px-2.5 md:px-3.5 py-1.5 text-[12px] md:text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors whitespace-nowrap"
      >
        + Nueva
      </button>
    ) : null,
    [mainView, currentDate, viewMode],
  );

  // Swipe horizontal sobre el calendario: misma accion que las flechas.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  function onSwipeStart(e: React.TouchEvent | React.PointerEvent) {
    if (viewMode === 'custom') return;
    const point = 'touches' in e ? e.touches[0] : e;
    swipeStartRef.current = { x: point.clientX, y: point.clientY };
  }
  function onSwipeEnd(e: React.TouchEvent | React.PointerEvent) {
    if (viewMode === 'custom' || !swipeStartRef.current) return;
    const point = 'changedTouches' in e ? e.changedTouches[0] : e;
    const dx = point.clientX - swipeStartRef.current.x;
    const dy = Math.abs(point.clientY - swipeStartRef.current.y);
    swipeStartRef.current = null;
    // Threshold de 60px horizontal y que sea claramente mas horizontal que vertical
    if (Math.abs(dx) > 60 && Math.abs(dx) > dy * 1.5) {
      if (dx > 0) goBack(); else goForward();
    }
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
    // Clean query params so the modal does not reopen on refresh / back navigation.
    if (searchParams.get('new') === '1' || searchParams.get('appointmentId')) {
      window.history.replaceState({}, '', '/calendar');
    }
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
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
    } catch (err) {
      console.error('Error rescheduling:', err);
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Main view tabs */}
      <div className="border-b border-gray-200 px-3 md:px-6 bg-white">
        <div className="flex gap-1">
          {(['calendario', 'registro'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMainView(tab)}
              className={`px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium border-b-2 transition-colors ${
                mainView === tab ? 'border-[#008080] text-[#008080]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'calendario' ? 'Citas' : (
                <>
                  <span className="md:hidden">Registro</span>
                  <span className="hidden md:inline">Registro de citas</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {mainView === 'calendario' && (<>
      <div className="px-3 md:px-6 py-2 md:py-3 bg-white border-b border-gray-200">
        {/* Mode selector */}
        <div className="flex w-full md:w-auto rounded-lg border border-gray-300 overflow-hidden md:inline-flex">
          {([
            { key: 'day' as ViewMode, label: 'Día' },
            { key: 'week' as ViewMode, label: 'Semana' },
            { key: 'month' as ViewMode, label: 'Mes' },
            { key: 'custom' as ViewMode, label: 'Personalizado' },
          ]).map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`${v.key === 'custom' ? 'flex-[1.6] md:flex-none' : 'flex-1 md:flex-none'} px-1 md:px-4 py-1.5 md:py-2 text-[11px] md:text-sm font-medium whitespace-nowrap transition-colors border-r border-gray-300 last:border-r-0 ${
                viewMode === v.key ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {viewMode === 'custom' && (
          <div className="mt-2 w-full md:w-auto flex items-center gap-1.5 md:gap-2 md:inline-flex">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 md:flex-none min-w-0 md:w-auto px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#008080]"
            />
            <span className="text-gray-500 text-[11px] md:text-sm flex-shrink-0">-</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 md:flex-none min-w-0 md:w-auto px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#008080]"
            />
          </div>
        )}
      </div>

      {/* Employee pills filter — scroll horizontal en una sola fila */}
      <div className="flex items-center gap-2 px-3 md:px-6 py-2 md:py-3 bg-gray-50 border-b border-gray-200 overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: 'thin' }}>
        <button
          onClick={() => setFilterEmployeeId('')}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold border transition-all ${
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
            className={`flex-shrink-0 inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full text-xs md:text-sm font-semibold border transition-all ${
              filterEmployeeId === emp.id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden text-[10px] font-bold flex-shrink-0"
              style={{
                backgroundColor: `${emp.color || '#008080'}25`,
                color: emp.color || '#008080',
              }}
            >
              {emp.avatarUrl ? (
                <img src={resolveImageUrl(emp.avatarUrl) || ''} alt="" className="w-full h-full object-cover" />
              ) : (
                `${emp.firstName?.[0] ?? ''}${emp.lastName?.[0] ?? ''}`
              )}
            </span>
            {emp.firstName}
          </button>
        ))}
      </div>

      {/* Secondary filters: client + services + clear */}
      <div className="flex items-center gap-2 px-3 md:px-6 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
        <SearchableSelect
          value={filterClientId}
          onChange={setFilterClientId}
          placeholder="Buscar cliente..."
          allLabel="Todos los clientes"
          options={[...clients].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es')).map((c) => ({
            id: c.id,
            label: `${c.firstName} ${c.lastName}`,
            sublabel: c.email || c.phone || undefined,
            avatarUrl: (c as any).avatarUrl,
          }))}
        />

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-3 border-b border-gray-200 bg-gray-50">
        <div className="bg-white rounded-lg border border-gray-200 px-3 md:px-4 py-2 md:py-2.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Total citas</p>
          <p className="text-base md:text-xl font-bold text-gray-900">{viewStats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-3 md:px-4 py-2 md:py-2.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Completadas</p>
          <p className="text-base md:text-xl font-bold text-green-600">{viewStats.completed}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-3 md:px-4 py-2 md:py-2.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Canceladas</p>
          <p className="text-base md:text-xl font-bold text-red-500">{viewStats.cancelled}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-3 md:px-4 py-2 md:py-2.5">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Ingresos</p>
          <p className="text-base md:text-xl font-bold text-primary-600">{formatCurrency(viewStats.revenue)}</p>
        </div>
      </div>

      {/* Cabecera con [Hoy] + fecha actual capitalizada */}
      {viewMode !== 'custom' && (
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2 bg-white border-b border-gray-200">
          <button
            onClick={goToToday}
            className="px-2.5 md:px-3 py-1 md:py-1.5 text-[11px] md:text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            Hoy
          </button>
          <span className="text-sm md:text-base font-medium text-gray-900 capitalize truncate">
            {viewMode === 'month'
              ? formatDate(currentDate.toDate(), 'MMMM YYYY')
              : viewMode === 'day'
                ? formatDate(currentDate.toDate(), 'dddd, D [de] MMMM YYYY')
                : `${formatDate(currentDate.startOf('week').toDate(), 'D MMM')} - ${formatDate(currentDate.endOf('week').toDate(), 'D MMM, YYYY')}`}
          </span>
        </div>
      )}

      <div
        className="relative flex-1 overflow-hidden"
        onTouchStart={onSwipeStart}
        onTouchEnd={onSwipeEnd}
      >
        {/* Flechas absolutas para anterior/siguiente (hidden en custom) */}
        {viewMode !== 'custom' && (
          <>
            <button
              onClick={goBack}
              aria-label="Anterior"
              className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white hover:shadow transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goForward}
              aria-label="Siguiente"
              className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white hover:shadow transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
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
          <div className="h-full overflow-auto p-3 md:p-6 bg-white">
            {appointments.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No hay citas en este período</div>
            ) : (
              <div className="space-y-2">
                {appointments.map((apt) => {
                  const totalPrice = (apt.items || []).reduce((sum, i) => sum + Number(i.priceSnapshot || 0), 0);
                  return (
                    <div
                      key={apt.id}
                      onClick={() => handleAppointmentClick(apt)}
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
            businessHours={businessHoursData?.data || []}
          />
        )}
      </div>
      </>)}

      {/* ─── Registro de citas ─── */}
      {mainView === 'registro' && (
        <div className="flex-1 overflow-y-auto">
          {/* Filters */}
          <div className="px-3 md:px-6 py-3 md:py-4 bg-white border-b border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
                placeholder="Buscar cliente, empleado, servicio..."
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] w-56"
              />
              <input type="date" value={regDateFrom} onChange={(e) => setRegDateFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] bg-white" />
              <span className="text-gray-400">-</span>
              <input type="date" value={regDateTo} onChange={(e) => setRegDateTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] bg-white" />
              <SearchableSelect
                value={regEmployee}
                onChange={setRegEmployee}
                placeholder="Buscar empleado..."
                allLabel="Todos los empleados"
                options={[...employees].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es')).map((e) => ({
                  id: e.id, label: `${e.firstName} ${e.lastName}`, avatarUrl: e.avatarUrl, color: e.color,
                }))}
              />
              <SearchableSelect
                value={regClient}
                onChange={setRegClient}
                placeholder="Buscar cliente..."
                allLabel="Todos los clientes"
                options={[...clients].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es')).map((c) => ({
                  id: c.id, label: `${c.firstName} ${c.lastName}`, sublabel: c.email || c.phone || undefined, avatarUrl: (c as any).avatarUrl,
                }))}
              />
              <select value={regStatus} onChange={(e) => setRegStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:border-[#008080]">
                <option value="">Todos los estados</option>
                <option value="CONFIRMED">Confirmada</option>
                <option value="COMPLETED">Completada</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="NO_SHOW">Ausente</option>
                <option value="IN_PROGRESS">En curso</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="px-3 md:px-6 py-2 md:py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-600">{regAppointments.length} cita{regAppointments.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-bold text-green-700">
              Total: {formatCurrency(regAppointments.reduce((s, a) => s + (a.items || []).reduce((is, i) => is + Number(i.priceSnapshot || 0), 0), 0))}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Horario</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Servicios</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {regAppointments.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map((apt) => {
                  const total = (apt.items || []).reduce((s, i) => s + Number(i.priceSnapshot || 0), 0);
                  const statusMap: Record<string, { label: string; color: string }> = {
                    CONFIRMED: { label: 'Confirmada', color: 'bg-green-100 text-green-700' },
                    COMPLETED: { label: 'Completada', color: 'bg-gray-100 text-gray-600' },
                    CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-600' },
                    NO_SHOW: { label: 'Ausente', color: 'bg-red-100 text-red-600' },
                    IN_PROGRESS: { label: 'En curso', color: 'bg-blue-100 text-blue-700' },
                    PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
                  };
                  const status = statusMap[apt.status] || statusMap.PENDING;
                  return (
                    <tr
                      key={apt.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setSelectedAppointmentId(apt.id); setIsModalOpen(true); }}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{dayjs(apt.startTime).format('DD/MM/YYYY')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{dayjs(apt.startTime).format('HH:mm')} - {dayjs(apt.endTime).format('HH:mm')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#008080' }}>
                            {(apt.client as any)?.avatarUrl ? (
                              <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${(apt.client as any).avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <>{apt.client?.firstName?.[0]}{apt.client?.lastName?.[0]}</>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{apt.client?.firstName} {apt.client?.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: apt.employee?.color || '#008080' }}>
                            {(apt.employee as any)?.avatarUrl ? (
                              <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${(apt.employee as any).avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <>{apt.employee?.firstName?.[0]}{apt.employee?.lastName?.[0]}</>
                            )}
                          </div>
                          <span className="text-sm text-gray-600">{apt.employee?.firstName} {apt.employee?.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{apt.items?.map((i) => i.serviceNameSnapshot).join(', ')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {regAppointments.length === 0 && (
              <div className="text-center py-16 text-gray-400">No hay citas en este período</div>
            )}
          </div>
        </div>
      )}

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
