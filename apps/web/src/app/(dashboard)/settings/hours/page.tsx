'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { showSaveSuccess } from '@/lib/save-toast';

interface BusinessHour {
  id: string | null;
  tenantId: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

interface BusinessClosure {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: string;
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

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatDateEs(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BusinessHoursPage() {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Closure form state
  const [closureStart, setClosureStart] = useState('');
  const [closureEnd, setClosureEnd] = useState('');
  const [closureReason, setClosureReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['business-hours'],
    queryFn: () => api.get<{ data: BusinessHour[] }>('/api/tenant/business-hours'),
  });

  const { data: closuresData } = useQuery({
    queryKey: ['business-closures'],
    queryFn: () => api.get<{ data: BusinessClosure[] }>('/api/tenant/closures'),
  });

  const closures = closuresData?.data || [];

  // Total days closed this year
  const currentYear = new Date().getFullYear();
  const totalClosedDays = closures.reduce((sum, c) => {
    const start = c.startDate.split('T')[0];
    const end = c.endDate.split('T')[0];
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;
    const effectiveStart = start > yearStart ? start : yearStart;
    const effectiveEnd = end < yearEnd ? end : yearEnd;
    if (effectiveStart > effectiveEnd) return sum;
    return sum + daysBetween(effectiveStart, effectiveEnd);
  }, 0);

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
      queryClient.invalidateQueries({ queryKey: ['business-hours-check'] });
      setHasChanges(false);
      showSaveSuccess();
    },
  });

  const createClosureMutation = useMutation({
    mutationFn: (payload: { startDate: string; endDate: string; reason: string }) =>
      api.post('/api/tenant/closures', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-closures'] });
      setClosureStart('');
      setClosureEnd('');
      setClosureReason('');
    },
  });

  const deleteClosureMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenant/closures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-closures'] });
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

  function handleAddClosure() {
    if (!closureStart || !closureEnd || !closureReason.trim()) return;
    createClosureMutation.mutate({
      startDate: closureStart,
      endDate: closureEnd,
      reason: closureReason.trim(),
    });
  }

  return (
    <div className="flex flex-col h-full">

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-gray-500 mb-6">
            Configura los horarios de apertura y cierre de tu negocio para cada día de la semana.
          </p>

          {/* Apply to all */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Aplicar horario a todos los días</p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="time"
                id="applyAllOpen"
                defaultValue="09:00"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
              />
              <span className="text-gray-400 text-sm">a</span>
              <input
                type="time"
                id="applyAllClose"
                defaultValue="21:00"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
              />
              <button
                type="button"
                onClick={() => {
                  const openEl = document.getElementById('applyAllOpen') as HTMLInputElement;
                  const closeEl = document.getElementById('applyAllClose') as HTMLInputElement;
                  if (openEl && closeEl) {
                    setHours((prev) => prev.map((h) => ({ ...h, isOpen: true, openTime: openEl.value, closeTime: closeEl.value })));
                    setHasChanges(true);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#008080' }}
              >
                Aplicar a todos
              </button>
            </div>
          </div>

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
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-colors ${
                    day.isOpen
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  {/* Fila superior en mobile (siempre visible): día + toggle + estado */}
                  <div className="flex items-center gap-3 sm:contents">
                    <div className="w-24 sm:w-28 flex-shrink-0">
                      <span className="text-sm font-medium text-gray-900">
                        {DAY_LABELS[day.dayOfWeek]}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateDay(day.dayOfWeek, 'isOpen', !day.isOpen)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        day.isOpen ? 'bg-[#008080]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          day.isOpen ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    <span className={`text-sm sm:w-16 flex-shrink-0 ${day.isOpen ? 'text-green-600' : 'text-gray-400'}`}>
                      {day.isOpen ? 'Abierto' : 'Cerrado'}
                    </span>
                  </div>

                  {/* Time inputs — se apilan en mobile bajo el header del día.
                      `min-w-0` y `flex-1` permiten que el input type="time" de
                      Safari iOS (ancho intrínseco grande) no rebose el card. */}
                  {day.isOpen && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="time"
                        value={day.openTime}
                        onChange={(e) => updateDay(day.dayOfWeek, 'openTime', e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] flex-1 min-w-0 max-w-[140px]"
                      />
                      <span className="text-gray-400 text-sm flex-shrink-0">a</span>
                      <input
                        type="time"
                        value={day.closeTime}
                        onChange={(e) => updateDay(day.dayOfWeek, 'closeTime', e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] flex-1 min-w-0 max-w-[140px]"
                      />
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

          {saveMutation.isError && (
            <p className="mt-3 text-sm text-red-600 text-right">
              Error al guardar los horarios
            </p>
          )}

          {/* ─── Business Closures Section ─── */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Cierres Temporales
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Festivos, remodelaciones u otros periodos en que el negocio estará cerrado.
            </p>

            {/* Add closure form */}
            <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={closureStart}
                  onChange={(e) => setClosureStart(e.target.value)}
                  className="input-field text-sm py-1.5"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={closureEnd}
                  onChange={(e) => setClosureEnd(e.target.value)}
                  min={closureStart || undefined}
                  className="input-field text-sm py-1.5"
                />
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Motivo
                </label>
                <input
                  type="text"
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  placeholder="Ej: Festivo, remodelación..."
                  className="input-field text-sm py-1.5"
                />
              </div>
              <button
                onClick={handleAddClosure}
                disabled={!closureStart || !closureEnd || !closureReason.trim() || createClosureMutation.isPending}
                className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
              >
                {createClosureMutation.isPending ? 'Agregando...' : '+ Agregar'}
              </button>
            </div>

            {createClosureMutation.isError && (
              <p className="text-sm text-red-600 mb-4">
                Error al crear el cierre
              </p>
            )}

            {/* List of closures */}
            {closures.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No hay cierres programados
              </p>
            ) : (
              <div className="space-y-2">
                {closures.map((closure) => {
                  const start = closure.startDate.split('T')[0];
                  const end = closure.endDate.split('T')[0];
                  const days = daysBetween(start, end);
                  return (
                    <div
                      key={closure.id}
                      className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {closure.reason}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDateEs(start)}
                          {start !== end && ` - ${formatDateEs(end)}`}
                          {' '}
                          <span className="text-gray-400">
                            ({days} día{days !== 1 ? 's' : ''})
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => deleteClosureMutation.mutate(closure.id)}
                        disabled={deleteClosureMutation.isPending}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        title="Eliminar cierre"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary */}
            {closures.length > 0 && (
              <div className="mt-4 text-right">
                <span className="text-sm text-gray-500">
                  Total días cerrados ({currentYear}): <strong className="text-gray-900">{totalClosedDays}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
