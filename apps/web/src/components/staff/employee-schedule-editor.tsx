'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Schedule {
  id?: string;
  dayOfWeek: string;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
}

interface BusinessHour {
  dayOfWeek: string;
  isOpen: boolean;
}

interface EmployeeScheduleEditorProps {
  employeeId: string;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const DEFAULT_SCHEDULES: Schedule[] = DAY_ORDER.map((day) => ({
  dayOfWeek: day,
  isWorking: day !== 'SUNDAY',
  startTime: '09:00',
  endTime: '18:00',
  effectiveFrom: new Date().toISOString().split('T')[0],
}));

function generateTimeOptions() {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export function EmployeeScheduleEditor({ employeeId }: EmployeeScheduleEditorProps) {
  const queryClient = useQueryClient();
  const [schedules, setSchedules] = useState<Schedule[]>(DEFAULT_SCHEDULES);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['employee-schedules', employeeId],
    queryFn: () =>
      api.get<{ data: Schedule[] }>(`/api/employees/${employeeId}/schedules`),
  });

  const { data: businessHoursData } = useQuery({
    queryKey: ['business-hours'],
    queryFn: () => api.get<{ data: BusinessHour[] }>('/api/tenant/business-hours'),
  });

  // Map of days the business is closed
  const businessClosedDays = new Set<string>(
    (businessHoursData?.data || [])
      .filter((h) => !h.isOpen)
      .map((h) => h.dayOfWeek),
  );

  useEffect(() => {
    if (data?.data && data.data.length > 0) {
      // Merge fetched schedules with defaults for any missing days
      const fetched = data.data;
      const merged = DAY_ORDER.map((day) => {
        const found = fetched.find((s) => s.dayOfWeek === day);
        if (found) {
          return {
            ...found,
            startTime: found.startTime || '09:00',
            endTime: found.endTime || '18:00',
            effectiveFrom: typeof found.effectiveFrom === 'string'
              ? found.effectiveFrom.split('T')[0]
              : new Date().toISOString().split('T')[0],
          };
        }
        return DEFAULT_SCHEDULES.find((d) => d.dayOfWeek === day)!;
      });
      setSchedules(merged);
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { schedules: Schedule[] }) =>
      api.put(`/api/employees/${employeeId}/schedules`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-schedules', employeeId] });
      setHasChanges(false);
    },
  });

  function updateDay(dayOfWeek: string, field: string, value: string | boolean) {
    setSchedules((prev) =>
      prev.map((s) =>
        s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s,
      ),
    );
    setHasChanges(true);
  }

  function handleSave() {
    // Validate startTime < endTime for working days
    const invalid = schedules.find(
      (s) => s.isWorking && !businessClosedDays.has(s.dayOfWeek) && s.startTime >= s.endTime,
    );
    if (invalid) {
      alert(`${DAY_LABELS[invalid.dayOfWeek]}: La hora de inicio debe ser anterior a la hora de fin.`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    saveMutation.mutate({
      schedules: schedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        isWorking: s.isWorking,
        startTime: s.startTime,
        endTime: s.endTime,
        effectiveFrom: today,
      })),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Configura los días y horarios de trabajo de este empleado.
      </p>

      <div className="space-y-2">
        {schedules.map((day) => {
          const businessClosed = businessClosedDays.has(day.dayOfWeek);

          return (
            <div
              key={day.dayOfWeek}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                businessClosed
                  ? 'bg-red-50/50 border-red-100'
                  : day.isWorking
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-50 border-gray-100'
              }`}
            >
              <div className="w-24 flex-shrink-0">
                <span className={`text-sm font-medium ${businessClosed ? 'text-gray-400' : 'text-gray-900'}`}>
                  {DAY_LABELS[day.dayOfWeek]}
                </span>
              </div>

              {businessClosed ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v.01M12 12v-4m0 0a9 9 0 110 18 9 9 0 010-18z" />
                    </svg>
                    Negocio cerrado
                  </span>
                  <span className="text-xs text-gray-400">
                    No se pueden agendar citas este día
                  </span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => updateDay(day.dayOfWeek, 'isWorking', !day.isWorking)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                      day.isWorking ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        day.isWorking ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  <span className={`text-xs w-14 flex-shrink-0 ${day.isWorking ? 'text-green-600' : 'text-gray-400'}`}>
                    {day.isWorking ? 'Trabaja' : 'Libre'}
                  </span>

                  {day.isWorking && (
                    <div className="flex items-center gap-2 flex-1">
                      <select
                        value={day.startTime}
                        onChange={(e) => updateDay(day.dayOfWeek, 'startTime', e.target.value)}
                        className="input-field py-1 text-sm"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <span className="text-gray-400 text-xs">a</span>
                      <select
                        value={day.endTime}
                        onChange={(e) => updateDay(day.dayOfWeek, 'endTime', e.target.value)}
                        className="input-field py-1 text-sm"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="btn-primary disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Guardando...' : 'Guardar Horario'}
        </button>
      </div>

      {saveMutation.isSuccess && (
        <p className="text-sm text-green-600 text-right">
          Horario guardado correctamente
        </p>
      )}
      {saveMutation.isError && (
        <p className="text-sm text-red-600 text-right">
          Error al guardar el horario
        </p>
      )}
    </div>
  );
}
