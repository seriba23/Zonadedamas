'use client';

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

interface CalendarViewProps {
  date: Dayjs;
  appointments: Appointment[];
  viewMode: 'day' | 'week';
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

const HOUR_START = 7;
const HOUR_END = 21;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const SLOT_HEIGHT = 60; // px per hour
const CONTAINER_HEIGHT = TOTAL_HOURS * SLOT_HEIGHT;

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

function getAppointmentStyle(
  startTime: string,
  endTime: string,
): { top: number; height: number } {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const startOffset = startMins - HOUR_START * 60;
  const durationMins = endMins - startMins;

  const top = (startOffset / 60) * SLOT_HEIGHT;
  const height = Math.max((durationMins / 60) * SLOT_HEIGHT, 20);

  return { top, height };
}

const STATUS_DECORATIONS: Record<string, string> = {
  cancelled: 'line-through opacity-50',
  no_show: 'opacity-60',
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

  // Group into overlap clusters
  const clusters: Appointment[][] = [];
  let currentCluster: Appointment[] = [sorted[0]];
  let clusterEnd = new Date(sorted[0].endTime).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const apt = sorted[i];
    const aptStart = new Date(apt.startTime).getTime();
    if (aptStart < clusterEnd) {
      // Overlaps with current cluster
      currentCluster.push(apt);
      clusterEnd = Math.max(clusterEnd, new Date(apt.endTime).getTime());
    } else {
      clusters.push(currentCluster);
      currentCluster = [apt];
      clusterEnd = new Date(apt.endTime).getTime();
    }
  }
  clusters.push(currentCluster);

  // Assign columns within each cluster
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

function DayColumn({
  date,
  appointments,
  onSlotClick,
  onAppointmentClick,
}: {
  date: Dayjs;
  appointments: Appointment[];
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}) {
  const dayAppointments = appointments.filter((apt) =>
    dayjs(apt.startTime).isSame(date, 'day'),
  );

  const layout = computeOverlapLayout(dayAppointments);

  function handleSlotClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = Math.floor((y / SLOT_HEIGHT) * 60) + HOUR_START * 60;
    const hours = Math.floor(minutesFromStart / 60);
    const minutes = Math.floor((minutesFromStart % 60) / 15) * 15;
    const timeStr = date.format('YYYY-MM-DD') +
      `T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    onSlotClick(timeStr);
  }

  const GAP = 4; // px gap between columns and edges

  return (
    <div
      className="relative flex-1 cursor-pointer"
      style={{ height: CONTAINER_HEIGHT }}
      onClick={handleSlotClick}
    >
      {/* Hour grid lines */}
      {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
        <div
          key={i}
          className="absolute w-full border-t border-gray-100"
          style={{ top: i * SLOT_HEIGHT }}
        />
      ))}

      {/* Half-hour lines */}
      {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
        <div
          key={`half-${i}`}
          className="absolute w-full border-t border-dashed border-gray-50"
          style={{ top: i * SLOT_HEIGHT + SLOT_HEIGHT / 2 }}
        />
      ))}

      {/* Appointments */}
      {dayAppointments.map((apt) => {
        const { top, height } = getAppointmentStyle(apt.startTime, apt.endTime);
        const serviceName = apt.items?.[0]?.serviceNameSnapshot || 'Servicio';
        const totalPrice = apt.items?.reduce((sum, item) => sum + (Number(item.priceSnapshot) || 0), 0) ?? 0;
        const employeeColor = apt.employee?.color || '#008080';
        const rgb = hexToRgb(employeeColor);
        const bgColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)` : 'rgba(0, 128, 128, 0.12)';
        const statusExtra = STATUS_DECORATIONS[apt.status] || '';

        const info = layout.get(apt.id) || { column: 0, totalColumns: 1 };
        const widthPercent = 100 / info.totalColumns;
        const leftPercent = info.column * widthPercent;

        return (
          <div
            key={apt.id}
            className={`absolute rounded-lg border-l-4 px-2 py-1 overflow-hidden cursor-pointer hover:shadow-md transition-shadow z-10 ${statusExtra}`}
            style={{
              top,
              height,
              left: `calc(${leftPercent}% + ${GAP}px)`,
              width: `calc(${widthPercent}% - ${GAP * 2}px)`,
              borderLeftColor: employeeColor,
              backgroundColor: bgColor,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAppointmentClick(apt);
            }}
          >
            <p className="text-xs font-semibold truncate text-gray-900">
              {apt.client
                ? `${apt.client.firstName} ${apt.client.lastName}`
                : 'Cliente'}
            </p>
            <p className="text-xs truncate text-gray-700">
              {serviceName}{totalPrice > 0 ? ` · $${totalPrice.toFixed(2)}` : ''}
            </p>
            {height > 40 && (
              <p className="text-xs text-gray-500">
                {formatTime(
                  new Date(apt.startTime).toTimeString().slice(0, 5),
                )}
                {' - '}
                {formatTime(new Date(apt.endTime).toTimeString().slice(0, 5))}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CalendarView({
  date,
  appointments,
  viewMode,
  onSlotClick,
  onAppointmentClick,
}: CalendarViewProps) {
  const hours = Array.from(
    { length: TOTAL_HOURS },
    (_, i) => i + HOUR_START,
  );

  // For week view, generate all 7 days
  const weekDays = viewMode === 'week'
    ? Array.from({ length: 7 }, (_, i) => date.startOf('week').add(i, 'day'))
    : [date];

  const isToday = (d: Dayjs) => d.isSame(dayjs(), 'day');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Day header for week view */}
      {viewMode === 'week' && (
        <div className="flex border-b border-gray-200 bg-white">
          <div className="w-16 flex-shrink-0" />
          {weekDays.map((day) => (
            <div
              key={day.format('YYYY-MM-DD')}
              className={`flex-1 text-center py-2 border-l border-gray-100 ${isToday(day) ? 'bg-primary-50' : ''}`}
            >
              <p className="text-xs text-gray-500 uppercase">
                {day.format('ddd')}
              </p>
              <p
                className={`text-lg font-semibold ${
                  isToday(day) ? 'text-primary-600' : 'text-gray-900'
                }`}
              >
                {day.format('D')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Scrollable calendar grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex">
          {/* Time labels */}
          <div
            className="w-16 flex-shrink-0 relative"
            style={{ height: CONTAINER_HEIGHT }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute w-full pr-2 text-right"
                style={{ top: (hour - HOUR_START) * SLOT_HEIGHT - 8 }}
              >
                <span className="text-xs text-gray-400">
                  {hour === 12
                    ? '12 PM'
                    : hour > 12
                      ? `${hour - 12} PM`
                      : `${hour} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 flex">
            {weekDays.map((day) => (
              <DayColumn
                key={day.format('YYYY-MM-DD')}
                date={day}
                appointments={appointments}
                onSlotClick={onSlotClick}
                onAppointmentClick={onAppointmentClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
