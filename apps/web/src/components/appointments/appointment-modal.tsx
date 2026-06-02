'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DetailSheet } from '@/components/ui/detail-sheet';
import { AppointmentStatusBadge } from '@/components/ui/badge';
import { AvailabilityPicker } from '@/components/calendar/availability-picker';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatDate, formatTime, resolveImageUrl } from '@/lib/utils';
import { formatBookingTime } from '@/lib/booking-time';
import dayjs from 'dayjs';
import { useCurrency } from '@/lib/hooks/use-currency';

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

interface ProductReservation {
  id: string;
  product: { id: string; name: string; imageUrl?: string };
  quantity: number;
  unitPrice: number;
  status: string;
  fulfillmentType: string;
  preferredPaymentMethod: string;
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
  discountAmount?: number;
  redemptionId?: string;
  pointsSpent?: number;
  redemption?: {
    id: string;
    code: string;
    pointsSpent: number;
    reward: { name: string; type: string; discountAmount?: number | null; discountMode?: string | null };
  } | null;
  items?: AppointmentItem[];
  photos?: AppointmentPhoto[];
  productReservations?: ProductReservation[];
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
  const { format: formatCurrency } = useCurrency();
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
  const router = useRouter();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Flag para encadenar "Finalizar sin foto" → upload → completar.
  const [autoCompleteOnNextUpload, setAutoCompleteOnNextUpload] = useState(false);
  // Ref del input file oculto que dispara el "Finalizar" cuando no hay foto.
  const finalizeFileInputRef = useRef<HTMLInputElement>(null);

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
      // Si veníamos del botón "Finalizar" sin fotos, encadenamos completar
      // automáticamente tras un upload exitoso.
      if (autoCompleteOnNextUpload) {
        setAutoCompleteOnNextUpload(false);
        completeMutation.mutate();
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      setAutoCompleteOnNextUpload(false);
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

  // Lista completa de clientes para el SearchableSelect (estilo POS).
  // El propio componente filtra en el navegador con el input de búsqueda
  // interno. Si la lista crece mucho, paginamos en V2.
  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => api.get<{ data: Client[] }>('/api/clients?perPage=100'),
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
    // Si el empleado seleccionado no tiene NINGUNO de los servicios actuales
    // (porque cambió la selección), lo limpiamos. Si tiene al menos uno,
    // lo dejamos: el AvailabilityPicker filtrará slots viables.
    if (selectedEmployeeId && selectedServiceIds.length > 0 && employees.length > 0) {
      const emp = employees.find((e: any) => e.id === selectedEmployeeId);
      const empServiceIds: string[] = ((emp as any)?.employeeServices || []).map(
        (es: any) => es.serviceId || es.service?.id,
      );
      const hasAny = selectedServiceIds.some((sid) => empServiceIds.includes(sid));
      if (!hasAny) {
        setSelectedEmployeeId('');
      }
    }
    if (selectedEmployeeId && employees.length > 0 && !employees.find((e) => e.id === selectedEmployeeId)) {
      setSelectedEmployeeId('');
    }
  }, [employees, selectedEmployeeId, selectedServiceIds]);

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

  // Tras finalizar mostramos un prompt para encadenar el cobro en el POS.
  const [showPayPrompt, setShowPayPrompt] = useState(false);

  const completeMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointmentId}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      // No cerramos el modal: dejamos al cajero decidir "Proceder al pago"
      // (redirige al POS con la cita cargada) o "Cerrar".
      setShowPayPrompt(true);
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al completar la cita');
    },
  });

  // Consentimiento del cliente para fotos del resultado. Bloquea la
  // finalización de la cita hasta que el cajero registre la respuesta.
  // - true  → habilita la subida de fotos (y obliga al menos una)
  // - false → omite las fotos del resultado
  const consentMutation = useMutation({
    mutationFn: (consent: boolean) =>
      api.post(`/api/appointments/${appointmentId}/photo-consent`, { consent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al registrar el consentimiento');
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

  const reservationsTotal = appointment?.productReservations?.reduce(
    (sum, res) =>
      res.status === 'CANCELLED' ? sum : sum + Number(res.unitPrice || 0) * (res.quantity || 1),
    0,
  ) ?? 0;

  const totalPrice = appointment?.items?.reduce(
    (sum, item) => sum + Number(item.priceSnapshot || 0),
    0,
  ) ?? 0;

  const totalDuration = appointment?.items?.reduce(
    (sum, item) => sum + Number(item.durationSnapshot || 0),
    0,
  ) ?? 0;

  const discount = Number(appointment?.discountAmount || 0);
  const pointsSpent = Number(appointment?.pointsSpent || 0);
  const paidWithPoints = pointsSpent > 0;
  const subtotalServicios = totalPrice;
  const subtotalApartados = reservationsTotal;
  const subtotal = subtotalServicios + subtotalApartados;
  // Si pagó con puntos, los servicios cuestan 0; los apartados se mantienen en efectivo.
  const finalTotal = paidWithPoints
    ? Math.max(0, subtotalApartados)
    : Math.max(0, subtotal - discount);

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
    <DetailSheet
      title={modalTitle}
      onClose={onClose}
      size="lg"
    >
      {isEditing ? (
        // View mode
        loadingAppointment ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-[var(--bg-muted)] rounded animate-pulse" />
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
              <p className="text-sm text-[var(--text-secondary)]">
                {formatDate(appointment.startTime)},{' '}
                {formatTime(formatBookingTime(appointment.startTime))}
                {' – '}
                {formatTime(formatBookingTime(appointment.endTime))}
              </p>
            </div>

            {/* Client & Employee */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  Cliente
                </p>
                {appointment.client ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center overflow-hidden text-xs font-semibold flex-shrink-0">
                      {(appointment.client as any).avatarUrl ? (
                        <img src={resolveImageUrl((appointment.client as any).avatarUrl) || ''} alt="" className="w-full h-full object-cover" />
                      ) : (
                        `${appointment.client.firstName?.[0] ?? ''}${appointment.client.lastName?.[0] ?? ''}`
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {appointment.client.firstName} {appointment.client.lastName}
                      </p>
                      {appointment.client.email && (
                        <p className="text-xs text-[var(--text-secondary)] truncate">{appointment.client.email}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-[var(--text-primary)]">-</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  Profesional
                </p>
                {appointment.employee ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden text-xs font-semibold flex-shrink-0"
                      style={{
                        backgroundColor: `${(appointment.employee as any).color || '#008080'}25`,
                        color: (appointment.employee as any).color || '#008080',
                      }}
                    >
                      {(appointment.employee as any).avatarUrl ? (
                        <img src={resolveImageUrl((appointment.employee as any).avatarUrl) || ''} alt="" className="w-full h-full object-cover" />
                      ) : (
                        `${appointment.employee.firstName?.[0] ?? ''}${appointment.employee.lastName?.[0] ?? ''}`
                      )}
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate flex-1 min-w-0">
                      {appointment.employee.firstName} {appointment.employee.lastName}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-[var(--text-primary)]">-</p>
                )}
              </div>
            </div>

            {/* Services */}
            {appointment.items && appointment.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Servicios
                </p>
                <div className="bg-[var(--bg-subtle)] rounded-lg p-3 space-y-2">
                  {appointment.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center"
                    >
                      <div>
                        <span className="text-sm text-[var(--text-secondary)]">
                          {item.serviceNameSnapshot}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">
                          {item.durationSnapshot} min
                        </span>
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {formatCurrency(Number(item.priceSnapshot))}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      Subtotal servicios ({totalDuration} min)
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {formatCurrency(subtotalServicios)}
                    </span>
                  </div>
                  {subtotalApartados > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-secondary)]">Apartados (productos)</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{formatCurrency(subtotalApartados)}</span>
                    </div>
                  )}
                  {appointment.redemption && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-teal-700">
                        Cupón <span className="font-mono">{appointment.redemption.code}</span> · {appointment.redemption.reward.name}
                      </span>
                      {discount > 0 && (
                        <span className="text-sm font-medium text-teal-700">-{formatCurrency(discount)}</span>
                      )}
                    </div>
                  )}
                  {discount > 0 && !appointment.redemption && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-green-600">Descuento aplicado</span>
                      <span className="text-sm font-medium text-green-600">-{formatCurrency(discount)}</span>
                    </div>
                  )}
                  {paidWithPoints && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-teal-700">Pagado con puntos</span>
                      <span className="text-sm font-medium text-teal-700">{pointsSpent} pts</span>
                    </div>
                  )}
                  {/* CTA agregar servicios — entre el último concepto y el
                      "Total a cobrar", donde es más natural ampliar el ticket. */}
                  {canAddServices && !addServicesMode && (
                    <button
                      type="button"
                      onClick={() => setAddServicesMode(true)}
                      className="w-full mt-1 px-3 py-2 rounded-lg border-2 border-dashed text-xs font-semibold transition-colors hover:bg-teal-50"
                      style={{ borderColor: '#008080', color: '#008080' }}
                    >
                      + Agregar servicios
                    </button>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                    <span className="text-sm font-bold text-[var(--text-primary)]">Total a cobrar</span>
                    <span className="text-base font-bold text-[#008080]">{formatCurrency(finalTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Product Reservations (Apartados) */}
            {appointment.productReservations && appointment.productReservations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Apartados
                </p>
                <div className="bg-[var(--bg-subtle)] rounded-lg p-3 space-y-2">
                  {appointment.productReservations.map((res) => {
                    const statusLabels: Record<string, { label: string; color: string }> = {
                      PENDING: { label: 'Pendiente', color: 'text-teal-700 bg-teal-50' },
                      CONFIRMED: { label: 'Confirmado', color: 'text-blue-700 bg-blue-50' },
                      READY: { label: 'Listo', color: 'text-green-700 bg-green-50' },
                      DELIVERED: { label: 'Entregado', color: 'text-green-700 bg-green-50' },
                      CANCELLED: { label: 'Cancelado', color: 'text-red-600 bg-red-50' },
                    };
                    const st = statusLabels[res.status] || { label: res.status, color: 'text-[var(--text-secondary)] bg-[var(--bg-muted)]' };

                    return (
                      <div key={res.id} className="flex items-center gap-3">
                        {res.product.imageUrl && (
                          <img
                            src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${res.product.imageUrl}`}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text-secondary)]">{res.product.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{res.quantity} × {formatCurrency(Number(res.unitPrice))}</p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <span className="text-sm font-medium text-[var(--text-primary)]">{formatCurrency(Number(res.unitPrice) * res.quantity)}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {appointment.notes && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Notas
                </p>
                <p className="text-sm text-[var(--text-secondary)] bg-[var(--bg-subtle)] rounded-lg p-3">
                  {appointment.notes}
                </p>
              </div>
            )}

            {appointment.internalNotes && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Notas internas
                </p>
                <p className="text-sm text-teal-800 dark:text-teal-200 rounded-lg p-3 border" style={{ backgroundColor: 'var(--primary-tint)', borderColor: 'var(--primary-tint-border)' }}>
                  {appointment.internalNotes}
                </p>
              </div>
            )}

            {/* Consentimiento + Fotos de resultado — visible para CONFIRMED,
                IN_PROGRESS, COMPLETED.

                Reglas:
                - Si ya hay fotos cargadas → mostrar el bloque de fotos
                  directamente (el consentimiento queda implícito = aceptó).
                - Si NO hay fotos y consent es null → pedir consentimiento.
                - Si NO hay fotos y consent es false → aviso "no autorizó",
                  con botón "Cambiar y subir foto" que activa consent=true
                  y dispara el file picker en un solo paso.
                - Si NO hay fotos y consent es true → empty state con CTA.

                Estilo: mismo patrón que "Dejar reseña" del marketplace cliente. */}
            {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(appointment.status.toUpperCase()) && (
              <div>
                {photos.length === 0 && (appointment.photoConsent === null || appointment.photoConsent === undefined) ? (
                  // ── PASO 1: consentimiento ──────────────────────────
                  <div
                    className="rounded-xl border-2 p-4"
                    style={{ borderColor: '#008080', backgroundColor: '#e0f2f1' }}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" style={{ color: '#008080' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">Consentimiento del cliente</p>
                        <p className="text-[11px] text-gray-600 leading-snug mt-0.5">
                          ¿El cliente autoriza tomar fotos del resultado y usarlas en el portafolio del negocio?
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => consentMutation.mutate(true)}
                        disabled={consentMutation.isPending}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: '#008080' }}
                      >
                        Sí, acepta
                      </button>
                      <button
                        onClick={() => consentMutation.mutate(false)}
                        disabled={consentMutation.isPending}
                        className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        No autoriza
                      </button>
                    </div>
                  </div>
                ) : photos.length === 0 && appointment.photoConsent === false ? (
                  // ── Cliente NO autorizó: aviso, sin fotos.
                  // "Cambiar y subir" cambia consent → true Y abre file picker
                  // en un solo gesto (no vuelve al estado de pedir consent).
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                      </svg>
                      <p className="text-xs text-gray-600">El cliente no autorizó fotos del resultado</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await consentMutation.mutateAsync(true);
                          finalizeFileInputRef.current?.click();
                        } catch {}
                      }}
                      disabled={consentMutation.isPending}
                      className="text-[10px] font-semibold whitespace-nowrap"
                      style={{ color: '#008080' }}
                    >
                      Cambiar y subir foto
                    </button>
                  </div>
                ) : photos.length === 0 ? (
                  <label className="block cursor-pointer">
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
                    <div
                      className="w-full px-4 py-4 rounded-xl border-2 border-dashed text-sm font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-teal-50"
                      style={{ borderColor: '#008080', color: '#008080' }}
                    >
                      {uploadingPhoto ? (
                        <span>Subiendo...</span>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                          </svg>
                          + Agregar fotos del resultado
                        </>
                      )}
                    </div>
                  </label>
                ) : (
                  <div
                    className="rounded-xl border-2 p-4"
                    style={{ borderColor: '#008080', backgroundColor: '#e0f2f1' }}
                  >
                    {/* Header — avatar/icono + título + contador */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" style={{ color: '#008080' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">Fotos de resultado</p>
                        <p className="text-[10px] text-gray-500 leading-tight">{photos.length} foto{photos.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {/* Grid de fotos + tile para añadir más al final */}
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map((photo) => (
                        <div key={photo.id} className="relative group aspect-square">
                          <img
                            src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${photo.imageUrl}`}
                            alt={photo.caption || 'Resultado'}
                            className="w-full h-full object-cover rounded-lg ring-1 ring-white"
                          />
                          <button
                            onClick={() => handlePhotoDelete(photo.id)}
                            className="absolute top-1 right-1 bg-white text-red-500 rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow"
                            title="Eliminar"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                      <label className="aspect-square rounded-lg border-2 border-dashed bg-white/60 flex items-center justify-center cursor-pointer hover:bg-white transition-colors" style={{ borderColor: '#008080' }}>
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
                          <span className="text-[10px] font-medium" style={{ color: '#008080' }}>Subiendo...</span>
                        ) : (
                          <svg className="w-5 h-5" style={{ color: '#008080' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add services mode */}
            {addServicesMode && (
              <div className="border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Agregar servicios
                  </p>
                  <button
                    onClick={() => {
                      setAddServicesMode(false);
                      setNewServiceIds([]);
                      setCheckAfterResult(null);
                      setAddServiceError(null);
                    }}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"
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
                          : 'border-[var(--border)] hover:border-[var(--border)]'
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
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {s.name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
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
                  <div className="p-3 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-sm mb-3 flex items-center gap-2">
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
                          {formatTime(formatBookingTime(checkAfterResult.immediateSlot.startTime))}
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
                            {formatTime(formatBookingTime(checkAfterResult.immediateSlot.startTime))}
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
                              : `Agendar a las ${formatTime(formatBookingTime(checkAfterResult.immediateSlot.startTime))}`}
                          </button>
                        </div>
                      )}

                    {!checkAfterResult.immediatelyAvailable &&
                      !checkAfterResult.immediateSlot &&
                      checkAfterResult.nextAvailable && (
                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--primary-tint)', borderColor: 'var(--primary-tint-border)' }}>
                          <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                            Sin espacio despues de la cita. Proxima disponibilidad:
                          </p>
                          <p className="text-sm mt-1 text-teal-700 dark:text-teal-300">
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
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">
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
                    // El availability endpoint devuelve "YYYY-MM-DDTHH:mm:00"
                    // sin TZ. Lo dejamos tal cual: el backend trabaja con
                    // horas como "hora del negocio" en UTC raw, igual que
                    // los slots. Convertir a UTC absoluto romperia la
                    // comparacion con los slots al volver a consultar.
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
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
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

            {/* Prompt tras finalizar: encadena al POS si quieren cobrar ya */}
            {showPayPrompt && (
              <div
                className="rounded-xl border-2 p-4"
                style={{ borderColor: '#008080', backgroundColor: '#e0f2f1' }}
              >
                <div className="flex items-start gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" style={{ color: '#008080' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 leading-tight">Cita finalizada</p>
                    <p className="text-[11px] text-gray-600 leading-snug mt-0.5">
                      ¿Deseas cobrar ahora? Te llevaremos al Punto de venta con esta cita ya cargada.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      router.push(`/pos?appointmentId=${appointmentId}`);
                    }}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: '#008080' }}
                  >
                    Proceder al pago
                  </button>
                  <button
                    onClick={() => {
                      setShowPayPrompt(false);
                      onSave();
                    }}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons — orden: Cancelar / Reagendar / Finalizar
                (los más destructivos a la izquierda, primario a la derecha) */}
            {!rescheduleMode && !showCancelForm && !addServicesMode && !showPayPrompt && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-[var(--border)]">
                {/* Input file oculto que dispara el flow "Finalizar sin foto":
                    click → upload → al éxito, completeMutation.mutate() via
                    autoCompleteOnNextUpload. */}
                <input
                  ref={finalizeFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                    e.target.value = '';
                  }}
                />
                {canCancel && (
                  <button
                    onClick={() => setShowCancelForm(true)}
                    className="btn-danger flex-1"
                  >
                    Cancelar cita
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
                {canConfirm && (
                  <button
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar cita'}
                  </button>
                )}
                {canComplete && (() => {
                  // El consentimiento es paso obligatorio. Mientras esté
                  // null, deshabilitamos "Finalizar" para que el cajero
                  // primero registre la respuesta del cliente arriba.
                  const consentPending =
                    appointment.photoConsent === null || appointment.photoConsent === undefined;
                  const consentDeclined = appointment.photoConsent === false;
                  return (
                    <button
                      onClick={() => {
                        if (consentDeclined) {
                          // Cliente no autorizó fotos: completar directo.
                          completeMutation.mutate();
                          return;
                        }
                        if (photos.length > 0) {
                          completeMutation.mutate();
                        } else {
                          // Cliente sí autorizó pero aún no hay foto: abrir
                          // file picker y encadenar completar al upload.
                          setAutoCompleteOnNextUpload(true);
                          finalizeFileInputRef.current?.click();
                        }
                      }}
                      disabled={completeMutation.isPending || uploadingPhoto || consentPending}
                      className="btn-primary flex-1"
                      title={consentPending ? 'Registra primero el consentimiento del cliente' : ''}
                    >
                      {completeMutation.isPending
                        ? 'Procesando...'
                        : uploadingPhoto
                          ? 'Subiendo foto...'
                          : consentPending
                            ? 'Pide consentimiento'
                            : 'Finalizar'}
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[var(--text-secondary)]">No se encontro la cita</p>
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
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Cliente *
            </label>
            <SearchableSelect
              value={selectedClientId}
              onChange={(id) => setSelectedClientId(id)}
              options={clientResults
                .slice()
                .sort((a: any, b: any) =>
                  `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es'),
                )
                .map((c: any) => ({
                  id: c.id,
                  label: `${c.firstName} ${c.lastName}`,
                  sublabel: c.phone || c.email,
                  initials: `${c.firstName?.[0] || ''}${c.lastName?.[0] || ''}`.toUpperCase(),
                  avatarUrl: c.avatarUrl || null,
                  color: '#008080',
                }))}
              placeholder="Buscar cliente..."
              allLabel="Seleccionar cliente"
            />
          </div>

          {/* Services */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Servicios *
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {services.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedServiceIds.includes(s.id)
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-[var(--border)] hover:border-[var(--border)]'
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
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {s.durationMinutes}min · {formatCurrency(s.price)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Employee — solo aparecen profesionales que tienen TODOS los
              servicios seleccionados asignados. Sin servicios no se filtra.
              Esto evita el error backend "el empleado no tiene asignado(s):
              SERVICIO" al combinar empleado y servicio inválidos. */}
          {(() => {
            // Elegible = el empleado tiene AL MENOS UNO de los servicios.
            // Multi-servicio con empleados distintos es válido en el sistema;
            // el AvailabilityPicker se encarga de sugerir slots viables.
            const eligibleEmployees =
              selectedServiceIds.length === 0
                ? employees
                : employees.filter((emp: any) => {
                    const empServiceIds: string[] = (emp.employeeServices || []).map(
                      (es: any) => es.serviceId || es.service?.id,
                    );
                    return selectedServiceIds.some((sid) => empServiceIds.includes(sid));
                  });
            return (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
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
                  {eligibleEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
                {selectedServiceIds.length > 0 && eligibleEmployees.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Ningún profesional tiene asignado(s) el/los servicio(s) seleccionado(s).
                  </p>
                )}
              </div>
            );
          })()}

          {/* Date & Time picker */}
          {selectedServiceIds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Fecha y hora *
              </label>
              <AvailabilityPicker
                serviceIds={selectedServiceIds}
                employeeId={selectedEmployeeId || undefined}
                initialDateTime={initialStartTime}
                onSelect={(empId, start, end) => {
                  setSelectedEmployeeId(empId);
                  // start/end vienen como "YYYY-MM-DDTHH:mm:00" sin TZ.
                  // Se mandan tal cual al backend (ver nota en reschedule).
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
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
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
    </DetailSheet>
  );
}
