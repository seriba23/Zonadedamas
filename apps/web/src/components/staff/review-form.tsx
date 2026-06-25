// ============================================================
// ARCHIVO: review-form.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Formulario para que el administrador cree una reseña manualmente
//   en nombre de un cliente. El flujo es:
//     1. El admin selecciona un cliente de la lista.
//     2. Al seleccionar el cliente, se cargan sus citas COMPLETADAS
//        con este empleado (las únicas que permiten reseña).
//     3. El admin selecciona la cita, elige una puntuación (1-5
//        estrellas interactivas) y opcionalmente escribe un comentario.
//     4. Al guardar, se crea la reseña en el servidor.
// ¿QUÉ RECIBE? (props)
//   - employeeId: ID del empleado que recibe la reseña.
//   - onClose: función para cerrar el formulario (sin guardar).
//   - onSuccess: función que se llama cuando la reseña se guarda OK.
// ============================================================

'use client';
// Necesario para hooks y eventos interactivos.

import { useState } from 'react';
// useState: campos del formulario, error, cliente seleccionado, etc.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery: carga los clientes y las citas del cliente seleccionado.
// useMutation: crea la reseña en el servidor.
// useQueryClient: invalida caché para que las listas se actualicen.

import { api, ApiResponse } from '@/lib/api';
// api: módulo HTTP. ApiResponse: tipo genérico { data: T }.

import { StarRating } from './star-rating';
// Componente de estrellas en modo interactivo (el usuario puede hacer clic).

import { formatBookingDate } from '@/lib/booking-time';
// Función que formatea fechas de citas de forma amigable.
// Ej: formatBookingDate("2026-07-01T10:00:00", 'short') → "Mar 1 jul, 10:00"

// ─── TIPOS ──────────────────────────────────────────────────

interface Client {
  // Cliente del directorio del negocio.
  id: string;
  firstName: string;
  lastName: string;
}

interface CompletedAppointment {
  // Cita completada que puede tener reseña.
  id: string;
  startTime: string;           // fecha/hora ISO de inicio de la cita
  items: Array<{
    serviceNameSnapshot: string;  // nombre del servicio en el momento de la cita
  }>;
}

interface ReviewFormProps {
  employeeId: string;
  onClose: () => void;   // función sin argumentos para cerrar el modal/formulario
  onSuccess: () => void; // función que el padre llama cuando se guarda con éxito
}

// ─── COMPONENTE ─────────────────────────────────────────────
export function ReviewForm({ employeeId, onClose, onSuccess }: ReviewFormProps) {
  const queryClient = useQueryClient();

  // ── Estados del formulario ─────────────────────────────
  const [selectedClientId, setSelectedClientId] = useState('');
  // ID del cliente seleccionado. '' = ninguno.

  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  // ID de la cita seleccionada. '' = ninguna.

  const [rating, setRating] = useState(0);
  // Puntuación seleccionada (0 = sin seleccionar, 1-5 = valor elegido).

  const [comment, setComment] = useState('');
  // Comentario opcional (máx. 1000 caracteres).

  const [error, setError] = useState<string | null>(null);
  // Mensaje de error de validación o de la API. null = sin error.

  // ─── QUERY: lista de clientes ────────────────────────
  // Carga hasta 100 clientes del negocio para el selector.
  // No tiene "enabled" → se carga siempre al montar el componente.
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get<{ data: Client[] }>('/api/clients?perPage=100'),
  });
  // Extraemos el array (o [] si aún no cargó).
  const clients = clientsData?.data || [];

  // ─── QUERY: citas completadas del cliente seleccionado ──
  // Solo se ejecuta cuando hay un cliente seleccionado.
  // Filtra por: empleado, cliente, y estado COMPLETADO.
  const { data: appointmentsData, isLoading: loadingAppointments } = useQuery({
    queryKey: ['completed-appointments', employeeId, selectedClientId],
    // El queryKey incluye selectedClientId: si el admin cambia de cliente,
    // React Query hace una nueva petición con el nuevo cliente.
    queryFn: () =>
      api.get<ApiResponse<CompletedAppointment[]>>(
        `/api/appointments?employeeId=${employeeId}&clientId=${selectedClientId}&status=COMPLETED&perPage=50`,
      ),
    // "enabled: !!selectedClientId" = solo ejecuta si hay un cliente elegido.
    // !!'' = false (string vacío → no ejecutar)
    // !!'abc123' = true (ID válido → ejecutar)
    enabled: !!selectedClientId,
  });
  const appointments = appointmentsData?.data || [];

  // ─── MUTATION: crear reseña ──────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: {
      rating: number;
      comment?: string;
      appointmentId: string;
      clientId: string;
    }) => api.post(`/api/employees/${employeeId}/reviews`, data),
    onSuccess: () => {
      // Actualizamos las queries relacionadas para reflejar la nueva reseña.
      queryClient.invalidateQueries({ queryKey: ['employee-reviews', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employee-stats', employeeId] });
      // Notificamos al padre que todo salió bien.
      onSuccess();
    },
    onError: (err: { message?: string }) => {
      // Si el servidor devuelve un error, lo mostramos en el formulario.
      setError(err.message || 'Error al crear la reseña');
    },
  });

  // ─── handleSubmit ────────────────────────────────────
  // Manejador del submit del formulario con validaciones.
  function handleSubmit(e: React.FormEvent) {
    // Previene la recarga de la página (comportamiento por defecto del form HTML).
    e.preventDefault();
    setError(null);  // limpiamos errores anteriores

    // Validaciones en orden de prioridad.
    if (!selectedClientId) {
      setError('Selecciona un cliente');
      return;
    }
    if (!selectedAppointmentId) {
      setError('Selecciona una cita');
      return;
    }
    if (rating === 0) {
      setError('Selecciona una puntuación');
      return;
    }

    createMutation.mutate({
      rating,
      // "comment.trim() || undefined": si el comentario está vacío o solo
      // tiene espacios, enviamos undefined (el backend no guarda campo vacío).
      comment: comment.trim() || undefined,
      appointmentId: selectedAppointmentId,
      clientId: selectedClientId,
    });
  }

  // ─── JSX ────────────────────────────────────────────
  return (
    // El formulario llama a handleSubmit al enviarse.
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Banner de error: solo visible si "error" no es null. */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Selector de cliente ───────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cliente *
        </label>
        <select
          value={selectedClientId}
          onChange={(e) => {
            // Al cambiar de cliente, limpiamos la cita seleccionada
            // (la anterior pertenecía al cliente anterior).
            setSelectedClientId(e.target.value);
            setSelectedAppointmentId('');
          }}
          className="input-field"
        >
          <option value="">Seleccionar cliente...</option>
          {/* .map() genera un <option> por cada cliente.
              "c" = objeto Client { id, firstName, lastName } */}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* ── Selector de cita ──────────────────────────── */}
      {/* Solo visible si hay un cliente seleccionado. */}
      {selectedClientId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cita completada *
          </label>
          {/* Estados posibles del selector de cita: */}
          {loadingAppointments ? (
            // 1. Cargando las citas del cliente
            <p className="text-sm text-gray-400">Cargando citas...</p>
          ) : appointments.length === 0 ? (
            // 2. El cliente no tiene citas completadas con este empleado
            <p className="text-sm text-gray-400">
              No hay citas completadas disponibles para este cliente
            </p>
          ) : (
            // 3. Hay citas: mostramos el selector
            <select
              value={selectedAppointmentId}
              onChange={(e) => setSelectedAppointmentId(e.target.value)}
              className="input-field"
            >
              <option value="">Seleccionar cita...</option>
              {/* "apt" = objeto CompletedAppointment { id, startTime, items } */}
              {appointments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {/* Formato de la fecha corto + nombres de los servicios */}
                  {formatBookingDate(apt.startTime, 'short')}{' '}
                  {/* {' '} = espacio explícito en JSX entre la fecha y el guión */}
                  - {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Selector de puntuación (estrellas interactivas) ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Puntuación *
        </label>
        {/* StarRating con interactive=true y onChange: al hacer clic
            en una estrella, actualiza el estado "rating".
            "size='lg'" muestra estrellas grandes (cómodas para clic). */}
        <StarRating rating={rating} size="lg" interactive onChange={setRating} />
      </div>

      {/* ── Comentario (opcional) ─────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comentario
        </label>
        <textarea
          value={comment}
          onChange={(e) => {
            // Limitamos a 1000 caracteres: solo actualizamos el estado
            // si el texto no supera ese límite.
            if (e.target.value.length <= 1000) setComment(e.target.value);
          }}
          className="input-field min-h-[80px] resize-y"
          // "resize-y" permite al usuario cambiar la altura del textarea
          // pero no el ancho.
          rows={3}
          placeholder="Comentario opcional..."
        />
        {/* Contador de caracteres en tiempo real */}
        <p className="text-xs text-gray-400 mt-1 text-right">
          {comment.length}/1000
        </p>
      </div>

      {/* ── Botones de acción ──────────────────────────── */}
      <div className="flex justify-end gap-3 pt-2">
        {/* Cancelar: type="button" evita enviar el formulario */}
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        {/* Guardar: type="submit" dispara el onSubmit del formulario */}
        <button
          type="submit"
          // Deshabilitado mientras la mutación está en progreso.
          disabled={createMutation.isPending}
          className="btn-primary"
        >
          {createMutation.isPending ? 'Guardando...' : 'Guardar Reseña'}
        </button>
      </div>
    </form>
  );
}
