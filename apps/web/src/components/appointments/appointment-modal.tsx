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
  durationMinutes: number;
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

interface AppointmentItem {
  id: string;
  serviceId: string;
  serviceNameSnapshot: string;
  priceSnapshot: number;
  durationSnapshot: number;
  commissionSnapshot: number | null;
}

interface AppointmentPhoto {
  id: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
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
  internalNotes?: string;
  items?: AppointmentItem[];
  photos?: AppointmentPhoto[];
}

interface CheckAfterResult {
  immediatelyAvailable: boolean;
  immediateSlot: { startTime: string; endTime: string } | null;
  nextAvailable: { date: string; startTime: string; endTime: string } | null;
}

interface AppointmentModalProps {
  appointmentId?: string;
  initialStartTime?: string;
  initialClientId?: string;
  initialEmployeeId?: string;
  onClose: () => void;
  onSave: () => void;
  onCreateAnother?: (clientId: string, employeeId: string) => void;
}

export function AppointmentModal({
  appointmentId,
  initialStartTime,
  initialClientId,
  initialEmployeeId,
  onClose,
  onSave,
  onCreateAnother,
}: AppointmentModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!appointmentId;

  // Form state for new appointment
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(initialEmployeeId || '');
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [selectedEndTime, setSelectedEndTime] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Active date for employee filtering (synced with AvailabilityPicker mini-calendar)
  const initialDateStr = initialStartTime ? initialStartTime.split('T')[0] : undefined;
  const [activeDate, setActiveDate] = useState<string | undefined>(initialDateStr);

  // Add services flow state
  const [addServicesMode, setAddServicesMode] = useState(false);
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);
  const [checkAfterResult, setCheckAfterResult] = useState<CheckAfterResult | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [addServiceError, setAddServiceError] = useState<string | null>(null);

  // Fetch existing appointment
  const { data: appointmentData, isLoading: loadingAppointment } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () =>
      api.get<{ data: Appointment }>(`/api/appointments/${appointmentId}`),
    enabled: isEditing,
  });

  // Fetch appointment photos
  const { data: photosData } = useQuery({
    queryKey: ['appointment-photos', appointmentId],
    queryFn: () =>
      api.get<{ data: AppointmentPhoto[] }>(`/api/appointments/${appointmentId}/photos`),
    enabled: isEditing && !!appointmentId,
  });

  const photos = photosData?.data || [];

  const handlePhotoUpload = async (file: File) => {
    if (!appointmentId) return;
    setUploadingPhoto(true);
    try {
      await api.upload(`/api/appointments/${appointmentId}/photos`, file);
      queryClient.invalidateQueries({ queryKey: ['appointment-photos', appointmentId] });
    } catch (err) {
      console.error('Error uploading photo:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!appointmentId) return;
    try {
      await api.delete(`/api/appointments/${appointmentId}/photos/${photoId}`);
      queryClient.invalidateQueries({ queryKey: ['appointment-photos', appointmentId] });
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  };

  // Fetch services
  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services'),
  });

  // Fetch employees — filter by working date (synced with AvailabilityPicker date)
  const { data: employeesData } = useQuery({
    queryKey: ['employees', activeDate || 'all'],
    queryFn: () => {
      const params = activeDate ? `?workingDate=${activeDate}` : '';
      return api.get<{ data: Employee[] }>(`/api/employees${params}`);
    },
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

  // Pre-fill: if initialClientId, fetch that client's name
  const { data: initialClientData } = useQuery({
    queryKey: ['client', initialClientId],
    queryFn: () => api.get<{ data: Client }>(`/api/clients/${initialClientId}`),
    enabled: !!initialClientId && !isEditing,
  });

  const appointment = appointmentData?.data;
  const services = servicesData?.data || [];
  const employees = employeesData?.data || [];
  const clientResults = clientsData?.data || [];

  // Clear employee selection if the selected employee is not available on the new date
  useEffect(() => {
    if (selectedEmployeeId && employees.length > 0 && !employees.find((e) => e.id === selectedEmployeeId)) {
      setSelectedEmployeeId('');
    }
  }, [employees, selectedEmployeeId]);

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

  // Mutation for creating follow-up appointment from add-services flow
  const addServicesMutation = useMutation({
    mutationFn: (payload: {
      clientId: string;
      employeeId: string;
      locationId: string;
      startTime: string;
      serviceIds: string[];
    }) => api.post('/api/appointments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      setAddServicesMode(false);
      setNewServiceIds([]);
      setCheckAfterResult(null);
      onSave();
    },
    onError: (err: { message?: string }) => {
      setAddServiceError(err.message || 'Error al agendar servicios adicionales');
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
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al cancelar la cita');
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
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al completar la cita');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointmentId}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      onSave();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al confirmar la cita');
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
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al reagendar la cita');
    },
  });

  // Check availability after appointment ends
  async function handleCheckAfter() {
    if (!appointment || newServiceIds.length === 0) return;
    setCheckingAvailability(true);
    setAddServiceError(null);
    setCheckAfterResult(null);
    try {
      const result = await api.post<{ data: CheckAfterResult }>(
        '/api/availability/check-after',
        {
          employeeId: appointment.employeeId,
          serviceIds: newServiceIds,
          afterTime: appointment.endTime,
        },
      );
      setCheckAfterResult(result.data);
    } catch (err: any) {
      setAddServiceError(err.message || 'Error al verificar disponibilidad');
    } finally {
      setCheckingAvailability(false);
    }
  }

  // Auto-check availability when services change in add-services mode
  useEffect(() => {
    if (addServicesMode && newServiceIds.length > 0 && appointment) {
      handleCheckAfter();
    } else {
      setCheckAfterResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newServiceIds, addServicesMode]);

  function handleConfirmAddServices(startTime: string) {
    if (!appointment) return;
    const employee = employees.find((e) => e.id === appointment.employeeId);
    if (!employee?.locationId) {
      setAddServiceError('El profesional no tiene ubicación asignada');
      return;
    }
    addServicesMutation.mutate({
      clientId: appointment.clientId,
      employeeId: appointment.employeeId,
      locationId: employee.locationId,
      startTime,
      serviceIds: newServiceIds,
    });
  }

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

  const statusLower = appointment?.status?.toLowerCase() || '';
  const canCancel =
    appointment &&
    ['pending', 'confirmed', 'rescheduled'].includes(statusLower);
  const canComplete =
    appointment &&
    ['confirmed', 'in_progress'].includes(statusLower);
  const canReschedule =
    appointment &&
    ['pending', 'confirmed', 'rescheduled'].includes(statusLower);
  const canConfirm = false; // Citas se auto-confirman al crearse
  const canAddServices =
    appointment &&
    ['confirmed', 'rescheduled', 'in_progress'].includes(statusLower);

  const totalPrice = appointment?.items?.reduce(
    (sum, item) => sum + Number(item.priceSnapshot || 0),
    0,
  ) ?? 0;

  const totalDuration = appointment?.items?.reduce(
    (sum, item) => sum + Number(item.durationSnapshot || 0),
    0,
  ) ?? 0;

  // Get the display name for pre-filled client
  const getPrefilledClientName = () => {
    if (initialClientId) {
      const fromSearch = clientResults.find((c) => c.id === initialClientId);
      if (fromSearch) return `${fromSearch.firstName} ${fromSearch.lastName}`;
      if (initialClientData?.data) {
        const c = initialClientData.data;
        return `${c.firstName} ${c.lastName}`;
      }
      return 'Cliente seleccionado';
    }
    const found = clientResults.find((c) => c.id === selectedClientId);
    return found ? `${found.firstName} ${found.lastName}` : 'Cliente seleccionado';
  };

  const modalTitle = isEditing
    ? loadingAppointment
      ? 'Cargando...'
      : `Cita — ${appointment?.client?.firstName ?? ''} ${appointment?.client?.lastName ?? ''}`
    : 'Nueva Cita';

  return (
    <Modal
      title={modalTitle}
      onClose={onClose}
      size="lg"
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
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {formError}
              </div>
            )}

            {/* Status */}
            <div className="flex items-center justify-between">
              <AppointmentStatusBadge status={appointment.status.toLowerCase()} />
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
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  {appointment.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center"
                    >
                      <div>
                        <span className="text-sm text-gray-700">
                          {item.serviceNameSnapshot}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {item.durationSnapshot} min
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(Number(item.priceSnapshot))}
                      </span>
                    </div>
                  ))}
                  {appointment.items.length > 1 && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-800">
                        Total ({totalDuration} min)
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(totalPrice)}
                      </span>
                    </div>
                  )}
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

            {appointment.internalNotes && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Notas internas
                </p>
                <p className="text-sm text-gray-600 bg-amber-50 rounded-lg p-3 border border-amber-100">
                  {appointment.internalNotes}
                </p>
              </div>
            )}

            {/* Result Photos — visible for CONFIRMED, IN_PROGRESS, COMPLETED */}
            {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(appointment.status.toUpperCase()) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Fotos de resultado
                </p>
                <div className="bg-gray-50 rounded-lg p-3">
                  {photos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {photos.map((photo) => (
                        <div key={photo.id} className="relative group aspect-square">
                          <img
                            src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${photo.imageUrl}`}
                            alt={photo.caption || 'Resultado'}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <button
                            onClick={() => handlePhotoDelete(photo.id)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Eliminar"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                        e.target.value = '';
                      }}
                      disabled={uploadingPhoto}
                    />
                    {uploadingPhoto ? (
                      <span className="text-sm text-gray-500">Subiendo...</span>
                    ) : (
                      <span className="text-sm text-gray-500">
                        + Subir foto de resultado
                      </span>
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* Add services mode */}
            {addServicesMode && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">
                    Agregar servicios
                  </p>
                  <button
                    onClick={() => {
                      setAddServicesMode(false);
                      setNewServiceIds([]);
                      setCheckAfterResult(null);
                      setAddServiceError(null);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-3">
                  {services.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        newServiceIds.includes(s.id)
                          ? 'border-primary-400 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newServiceIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewServiceIds((ids) => [...ids, s.id]);
                          } else {
                            setNewServiceIds((ids) =>
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
                          {s.durationMinutes}min · {formatCurrency(s.price)}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {addServiceError && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-3">
                    {addServiceError}
                  </div>
                )}

                {checkingAvailability && (
                  <div className="p-3 rounded-lg bg-gray-50 text-gray-600 text-sm mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verificando disponibilidad...
                  </div>
                )}

                {checkAfterResult && !checkingAvailability && (
                  <div className="space-y-3">
                    {checkAfterResult.immediatelyAvailable && checkAfterResult.immediateSlot && (
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                        <p className="text-sm text-green-800 font-medium">
                          Disponible justo despues de la cita a las{' '}
                          {formatTime(
                            new Date(checkAfterResult.immediateSlot.startTime)
                              .toTimeString()
                              .slice(0, 5),
                          )}
                        </p>
                        <button
                          onClick={() =>
                            handleConfirmAddServices(
                              checkAfterResult.immediateSlot!.startTime,
                            )
                          }
                          disabled={addServicesMutation.isPending}
                          className="btn-primary text-sm mt-2 w-full"
                        >
                          {addServicesMutation.isPending
                            ? 'Agendando...'
                            : 'Confirmar'}
                        </button>
                      </div>
                    )}

                    {!checkAfterResult.immediatelyAvailable &&
                      checkAfterResult.immediateSlot && (
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                          <p className="text-sm text-blue-800 font-medium">
                            Disponible hoy a las{' '}
                            {formatTime(
                              new Date(checkAfterResult.immediateSlot.startTime)
                                .toTimeString()
                                .slice(0, 5),
                            )}
                          </p>
                          <button
                            onClick={() =>
                              handleConfirmAddServices(
                                checkAfterResult.immediateSlot!.startTime,
                              )
                            }
                            disabled={addServicesMutation.isPending}
                            className="btn-primary text-sm mt-2 w-full"
                          >
                            {addServicesMutation.isPending
                              ? 'Agendando...'
                              : `Agendar a las ${formatTime(
                                  new Date(checkAfterResult.immediateSlot.startTime)
                                    .toTimeString()
                                    .slice(0, 5),
                                )}`}
                          </button>
                        </div>
                      )}

                    {!checkAfterResult.immediatelyAvailable &&
                      !checkAfterResult.immediateSlot &&
                      checkAfterResult.nextAvailable && (
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-sm text-amber-800 font-medium">
                            Sin espacio despues de la cita. Proxima disponibilidad:
                          </p>
                          <p className="text-sm text-amber-700 mt-1">
                            {formatDate(checkAfterResult.nextAvailable.date)} a las{' '}
                            {formatTime(checkAfterResult.nextAvailable.startTime)}
                          </p>
                          <button
                            onClick={() =>
                              handleConfirmAddServices(
                                `${checkAfterResult.nextAvailable!.date}T${checkAfterResult.nextAvailable!.startTime}:00Z`,
                              )
                            }
                            disabled={addServicesMutation.isPending}
                            className="btn-primary text-sm mt-2 w-full"
                          >
                            {addServicesMutation.isPending
                              ? 'Agendando...'
                              : `Agendar el ${formatDate(checkAfterResult.nextAvailable.date, 'D [de] MMM')}`}
                          </button>
                        </div>
                      )}

                    {!checkAfterResult.immediatelyAvailable &&
                      !checkAfterResult.immediateSlot &&
                      !checkAfterResult.nextAvailable && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                          <p className="text-sm text-red-800">
                            No se encontro disponibilidad en los proximos 14 dias.
                          </p>
                        </div>
                      )}

                    {/* Always show "Crear otra cita" fallback */}
                    {onCreateAnother && (
                      <button
                        onClick={() => {
                          onClose();
                          onCreateAnother(
                            appointment.clientId,
                            appointment.employeeId,
                          );
                        }}
                        className="btn-secondary text-sm w-full"
                      >
                        Crear otra cita manualmente
                      </button>
                    )}
                  </div>
                )}
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
                      ?.map((i) => i.serviceId)
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
                  Motivo de cancelacion
                </p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Razon de la cancelacion..."
                />
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    className="btn-danger flex-1"
                  >
                    {cancelMutation.isPending
                      ? 'Cancelando...'
                      : 'Confirmar cancelacion'}
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
            {!rescheduleMode && !showCancelForm && !addServicesMode && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
                {canAddServices && (
                  <button
                    onClick={() => setAddServicesMode(true)}
                    className="btn-secondary flex-1"
                  >
                    + Agregar servicios
                  </button>
                )}
                {canConfirm && (
                  <button
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar cita'}
                  </button>
                )}
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
                    disabled={completeMutation.isPending || photos.length === 0}
                    className="btn-primary flex-1"
                    title={photos.length === 0 ? 'Sube al menos una foto del resultado' : ''}
                  >
                    {completeMutation.isPending
                      ? 'Procesando...'
                      : photos.length === 0
                        ? 'Sube foto para completar'
                        : 'Completar'}
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
          <p className="text-gray-500">No se encontro la cita</p>
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
                  {getPrefilledClientName()}
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
                      {s.durationMinutes}min · {formatCurrency(s.price)}
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
                onDateChange={(dateStr) => {
                  setActiveDate(dateStr);
                  setSelectedStartTime('');
                  setSelectedEndTime('');
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
