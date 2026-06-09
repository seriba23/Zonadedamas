'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientAuth } from '@/lib/hooks/use-client-auth';
import { portalApi } from '@/lib/portal-api';
import { formatCurrency } from '@/lib/utils';
import dayjs from 'dayjs';
import PortalNav from '../portal-nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string | number;
  color: string;
  category: string | null;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  color: string;
  employeeServices: { serviceId: string }[];
}

interface Slot {
  startTime: string;
  endTime: string;
  employeeId: string;
  employeeName: string;
}

type Step = 'service' | 'employee' | 'datetime' | 'confirm';

export default function PortalBookPage() {
  const { isAuthenticated, isLoading: authLoading, tenantSlug } = useClientAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('service');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/portal/${tenantSlug}/login`);
    }
  }, [authLoading, isAuthenticated, router, tenantSlug]);

  const { data: servicesData } = useQuery({
    queryKey: ['portal-services'],
    queryFn: () => portalApi.get<Service[]>('/services'),
    enabled: isAuthenticated,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['portal-employees'],
    queryFn: () => portalApi.get<Employee[]>('/employees'),
    enabled: isAuthenticated,
  });

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['portal-availability', selectedServiceIds, selectedEmployeeId, selectedDate],
    queryFn: () =>
      portalApi.post<{ data: any[] }>('/availability', {
        serviceIds: selectedServiceIds,
        startDate: selectedDate,
        endDate: selectedDate,
        employeeId: selectedEmployeeId,
      }),
    enabled:
      isAuthenticated &&
      step === 'datetime' &&
      selectedServiceIds.length > 0 &&
      !!selectedEmployeeId,
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      portalApi.post('/book', {
        employeeId: selectedEmployeeId,
        serviceIds: selectedServiceIds,
        // startTime tal cual ("YYYY-MM-DDTHH:mm:00" sin TZ) — ver nota en
        // marketplace/page.tsx. El backend trabaja con horas del negocio
        // en UTC raw, igual que los slots de availability.
        startTime: selectedSlot?.startTime,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
      router.push(`/portal/${tenantSlug}/appointments`);
    },
  });

  const services: Service[] = (servicesData as any) || [];
  const employees: Employee[] = (employeesData as any) || [];
  const availableEmployees = employees.filter((emp) =>
    selectedServiceIds.every((sid) =>
      emp.employeeServices.some((es) => es.serviceId === sid),
    ),
  );

  // Flatten availability response
  const slots: Slot[] = [];
  const rawSlots = (slotsData as any)?.data || [];
  if (Array.isArray(rawSlots)) {
    for (const day of rawSlots) {
      if (day.employees) {
        for (const emp of day.employees) {
          for (const slot of emp.slots) {
            slots.push({
              startTime: `${day.date}T${slot.startTime}:00`,
              endTime: `${day.date}T${slot.endTime}:00`,
              employeeId: emp.id,
              employeeName: emp.name,
            });
          }
        }
      } else if (day.startTime) {
        slots.push(day);
      }
    }
  }

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => {
            if (step === 'service') router.back();
            else if (step === 'employee') setStep('service');
            else if (step === 'datetime') setStep('employee');
            else if (step === 'confirm') setStep('datetime');
          }}
          className="p-1 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Reservar cita</h1>
      </div>

      {/* Steps indicator */}
      <div className="bg-white px-4 py-3 flex items-center gap-2 border-b border-gray-100">
        {(['service', 'employee', 'datetime', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s
                  ? 'bg-indigo-600 text-white'
                  : i < ['service', 'employee', 'datetime', 'confirm'].indexOf(step)
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1}
            </div>
            {i < 3 && <div className="w-8 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* Step 1: Services */}
        {step === 'service' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Selecciona los servicios
            </p>
            {services.map((service) => {
              const selected = selectedServiceIds.includes(service.id);
              return (
                <button
                  key={service.id}
                  onClick={() =>
                    setSelectedServiceIds((prev) =>
                      selected
                        ? prev.filter((id) => id !== service.id)
                        : [...prev, service.id],
                    )
                  }
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{service.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {service.durationMinutes} min
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(Number(service.price))}
                    </span>
                  </div>
                </button>
              );
            })}
            {selectedServiceIds.length > 0 && (
              <button
                onClick={() => setStep('employee')}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors mt-4"
              >
                Continuar ({selectedServiceIds.length} servicio
                {selectedServiceIds.length !== 1 ? 's' : ''} -{' '}
                {formatCurrency(totalPrice)})
              </button>
            )}
          </div>
        )}

        {/* Step 2: Employee */}
        {step === 'employee' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Elige tu profesional
            </p>
            {availableEmployees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => setSelectedEmployeeId(emp.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedEmployeeId === emp.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
                    style={{ backgroundColor: emp.color }}
                  >
                    {emp.avatarUrl ? (
                      <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <>{emp.firstName[0]}{emp.lastName[0]}</>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {emp.firstName} {emp.lastName}
                  </p>
                </div>
              </button>
            ))}

            {/* Continuar — consistente con los demas steps. */}
            <button
              type="button"
              disabled={!selectedEmployeeId}
              onClick={() => setStep('datetime')}
              className="w-full mt-4 py-3 rounded-xl font-semibold text-white text-sm bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === 'datetime' && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              Selecciona fecha y hora
            </p>
            <input
              type="date"
              value={selectedDate}
              min={dayjs().format('YYYY-MM-DD')}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlot(null);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:ring-2 focus:ring-indigo-500"
            />

            {slotsLoading ? (
              <div className="text-center py-8 text-gray-400">Buscando horarios...</div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No hay horarios disponibles para esta fecha
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot, i) => {
                  const isSelected =
                    selectedSlot?.startTime === slot.startTime;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300'
                      }`}
                    >
                      {dayjs.utc(slot.startTime).format('h:mm A')}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedSlot && (
              <button
                onClick={() => setStep('confirm')}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors mt-4"
              >
                Continuar
              </button>
            )}
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && selectedSlot && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Resumen de tu cita
              </p>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha</span>
                  <span className="font-medium text-gray-900">
                    {dayjs.utc(selectedSlot.startTime).format('ddd, D [de] MMM YYYY')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Hora</span>
                  <span className="font-medium text-gray-900">
                    {dayjs.utc(selectedSlot.startTime).format('h:mm A')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duración</span>
                  <span className="font-medium text-gray-900">{totalDuration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Profesional</span>
                  <span className="font-medium text-gray-900">
                    {employees.find((e) => e.id === selectedEmployeeId)?.firstName}{' '}
                    {employees.find((e) => e.id === selectedEmployeeId)?.lastName}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-gray-500 mb-1">Servicios</p>
                  {selectedServices.map((s) => (
                    <div key={s.id} className="flex justify-between py-0.5">
                      <span className="text-gray-700">{s.name}</span>
                      <span className="font-medium">{formatCurrency(Number(s.price))}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(totalPrice)}
                  </span>
                </div>
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales (opcional)"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none h-20 focus:ring-2 focus:ring-indigo-500"
            />

            <button
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {bookMutation.isPending ? 'Reservando...' : 'Confirmar reserva'}
            </button>

            {bookMutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">
                {(bookMutation.error as any)?.message || 'Error al reservar'}
              </p>
            )}
          </div>
        )}
      </div>

      <PortalNav />
    </div>
  );
}
