'use client';

import { useState, useEffect, useRef } from 'react';
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

interface AllSlotsSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

interface AllSlotsResponse {
  scheduleStart: string | null;
  scheduleEnd: string | null;
  slots: AllSlotsSlot[];
  closureReason?: string;
}

interface AvailabilityPickerProps {
  locationId?: string;
  serviceIds: string[];
  employeeId?: string;
  initialDateTime?: string; // e.g. "2026-02-22T09:00:00"
  onSelect: (employeeId: string, startTime: string, endTime: string) => void;
  onDateChange?: (dateStr: string) => void; // YYYY-MM-DD — fires when mini-calendar date changes
}

export function AvailabilityPicker({
  locationId,
  serviceIds,
  employeeId,
  initialDateTime,
  onSelect,
  onDateChange,
}: AvailabilityPickerProps) {
  const initialDate = initialDateTime ? dayjs(initialDateTime) : dayjs();
  const initialTime = initialDateTime ? initialDateTime.split('T')[1]?.substring(0, 5) : null;

  const [selectedDate, setSelectedDate] = useState<Dayjs>(initialDate);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const autoSelectedRef = useRef(false);

  const startOfMonth = selectedDate.startOf('month');
  const daysInMonth = selectedDate.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) =>
    startOfMonth.add(i, 'day'),
  );

  const dateStr = selectedDate.format('YYYY-MM-DD');

  // Si la fecha seleccionada es HOY, descartamos slots cuyo inicio ya pasó.
  // El backend no filtra por hora actual; el cajero no debe poder agendar
  // a las 9:00 cuando ya son las 9:45.
  const isToday = selectedDate.isSame(dayjs(), 'day');
  const isSlotPast = (slotStartTime: string): boolean => {
    if (!isToday) return false;
    // slotStartTime puede venir como "HH:mm" (all-slots) o como ISO completo.
    const time = slotStartTime.includes('T')
      ? slotStartTime.split('T')[1]?.substring(0, 5) || slotStartTime
      : slotStartTime;
    const [h, m] = time.split(':').map(Number);
    const slotDate = selectedDate.hour(h).minute(m).second(0);
    return slotDate.isBefore(dayjs());
  };

  // Use all-slots endpoint when a specific employee is selected
  const useAllSlots = !!employeeId;

  // Standard availability query (any employee or no specific employee).
  // staleTime=0 + refetchOnMount='always' garantiza que ver el componente
  // siempre dispara una consulta nueva — la disponibilidad cambia con cada
  // cita que se crea, no podemos servir cache stale.
  const standardQuery = useQuery({
    queryKey: ['availability', dateStr, serviceIds, employeeId, locationId],
    queryFn: () =>
      api.post<{ data: AvailableSlot[] }>('/api/availability/query', {
        startDate: dateStr,
        endDate: dateStr,
        serviceIds,
        employeeId: employeeId || undefined,
        locationId: locationId || undefined,
      }),
    enabled: serviceIds.length > 0 && !useAllSlots,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // All-slots query (specific employee selected)
  const allSlotsQuery = useQuery({
    queryKey: ['all-slots', dateStr, serviceIds, employeeId],
    queryFn: () =>
      api.post<{ data: AllSlotsResponse }>('/api/availability/all-slots', {
        date: dateStr,
        employeeId,
        serviceIds,
      }),
    enabled: serviceIds.length > 0 && useAllSlots,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const isLoading = useAllSlots ? allSlotsQuery.isLoading : standardQuery.isLoading;
  const standardSlots = standardQuery.data?.data || [];
  const allSlotsData = allSlotsQuery.data?.data;

  // Auto-select the initial time slot if available
  useEffect(() => {
    if (autoSelectedRef.current || !initialTime || selectedSlot) return;

    if (useAllSlots && allSlotsData && allSlotsData.slots.length > 0) {
      const match = allSlotsData.slots.find(
        (s) => s.startTime === initialTime && s.available,
      );
      if (match && employeeId) {
        autoSelectedRef.current = true;
        const fullStart = `${dateStr}T${match.startTime}:00`;
        const fullEnd = `${dateStr}T${match.endTime}:00`;
        setSelectedSlot({ startTime: fullStart, endTime: fullEnd, employeeId });
        onSelect(employeeId, fullStart, fullEnd);
      }
    } else if (!useAllSlots && standardSlots.length > 0) {
      const match = standardSlots.find((s) => {
        const time = s.startTime.includes('T')
          ? s.startTime.split('T')[1].substring(0, 5)
          : s.startTime.substring(0, 5);
        return time === initialTime;
      });
      if (match) {
        autoSelectedRef.current = true;
        setSelectedSlot(match);
        onSelect(match.employeeId, match.startTime, match.endTime);
      }
    }
  }, [allSlotsData, standardSlots, initialTime, useAllSlots, employeeId, dateStr]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSlotSelect(slot: AvailableSlot) {
    setSelectedSlot(slot);
    onSelect(slot.employeeId, slot.startTime, slot.endTime);
  }

  function handleAllSlotSelect(slot: AllSlotsSlot) {
    if (!slot.available || !employeeId) return;
    const fullStart = `${dateStr}T${slot.startTime}:00`;
    const fullEnd = `${dateStr}T${slot.endTime}:00`;
    setSelectedSlot({ startTime: fullStart, endTime: fullEnd, employeeId });
    onSelect(employeeId, fullStart, fullEnd);
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
                  onDateChange?.(day.format('YYYY-MM-DD'));
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
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">
            {useAllSlots ? 'Horarios del empleado' : 'Horarios disponibles'}
          </p>
          {useAllSlots && allSlotsData && allSlotsData.slots.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-green-400 bg-green-50 inline-block" />
                Disponible
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-red-300 bg-red-50 inline-block" />
                Ocupado
              </span>
            </div>
          )}
        </div>

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
        ) : useAllSlots ? (
          // All-slots mode: show available + occupied
          !allSlotsData || allSlotsData.slots.length === 0 ? (
            <div className="py-4 text-center">
              {allSlotsData?.closureReason ? (
                <p className="text-sm text-red-500 font-medium">
                  Negocio cerrado el día {selectedDate.date()} de {selectedDate.format('MMMM')}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  El empleado no trabaja este día
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {allSlotsData.slots.map((slot) => {
                const isSelected =
                  selectedSlot?.startTime === `${dateStr}T${slot.startTime}:00`;
                const past = isSlotPast(slot.startTime);

                // Horarios pasados (mismo día, hora ya vencida): no
                // seleccionables y visualmente apagados.
                if (past) {
                  return (
                    <div
                      key={slot.startTime}
                      className="py-1.5 text-sm rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-300 text-center cursor-not-allowed"
                      title="Ese horario ya pasó"
                    >
                      {formatTime(slot.startTime)}
                    </div>
                  );
                }

                if (slot.available) {
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => handleAllSlotSelect(slot)}
                      className={`py-1.5 text-sm rounded-lg border-2 transition-colors ${
                        isSelected
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      {formatTime(slot.startTime)}
                    </button>
                  );
                }

                return (
                  <div
                    key={slot.startTime}
                    className="py-1.5 text-sm rounded-lg border-2 border-red-300 bg-red-50 text-red-400 text-center cursor-not-allowed"
                  >
                    {formatTime(slot.startTime)}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // Standard mode: only available slots
          (() => {
            // Filtramos los slots cuyo inicio ya pasó (solo aplica al día
            // de hoy). Si tras el filtro no queda nada, mostramos vacío.
            const futureStandardSlots = standardSlots.filter(
              (s) => !isSlotPast(s.startTime),
            );
            if (futureStandardSlots.length === 0) {
              return (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No hay horarios disponibles para esta fecha
                </p>
              );
            }
            return (
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {futureStandardSlots.map((slot) => {
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
            );
          })()
        )}
      </div>
    </div>
  );
}
