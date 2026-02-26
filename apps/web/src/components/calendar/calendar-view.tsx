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

interface CalendarViewProps {
  date: Dayjs;
  appointments: Appointment[];
  viewMode: 'day' | 'week';
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onAppointmentDragEnd?: (appointmentId: string, newStartTime: string) => void;
  closures?: BusinessClosure[];
  employeeTimeOffs?: EmployeeTimeOff[];
}

const HOUR_START = 7;
const HOUR_END = 21;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 40; // px per 30-min slot
const TOTAL_SLOTS = TOTAL_HOURS * 2; // 28 slots
const HEADER_HEIGHT = 0; // header is outside the grid body
const HORA_COL_WIDTH = 60; // px for time labels column
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

function getTimeOffStyle(
  startDatetime: string,
  endDatetime: string,
  dayStr: string,
): { top: number; height: number } {
  const dayStart = HOUR_START * 60;
  const dayEnd = HOUR_END * 60;

  let startMins = timeToMinutes(startDatetime);
  let endMins = timeToMinutes(endDatetime);

  const toStartDate = new Date(startDatetime).toISOString().split('T')[0];
  const toEndDate = new Date(endDatetime).toISOString().split('T')[0];

  if (toStartDate < dayStr) startMins = dayStart;
  if (toEndDate > dayStr) endMins = dayEnd;

  startMins = Math.max(startMins, dayStart);
  endMins = Math.min(endMins, dayEnd);

  if (endMins <= startMins) return { top: 0, height: 0 };

  const startOffset = startMins - dayStart;
  const durationMins = endMins - startMins;

  const top = (startOffset / SLOT_MINUTES) * SLOT_HEIGHT;
  const height = Math.max((durationMins / SLOT_MINUTES) * SLOT_HEIGHT, 10);

  return { top, height };
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
}: CalendarViewProps) {
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
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

  const weekDays = useMemo(
    () =>
      viewMode === 'week'
        ? Array.from({ length: 7 }, (_, i) => date.startOf('week').add(i, 'day'))
        : [date],
    [date, viewMode],
  );

  const numDays = weekDays.length;

  const isToday = (d: Dayjs) => d.isSame(dayjs(), 'day');
  const todayIndex = useMemo(() => {
    const today = dayjs();
    return weekDays.findIndex((d) => d.isSame(today, 'day'));
  }, [weekDays]);

  // Group appointments by day
  const appointmentsByDay = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    weekDays.forEach((_, i) => map.set(i, []));
    for (const apt of appointments) {
      const aptDay = dayjs(apt.startTime);
      for (let i = 0; i < weekDays.length; i++) {
        if (aptDay.isSame(weekDays[i], 'day')) {
          map.get(i)!.push(apt);
          break;
        }
      }
    }
    return map;
  }, [appointments, weekDays]);

  // Overlap layouts per day
  const layoutsByDay = useMemo(() => {
    const map = new Map<number, Map<string, LayoutInfo>>();
    for (const [dayIdx, dayApts] of appointmentsByDay) {
      map.set(dayIdx, computeOverlapLayout(dayApts));
    }
    return map;
  }, [appointmentsByDay]);

  // Closures per day
  const closureByDay = useMemo(() => {
    return weekDays.map((d) => isDateInClosure(d, closures));
  }, [weekDays, closures]);

  // Time-offs per day
  const timeOffsByDay = useMemo(() => {
    return weekDays.map((day) => {
      const dayStr = day.format('YYYY-MM-DD');
      return employeeTimeOffs.filter((to) => {
        const toStart = to.startDatetime.split('T')[0];
        const toEnd = to.endDatetime.split('T')[0];
        return dayStr >= toStart && dayStr <= toEnd;
      });
    });
  }, [weekDays, employeeTimeOffs]);

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
      const originalDayIndex = weekDays.findIndex((d) => d.isSame(aptDay, 'day'));

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
    [weekDays, onAppointmentDragEnd],
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
          const newDay = weekDays[prev.ghostDayIndex];
          if (newDay) {
            const closure = isDateInClosure(newDay, closures);
            if (!closure) {
              const newDateStr = newDay.format('YYYY-MM-DD');
              const newTimeStr = minutesToTimeStr(prev.ghostMinutes);
              const newStartTime = `${newDateStr}T${newTimeStr}:00`;

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
  }, [dragState, pixelToSlot, weekDays, closures, onAppointmentDragEnd, onAppointmentClick]);

  // --- Slot click handler ---
  function handleSlotClick(e: React.MouseEvent<HTMLDivElement>) {
    if (dragState) return;
    const slot = pixelToSlot(e.clientX, e.clientY);
    if (!slot) return;

    const closure = closureByDay[slot.dayIndex];
    if (closure) return;

    const day = weekDays[slot.dayIndex];
    const timeStr = minutesToTimeStr(slot.totalMinutes);
    onSlotClick(`${day.format('YYYY-MM-DD')}T${timeStr}:00`);
  }

  // --- Grid body height ---
  const gridBodyHeight = TOTAL_SLOTS * SLOT_HEIGHT;

  // --- Current time indicator position ---
  const showTimeIndicator = nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;
  const timeIndicatorTop = ((nowMinutes - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;

  // --- Render ---
  const GAP = 3;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Day headers */}
      <div
        className="border-b border-gray-200 bg-white"
        style={{
          display: 'grid',
          gridTemplateColumns: `${HORA_COL_WIDTH}px repeat(${numDays}, 1fr)`,
        }}
      >
        {/* Empty corner cell */}
        <div className="py-2" />

        {weekDays.map((day, i) => {
          const closure = closureByDay[i];
          return (
            <div
              key={day.format('YYYY-MM-DD')}
              className={`text-center py-2 border-l border-gray-100 ${
                closure ? 'bg-gray-100' : isToday(day) ? 'bg-blue-50/50' : ''
              }`}
            >
              <p className="text-xs text-gray-500 uppercase">
                {day.format('ddd')}
              </p>
              <p
                className={`text-lg font-semibold ${
                  closure
                    ? 'text-gray-400'
                    : isToday(day)
                      ? 'text-blue-600'
                      : 'text-gray-900'
                }`}
              >
                {day.format('D')}
              </p>
              {closure && (
                <p className="text-xs text-gray-400 truncate px-1">Cerrado</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable grid body */}
      <div className="flex-1 overflow-y-auto" ref={gridBodyRef}>
        <div className="relative" style={{ height: gridBodyHeight }}>
          {/* Grid lines + time labels using CSS Grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              display: 'grid',
              gridTemplateColumns: `${HORA_COL_WIDTH}px repeat(${numDays}, 1fr)`,
              gridTemplateRows: `repeat(${TOTAL_SLOTS}, ${SLOT_HEIGHT}px)`,
            }}
          >
            {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
              const isHourLine = slotIdx % 2 === 0;
              const hour = HOUR_START + Math.floor(slotIdx / 2);
              return (
                <React.Fragment key={slotIdx}>
                  {/* Time label cell */}
                  <div
                    className="relative pr-2 text-right"
                    style={{ gridRow: slotIdx + 1, gridColumn: 1 }}
                  >
                    {isHourLine && (
                      <span className="text-xs text-gray-400 absolute -top-2 right-2">
                        {formatHourLabel(hour)}
                      </span>
                    )}
                  </div>

                  {/* Day cells with grid lines */}
                  {weekDays.map((_, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={`border-l border-gray-100 ${
                        isHourLine
                          ? 'border-t border-t-gray-200'
                          : 'border-t border-t-gray-100 border-dashed'
                      }`}
                      style={{ gridRow: slotIdx + 1, gridColumn: dayIdx + 2 }}
                    />
                  ))}
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
          {weekDays.map((day, dayIdx) => {
            const closure = closureByDay[dayIdx];
            if (!closure) return null;
            return (
              <div
                key={`closure-${dayIdx}`}
                className="absolute bg-gray-200/60 z-20 flex flex-col items-center justify-center pointer-events-none"
                style={{
                  top: 0,
                  height: gridBodyHeight,
                  left: `calc(${HORA_COL_WIDTH}px + ${dayIdx} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}))`,
                  width: `calc((100% - ${HORA_COL_WIDTH}px) / ${numDays})`,
                }}
              >
                <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-sm font-semibold text-gray-600">Cerrado</span>
                <span className="text-xs text-gray-500 mt-0.5 px-2 text-center">{closure.reason}</span>
              </div>
            );
          })}

          {/* Employee time-off blocks */}
          {weekDays.map((day, dayIdx) => {
            if (closureByDay[dayIdx]) return null;
            const dayStr = day.format('YYYY-MM-DD');
            const dayTimeOffs = timeOffsByDay[dayIdx];
            return dayTimeOffs.map((to) => {
              const { top, height } = getTimeOffStyle(to.startDatetime, to.endDatetime, dayStr);
              if (height <= 0) return null;
              const empColor = to.employee?.color || '#6b7280';
              const rgb = hexToRgb(empColor);
              const bgColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` : 'rgba(107, 114, 128, 0.15)';
              const empName = to.employee ? `${to.employee.firstName} ${to.employee.lastName.charAt(0)}.` : '';

              return (
                <div
                  key={to.id}
                  className="absolute rounded-md border border-dashed overflow-hidden z-[5] pointer-events-none"
                  style={{
                    top,
                    height,
                    left: `calc(${HORA_COL_WIDTH}px + ${dayIdx} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}) + 4px)`,
                    width: `calc((100% - ${HORA_COL_WIDTH}px) / ${numDays} - 8px)`,
                    borderColor: empColor,
                    backgroundColor: bgColor,
                    backgroundImage: `repeating-linear-gradient(
                      -45deg,
                      transparent,
                      transparent 4px,
                      ${rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)` : 'rgba(107, 114, 128, 0.08)'} 4px,
                      ${rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)` : 'rgba(107, 114, 128, 0.08)'} 8px
                    )`,
                  }}
                >
                  <div className="px-1.5 py-0.5">
                    <p className="text-xs font-medium truncate" style={{ color: empColor }}>
                      {empName} - {to.reason || 'Ausencia'}
                    </p>
                  </div>
                </div>
              );
            });
          })}

          {/* Appointment blocks */}
          {weekDays.map((_, dayIdx) => {
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
                    <p className="text-xs font-bold truncate text-gray-900">
                      {clientName}
                    </p>
                  </div>

                  {/* Employee + service info (only if block tall enough) */}
                  {height > 42 && (
                    <p className="text-[10px] truncate text-gray-600 leading-tight">
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
              {/* Red circle on the left */}
              <div
                className="absolute rounded-full bg-red-500"
                style={{
                  width: 8,
                  height: 8,
                  top: -3,
                  left: 0,
                }}
              />
              {/* Red line */}
              <div
                className="border-t-2 border-red-500"
                style={{
                  marginLeft: 8,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

