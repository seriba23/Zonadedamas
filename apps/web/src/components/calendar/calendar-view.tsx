'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { formatTime } from '@/lib/utils';

interface AppointmentItem {
  serviceNameSnapshot: string;
  priceSnapshot?: number;
  durationSnapshot?: number;
}

interface Appointment {
  id: string;
  clientId: string;
  client?: { firstName: string; lastName: string };
  employeeId: string;
  employee?: { firstName: string; lastName: string; color?: string };
  startTime: string;
  endTime: string;
  status: string;
  items?: AppointmentItem[];
}

export interface BusinessClosure {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface EmployeeTimeOff {
  id: string;
  employeeId: string;
  startDatetime: string;
  endDatetime: string;
  reason?: string;
  employee?: { id: string; firstName: string; lastName: string; color?: string };
}

export interface BusinessHourEntry {
  dayOfWeek: string;
  isOpen: boolean;
  startTime?: string; // "HH:mm"
  endTime?: string;   // "HH:mm"
}

export interface DayEmployee {
  id: string;
  firstName: string;
  lastName: string;
  color?: string;
  avatarUrl?: string | null;
}

interface CalendarViewProps {
  date: Dayjs;
  appointments: Appointment[];
  viewMode: 'day' | 'week';
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onAppointmentDragEnd?: (appointmentId: string, newStartTime: string) => void;
  closures?: BusinessClosure[];
  employeeTimeOffs?: EmployeeTimeOff[];
  businessHours?: BusinessHourEntry[];
  /** Empleados que trabajan en `date` (solo se usa en vista 'day' para hacer columnas por empleado). */
  dayEmployees?: DayEmployee[];
}

interface Column {
  key: string;
  date: Dayjs;
  /** Si está presente, esta columna pertenece a un empleado específico (vista día). */
  employee?: DayEmployee;
}

const HOUR_START = 6;
const HOUR_END = 22;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 40; // px per 30-min slot
const TOTAL_SLOTS = TOTAL_HOURS * 2; // 28 slots
const HEADER_HEIGHT = 0; // header is outside the grid body
const HORA_COL_WIDTH = 60; // px for time labels column
const EMPLOYEE_COL_WIDTH = 168; // px por columna de empleado en vista 'day' (scroll horizontal)
const SNAP_MINUTES = 15;

const DRAGGABLE_STATUSES = new Set(['pending', 'confirmed', 'rescheduled']);

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function timeToMinutes(isoTime: string): number {
  const d = new Date(isoTime);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatHourLabel(hour: number): string {
  if (hour === 12) return '12 PM';
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

const STATUS_DECORATIONS: Record<string, string> = {
  cancelled: 'line-through opacity-50',
  no_show: 'opacity-60',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  pending: '#eab308',
  confirmed: '#22c55e',
  rescheduled: '#f97316',
  in_progress: '#3b82f6',
  completed: '#9ca3af',
  cancelled: '#ef4444',
  no_show: '#f97316',
};

interface LayoutInfo {
  column: number;
  totalColumns: number;
}

function computeOverlapLayout(appointments: Appointment[]): Map<string, LayoutInfo> {
  const result = new Map<string, LayoutInfo>();
  if (appointments.length === 0) return result;

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  const clusters: Appointment[][] = [];
  let currentCluster: Appointment[] = [sorted[0]];
  let clusterEnd = new Date(sorted[0].endTime).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const apt = sorted[i];
    const aptStart = new Date(apt.startTime).getTime();
    if (aptStart < clusterEnd) {
      currentCluster.push(apt);
      clusterEnd = Math.max(clusterEnd, new Date(apt.endTime).getTime());
    } else {
      clusters.push(currentCluster);
      currentCluster = [apt];
      clusterEnd = new Date(apt.endTime).getTime();
    }
  }
  clusters.push(currentCluster);

  for (const cluster of clusters) {
    const columns: Appointment[][] = [];
    for (const apt of cluster) {
      const aptStart = new Date(apt.startTime).getTime();
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1];
        if (new Date(lastInCol.endTime).getTime() <= aptStart) {
          columns[col].push(apt);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([apt]);
      }
    }
    const totalColumns = columns.length;
    columns.forEach((col, colIdx) => {
      for (const apt of col) {
        result.set(apt.id, { column: colIdx, totalColumns });
      }
    });
  }

  return result;
}

function isDateInClosure(date: Dayjs, closures: BusinessClosure[]): BusinessClosure | null {
  const dateStr = date.format('YYYY-MM-DD');
  for (const c of closures) {
    const cStart = c.startDate.split('T')[0];
    const cEnd = c.endDate.split('T')[0];
    if (dateStr >= cStart && dateStr <= cEnd) return c;
  }
  return null;
}

interface DragState {
  appointmentId: string;
  appointment: Appointment;
  startX: number;
  startY: number;
  isDragging: boolean;
  ghostTop: number;
  ghostDayIndex: number;
  ghostMinutes: number;
  originalDayIndex: number;
  durationMinutes: number;
}

export function CalendarView({
  date,
  appointments,
  viewMode,
  onSlotClick,
  onAppointmentClick,
  onAppointmentDragEnd,
  closures = [],
  employeeTimeOffs = [],
  businessHours = [],
  dayEmployees = [],
}: CalendarViewProps) {
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Sincroniza scroll horizontal del body hacia el header (vista 'day' empleado)
  useEffect(() => {
    const body = gridBodyRef.current;
    const header = headerRef.current;
    if (!body || !header) return;
    function onScroll() {
      if (header && body) header.scrollLeft = body.scrollLeft;
    }
    body.addEventListener('scroll', onScroll);
    return () => body.removeEventListener('scroll', onScroll);
  }, []);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Las columnas del grid:
  // - Vista semana: 7 columnas, una por día
  // - Vista día con empleados que trabajan: una columna por empleado
  // - Vista día sin empleados: una columna única del día (fallback)
  const columns: Column[] = useMemo(() => {
    if (viewMode === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = date.startOf('week').add(i, 'day');
        return { key: d.format('YYYY-MM-DD'), date: d };
      });
    }
    if (dayEmployees && dayEmployees.length > 0) {
      return dayEmployees.map((emp) => ({
        key: emp.id,
        date,
        employee: emp,
      }));
    }
    return [{ key: date.format('YYYY-MM-DD'), date }];
  }, [date, viewMode, dayEmployees]);

  const numDays = columns.length;

  const isToday = (d: Dayjs) => d.isSame(dayjs(), 'day');
  const todayIndex = useMemo(() => {
    const today = dayjs();
    // En vista día por empleado, todas las columnas son el mismo día. Si es hoy,
    // marcamos col 0 para que la linea AHORA se renderice una sola vez (a lo ancho).
    if (viewMode === 'day') {
      return columns[0]?.date.isSame(today, 'day') ? 0 : -1;
    }
    return columns.findIndex((c) => c.date.isSame(today, 'day'));
  }, [columns, viewMode]);

  // Group appointments by column index
  // - Semana: una col por día, filtrar por mismo día
  // - Día por empleado: filtrar por mismo día Y mismo empleado
  const appointmentsByDay = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    columns.forEach((_, i) => map.set(i, []));
    for (const apt of appointments) {
      const aptDay = dayjs(apt.startTime);
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (!aptDay.isSame(col.date, 'day')) continue;
        if (col.employee && apt.employeeId !== col.employee.id) continue;
        map.get(i)!.push(apt);
        if (viewMode === 'week') break; // en semana cada cita va a un único día
      }
    }
    return map;
  }, [appointments, columns, viewMode]);

  // Overlap layouts per day
  const layoutsByDay = useMemo(() => {
    const map = new Map<number, Map<string, LayoutInfo>>();
    for (const [dayIdx, dayApts] of appointmentsByDay) {
      map.set(dayIdx, computeOverlapLayout(dayApts));
    }
    return map;
  }, [appointmentsByDay]);

  // Closures por columna. En vista día las columnas comparten el mismo día,
  // por lo que el closure aplica a todas o a ninguna.
  const closureByDay = useMemo(() => {
    return columns.map((c) => isDateInClosure(c.date, closures));
  }, [columns, closures]);

  // Business hours per day of week (0=Sun..6=Sat)
  const DOW_MAP: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
  const businessHoursByDow = useMemo(() => {
    const map = new Map<number, { isOpen: boolean; start: number; end: number }>();
    for (const bh of businessHours) {
      const dow = DOW_MAP[bh.dayOfWeek];
      if (dow === undefined) continue;
      const start = bh.startTime ? parseInt(bh.startTime.split(':')[0]) * 60 + parseInt(bh.startTime.split(':')[1]) : HOUR_START * 60;
      const end = bh.endTime ? parseInt(bh.endTime.split(':')[0]) * 60 + parseInt(bh.endTime.split(':')[1]) : HOUR_END * 60;
      map.set(dow, { isOpen: bh.isOpen, start, end });
    }
    return map;
  }, [businessHours]);

  // Time-offs por columna. En vista día, cada columna solo ve los time-offs
  // del empleado al que pertenece. En vista semana, todos los time-offs del día.
  const timeOffsByDay = useMemo(() => {
    return columns.map((col) => {
      const dayStr = col.date.format('YYYY-MM-DD');
      return employeeTimeOffs.filter((to) => {
        const toStart = to.startDatetime.split('T')[0];
        const toEnd = to.endDatetime.split('T')[0];
        const dateMatches = dayStr >= toStart && dayStr <= toEnd;
        if (!dateMatches) return false;
        if (col.employee) return to.employeeId === col.employee.id;
        return true;
      });
    });
  }, [columns, employeeTimeOffs]);

  // --- Drag & Drop ---
  const pixelToSlot = useCallback(
    (clientX: number, clientY: number): { dayIndex: number; totalMinutes: number } | null => {
      if (!gridBodyRef.current) return null;
      const rect = gridBodyRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top + gridBodyRef.current.scrollTop;

      // Calculate day index from x position
      const dayWidth = (rect.width - HORA_COL_WIDTH) / numDays;
      const dayIndex = Math.floor((x - HORA_COL_WIDTH) / dayWidth);
      if (dayIndex < 0 || dayIndex >= numDays) return null;

      // Calculate minutes from y position
      const minutesFromStart = (y / SLOT_HEIGHT) * SLOT_MINUTES;
      const totalMinutes = HOUR_START * 60 + minutesFromStart;

      // Snap to SNAP_MINUTES intervals
      const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const clamped = Math.max(HOUR_START * 60, Math.min(snapped, HOUR_END * 60));

      return { dayIndex, totalMinutes: clamped };
    },
    [numDays],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, apt: Appointment) => {
      if (!DRAGGABLE_STATUSES.has(apt.status?.toLowerCase())) return;
      if (!onAppointmentDragEnd) return;

      e.preventDefault();
      e.stopPropagation();

      const startMins = timeToMinutes(apt.startTime);
      const endMins = timeToMinutes(apt.endTime);
      const durationMinutes = endMins - startMins;

      const aptDay = dayjs(apt.startTime);
      // En vista día por empleado, fijamos la columna a la del empleado dueño.
      const originalDayIndex = viewMode === 'day' && dayEmployees.length > 0
        ? columns.findIndex((c) => c.employee?.id === apt.employeeId)
        : columns.findIndex((c) => c.date.isSame(aptDay, 'day'));

      setDragState({
        appointmentId: apt.id,
        appointment: apt,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
        ghostTop: ((startMins - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT,
        ghostDayIndex: originalDayIndex >= 0 ? originalDayIndex : 0,
        ghostMinutes: startMins,
        originalDayIndex: originalDayIndex >= 0 ? originalDayIndex : 0,
        durationMinutes,
      });
    },
    [columns, viewMode, dayEmployees, onAppointmentDragEnd],
  );

  useEffect(() => {
    if (!dragState) return;

    function handleMouseMove(e: MouseEvent) {
      setDragState((prev) => {
        if (!prev) return null;

        const dx = e.clientX - prev.startX;
        const dy = e.clientY - prev.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!prev.isDragging && distance < 5) return prev;

        const slot = pixelToSlot(e.clientX, e.clientY);
        if (!slot) return { ...prev, isDragging: true };

        // Clamp so appointment doesn't extend past HOUR_END
        const maxStart = HOUR_END * 60 - prev.durationMinutes;
        const clampedMinutes = Math.min(slot.totalMinutes, maxStart);

        const ghostTop = ((clampedMinutes - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;

        return {
          ...prev,
          isDragging: true,
          ghostTop,
          ghostDayIndex: slot.dayIndex,
          ghostMinutes: clampedMinutes,
        };
      });
    }

    function handleMouseUp() {
      setDragState((prev) => {
        if (!prev) return null;

        if (prev.isDragging && onAppointmentDragEnd) {
          // En vista día por empleado, las columnas representan empleados,
          // no días: el día destino siempre es `date`.
          const targetCol = columns[prev.ghostDayIndex];
          const newDay = targetCol?.date;
          if (newDay) {
            const closure = isDateInClosure(newDay, closures);
            if (!closure) {
              // Construir el datetime en zona LOCAL del usuario y convertir a
              // ISO con Z. Antes mandabamos "YYYY-MM-DDTHH:mm:00" sin offset
              // y el backend lo interpretaba como UTC, lo que causaba desfase
              // de horas igual al offset local.
              const hh = Math.floor(prev.ghostMinutes / 60);
              const mm = prev.ghostMinutes % 60;
              const newStartTime = newDay
                .hour(hh)
                .minute(mm)
                .second(0)
                .millisecond(0)
                .toISOString();

              // Only call if actually changed
              const origMins = timeToMinutes(prev.appointment.startTime);
              const origDay = prev.originalDayIndex;
              if (prev.ghostMinutes !== origMins || prev.ghostDayIndex !== origDay) {
                onAppointmentDragEnd(prev.appointmentId, newStartTime);
              }
            }
          }
        } else if (!prev.isDragging) {
          // It was a click, not a drag
          onAppointmentClick(prev.appointment);
        }

        return null;
      });
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, pixelToSlot, columns, closures, onAppointmentDragEnd, onAppointmentClick]);

  // --- Slot click handler ---
  function handleSlotClick(e: React.MouseEvent<HTMLDivElement>) {
    if (dragState) return;
    const slot = pixelToSlot(e.clientX, e.clientY);
    if (!slot) return;

    const closure = closureByDay[slot.dayIndex];
    if (closure) return;

    const col = columns[slot.dayIndex];
    if (!col) return;
    const timeStr = minutesToTimeStr(slot.totalMinutes);
    onSlotClick(`${col.date.format('YYYY-MM-DD')}T${timeStr}:00`);
  }

  // --- Grid body height ---
  const gridBodyHeight = TOTAL_SLOTS * SLOT_HEIGHT;

  // --- Current time indicator position ---
  const showTimeIndicator = nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;
  const timeIndicatorTop = ((nowMinutes - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;

  // --- Render ---
  const GAP = 3;
  // Vista día con columnas por empleado: scroll horizontal + columna horas fija
  const isEmployeeView = viewMode === 'day' && columns.some((c) => !!c.employee);
  const gridTemplateColumns = isEmployeeView
    ? `${HORA_COL_WIDTH}px repeat(${numDays}, ${EMPLOYEE_COL_WIDTH}px)`
    : `${HORA_COL_WIDTH}px repeat(${numDays}, 1fr)`;
  const innerMinWidth = isEmployeeView
    ? `${HORA_COL_WIDTH + numDays * EMPLOYEE_COL_WIDTH}px`
    : undefined;
  // Estilos para fijar la columna de horas (sticky) cuando hay scroll horizontal.
  // zIndex 15 supera el z-10 de los bloques de cita: al scrollear, el contenido
  // desaparece DETRÁS de la columna de horas en vez de superponerse.
  const stickyColStyle: React.CSSProperties = isEmployeeView
    ? {
        position: 'sticky',
        left: 0,
        zIndex: 15,
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }
    : {};
  const stickyCornerStyle: React.CSSProperties = isEmployeeView
    ? {
        position: 'sticky',
        left: 0,
        zIndex: 16,
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }
    : {};

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-surface)' }}>
      {/* Day headers — overflow oculto, scroll sincronizado con el body */}
      <div
        ref={headerRef}
        className="border-b overflow-x-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          minWidth: innerMinWidth,
        }}
      >
        {/* Empty corner cell (sticky en vista empleado) */}
        <div className="py-2" style={stickyCornerStyle} />

        {columns.map((col, i) => {
          const day = col.date;
          const closure = closureByDay[i];
          const dayTimeOffs = timeOffsByDay[i];
          const hasTimeOffs = dayTimeOffs.length > 0 && !closure;
          const dayBh = businessHoursByDow.get(day.day());
          const isDayClosed = closure || (dayBh && !dayBh.isOpen);
          // Vista día por empleado: header con avatar + nombre + número de citas
          if (col.employee) {
            const emp = col.employee;
            const empColor = emp.color || '#008080';
            const aptCount = (appointmentsByDay.get(i) || []).length;
            const initials = `${emp.firstName?.[0] ?? ''}${emp.lastName?.[0] ?? ''}`.toUpperCase();
            return (
              <div
                key={col.key}
                className="flex items-center gap-2 px-2 md:px-3 py-2 border-l border-[var(--border)] min-w-0"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 text-[11px] font-bold text-white"
                  style={{ backgroundColor: empColor }}
                >
                  {emp.avatarUrl ? (
                    <img
                      src={emp.avatarUrl.startsWith('http') ? emp.avatarUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${emp.avatarUrl}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials || '·'}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate text-[var(--text-primary)]">
                    {emp.firstName}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {aptCount} {aptCount === 1 ? 'cita' : 'citas'}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div
              key={col.key}
              className={`text-center py-2 border-l border-[var(--border)] relative group ${
                isDayClosed ? 'bg-[var(--bg-muted)]' : isToday(day) ? 'bg-primary-50' : ''
              }`}
            >
              <p className="text-xs uppercase text-[var(--text-secondary)]">
                {day.format('ddd')}
              </p>
              <p
                className={`text-lg font-semibold ${
                  isDayClosed
                    ? 'text-[var(--text-muted)]'
                    : isToday(day)
                      ? 'text-primary-600'
                      : 'text-[var(--text-primary)]'
                }`}
              >
                {day.format('D')}
              </p>
              {isDayClosed && (
                <p className="text-xs text-[var(--text-muted)] truncate px-1">Cerrado</p>
              )}
              {hasTimeOffs && (
                <>
                  <div className="flex justify-center gap-0.5 mt-0.5">
                    {dayTimeOffs.map((to) => (
                      <span
                        key={to.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: to.employee?.color || '#6b7280' }}
                      />
                    ))}
                  </div>
                  {/* Tooltip on hover */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 hidden group-hover:block w-52">
                    <div className="bg-gray-900 text-white rounded-lg shadow-lg px-3 py-2 text-left">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Permisos / Ausencias</p>
                      {dayTimeOffs.map((to) => {
                        const empColor = to.employee?.color || '#6b7280';
                        const empName = to.employee
                          ? `${to.employee.firstName} ${to.employee.lastName.charAt(0)}.`
                          : 'Empleado';
                        const startH = new Date(to.startDatetime).toTimeString().slice(0, 5);
                        const endH = new Date(to.endDatetime).toTimeString().slice(0, 5);
                        return (
                          <div key={to.id} className="flex items-start gap-2 py-1">
                            <span
                              className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                              style={{ backgroundColor: empColor }}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">{empName}</p>
                              <p className="text-[10px] text-gray-300">
                                {formatTime(startH)} - {formatTime(endH)}
                              </p>
                              {to.reason && (
                                <p className="text-[10px] text-gray-400 truncate">{to.reason}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* Scrollable grid body — scroll vertical siempre, horizontal solo en vista empleado */}
      <div className={`flex-1 overflow-y-auto ${isEmployeeView ? 'overflow-x-auto' : ''}`} ref={gridBodyRef}>
        <div className="relative" style={{ height: gridBodyHeight, minWidth: innerMinWidth }}>
          {/* Grid lines + time labels using CSS Grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              display: 'grid',
              gridTemplateColumns,
              gridTemplateRows: `repeat(${TOTAL_SLOTS}, ${SLOT_HEIGHT}px)`,
            }}
          >
            {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
              const isHourLine = slotIdx % 2 === 0;
              const hour = HOUR_START + Math.floor(slotIdx / 2);
              return (
                <React.Fragment key={slotIdx}>
                  {/* Time label cell — sticky en vista empleado */}
                  <div
                    className="relative pr-2 text-right"
                    style={{ gridRow: slotIdx + 1, gridColumn: 1, ...stickyColStyle }}
                  >
                    {isHourLine && (
                      <span className={`text-xs text-[var(--text-muted)] absolute right-2 ${slotIdx === 0 ? 'top-1' : '-top-2'}`}>
                        {formatHourLabel(hour)}
                      </span>
                    )}
                  </div>

                  {/* Day cells with grid lines */}
                  {columns.map((col, dayIdx) => {
                    const day = col.date;
                    const dow = day.day();
                    const bh = businessHoursByDow.get(dow);
                    const isClosed = bh ? !bh.isOpen : false;
                    const slotMinutes = HOUR_START * 60 + slotIdx * SLOT_MINUTES;
                    const isOutsideHours = bh && bh.isOpen ? (slotMinutes < bh.start || slotMinutes >= bh.end) : false;
                    const isDisabled = isClosed || isOutsideHours;
                    return (
                      <div
                        key={dayIdx}
                        className={`border-l border-[var(--border)] ${
                          isHourLine
                            ? 'border-t border-t-[var(--border)]'
                            : 'border-t border-t-[var(--border)] border-dashed'
                        } ${isDisabled ? 'bg-[var(--bg-subtle)]' : ''}`}
                        style={{ gridRow: slotIdx + 1, gridColumn: dayIdx + 2 }}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>

          {/* Clickable overlay for creating appointments */}
          <div
            className="absolute inset-0"
            style={{ left: HORA_COL_WIDTH, cursor: 'pointer' }}
            onClick={handleSlotClick}
          />

          {/* Closure overlays */}
          {columns.map((_, dayIdx) => {
            const closure = closureByDay[dayIdx];
            if (!closure) return null;
            return (
              <div
                key={`closure-${dayIdx}`}
                className="absolute z-20 flex flex-col items-center justify-center pointer-events-none bg-[var(--bg-muted)]/80"
                style={{
                  top: 0,
                  height: gridBodyHeight,
                  left: `calc(${HORA_COL_WIDTH}px + ${dayIdx} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}))`,
                  width: `calc((100% - ${HORA_COL_WIDTH}px) / ${numDays})`,
                }}
              >
                <svg className="w-6 h-6 text-[var(--text-secondary)] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-sm font-semibold text-[var(--text-secondary)]">Cerrado</span>
                <span className="text-xs text-[var(--text-muted)] mt-0.5 px-2 text-center">{closure.reason}</span>
              </div>
            );
          })}

          {/* Appointment blocks */}
          {columns.map((_, dayIdx) => {
            if (closureByDay[dayIdx]) return null;
            const dayApts = appointmentsByDay.get(dayIdx) || [];
            const layout = layoutsByDay.get(dayIdx) || new Map();

            return dayApts.map((apt) => {
              const startMins = timeToMinutes(apt.startTime);
              const endMins = timeToMinutes(apt.endTime);
              const durationMins = endMins - startMins;

              const top = ((startMins - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
              const height = Math.max((durationMins / SLOT_MINUTES) * SLOT_HEIGHT - 2, 18);

              const info = layout.get(apt.id) || { column: 0, totalColumns: 1 };
              const { column: col, totalColumns: totalCols } = info;

              const employeeColor = apt.employee?.color || '#008080';
              const rgb = hexToRgb(employeeColor);
              const bgColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)` : 'rgba(0, 128, 128, 0.12)';
              const statusLower = apt.status?.toLowerCase() || '';
              const statusExtra = STATUS_DECORATIONS[statusLower] || '';
              const statusDotColor = STATUS_DOT_COLORS[statusLower] || '#9ca3af';
              const isDraggable = DRAGGABLE_STATUSES.has(statusLower);
              const isBeingDragged = dragState?.appointmentId === apt.id && dragState?.isDragging;

              const serviceName = apt.items?.[0]?.serviceNameSnapshot || 'Servicio';
              const extraServices = (apt.items?.length || 1) - 1;
              const serviceLabel = extraServices > 0 ? `${serviceName} +${extraServices}` : serviceName;

              const clientName = apt.client
                ? `${apt.client.firstName} ${apt.client.lastName}`
                : 'Cliente';
              const empShort = apt.employee
                ? `${apt.employee.firstName} ${apt.employee.lastName.charAt(0)}.`
                : '';

              const startTimeStr = new Date(apt.startTime).toTimeString().slice(0, 5);
              const endTimeStr = new Date(apt.endTime).toTimeString().slice(0, 5);

              return (
                <div
                  key={apt.id}
                  className={`absolute rounded-lg border-l-[3px] px-2 py-0.5 overflow-hidden transition-shadow z-10 select-none ${statusExtra} ${
                    isBeingDragged ? 'opacity-40' : 'hover:shadow-md'
                  } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                  style={{
                    top,
                    height,
                    left: `calc(${HORA_COL_WIDTH}px + ${dayIdx} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}) + ${col} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}) / ${totalCols} + ${GAP}px)`,
                    width: `calc(((100% - ${HORA_COL_WIDTH}px) / ${numDays}) / ${totalCols} - ${GAP * 2}px)`,
                    borderLeftColor: employeeColor,
                    backgroundColor: bgColor,
                  }}
                  onMouseDown={(e) => {
                    if (isDraggable && onAppointmentDragEnd) {
                      handleMouseDown(e, apt);
                    }
                  }}
                  onClick={(e) => {
                    if (!isDraggable || !onAppointmentDragEnd) {
                      e.stopPropagation();
                      onAppointmentClick(apt);
                    }
                    // For draggable appointments, click is handled in mouseUp
                  }}
                >
                  {/* Time in employee color */}
                  <p className="text-[10px] font-semibold leading-tight truncate" style={{ color: employeeColor }}>
                    {formatTime(startTimeStr)} - {formatTime(endTimeStr)}
                  </p>

                  {/* Client name + status dot */}
                  <div className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: statusDotColor }}
                    />
                    <p className="text-xs font-bold truncate text-[var(--text-primary)]">
                      {clientName}
                    </p>
                  </div>

                  {/* Employee + service info (only if block tall enough) */}
                  {height > 42 && (
                    <p className="text-[10px] truncate text-[var(--text-secondary)] leading-tight">
                      {empShort}{empShort ? ' · ' : ''}{serviceLabel}
                    </p>
                  )}
                </div>
              );
            });
          })}

          {/* Drag ghost */}
          {dragState?.isDragging && (
            <div
              className="absolute rounded-lg border-2 border-dashed z-40 pointer-events-none"
              style={{
                top: dragState.ghostTop,
                height: Math.max((dragState.durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT - 2, 18),
                left: `calc(${HORA_COL_WIDTH}px + ${dragState.ghostDayIndex} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}) + ${GAP}px)`,
                width: `calc((100% - ${HORA_COL_WIDTH}px) / ${numDays} - ${GAP * 2}px)`,
                borderColor: 'rgba(59, 130, 246, 0.5)',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                transition: 'top 75ms ease, left 75ms ease',
              }}
            >
              <div className="px-2 py-1 text-xs font-semibold text-blue-600">
                {formatTime(minutesToTimeStr(dragState.ghostMinutes))}
              </div>
            </div>
          )}

          {/* Current time indicator */}
          {showTimeIndicator && todayIndex >= 0 && (
            <div
              className="absolute z-30 pointer-events-none"
              style={{
                top: timeIndicatorTop,
                left: HORA_COL_WIDTH - 4,
                right: 0,
              }}
            >
              {/* Punto rojo a la izquierda — marca la hora actual */}
              <div
                className="absolute rounded-full bg-danger-600 shadow-sm"
                style={{
                  width: 10,
                  height: 10,
                  top: -4,
                  left: 0,
                }}
              />
              {/* Linea horizontal de la hora actual */}
              <div
                className="border-t-2 border-danger-600"
                style={{
                  marginLeft: 10,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

