'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiResponse } from '@/lib/api';
import { StarRating } from './star-rating';
import { formatBookingDate } from '@/lib/booking-time';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface CompletedAppointment {
  id: string;
  startTime: string;
  items: Array<{ serviceNameSnapshot: string }>;
}

interface ReviewFormProps {
  employeeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewForm({ employeeId, onClose, onSuccess }: ReviewFormProps) {
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get all clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get<{ data: Client[] }>('/api/clients?perPage=100'),
  });
  const clients = clientsData?.data || [];

  // Get completed appointments for selected client + employee (no review yet)
  const { data: appointmentsData, isLoading: loadingAppointments } = useQuery({
    queryKey: ['completed-appointments', employeeId, selectedClientId],
    queryFn: () =>
      api.get<ApiResponse<CompletedAppointment[]>>(
        `/api/appointments?employeeId=${employeeId}&clientId=${selectedClientId}&status=COMPLETED&perPage=50`,
      ),
    enabled: !!selectedClientId,
  });
  const appointments = appointmentsData?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: {
      rating: number;
      comment?: string;
      appointmentId: string;
      clientId: string;
    }) => api.post(`/api/employees/${employeeId}/reviews`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-reviews', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employee-stats', employeeId] });
      onSuccess();
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'Error al crear la reseña');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
      comment: comment.trim() || undefined,
      appointmentId: selectedAppointmentId,
      clientId: selectedClientId,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cliente *
        </label>
        <select
          value={selectedClientId}
          onChange={(e) => {
            setSelectedClientId(e.target.value);
            setSelectedAppointmentId('');
          }}
          className="input-field"
        >
          <option value="">Seleccionar cliente...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </div>

      {selectedClientId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cita completada *
          </label>
          {loadingAppointments ? (
            <p className="text-sm text-gray-400">Cargando citas...</p>
          ) : appointments.length === 0 ? (
            <p className="text-sm text-gray-400">
              No hay citas completadas disponibles para este cliente
            </p>
          ) : (
            <select
              value={selectedAppointmentId}
              onChange={(e) => setSelectedAppointmentId(e.target.value)}
              className="input-field"
            >
              <option value="">Seleccionar cita...</option>
              {appointments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {formatBookingDate(apt.startTime, 'short')}{' '}
                  - {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Puntuación *
        </label>
        <StarRating rating={rating} size="lg" interactive onChange={setRating} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comentario
        </label>
        <textarea
          value={comment}
          onChange={(e) => {
            if (e.target.value.length <= 1000) setComment(e.target.value);
          }}
          className="input-field min-h-[80px] resize-y"
          rows={3}
          placeholder="Comentario opcional..."
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {comment.length}/1000
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="btn-primary"
        >
          {createMutation.isPending ? 'Guardando...' : 'Guardar Reseña'}
        </button>
      </div>
    </form>
  );
}
