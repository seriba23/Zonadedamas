'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DatePicker } from '@/components/ui/date-picker';

const REASONS = ['Vacaciones', 'Permiso personal', 'Cita médica', 'Emergencia', 'Otro'];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'text-teal-700 bg-teal-50' },
  APPROVED: { label: 'Aprobado', color: 'text-green-700 bg-green-50' },
  REJECTED: { label: 'Rechazado', color: 'text-red-600 bg-red-50' },
};

export default function EmployeeTimeOffPage() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('Vacaciones');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['my-time-off'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees/me/time-off'),
  });

  const requests = data?.data || [];

  const submitMutation = useMutation({
    mutationFn: (body: any) => api.post('/api/employees/me/time-off', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-time-off'] });
      setStartDate('');
      setEndDate('');
      setReason('Vacaciones');
      setCustomReason('');
      setError(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: any) => setError(err.message || 'Error al enviar solicitud'),
  });

  function handleSubmit() {
    if (!startDate || !endDate) { setError('Selecciona las fechas'); return; }
    setError(null);
    submitMutation.mutate({
      startDatetime: `${startDate}T${startTime}:00Z`,
      endDatetime: `${endDate}T${endTime}:00Z`,
      reason: reason === 'Otro' ? customReason : reason,
    });
  }

  return (
    <div className="p-6 max-w-2xl mx-auto pb-24 lg:pb-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Permisos y solicitudes</h1>
      <p className="text-sm text-gray-500 mb-6">
        Solicita tus ausencias: vacaciones, permisos, citas médicas, etc. Tu solicitud será revisada por un administrador.
      </p>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio *</label>
            <DatePicker value={startDate} onChange={setStartDate} maxDate={new Date(Date.now() + 365 * 86400000)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hora inicio</label>
            <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field">
              {Array.from({ length: 24 }, (_, h) => [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`]).flat().map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin *</label>
            <DatePicker value={endDate} onChange={setEndDate} maxDate={new Date(Date.now() + 365 * 86400000)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hora fin</label>
            <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field">
              {Array.from({ length: 24 }, (_, h) => [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`]).flat().map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Motivo</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  reason === r ? 'bg-[#008080] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === 'Otro' && (
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe el motivo..."
              className="input-field"
            />
          )}
        </div>

        {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs mb-3">{error}</div>}
        {success && <div className="p-3 rounded-lg bg-green-50 text-green-700 text-xs mb-3">Solicitud enviada correctamente</div>}

        <button
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ backgroundColor: '#008080' }}
        >
          {submitMutation.isPending ? 'Enviando...' : 'Solicitar ausencia'}
        </button>
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Mis solicitudes</h2>
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : requests.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">No tienes solicitudes de ausencia</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r: any) => {
              const st = STATUS_LABELS[r.status] || STATUS_LABELS.PENDING;
              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{r.reason || 'Sin motivo'}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(r.startDatetime).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' — '}
                    {new Date(r.endDatetime).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {r.rejectionReason && (
                    <p className="text-xs text-red-500 mt-1">Motivo de rechazo: {r.rejectionReason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
