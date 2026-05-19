'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  color?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  color?: string;
}

interface AvailableSlot {
  startTime: string;
  endTime: string;
  employeeId: string;
}

interface BookingDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;

  // Redirect to marketplace login if not authenticated
  useEffect(() => {
    const token = typeof window !== 'undefined' && localStorage.getItem('marketplace_access_token');
    if (!token) {
      router.replace(`/marketplace/login?redirect=${encodeURIComponent(`/book/${tenantSlug}`)}`);
    }
  }, [router, tenantSlug]);

  const [step, setStep] = useState<Step>(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [anyEmployee, setAnyEmployee] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [details, setDetails] = useState<BookingDetails>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [isConfirmed, setIsConfirmed] = useState(false);

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['public-services', tenantSlug],
    queryFn: async () => {
      const res = await fetch(`${PUBLIC_API}/api/public/${tenantSlug}/services`);
      if (!res.ok) throw new Error('Error al cargar servicios');
      return res.json() as Promise<{ data: Service[] }>;
    },
  });

  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['public-employees', tenantSlug],
    queryFn: async () => {
      const res = await fetch(`${PUBLIC_API}/api/public/${tenantSlug}/employees`);
      if (!res.ok) throw new Error('Error al cargar profesionales');
      return res.json() as Promise<{ data: Employee[] }>;
    },
    enabled: step >= 2,
  });

  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: [
      'public-slots',
      tenantSlug,
      selectedDate.format('YYYY-MM-DD'),
      selectedServices.map((s) => s.id),
      selectedEmployee?.id,
    ],
    queryFn: async () => {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const res = await fetch(`${PUBLIC_API}/api/public/${tenantSlug}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateStr,
          endDate: dateStr,
          serviceIds: selectedServices.map((s) => s.id),
          employeeId: selectedEmployee?.id,
        }),
      });
      if (!res.ok) throw new Error('Error al cargar horarios');
      return res.json() as Promise<{ data: AvailableSlot[] }>;
    },
    enabled: step === 3 && selectedServices.length > 0,
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${PUBLIC_API}/api/public/${tenantSlug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceIds: selectedServices.map((s) => s.id),
          employeeId: selectedSlot?.employeeId || selectedEmployee?.id,
          // selectedSlot.startTime es "YYYY-MM-DDTHH:mm:00" sin TZ. Convertir
          // a UTC absoluto con dayjs().toISOString() para que se guarde bien
          // y el display en local muestre la hora seleccionada.
          startTime: selectedSlot?.startTime ? dayjs(selectedSlot.startTime).toISOString() : undefined,
          client: {
            firstName: details.firstName,
            lastName: details.lastName,
            email: details.email,
            phone: details.phone,
          },
          notes: details.notes,
        }),
      });
      if (!res.ok) throw new Error('Error al crear la cita');
      return res.json();
    },
    onSuccess: () => {
      setIsConfirmed(true);
      setStep(5);
    },
  });

  const services = servicesData?.data || [];
  const employees = employeesData?.data || [];
  const slots = slotsData?.data || [];

  function toggleService(service: Service) {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service],
    );
  }

  const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);

  // Generate calendar days for current month view
  const startOfMonth = selectedDate.startOf('month');
  const daysInMonth = selectedDate.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) =>
    startOfMonth.add(i, 'day'),
  );

  if (isConfirmed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Reserva confirmada</h2>
          <p className="text-gray-500 mb-6">
            Tu cita ha sido reservada exitosamente. Recibirás un correo de confirmacion.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Servicios:</span>
              <span className="font-medium">{selectedServices.map((s) => s.name).join(', ')}</span>
            </div>
            {selectedSlot && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fecha y hora:</span>
                <span className="font-medium">
                  {formatDate(selectedSlot.startTime)},{' '}
                  {formatTime(selectedSlot.startTime.substring(11, 16))}
                </span>
              </div>
            )}
          </div>
          <button onClick={() => window.location.reload()} className="btn-primary w-full">
            Hacer otra reserva
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-primary-600">Siliba</h1>
          <p className="text-sm text-gray-500">Reserva tu cita en línea</p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'Servicio' },
              { num: 2, label: 'Profesional' },
              { num: 3, label: 'Horario' },
              { num: 4, label: 'Datos' },
              { num: 5, label: 'Confirmar' },
            ].map(({ num, label }, idx, arr) => (
              <div key={num} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                      step > num
                        ? 'bg-primary-600 text-white'
                        : step === num
                          ? 'bg-primary-100 text-primary-700 border-2 border-primary-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {step > num ? '✓' : num}
                  </div>
                  <span
                    className={`text-xs hidden sm:block ${step === num ? 'text-primary-700 font-medium' : 'text-gray-400'}`}
                  >
                    {label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 ${step > num ? 'bg-primary-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Step 1: Services */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Selecciona el servicio
            </h2>
            {loadingServices ? (
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-white rounded-xl border border-gray-200 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {services.map((service) => {
                  const isSelected = selectedServices.some((s) => s.id === service.id);
                  return (
                    <button
                      key={service.id}
                      onClick={() => toggleService(service)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex-shrink-0"
                          style={{ backgroundColor: service.color || '#008080' }}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{service.name}</p>
                          {service.description && (
                            <p className="text-sm text-gray-500">{service.description}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(service.price)}
                          </p>
                          <p className="text-xs text-gray-500">{service.durationMinutes} min</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedServices.length > 0 && (
              <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">
                    {selectedServices.length} servicio
                    {selectedServices.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-sm font-semibold">
                    {totalDuration} min · {formatCurrency(totalPrice)}
                  </span>
                </div>
                <button onClick={() => setStep(2)} className="btn-primary w-full">
                  Continuar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Employee */}
        {step === 2 && (
          <div>
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Selecciona el profesional
            </h2>
            <div className="grid gap-3">
              {/* Any employee option */}
              <button
                onClick={() => {
                  setSelectedEmployee(null);
                  setAnyEmployee(true);
                  setStep(3);
                }}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  anyEmployee
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                    ✨
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Cualquier profesional disponible
                    </p>
                    <p className="text-sm text-gray-500">
                      Te asignaremos el mejor disponible
                    </p>
                  </div>
                </div>
              </button>

              {loadingEmployees ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-white rounded-xl border border-gray-200 animate-pulse" />
                ))
              ) : (
                employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      setSelectedEmployee(emp);
                      setAnyEmployee(false);
                      setStep(3);
                    }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedEmployee?.id === emp.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                        {emp.avatarUrl ? (
                          <img src={`${PUBLIC_API}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <>{emp.firstName.charAt(0)}{emp.lastName.charAt(0)}</>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">
                        {emp.firstName} {emp.lastName}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === 3 && (
          <div>
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Selecciona fecha y hora
            </h2>

            {/* Mini calendar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setSelectedDate((d) => d.subtract(1, 'month'))}
                  className="p-1.5 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-semibold">
                  {selectedDate.format('MMMM YYYY')}
                </span>
                <button
                  onClick={() => setSelectedDate((d) => d.add(1, 'month'))}
                  className="p-1.5 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((d) => (
                  <div key={d} className="text-xs font-medium text-gray-400 py-1">
                    {d}
                  </div>
                ))}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {calendarDays.map((day) => {
                  const isToday = day.isSame(dayjs(), 'day');
                  const isPast = day.isBefore(dayjs(), 'day');
                  const isSelected = day.isSame(selectedDate, 'day');
                  return (
                    <button
                      key={day.format('YYYY-MM-DD')}
                      disabled={isPast}
                      onClick={() => setSelectedDate(day)}
                      className={`text-sm py-1.5 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-primary-600 text-white'
                          : isToday
                            ? 'bg-primary-100 text-primary-700 font-semibold'
                            : isPast
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {day.date()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Horarios disponibles — {formatDate(selectedDate.toDate())}
              </h3>
              {loadingSlots ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No hay horarios disponibles para esta fecha
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((slot) => {
                    const time = slot.startTime.substring(11, 16);
                    const isSelected = selectedSlot?.startTime === slot.startTime;
                    return (
                      <button
                        key={slot.startTime + slot.employeeId}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 text-sm rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-gray-200 hover:border-primary-400 text-gray-700'
                        }`}
                      >
                        {formatTime(time)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedSlot && (
              <button onClick={() => setStep(4)} className="btn-primary w-full mt-4">
                Continuar
              </button>
            )}
          </div>
        )}

        {/* Step 4: Contact details */}
        {step === 4 && (
          <div>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Tus datos
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(5);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={details.firstName}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, firstName: e.target.value }))
                    }
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    value={details.lastName}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, lastName: e.target.value }))
                    }
                    className="input-field"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={details.email}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, email: e.target.value }))
                  }
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={details.phone}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, phone: e.target.value }))
                  }
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={details.notes}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, notes: e.target.value }))
                  }
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Alergias, preferencias, etc."
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Continuar
              </button>
            </form>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && !isConfirmed && (
          <div>
            <button
              onClick={() => setStep(4)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Confirma tu reserva
            </h2>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 mb-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Servicios
                </p>
                {selectedServices.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{s.name}</span>
                    <span className="font-medium">{formatCurrency(s.price)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Fecha y hora
                </p>
                {selectedSlot && (
                  <p className="text-sm text-gray-700">
                    {formatDate(selectedSlot.startTime, 'dddd, D [de] MMMM YYYY')}{' '}
                    {' · '}
                    {formatTime(selectedSlot.startTime.substring(11, 16))}
                  </p>
                )}
              </div>

              {!anyEmployee && selectedEmployee && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Profesional
                  </p>
                  <p className="text-sm text-gray-700">
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Datos de contacto
                </p>
                <p className="text-sm text-gray-700">
                  {details.firstName} {details.lastName}
                </p>
                <p className="text-sm text-gray-500">{details.email}</p>
                <p className="text-sm text-gray-500">{details.phone}</p>
              </div>

              <div className="border-t border-gray-100 pt-4 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-primary-600 text-lg">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>

            {bookMutation.isError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                Error al confirmar la reserva. Por favor intenta de nuevo.
              </div>
            )}

            <button
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {bookMutation.isPending && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {bookMutation.isPending ? 'Confirmando...' : 'Confirmar Reserva'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
