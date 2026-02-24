'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface TimeOff {
  id: string;
  startDatetime: string;
  endDatetime: string;
  reason?: string;
  createdAt: string;
}

interface EmployeeTimeOffEditorProps {
  employeeId: string;
}

const REASON_PRESETS = [
  'Vacaciones',
  'Permiso especial',
  'Visita médica',
  'Asuntos personales',
  'Baja laboral',
  'Otro',
];

function formatDateTimeEs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hoursBetween(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
}

export function EmployeeTimeOffEditor({ employeeId }: EmployeeTimeOffEditorProps) {
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('Vacaciones');
  const [customReason, setCustomReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['employee-time-off', employeeId],
    queryFn: () =>
      api.get<{ data: TimeOff[] }>(`/api/employees/${employeeId}/time-off`),
  });

  const timeOffs = data?.data || [];

  const totalHours = timeOffs.reduce(
    (sum, t) => sum + hoursBetween(t.startDatetime, t.endDatetime),
    0,
  );

  const addMutation = useMutation({
    mutationFn: (payload: { startDatetime: string; endDatetime: string; reason: string }) =>
      api.post(`/api/employees/${employeeId}/time-off`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-time-off', employeeId] });
      setStartDate('');
      setEndDate('');
      setStartTime('09:00');
      setEndTime('18:00');
      setReason('Vacaciones');
      setCustomReason('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (timeOffId: string) =>
      api.delete(`/api/employees/${employeeId}/time-off/${timeOffId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-time-off', employeeId] });
    },
  });

  function handleAdd() {
    if (!startDate || !endDate) return;
    const finalReason = reason === 'Otro' ? customReason.trim() : reason;
    if (!finalReason) return;

    addMutation.mutate({
      startDatetime: `${startDate}T${startTime}:00`,
      endDatetime: `${endDate}T${endTime}:00`,
      reason: finalReason,
    });
  }

  const canAdd = startDate && endDate && (reason !== 'Otro' || customReason.trim());

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Registra las ausencias de este empleado: vacaciones, permisos, citas médicas, etc.
      </p>

      {/* Add form */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fecha inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
              }}
              className="input-field text-sm py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Hora inicio
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input-field text-sm py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fecha fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="input-field text-sm py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Hora fin
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="input-field text-sm py-1.5"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Motivo
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field text-sm py-1.5"
          >
            {REASON_PRESETS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {reason === 'Otro' && (
          <div>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe el motivo..."
              className="input-field text-sm py-1.5"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={!canAdd || addMutation.isPending}
            className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
          >
            {addMutation.isPending ? 'Agregando...' : '+ Agregar Ausencia'}
          </button>
        </div>
      </div>

      {addMutation.isError && (
        <p className="text-sm text-red-600">Error al registrar la ausencia</p>
      )}

      {/* List */}
      {timeOffs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          No hay ausencias registradas
        </p>
      ) : (
        <div className="space-y-2">
          {timeOffs.map((t) => {
            const hours = hoursBetween(t.startDatetime, t.endDatetime);
            return (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {t.reason || 'Sin motivo'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDateTimeEs(t.startDatetime)} - {formatDateTimeEs(t.endDatetime)}
                    {' '}
                    <span className="text-gray-400">
                      ({hours}h)
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(t.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Eliminar ausencia"
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
      {timeOffs.length > 0 && (
        <div className="text-right">
          <span className="text-sm text-gray-500">
            Total horas de ausencia: <strong className="text-gray-900">{totalHours}h</strong>
          </span>
        </div>
      )}
    </div>
  );
}
