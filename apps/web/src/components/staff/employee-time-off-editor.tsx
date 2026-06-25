// ============================================================
// ARCHIVO: employee-time-off-editor.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Editor de ausencias de un empleado. Sirve tanto para el
//   dashboard del administrador (puede aprobar/rechazar) como
//   para el portal del empleado (solo puede solicitar).
//   Muestra un formulario para registrar una nueva ausencia
//   (fecha inicio, fecha fin, hora inicio, hora fin y motivo),
//   y una lista de todas las ausencias registradas con su estado
//   (PENDING/APPROVED/REJECTED).
// ¿QUÉ RECIBE? (props)
//   - employeeId: ID del empleado cuyas ausencias se gestionan.
//   - isEmployeePortal: si es true, el modo es de empleado (solo solicitar).
//     Si es false (por defecto), es modo administrador (puede aprobar/rechazar).
//   - onApprove: callback opcional para cuando el admin aprueba.
//   - onReject: callback opcional para cuando el admin rechaza.
// ============================================================

'use client';
// Necesario para usar hooks y manejar eventos interactivos.

import { useState } from 'react';
// useState: para todos los campos del formulario de nueva ausencia
// y para el estado del formulario de rechazo.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery: carga la lista de ausencias del servidor.
// useMutation: crea, aprueba, rechaza y elimina ausencias.
// useQueryClient: invalida caché para refrescar la lista.

import { api } from '@/lib/api';
// Módulo propio de peticiones HTTP.

// ─── TIPOS ──────────────────────────────────────────────────

interface TimeOff {
  // Una ausencia registrada en el servidor.
  id: string;
  startDatetime: string;         // ISO datetime: "2026-07-01T09:00:00"
  endDatetime: string;
  reason?: string;               // motivo de la ausencia
  status: string;                // "PENDING", "APPROVED" o "REJECTED"
  rejectionReason?: string;      // solo si status === "REJECTED"
  createdAt: string;
}

interface EmployeeTimeOffEditorProps {
  employeeId: string;
  /** When true, new requests are created as PENDING and approve/reject actions are hidden */
  isEmployeePortal?: boolean;
  /** Callback for approve action (dashboard only) */
  onApprove?: (timeOffId: string) => void;
  /** Callback for reject action (dashboard only) */
  onReject?: (timeOffId: string, reason: string) => void;
}

// ─── CONSTANTES ─────────────────────────────────────────────

// Motivos predefinidos para el selector de "Motivo".
const REASON_PRESETS = [
  'Vacaciones',
  'Permiso especial',
  'Visita médica',
  'Asuntos personales',
  'Baja laboral',
  'Otro',
];

// ─── FUNCIONES DE UTILIDAD ───────────────────────────────────

// Formatea una fecha ISO a texto en español para mostrar en la UI.
// Ej: "2026-07-01T09:00:00" → "1 jul 2026, 09:00"
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

// Calcula la diferencia en horas entre dos fechas ISO.
// Redondeado a 1 decimal (ej: 7.5 horas).
function hoursBetween(start: string, end: string): number {
  // new Date(iso).getTime() devuelve los milisegundos desde el epoch (1970-01-01).
  // La diferencia en ms ÷ (1000ms * 60s * 60min) = diferencia en horas.
  const diff = new Date(end).getTime() - new Date(start).getTime();
  // Math.round(...* 10) / 10 = redondear a 1 decimal.
  return Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
}

// Mapeo de estado técnico a etiqueta legible en español.
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

// Mapeo de estado a clases CSS de Tailwind para el badge de color.
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
// "isEmployeePortal = false" es el valor por defecto del parámetro:
// si no se pasa la prop, asumimos que es el dashboard del admin.
export function EmployeeTimeOffEditor({ employeeId, isEmployeePortal = false }: EmployeeTimeOffEditorProps) {
  const queryClient = useQueryClient();

  // ── Estados del formulario de nueva ausencia ─────────────
  const [startDate, setStartDate] = useState('');         // "YYYY-MM-DD"
  const [startTime, setStartTime] = useState('09:00');    // "HH:MM"
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('Vacaciones');     // motivo seleccionado en el <select>
  const [customReason, setCustomReason] = useState('');   // texto libre si reason === 'Otro'

  // ── Estados para el flujo de rechazo ─────────────────────
  // ID de la ausencia que se está rechazando actualmente (null = ninguna).
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  // Texto del motivo de rechazo que escribe el administrador.
  const [rejectionReason, setRejectionReason] = useState('');

  // ─── QUERY: lista de ausencias ───────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['employee-time-off', employeeId],
    queryFn: () =>
      api.get<{ data: TimeOff[] }>(`/api/employees/${employeeId}/time-off`),
  });

  // Extraemos el array (o [] si aún no cargó).
  const timeOffs = data?.data || [];

  // Calculamos el total de horas de ausencia sumando todas las entradas.
  // .reduce() acumula la suma. "sum" empieza en 0, "t" es cada ausencia.
  const totalHours = timeOffs.reduce(
    (sum, t) => sum + hoursBetween(t.startDatetime, t.endDatetime),
    0,
  );

  // ─── MUTATION: crear ausencia ────────────────────────────
  const addMutation = useMutation({
    mutationFn: (payload: { startDatetime: string; endDatetime: string; reason: string; status?: string }) =>
      api.post(`/api/employees/${employeeId}/time-off`, payload),
    onSuccess: () => {
      // Refrescamos la lista de ausencias.
      queryClient.invalidateQueries({ queryKey: ['employee-time-off', employeeId] });
      // Limpiamos el formulario para una nueva entrada.
      setStartDate('');
      setEndDate('');
      setStartTime('09:00');
      setEndTime('18:00');
      setReason('Vacaciones');
      setCustomReason('');
    },
  });

  // ─── MUTATION: aprobar ausencia ──────────────────────────
  // Solo usada por el administrador (dashboard). Recibe el ID de la ausencia.
  const approveMutation = useMutation({
    mutationFn: (timeOffId: string) =>
      api.put(`/api/employees/${employeeId}/time-off/${timeOffId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-time-off', employeeId] });
    },
  });

  // ─── MUTATION: rechazar ausencia ─────────────────────────
  // Recibe el ID y el motivo de rechazo en un objeto.
  const rejectMutation = useMutation({
    mutationFn: ({ timeOffId, rejectionReason }: { timeOffId: string; rejectionReason: string }) =>
      api.put(`/api/employees/${employeeId}/time-off/${timeOffId}/reject`, { rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-time-off', employeeId] });
      setRejectingId(null);     // ocultamos el formulario de rechazo
      setRejectionReason('');   // limpiamos el campo de texto
    },
  });

  // ─── MUTATION: eliminar ausencia ─────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (timeOffId: string) =>
      api.delete(`/api/employees/${employeeId}/time-off/${timeOffId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-time-off', employeeId] });
    },
  });

  // ─── handleAdd ───────────────────────────────────────────
  // Valida y envía el formulario de nueva ausencia.
  function handleAdd() {
    // Validación básica: deben existir fechas de inicio y fin.
    if (!startDate || !endDate) return;
    // Si el motivo es 'Otro', usamos el texto personalizado; si no, el preset.
    // .trim() elimina espacios al inicio y al final.
    const finalReason = reason === 'Otro' ? customReason.trim() : reason;
    if (!finalReason) return;  // si el campo personalizado está vacío, cancelamos

    addMutation.mutate({
      // Combinamos la fecha y la hora en un datetime ISO:
      // "2026-07-01" + "T" + "09:00" + ":00" = "2026-07-01T09:00:00"
      startDatetime: `${startDate}T${startTime}:00`,
      endDatetime: `${endDate}T${endTime}:00`,
      reason: finalReason,
      // Spread condicional: si es el portal del empleado, enviamos status PENDING.
      // Si es el dashboard del admin, no enviamos status (el backend lo pone APPROVED).
      ...(isEmployeePortal ? { status: 'PENDING' } : {}),
    });
  }

  // ─── handleReject ────────────────────────────────────────
  // Valida y envía el rechazo de una ausencia específica.
  function handleReject(timeOffId: string) {
    if (!rejectionReason.trim()) return;  // requiere motivo de rechazo
    rejectMutation.mutate({ timeOffId, rejectionReason: rejectionReason.trim() });
  }

  // canAdd: condición compuesta para habilitar el botón "Agregar".
  // Requiere fecha inicio, fecha fin, y si el motivo es 'Otro', texto personalizado.
  const canAdd = startDate && endDate && (reason !== 'Otro' || customReason.trim());

  // ─── Estado de carga ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* Array.from({ length: 3 }) = array de 3 elementos vacíos.
            "_" es la variable no usada, "i" es el índice para el key. */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // ─── JSX ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Descripción contextual: diferente texto según el modo */}
      <p className="text-sm text-gray-500">
        {/* Ternario: texto para empleado vs. texto para admin */}
        {isEmployeePortal
          ? 'Solicita tus ausencias: vacaciones, permisos, citas médicas, etc. Tu solicitud será revisada por un administrador.'
          : 'Registra las ausencias de este empleado: vacaciones, permisos, citas médicas, etc.'}
      </p>

      {/* Add form */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
        {/* Grid de 2 columnas para los 4 campos de fecha/hora */}
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
                // Si la fecha de fin está vacía O es anterior a la fecha inicio,
                // la ajustamos automáticamente para que sea igual a la inicio.
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
              // "min" en el input date impide seleccionar fechas anteriores
              // a la fecha de inicio. "|| undefined" evita que min sea ''
              // (que causaría comportamiento inesperado en algunos navegadores).
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

        {/* Selector de motivo */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Motivo
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field text-sm py-1.5"
          >
            {/* .map() genera un <option> por cada motivo predefinido */}
            {REASON_PRESETS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Campo de motivo personalizado: solo visible si se seleccionó "Otro". */}
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

        {/* Botón de envío */}
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            // "!canAdd" convierte la condición (que puede ser string o boolean)
            // a boolean negado. Si canAdd es falsy, el botón se deshabilita.
            disabled={!canAdd || addMutation.isPending}
            className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
          >
            {/* Texto diferente según estado y modo */}
            {addMutation.isPending
              ? (isEmployeePortal ? 'Solicitando...' : 'Agregando...')
              : (isEmployeePortal ? '+ Solicitar Ausencia' : '+ Agregar Ausencia')}
          </button>
        </div>
      </div>

      {/* Error de la mutación de añadir */}
      {addMutation.isError && (
        <p className="text-sm text-red-600">Error al registrar la ausencia</p>
      )}

      {/* List */}
      {/* Si no hay ausencias, mostramos un mensaje. Si hay, mostramos la lista. */}
      {timeOffs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          No hay ausencias registradas
        </p>
      ) : (
        <div className="space-y-2">
          {/* .map() genera una tarjeta por cada ausencia registrada.
              "t" = objeto TimeOff { id, startDatetime, endDatetime, ... } */}
          {timeOffs.map((t) => {
            // Calculamos las horas de esta ausencia específica.
            const hours = hoursBetween(t.startDatetime, t.endDatetime);
            // Obtenemos la etiqueta y el color del estado.
            // "|| t.status" como fallback si el status no está en el mapeo.
            const statusLabel = STATUS_LABELS[t.status] || t.status;
            const statusColor = STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800';
            return (
              <div
                key={t.id}
                className="p-3 bg-white rounded-xl border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {/* Motivo de la ausencia */}
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {t.reason || 'Sin motivo'}
                      </p>
                      {/* Badge de estado con color dinámico */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {/* Fechas y horas de la ausencia */}
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDateTimeEs(t.startDatetime)} - {formatDateTimeEs(t.endDatetime)}
                      {' '}
                      <span className="text-gray-400">
                        ({hours}h)
                      </span>
                    </p>
                    {/* Motivo de rechazo: solo visible si el estado es REJECTED */}
                    {t.status === 'REJECTED' && t.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">
                        Motivo de rechazo: {t.rejectionReason}
                      </p>
                    )}
                  </div>
                  {/* Botones de acción en la tarjeta */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Approve/Reject buttons - only on dashboard for PENDING requests */}
                    {/* Botones de aprobar/rechazar: solo en el dashboard del admin
                        (!isEmployeePortal) y solo para solicitudes pendientes. */}
                    {!isEmployeePortal && t.status === 'PENDING' && (
                      <>
                        {/* Botón "Aprobar" (palomita verde) */}
                        <button
                          onClick={() => approveMutation.mutate(t.id)}
                          disabled={approveMutation.isPending}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                          title="Aprobar solicitud"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        {/* Botón "Rechazar" (X): abre el formulario de rechazo
                            para ESTA ausencia poniendo rejectingId = t.id. */}
                        <button
                          onClick={() => setRejectingId(t.id)}
                          disabled={rejectMutation.isPending}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Rechazar solicitud"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                    {/* Botón "Eliminar" (siempre visible para el admin) */}
                    <button
                      onClick={() => deleteMutation.mutate(t.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Eliminar ausencia"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Rejection reason input */}
                {/* Formulario de rechazo: solo aparece bajo la tarjeta cuyo
                    ID coincide con rejectingId. Comprobamos igualdad exacta
                    (rejectingId === t.id) para mostrar solo una a la vez. */}
                {rejectingId === t.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Motivo del rechazo..."
                      className="input-field text-sm py-1.5 flex-1"
                    />
                    {/* Botón de confirmar rechazo */}
                    <button
                      onClick={() => handleReject(t.id)}
                      // Deshabilitado si no hay texto (después de trim) o si está cargando.
                      disabled={!rejectionReason.trim() || rejectMutation.isPending}
                      className="btn-primary text-xs py-1.5 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    {/* Botón de cancelar rechazo: cierra el formulario sin rechazar */}
                    <button
                      onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                      className="text-xs text-gray-500 hover:text-gray-700 py-1.5 px-2"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary: total de horas de ausencia */}
      {/* Solo se muestra si hay al menos una ausencia registrada. */}
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
