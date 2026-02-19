'use client';

import dayjs, { type Dayjs } from 'dayjs';
import { formatTime } from '@/lib/utils';

interface AppointmentItem {
  service?: { name: string; color?: string };
  price?: number;
}

interface Appointment {
  id: string;
  clientId: string;
  client?: { firstName: string; lastName: string };
  employeeId: string;
  employee?: { firstName: string; lastName: string };
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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  confirmed: 'bg-blue-100 border-blue-400 text-blue-800',
  in_progress: 'bg-purple-100 border-purple-400 text-purple-800',
  completed: 'bg-green-100 border-green-400 text-green-800',
  cancelled: 'bg-gray-100 border-gray-400 text-gray-500 line-through',
  no_show: 'bg-red-100 border-red-300 text-red-700',
};

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
        const colorClass = STATUS_COLORS[apt.status] || STATUS_COLORS.pending;
        const serviceName = apt.items?.[0]?.service?.name || 'Servicio';
        const serviceColor = apt.items?.[0]?.service?.color;

        return (
          <div
            key={apt.id}
            className={`absolute left-1 right-1 rounded-lg border-l-4 px-2 py-1 overflow-hidden cursor-pointer hover:shadow-md transition-shadow z-10 ${colorClass}`}
            style={{
              top,
              height,
              borderLeftColor: serviceColor || undefined,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAppointmentClick(apt);
            }}
          >
            <p className="text-xs font-semibold truncate">
              {apt.client
                ? `${apt.client.firstName} ${apt.client.lastName}`
                : 'Cliente'}
            </p>
            <p className="text-xs truncate opacity-80">{serviceName}</p>
            {height > 40 && (
              <p className="text-xs opacity-60">
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
