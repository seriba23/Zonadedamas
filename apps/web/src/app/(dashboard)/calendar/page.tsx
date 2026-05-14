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
import { Modal } from '@/components/ui/modal';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';
import { createPortal } from 'react-dom';

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
  const [currentDate, setCurrentDate] = useState(dayjs());
  // Acepta ?view=day|week|month|custom desde Home u otras pestañas.
  const initialViewMode: ViewMode = (() => {
    const v = (searchParams.get('view') || '').toLowerCase();
    if (v === 'day' || v === 'week' || v === 'month' || v === 'custom') return v;
    return 'week';
  })();
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFilters, setShowFilters] = useState(() => !!searchParams.get('status'));
  const [showStats, setShowStats] = useState(false);
  const [prefillClientId, setPrefillClientId] = useState<string | undefined>();
  const [prefillEmployeeId, setPrefillEmployeeId] = useState<string | undefined>();

  const [customStart, setCustomStart] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));
  // Búsqueda libre por texto (cliente, empleado, servicio). Reemplaza la
  // pestaña Registro: ahora cualquier vista del calendario aprovecha la búsqueda.
  const [filterSearch, setFilterSearch] = useState('');

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
  const [filterEmployeeIds, setFilterEmployeeIds] = useState<string[]>([]);
  const [filterOnlyWithAppointments, setFilterOnlyWithAppointments] = useState(false);
  const [filterClientId, setFilterClientId] = useState('');
  function toggleEmployeeFilter(id: string) {
    setFilterEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  // Filtro de estado (multi-pill). Si viene ?status=XXX en el URL (e.g. desde
  // la alerta del Home "X citas sin confirmar"), se inicializa con ese status.
  const initialStatuses = useMemo(() => {
    const fromUrl = searchParams.get('status');
    return fromUrl ? [fromUrl.toUpperCase()] : [];
  }, [searchParams]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>(initialStatuses);
  function toggleStatusFilter(s: string) {
    setFilterStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }
  // Filtro de pago: 'all' | 'paid' | 'unpaid'. Se aplica en client-side
  // sobre el array de appointments (que incluye .payments del backend).
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterServiceNames, setFilterServiceNames] = useState<string[]>([]);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const serviceButtonRef = useRef<HTMLButtonElement>(null);
  const servicePanelRef = useRef<HTMLDivElement>(null);
  const [serviceCoords, setServiceCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (serviceButtonRef.current?.contains(e.target as Node)) return;
      if (servicePanelRef.current?.contains(e.target as Node)) return;
      setServiceDropdownOpen(false);
    }
    if (serviceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [serviceDropdownOpen]);

  // Coords del dropdown de servicios (portal a body)
  useEffect(() => {
    if (!serviceDropdownOpen || !serviceButtonRef.current) {
      setServiceCoords(null);
      return;
    }
    function update() {
      if (!serviceButtonRef.current) return;
      const rect = serviceButtonRef.current.getBoundingClientRect();
      const dropdownH = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < dropdownH && rect.top > dropdownH;
      setServiceCoords({
        top: openUp ? rect.top - dropdownH - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [serviceDropdownOpen]);

  // Rangos en ISO con timezone local para que el backend pueda incluir citas
  // que estan en el "dia local" del usuario aunque su startTime UTC caiga en
  // un dia UTC distinto. Antes mandabamos YYYY-MM-DD y el backend lo
  // interpretaba como UTC midnight, perdiendo las horas nocturnas locales.
  const startDate = viewMode === 'custom'
    ? dayjs(customStart).startOf('day').toISOString()
    : viewMode === 'month'
      ? currentDate.startOf('month').startOf('isoWeek').toISOString()
      : viewMode === 'week'
        ? currentDate.startOf('week').toISOString()
        : currentDate.startOf('day').toISOString();
  const endDate = viewMode === 'custom'
    ? dayjs(customEnd).endOf('day').toISOString()
    : viewMode === 'month'
      ? currentDate.endOf('month').endOf('isoWeek').toISOString()
      : viewMode === 'week'
        ? currentDate.endOf('week').toISOString()
        : currentDate.endOf('day').toISOString();

  // Build query params - month view needs more results
  const queryParams = new URLSearchParams({
    startDate,
    endDate,
    perPage: '100',
  });
  if (filterEmployeeIds.length > 0) queryParams.set('employeeIds', filterEmployeeIds.join(','));
  if (filterClientId) queryParams.set('clientId', filterClientId);
  // Backend solo admite un status; con multi-status filtramos en client.
  if (filterStatuses.length === 1) queryParams.set('status', filterStatuses[0]);

  const { data, refetch } = useQuery({
    queryKey: ['appointments', startDate, endDate, filterEmployeeIds.join(','), filterClientId, filterStatuses.length === 1 ? filterStatuses[0] : ''],
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

  // Empleados que trabajan en el día seleccionado (solo necesario en vista 'day'
  // para hacer columnas por empleado).
  const workingDateStr = currentDate.format('YYYY-MM-DD');
  const { data: dayEmployeesData } = useQuery({
    queryKey: ['employees-working', workingDateStr],
    queryFn: () =>
      api.get<{ data: EmployeeSummary[] }>(`/api/employees?perPage=100&workingDate=${workingDateStr}`),
    enabled: viewMode === 'day',
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

  const employees = employeesData?.data || [];
  const clients = clientsData?.data || [];
  const services = servicesData?.data || [];
  const activeEmployees = employees
    .filter((e) => e.isActive)
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es'));
  const closures = closuresData?.data || [];
  const employeeTimeOffs = timeOffsData?.data || [];

  // Apply frontend filters en cascada: servicios + status (cuando hay multi) + pago
  let appointments = filterServiceNames.length > 0
    ? allAppointments.filter((apt) =>
        apt.items?.some((item) =>
          filterServiceNames.includes(item.serviceNameSnapshot),
        ),
      )
    : allAppointments;
  if (filterStatuses.length > 1) {
    appointments = appointments.filter((apt) =>
      filterStatuses.includes(apt.status?.toUpperCase?.() || ''),
    );
  }
  if (filterPayment !== 'all') {
    appointments = appointments.filter((apt) => {
      const payments = ((apt as any).payments || []) as Array<{ status?: string }>;
      const isPaid = payments.some((p) => (p.status || '').toUpperCase() === 'COMPLETED');
      return filterPayment === 'paid' ? isPaid : !isPaid;
    });
  }
  if (filterSearch.trim()) {
    const q = filterSearch.toLowerCase().trim();
    appointments = appointments.filter((apt) => {
      const clientName = `${apt.client?.firstName || ''} ${apt.client?.lastName || ''}`.toLowerCase();
      const empName = `${apt.employee?.firstName || ''} ${apt.employee?.lastName || ''}`.toLowerCase();
      const svcs = (apt.items || []).map((i) => i.serviceNameSnapshot || '').join(' ').toLowerCase();
      return clientName.includes(q) || empName.includes(q) || svcs.includes(q);
    });
  }

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

  const hasFilters =
    filterEmployeeIds.length > 0 ||
    filterClientId ||
    filterServiceNames.length > 0 ||
    filterOnlyWithAppointments ||
    filterStatuses.length > 0 ||
    filterPayment !== 'all' ||
    filterSearch.trim().length > 0;

  function clearFilters() {
    setFilterEmployeeIds([]);
    setFilterClientId('');
    setFilterServiceNames([]);
    setFilterOnlyWithAppointments(false);
    setFilterStatuses([]);
    setFilterPayment('all');
    setFilterSearch('');
  }

  function toggleServiceFilter(name: string) {
    setFilterServiceNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  // Animacion de slide al navegar. navCounter cambia el key del wrapper para
  // re-disparar la animacion CSS; navDir decide direccion (forward/back).
  const [navDir, setNavDir] = useState<'forward' | 'back'>('forward');
  const [navCounter, setNavCounter] = useState(0);

  function goToToday() {
    const today = dayjs();
    setNavDir(today.isAfter(currentDate) ? 'forward' : 'back');
    setNavCounter((c) => c + 1);
    setCurrentDate(today);
  }

  function goBack() {
    setNavDir('back');
    setNavCounter((c) => c + 1);
    setCurrentDate((d) =>
      viewMode === 'month' ? d.subtract(1, 'month') : viewMode === 'week' ? d.subtract(1, 'week') : d.subtract(1, 'day'),
    );
  }

  function goForward() {
    setNavDir('forward');
    setNavCounter((c) => c + 1);
    setCurrentDate((d) =>
      viewMode === 'month' ? d.add(1, 'month') : viewMode === 'week' ? d.add(1, 'week') : d.add(1, 'day'),
    );
  }

  function openNewAppointment() {
    setSelectedSlot(currentDate.format('YYYY-MM-DD') + 'T09:00:00');
    setSelectedAppointmentId(null);
    setIsModalOpen(true);
  }

  // Registrar boton "+ Nueva cita" en el topbar global.
  useRegisterTopbarAction(
    <button
      onClick={openNewAppointment}
      className="px-2.5 md:px-3.5 py-1.5 text-[12px] md:text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors whitespace-nowrap"
    >
      + Nueva
    </button>,
    [currentDate, viewMode],
  );

  // Swipe horizontal sobre el calendario: misma accion que las flechas.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  // En vista 'day' con empleados, el calendario tiene scroll horizontal nativo
  // para ver columnas; no queremos que el swipe cambie de día y compita con ese scroll.
  const hasEmployeeDayScroll = viewMode === 'day' && (dayEmployeesData?.data?.length || 0) > 0;
  function onSwipeStart(e: React.TouchEvent | React.PointerEvent) {
    if (viewMode === 'custom' || hasEmployeeDayScroll) return;
    const point = 'touches' in e ? e.touches[0] : e;
    swipeStartRef.current = { x: point.clientX, y: point.clientY };
  }
  function onSwipeEnd(e: React.TouchEvent | React.PointerEvent) {
    if (viewMode === 'custom' || hasEmployeeDayScroll || !swipeStartRef.current) return;
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
      <>
      <div className="px-3 md:px-6 py-2 md:py-3 bg-[var(--bg-surface)] border-b border-[var(--border)]">
        {/* Mode selector */}
        <div className="flex w-full md:w-auto rounded-lg border border-[var(--border)] overflow-hidden md:inline-flex">
          {([
            { key: 'day' as ViewMode, label: 'Día' },
            { key: 'week' as ViewMode, label: 'Semana' },
            { key: 'month' as ViewMode, label: 'Mes' },
            { key: 'custom' as ViewMode, label: 'Personalizado' },
          ]).map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`${v.key === 'custom' ? 'flex-[1.6] md:flex-none' : 'flex-1 md:flex-none'} px-1 md:px-4 py-1.5 md:py-2 text-[11px] md:text-sm font-medium whitespace-nowrap transition-colors border-r border-[var(--border)] last:border-r-0 ${
                viewMode === v.key ? 'bg-[#008080] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
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
              className="flex-1 md:flex-none min-w-0 md:w-auto px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] focus:outline-none focus:border-[#008080]"
            />
            <span className="text-[var(--text-secondary)] text-[11px] md:text-sm flex-shrink-0">-</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 md:flex-none min-w-0 md:w-auto px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] focus:outline-none focus:border-[#008080]"
            />
          </div>
        )}
      </div>

      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="md">
          <div className="space-y-5">
            {/* Búsqueda libre */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Buscar
              </label>
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Cliente, empleado o servicio..."
                className="input-field text-sm py-2"
              />
            </div>

            {/* Empleados */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Empleado
              </label>
              <div
                className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 -mx-1 px-1"
                style={{ scrollbarWidth: 'thin' }}
              >
                <button
                  onClick={() => setFilterEmployeeIds([])}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold border transition-all ${
                    filterEmployeeIds.length === 0
                      ? 'bg-[#008080] text-white border-[#008080]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]" />
                  Todos
                </button>
                {activeEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => toggleEmployeeFilter(emp.id)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full text-xs md:text-sm font-semibold border transition-all ${
                      filterEmployeeIds.includes(emp.id)
                        ? 'bg-[#008080] text-white border-[#008080]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-muted)]'
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

              {/* Toggle: mostrar solo empleados con citas (vista día) */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">
                  Mostrar solo empleados con citas
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={filterOnlyWithAppointments}
                  onClick={() => setFilterOnlyWithAppointments((v) => !v)}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ backgroundColor: filterOnlyWithAppointments ? '#008080' : 'var(--border)' }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: filterOnlyWithAppointments ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            </div>

            {/* Estado de cita (multi-select pills) */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Estado de la cita
              </label>
              <div
                className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 -mx-1 px-1"
                style={{ scrollbarWidth: 'thin' }}
              >
                {[
                  { key: 'PENDING', label: 'Pendiente', dot: '#eab308' },
                  { key: 'CONFIRMED', label: 'Confirmada', dot: '#008080' },
                  { key: 'IN_PROGRESS', label: 'En curso', dot: '#3b82f6' },
                  { key: 'COMPLETED', label: 'Completada', dot: '#059669' },
                  { key: 'CANCELLED', label: 'Cancelada', dot: '#dc2626' },
                  { key: 'NO_SHOW', label: 'No-show', dot: '#94a3b8' },
                ].map((s) => {
                  const active = filterStatuses.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleStatusFilter(s.key)}
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? 'bg-[#008080] text-white border-[#008080]'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-muted)]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: active ? '#ffffff' : s.dot }} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pago */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Pago
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'all', label: 'Todas' },
                  { key: 'paid', label: 'Pagadas' },
                  { key: 'unpaid', label: 'No pagadas' },
                ].map((p) => {
                  const active = filterPayment === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setFilterPayment(p.key as 'all' | 'paid' | 'unpaid')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? 'bg-[#008080] text-white border-[#008080]'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-muted)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cliente */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Cliente
              </label>
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
            </div>

            {/* Servicios */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Servicios
              </label>
              <div className="relative">
                <button
                  ref={serviceButtonRef}
                  type="button"
                  onClick={() => setServiceDropdownOpen((v) => !v)}
                  className="input-field text-sm py-2 w-full text-left flex items-center justify-between"
                >
                  <span className="truncate">
                    {filterServiceNames.length === 0
                      ? 'Todos los servicios'
                      : `${filterServiceNames.length} servicio${filterServiceNames.length > 1 ? 's' : ''}`}
                  </span>
                  <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {serviceDropdownOpen && serviceCoords && typeof document !== 'undefined' && createPortal(
                  <div
                    ref={servicePanelRef}
                    style={{ position: 'fixed', top: serviceCoords.top, left: serviceCoords.left, width: serviceCoords.width, zIndex: 100 }}
                    className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-lg max-h-60 overflow-y-auto"
                  >
                    {services.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-muted)] cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={filterServiceNames.includes(s.name)}
                          onChange={() => toggleServiceFilter(s.name)}
                          className="rounded border-[var(--border)] text-primary-600 focus:ring-primary-500"
                        />
                        <span className="truncate">{s.name}</span>
                      </label>
                    ))}
                    {services.length === 0 && (
                      <p className="px-3 py-2 text-sm text-[var(--text-muted)]">Sin servicios</p>
                    )}
                  </div>,
                  document.body,
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
              <button
                onClick={clearFilters}
                disabled={!hasFilters}
                className={`flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap ${
                  hasFilters
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'
                }`}
              >
                Limpiar
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showStats && (
      /* Quick stats row — all views */
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] px-3 md:px-4 py-2 md:py-2.5">
          <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wide">Total citas</p>
          <p className="text-base md:text-xl font-bold text-[var(--text-primary)]">{viewStats.total}</p>
        </div>
        <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] px-3 md:px-4 py-2 md:py-2.5">
          <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wide">Completadas</p>
          <p className="text-base md:text-xl font-bold text-green-600">{viewStats.completed}</p>
        </div>
        <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] px-3 md:px-4 py-2 md:py-2.5">
          <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wide">Canceladas</p>
          <p className="text-base md:text-xl font-bold text-red-500">{viewStats.cancelled}</p>
        </div>
        <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] px-3 md:px-4 py-2 md:py-2.5">
          <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wide">Ingresos</p>
          <p className="text-base md:text-xl font-bold text-primary-600">{formatCurrency(viewStats.revenue)}</p>
        </div>
      </div>
      )}

      {/* Cabecera: [Hoy] + fecha + toggles de filtros/stats a la derecha */}
      <div className="flex items-center gap-2 px-3 md:px-6 py-2 bg-[var(--bg-surface)] border-b border-[var(--border)]">
        {viewMode !== 'custom' && (
          <>
            <button
              onClick={goToToday}
              className="px-2.5 md:px-3 py-1 md:py-1.5 text-[11px] md:text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors flex-shrink-0"
            >
              Hoy
            </button>
            <span className="text-sm md:text-base font-medium text-[var(--text-primary)] capitalize truncate flex-1 min-w-0">
              {viewMode === 'month'
                ? formatDate(currentDate.toDate(), 'MMMM YYYY')
                : viewMode === 'day'
                  ? formatDate(currentDate.toDate(), 'dddd, D [de] MMMM YYYY')
                  : `${formatDate(currentDate.startOf('week').toDate(), 'D MMM')} - ${formatDate(currentDate.endOf('week').toDate(), 'D MMM, YYYY')}`}
            </span>
          </>
        )}
        {viewMode === 'custom' && <div className="flex-1" />}

        {/* Toggle: Filtros */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Mostrar/ocultar filtros"
          className={`relative flex-shrink-0 p-1.5 md:p-2 rounded-lg border transition-colors ${
            showFilters
              ? 'bg-[#008080] border-[#008080] text-white'
              : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
          }`}
          title="Filtros"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {hasFilters && !showFilters && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#008080] border-2 border-white" />
          )}
        </button>

        {/* Toggle: Stats (icono de reportes) */}
        <button
          onClick={() => setShowStats((v) => !v)}
          aria-label="Mostrar/ocultar estadísticas"
          className={`flex-shrink-0 p-1.5 md:p-2 rounded-lg border transition-colors ${
            showStats
              ? 'bg-[#008080] border-[#008080] text-white'
              : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
          }`}
          title="Estadísticas"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </button>

      </div>

      <div
        className="relative flex-1 overflow-hidden"
        onTouchStart={onSwipeStart}
        onTouchEnd={onSwipeEnd}
      >
        {/* Flechas absolutas para anterior/siguiente (hidden en custom).
            z-30 garantiza que queden por encima de las citas (z-10/20).
            stopPropagation + onMouseDown/onTouchStart blockean el click de la cita. */}
        {viewMode !== 'custom' && (
          <>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); goBack(); }}
              aria-label="Anterior"
              className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 md:w-10 md:h-10 rounded-full bg-[var(--bg-surface)]/95 border border-[var(--border)] shadow-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); goForward(); }}
              aria-label="Siguiente"
              className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 md:w-10 md:h-10 rounded-full bg-[var(--bg-surface)]/95 border border-[var(--border)] shadow-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        <div
          key={navCounter}
          className={`h-full ${navDir === 'forward' ? 'animate-cal-slide-forward' : 'animate-cal-slide-back'}`}
        >
        {viewMode === 'month' ? (
          <div className="h-full flex flex-col overflow-auto bg-[var(--bg-surface)]">

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b border-[var(--border)]">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                <div key={day} className="py-2 text-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${monthGridData.weeks.length}, 1fr)` }}>
              {monthGridData.weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-[var(--border)] last:border-b-0">
                  {week.map((cell) => {
                    const count = cell.appointments.length;
                    const intensity = monthGridData.maxCount > 0 ? count / monthGridData.maxCount : 0;
                    const bgColor = undefined;

                    return (
                      <button
                        key={cell.date.format('YYYY-MM-DD')}
                        onClick={() => handleMonthDayClick(cell.date)}
                        className={`relative flex flex-col items-start p-2 border-r border-[var(--border)] last:border-r-0 text-left transition-colors hover:bg-[var(--bg-muted)] min-h-[80px] ${
                          !cell.isCurrentMonth ? 'opacity-40' : ''
                        }`}
                        style={cell.isCurrentMonth ? { backgroundColor: bgColor } : undefined}
                      >
                        <span
                          className={`text-sm font-medium leading-none ${
                            cell.isToday
                              ? 'bg-primary-600 text-white w-7 h-7 rounded-full flex items-center justify-center'
                              : cell.isCurrentMonth
                                ? 'text-[var(--text-primary)]'
                                : 'text-[var(--text-muted)]'
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
                              <span className="text-[10px] text-[var(--text-secondary)]">+{count - 2} más</span>
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
          <div className="h-full overflow-auto p-3 md:p-6 bg-[var(--bg-surface)]">
            {appointments.length === 0 ? (
              <div className="text-center py-16 text-[var(--text-muted)]">No hay citas en este período</div>
            ) : (
              <div className="space-y-2">
                {appointments.map((apt) => {
                  const totalPrice = (apt.items || []).reduce((sum, i) => sum + Number(i.priceSnapshot || 0), 0);
                  const statusLabel =
                    apt.status === 'COMPLETED' ? 'Completada' :
                    apt.status === 'CANCELLED' ? 'Cancelada' :
                    apt.status === 'PENDING' ? 'Pendiente' :
                    apt.status === 'CONFIRMED' ? 'Confirmada' :
                    apt.status === 'NO_SHOW' ? 'No-show' :
                    apt.status;
                  const statusColor =
                    apt.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    apt.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                    apt.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    apt.status === 'CONFIRMED' ? 'bg-primary-50 text-primary-700' :
                    'bg-[var(--bg-muted)] text-[var(--text-secondary)]';
                  return (
                    <div
                      key={apt.id}
                      onClick={() => handleAppointmentClick(apt)}
                      className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-muted)] cursor-pointer transition-colors min-w-0"
                      style={{ borderLeft: `3px solid ${apt.employee?.color || '#008080'}` }}
                    >
                      <div className="min-w-[110px] flex-shrink-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">{dayjs(apt.startTime).format('D MMM YYYY')}</p>
                        <p className="text-xs text-[var(--text-secondary)] whitespace-nowrap">{dayjs(apt.startTime).format('h:mm A')} - {dayjs(apt.endTime).format('h:mm A')}</p>
                      </div>
                      <div className="flex-1 min-w-0 basis-full md:basis-auto order-3 md:order-none">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{apt.client?.firstName} {apt.client?.lastName}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{apt.items?.map((i) => i.serviceNameSnapshot).join(', ')}</p>
                      </div>
                      <div className="hidden md:block text-xs text-[var(--text-secondary)] truncate min-w-0 max-w-[140px]">{apt.employee?.firstName} {apt.employee?.lastName}</div>
                      <div className="ml-auto md:ml-0 text-sm font-semibold text-[var(--text-primary)] tabular-nums whitespace-nowrap flex-shrink-0">{formatCurrency(totalPrice)}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${statusColor}`}>
                        {statusLabel}
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
            dayEmployees={
              viewMode === 'day'
                ? (dayEmployeesData?.data || [])
                    .filter((e) => filterEmployeeIds.length === 0 || filterEmployeeIds.includes(e.id))
                    .filter((e) =>
                      !filterOnlyWithAppointments || appointments.some((a) => a.employeeId === e.id),
                    )
                : []
            }
            onDayHeaderClick={(day) => {
              setCurrentDate(day);
              setViewMode('day');
            }}
          />
        )}
        </div>
      </div>
      </>


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
