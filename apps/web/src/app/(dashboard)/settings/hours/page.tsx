'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';

interface BusinessHour {
  id: string | null;
  tenantId: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
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

export default function BusinessHoursPage() {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['business-hours'],
    queryFn: () => api.get<{ data: BusinessHour[] }>('/api/tenant/business-hours'),
  });

  useEffect(() => {
    if (data?.data) {
      const sorted = [...data.data].sort(
        (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
      );
      setHours(sorted);
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { hours: BusinessHour[] }) =>
      api.put('/api/tenant/business-hours', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours'] });
      setHasChanges(false);
    },
  });

  function updateDay(dayOfWeek: string, field: string, value: string | boolean) {
    setHours((prev) =>
      prev.map((h) =>
        h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h,
      ),
    );
    setHasChanges(true);
  }

  function handleSave() {
    saveMutation.mutate({
      hours: hours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime,
        closeTime: h.closeTime,
        isOpen: h.isOpen,
      })) as any,
    });
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Horarios del Negocio" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-gray-500 mb-6">
            Configura los horarios de apertura y cierre de tu negocio para cada día de la semana.
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {hours.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                    day.isOpen
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  {/* Day label */}
                  <div className="w-28 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-900">
                      {DAY_LABELS[day.dayOfWeek]}
                    </span>
                  </div>

                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => updateDay(day.dayOfWeek, 'isOpen', !day.isOpen)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                      day.isOpen ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        day.isOpen ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  <span className={`text-sm w-16 flex-shrink-0 ${day.isOpen ? 'text-green-600' : 'text-gray-400'}`}>
                    {day.isOpen ? 'Abierto' : 'Cerrado'}
                  </span>

                  {/* Time selects */}
                  {day.isOpen && (
                    <div className="flex items-center gap-2 flex-1">
                      <select
                        value={day.openTime}
                        onChange={(e) => updateDay(day.dayOfWeek, 'openTime', e.target.value)}
                        className="input-field py-1.5 text-sm"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <span className="text-gray-400 text-sm">a</span>
                      <select
                        value={day.closeTime}
                        onChange={(e) => updateDay(day.dayOfWeek, 'closeTime', e.target.value)}
                        className="input-field py-1.5 text-sm"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Save button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar Horarios'}
            </button>
          </div>

          {saveMutation.isSuccess && (
            <p className="mt-3 text-sm text-green-600 text-right">
              Horarios guardados correctamente
            </p>
          )}
          {saveMutation.isError && (
            <p className="mt-3 text-sm text-red-600 text-right">
              Error al guardar los horarios
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
