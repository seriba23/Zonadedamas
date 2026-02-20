'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/utils';

interface AvailableSlot {
  startTime: string;
  endTime: string;
  employeeId: string;
  employeeName?: string;
}

interface AvailabilityPickerProps {
  locationId?: string;
  serviceIds: string[];
  employeeId?: string;
  onSelect: (employeeId: string, startTime: string, endTime: string) => void;
}

export function AvailabilityPicker({
  locationId,
  serviceIds,
  employeeId,
  onSelect,
}: AvailabilityPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  const startOfMonth = selectedDate.startOf('month');
  const daysInMonth = selectedDate.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) =>
    startOfMonth.add(i, 'day'),
  );

  const dateStr = selectedDate.format('YYYY-MM-DD');

  const { data, isLoading } = useQuery({
    queryKey: [
      'availability',
      dateStr,
      serviceIds,
      employeeId,
      locationId,
    ],
    queryFn: () =>
      api.post<{ data: AvailableSlot[] }>('/api/availability/query', {
        startDate: dateStr,
        endDate: dateStr,
        serviceIds,
        employeeId: employeeId || undefined,
        locationId: locationId || undefined,
      }),
    enabled: serviceIds.length > 0,
  });

  const slots = data?.data || [];

  function handleSlotSelect(slot: AvailableSlot) {
    setSelectedSlot(slot);
    onSelect(slot.employeeId, slot.startTime, slot.endTime);
  }

  return (
    <div className="space-y-4">
      {/* Mini calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => {
              setSelectedDate((d) => d.subtract(1, 'month'));
              setSelectedSlot(null);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {selectedDate.format('MMMM YYYY')}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedDate((d) => d.add(1, 'month'));
              setSelectedSlot(null);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center mb-2">
          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((d) => (
            <div key={d} className="text-xs font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {calendarDays.map((day) => {
            const isToday = day.isSame(dayjs(), 'day');
            const isPast = day.isBefore(dayjs(), 'day');
            const isSelected = day.isSame(selectedDate, 'day');

            return (
              <button
                key={day.format('YYYY-MM-DD')}
                type="button"
                disabled={isPast}
                onClick={() => {
                  setSelectedDate(day);
                  setSelectedSlot(null);
                }}
                className={`text-sm py-1.5 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-primary-600 text-white font-semibold'
                    : isToday
                      ? 'bg-primary-100 text-primary-700 font-semibold'
                      : isPast
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {day.date()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Horarios disponibles
        </p>
        {serviceIds.length === 0 ? (
          <p className="text-sm text-gray-400">
            Selecciona un servicio primero
          </p>
        ) : isLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-9 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No hay horarios disponibles para esta fecha
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
            {slots.map((slot) => {
              const time = slot.startTime.includes('T')
                ? slot.startTime.split('T')[1].substring(0, 5)
                : slot.startTime.substring(0, 5);
              const isSelected = selectedSlot?.startTime === slot.startTime;
              return (
                <button
                  key={`${slot.employeeId}-${slot.startTime}`}
                  type="button"
                  onClick={() => handleSlotSelect(slot)}
                  className={`py-1.5 text-sm rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-300 text-gray-700 hover:border-primary-400 hover:bg-primary-50'
                  }`}
                >
                  {formatTime(time)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
