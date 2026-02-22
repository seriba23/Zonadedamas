'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { AppointmentStatusBadge } from '@/components/ui/badge';
import { AvailabilityPicker } from '@/components/calendar/availability-picker';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  color?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  locationId?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface Appointment {
  id: string;
  clientId: string;
  client?: Client;
  employeeId: string;
  employee?: Employee;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  items?: Array<{ id: string; service?: Service; price: number }>;
}

interface AppointmentModalProps {
  appointmentId?: string;
  initialStartTime?: string;
  onClose: () => void;
  onSave: () => void;
}

export function AppointmentModal({
  appointmentId,
  initialStartTime,
  onClose,
  onSave,
}: AppointmentModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!appointmentId;

  // Form state for new appointment
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [selectedEndTime, setSelectedEndTime] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');

  // Fetch existing appointment
  const { data: appointmentData, isLoading: loadingAppointment } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () =>
      api.get<{ data: Appointment }>(`/api/appointments/${appointmentId}`),
    enabled: isEditing,
  });

  // Fetch services
  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services'),
  });

  // Fetch employees
  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<{ data: Employee[] }>('/api/employees'),
  });

  // Search clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients-search', clientSearch],
    queryFn: () =>
      api.get<{ data: Client[] }>(
        `/api/clients?search=${encodeURIComponent(clientSearch)}&perPage=10`,
      ),
    enabled: clientSearch.length >= 2,
  });

  const appointment = appointmentData?.data;
  const services = servicesData?.data || [];
  const employees = employeesData?.data || [];
  const clientResults = clientsData?.data || [];

  const createMutation = useMutation({
    mutationFn: (payload: {
      clientId: string;
      employeeId: string;
      locationId: string;
      startTime: string;
      serviceIds: string[];
      notes?: string;
    }) => api.post('/api/appointments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onSave();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al crear la cita');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointmentId}/cancel`, {
        reason: cancelReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      onSave();
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointmentId}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      onSave();
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointmentId}/reschedule`, {
        startTime: newStartTime,
        endTime: newEndTime,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      setRescheduleMode(false);
      onSave();
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) {
      setFormError('Selecciona un cliente');
      return;
    }
    if (selectedServiceIds.length === 0) {
      setFormError('Selecciona al menos un servicio');
      return;
    }
    if (!selectedStartTime) {
      setFormError('Selecciona una fecha y hora');
      return;
    }
    if (!selectedEmployeeId) {
      setFormError('Selecciona un profesional');
      return;
    }
    const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
    if (!selectedEmployee?.locationId) {
      setFormError('El profesional no tiene una ubicación asignada');
      return;
    }
    createMutation.mutate({
      clientId: selectedClientId,
      employeeId: selectedEmployeeId,
      locationId: selectedEmployee.locationId,
      startTime: selectedStartTime,
      serviceIds: selectedServiceIds,
      notes,
    });
  }

  const canCancel =
    appointment &&
    ['pending', 'confirmed'].includes(appointment.status);
  const canComplete =
    appointment &&
    ['confirmed', 'in_progress'].includes(appointment.status);
  const canReschedule =
    appointment &&
    ['pending', 'confirmed'].includes(appointment.status);

  const modalTitle = isEditing
    ? loadingAppointment
      ? 'Cargando...'
      : `Cita — ${appointment?.client?.firstName ?? ''} ${appointment?.client?.lastName ?? ''}`
    : 'Nueva Cita';

  return (
    <Modal
      title={modalTitle}
      onClose={onClose}
      size={isEditing ? 'lg' : 'lg'}
    >
      {isEditing ? (
        // View mode
        loadingAppointment ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : appointment ? (
          <div className="space-y-5">
            {/* Status */}
            <div className="flex items-center justify-between">
              <AppointmentStatusBadge status={appointment.status} />
              <p className="text-sm text-gray-500">
                {formatDate(appointment.startTime)},{' '}
                {formatTime(
                  new Date(appointment.startTime).toTimeString().slice(0, 5),
                )}
                {' – '}
                {formatTime(
                  new Date(appointment.endTime).toTimeString().slice(0, 5),
                )}
              </p>
            </div>

            {/* Client & Employee */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Cliente
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {appointment.client
                    ? `${appointment.client.firstName} ${appointment.client.lastName}`
                    : '-'}
                </p>
                {appointment.client?.email && (
                  <p className="text-xs text-gray-500">
                    {appointment.client.email}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Profesional
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {appointment.employee
                    ? `${appointment.employee.firstName} ${appointment.employee.lastName}`
                    : '-'}
                </p>
              </div>
            </div>

            {/* Services */}
            {appointment.items && appointment.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Servicios
                </p>
                <div className="space-y-2">
                  {appointment.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center py-1"
                    >
                      <span className="text-sm text-gray-700">
                        {item.service?.name || 'Servicio'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {appointment.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Notas
                </p>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  {appointment.notes}
                </p>
              </div>
            )}

            {/* Reschedule mode */}
            {rescheduleMode && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  Reagendar cita
                </p>
                <AvailabilityPicker
                  serviceIds={
                    appointment.items
                      ?.map((i) => i.service?.id)
                      .filter((id): id is string => !!id) || []
                  }
                  employeeId={appointment.employeeId}
                  onSelect={(empId, start, end) => {
                    setNewStartTime(start);
                    setNewEndTime(end);
                  }}
                />
                {newStartTime && (
                  <div className="mt-3 flex gap-3">
                    <button
                      onClick={() => rescheduleMutation.mutate()}
                      disabled={rescheduleMutation.isPending}
                      className="btn-primary flex-1"
                    >
                      {rescheduleMutation.isPending
                        ? 'Reagendando...'
                        : 'Confirmar reagendamiento'}
                    </button>
                    <button
                      onClick={() => setRescheduleMode(false)}
                      className="btn-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Cancel form */}
            {showCancelForm && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  Motivo de cancelación
                </p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Razón de la cancelación..."
                />
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    className="btn-danger flex-1"
                  >
                    {cancelMutation.isPending
                      ? 'Cancelando...'
                      : 'Confirmar cancelación'}
                  </button>
                  <button
                    onClick={() => setShowCancelForm(false)}
                    className="btn-secondary"
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!rescheduleMode && !showCancelForm && (
              <div className="flex gap-3 pt-2 border-t border-gray-200">
                {canReschedule && (
                  <button
                    onClick={() => setRescheduleMode(true)}
                    className="btn-secondary flex-1"
                  >
                    Reagendar
                  </button>
                )}
                {canComplete && (
                  <button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {completeMutation.isPending ? 'Procesando...' : 'Completar'}
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => setShowCancelForm(true)}
                    className="btn-danger"
                  >
                    Cancelar cita
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">No se encontró la cita</p>
        )
      ) : (
        // Create mode
        <form onSubmit={handleCreate} className="space-y-5">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {formError}
            </div>
          )}

          {/* Client search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente *
            </label>
            {selectedClientId ? (
              <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg border border-primary-200">
                <span className="text-sm text-primary-800">
                  {clientResults.find((c) => c.id === selectedClientId)
                    ? `${clientResults.find((c) => c.id === selectedClientId)!.firstName} ${clientResults.find((c) => c.id === selectedClientId)!.lastName}`
                    : 'Cliente seleccionado'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientId('');
                    setClientSearch('');
                  }}
                  className="text-primary-600 text-xs"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="input-field"
                  placeholder="Buscar cliente por nombre o email..."
                />
                {clientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClientId(c.id);
                          setClientSearch('');
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {c.firstName} {c.lastName}
                        </p>
                        {c.email && (
                          <p className="text-xs text-gray-500">{c.email}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Services */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Servicios *
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {services.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedServiceIds.includes(s.id)
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(s.id)}
                    onChange={(e) => {
                      setSelectedStartTime('');
                      setSelectedEndTime('');
                      if (e.target.checked) {
                        setSelectedServiceIds((ids) => [...ids, s.id]);
                      } else {
                        setSelectedServiceIds((ids) =>
                          ids.filter((id) => id !== s.id),
                        );
                      }
                    }}
                    className="sr-only"
                  />
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color || '#008080' }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.duration}min · {formatCurrency(s.price)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Employee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profesional
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                setSelectedEmployeeId(e.target.value);
                setSelectedStartTime('');
                setSelectedEndTime('');
              }}
              className="input-field"
            >
              <option value="">Cualquier profesional disponible</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time picker */}
          {selectedServiceIds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha y hora *
              </label>
              <AvailabilityPicker
                serviceIds={selectedServiceIds}
                employeeId={selectedEmployeeId || undefined}
                initialDateTime={initialStartTime}
                onSelect={(empId, start, end) => {
                  setSelectedEmployeeId(empId);
                  setSelectedStartTime(start);
                  setSelectedEndTime(end);
                }}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field resize-none"
              rows={2}
              placeholder="Instrucciones especiales, preferencias..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                createMutation.isPending ||
                !selectedClientId ||
                selectedServiceIds.length === 0 ||
                !selectedStartTime ||
                !selectedEmployeeId
              }
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creando...' : 'Crear cita'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
