'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '@/lib/api';
import { DetailSheet } from '@/components/ui/detail-sheet';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { AvailabilityPicker } from '@/components/calendar/availability-picker';
import { useCurrency } from '@/lib/hooks/use-currency';
import { AppointmentSuccessSheet } from './appointment-success-sheet';

const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type WizardStep = 'client' | 'service' | 'employee' | 'datetime' | 'confirm';

interface AppointmentWizardProps {
  onClose: () => void;
  onSave: () => void;
  initialDate?: string;  // YYYY-MM-DD
  initialTime?: string;  // HH:mm
  initialEmployeeId?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

interface Service {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  category?: string | null;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  color?: string;
  locationId?: string;
  employeeServices?: { serviceId: string }[];
}

export function AppointmentWizard({
  onClose,
  onSave,
  initialDate,
  initialTime,
  initialEmployeeId,
}: AppointmentWizardProps) {
  const queryClient = useQueryClient();
  const { format: formatCurrency } = useCurrency();

  // ── Estado del wizard ──
  const [step, setStep] = useState<WizardStep>('client');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
  const [anyEmployee, setAnyEmployee] = useState(false);
  // Multi-empleado: cuando ningún empleado puede hacer TODOS los servicios,
  // pero hay empleados que cubren AL MENOS UNO. El usuario asigna empleado
  // por servicio. Esto replica el flujo del marketplace cliente.
  const [serviceEmployeeMap, setServiceEmployeeMap] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<Dayjs>(
    initialDate ? dayjs(initialDate) : dayjs(),
  );
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [selectedEndTime, setSelectedEndTime] = useState('');
  // Slot composite: assignments por servicio elegidas por el backend.
  const [selectedAssignments, setSelectedAssignments] = useState<Array<{ serviceId: string; employeeId: string; startTime?: string; endTime?: string }>>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Tras crear la cita exitosamente mostramos la pantalla de éxito con
  // confeti. NO cerramos el wizard hasta que el usuario acepte.
  const [createdAppointment, setCreatedAppointment] = useState<any | null>(null);

  // ── New client form ──
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  // ── Queries ──
  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => api.get<{ data: Client[] }>('/api/clients?perPage=100'),
  });
  const clients = clientsData?.data || [];

  // Para saber si el tenant tiene el confeti activado en el modal de éxito,
  // y con qué figura/colores. Si no hay data o el campo no llega, default a
  // true (comportamiento previo).
  const { data: tenantCurrentData } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: () => api.get<{ data: any }>('/api/tenants/current'),
  });
  const tenantConfettiEnabled =
    (tenantCurrentData as any)?.data?.confettiEnabled !== false;
  const tenantConfettiShape: string | null =
    (tenantCurrentData as any)?.data?.confettiStyle ?? null;
  const tenantConfettiColors: string[] | null =
    (tenantCurrentData as any)?.data?.confettiColors ?? null;

  const { data: servicesData } = useQuery({
    queryKey: ['services-all'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services?perPage=100'),
  });
  // El backend ya filtra por isActive=true en findAll, así que no hace falta
  // filtrar otra vez en frontend.
  const services = servicesData?.data || [];

  const dateStr = selectedDate.format('YYYY-MM-DD');
  // Cargamos TODOS los empleados activos del negocio, sin filtrar por
  // workingDate. Si filtráramos por la fecha activa, el step "Profesional"
  // se quedaría vacío cuando el usuario navega a un día sin asignaciones
  // (el bug del "atrás → ningún profesional"). El filtrado por horario
  // específico ya lo hace el AvailabilityPicker / CompositeSlotPicker
  // internamente al consultar disponibilidad.
  const { data: employeesData } = useQuery({
    queryKey: ['employees-all-wizard'],
    queryFn: () => api.get<{ data: Employee[] }>('/api/employees?perPage=100'),
  });
  const employees: Employee[] = employeesData?.data || [];

  // ── Derivados ──
  // Filtrado de empleados — mismo patrón que el marketplace cliente.
  //  - employeesWithAll: cubren TODOS los servicios → flujo single-empleado
  //  - employeesWithAny: cubren AL MENOS UNO → fallback para multi-empleado
  //  - isMultiEmployee: ningún empleado solo cubre todo y hay candidatos
  //    parciales → asigna empleado por servicio.
  const employeesWithAll = useMemo(() => {
    if (selectedServiceIds.length === 0) return employees;
    return employees.filter((emp) =>
      selectedServiceIds.every((sid) =>
        emp.employeeServices?.some((es) => es.serviceId === sid),
      ),
    );
  }, [employees, selectedServiceIds]);

  const employeesWithAny = useMemo(() => {
    if (selectedServiceIds.length === 0) return employees;
    return employees.filter((emp) =>
      selectedServiceIds.some((sid) =>
        emp.employeeServices?.some((es) => es.serviceId === sid),
      ),
    );
  }, [employees, selectedServiceIds]);

  // En el admin SIEMPRE asignamos por servicio cuando hay multi-servicio,
  // aunque exista alguien que pueda hacer todo. El admin necesita
  // flexibilidad para distribuir trabajo (María para Manicure, Sofía para
  // Nail art) aunque María sola pudiera con todo. El cliente del marketplace
  // sólo activa multi cuando NADIE cubre todo — esa diferencia es intencional.
  const isMultiEmployee = selectedServiceIds.length > 1 && employeesWithAny.length > 0;

  const eligibleEmployees = employeesWithAll.length > 0 ? employeesWithAll : employeesWithAny;

  // Limpieza al cambiar la selección de servicios:
  //  - Saca del map entradas cuyo serviceId ya no está seleccionado.
  //  - Resetea el slot y assignments porque la duración total cambia.
  useEffect(() => {
    setServiceEmployeeMap((prev) => {
      const next: Record<string, string> = {};
      for (const sid of selectedServiceIds) {
        if (sid in prev) next[sid] = prev[sid];
      }
      return next;
    });
    setSelectedStartTime('');
    setSelectedEndTime('');
    setSelectedAssignments([]);
  }, [selectedServiceIds]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  const totalDuration = selectedServices.reduce((s, x) => s + (x.durationMinutes || 0), 0);
  const totalPrice = selectedServices.reduce((s, x) => s + Number(x.price), 0);

  // ── Mutations ──
  const createClientMutation = useMutation({
    mutationFn: (data: any) => api.post<{ data: Client }>('/api/clients', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['clients-all'] });
      setSelectedClientId(res.data.id);
      setShowNewClient(false);
      setNewClient({ firstName: '', lastName: '', email: '', phone: '' });
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'No se pudo crear el cliente');
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: () => {
      // Determinar el empleado principal y las asignaciones por servicio
      // dependiendo del modo (single vs multi).
      let mainEmployeeId = selectedEmployeeId;
      let serviceAssignments: Array<{ serviceId: string; employeeId: string }> | undefined;

      if (isMultiEmployee) {
        // Multi-empleado: preferimos las assignments resueltas por el slot
        // composite (porque el backend pudo desambiguar "Cualquiera" a un
        // empleado real). Si no las tenemos, caemos al map del usuario.
        const finalMap: Record<string, string> = {};
        for (const sid of selectedServiceIds) {
          const fromSlot = selectedAssignments.find((a) => a.serviceId === sid)?.employeeId;
          finalMap[sid] = fromSlot || serviceEmployeeMap[sid] || '';
        }
        const assignments = selectedServiceIds
          .map((sid) => ({ serviceId: sid, employeeId: finalMap[sid] }))
          .filter((a) => !!a.employeeId);
        if (assignments.length !== selectedServiceIds.length) {
          throw new Error('Cada servicio debe tener un profesional asignado');
        }
        mainEmployeeId = assignments[0].employeeId;
        serviceAssignments = assignments;
      }

      // Buscar locationId del empleado principal (o cualquier elegible si "any")
      const empForLocation =
        employees.find((e) => e.id === mainEmployeeId) ||
        eligibleEmployees[0];
      if (!empForLocation?.locationId) {
        throw new Error('El profesional no tiene ubicación asignada');
      }

      return api.post('/api/appointments', {
        clientId: selectedClientId,
        employeeId: mainEmployeeId,
        locationId: empForLocation.locationId,
        serviceIds: selectedServiceIds,
        startTime: selectedStartTime,
        source: 'MANUAL',
        ...(serviceAssignments && { serviceAssignments }),
        notes: notes || undefined,
      });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      // Guardamos la cita para mostrar la pantalla de éxito con confeti.
      setCreatedAppointment(res?.data || res);
    },
    onError: (err: any) => {
      const msg = err?.message || err?.response?.data?.message || '';
      // Si el slot ya fue tomado (race entre la consulta de disponibilidad
      // y el POST, o cache stale), invalida la disponibilidad y devuelve
      // al usuario al paso de horario con datos frescos en vez de dejar
      // un mensaje contradictorio en el paso de confirmación.
      if (/ya está reservado|ya esta reservado/i.test(msg)) {
        queryClient.invalidateQueries({ queryKey: ['all-slots'] });
        queryClient.invalidateQueries({ queryKey: ['availability'] });
        queryClient.invalidateQueries({ queryKey: ['composite-availability'] });
        setSelectedStartTime('');
        setSelectedEndTime('');
        setSelectedAssignments([]);
        setStep('datetime');
        setError(
          'Ese horario acaba de ocuparse. Elige otro slot disponible.',
        );
        return;
      }
      setError(msg || 'No se pudo crear la cita');
    },
  });

  // ── Navegación de steps ──
  // Lista dinámica de steps que se aplican (sin 'employee' si vino preseleccionado)
  const stepsActive: WizardStep[] = [
    'client',
    'service',
    ...((initialEmployeeId ? [] : ['employee']) as WizardStep[]),
    'datetime',
    'confirm',
  ];
  const stepIndex = stepsActive.indexOf(step);

  function canAdvance(): boolean {
    if (step === 'client') return !!selectedClientId;
    if (step === 'service') return selectedServiceIds.length > 0;
    if (step === 'employee') {
      if (isMultiEmployee) {
        // Cada servicio debe tener un empleado CONCRETO asignado.
        // (Quitamos "Cualquiera" porque el endpoint composite no acepta
        // employeeId vacío.) Los servicios con un solo profesional posible
        // se autoasignan en la UI.
        return selectedServiceIds.every((sid) => !!serviceEmployeeMap[sid]);
      }
      return anyEmployee || !!selectedEmployeeId;
    }
    if (step === 'datetime') return !!selectedStartTime;
    return true;
  }

  function next() {
    setError(null);
    if (!canAdvance()) return;
    const i = stepsActive.indexOf(step);
    if (i < stepsActive.length - 1) setStep(stepsActive[i + 1]);
  }

  function back() {
    setError(null);
    const i = stepsActive.indexOf(step);
    if (i > 0) setStep(stepsActive[i - 1]);
    else onClose();
  }

  // ── Render por step ──
  const stepLabels: Record<WizardStep, string> = {
    client: 'Cliente',
    service: 'Servicio',
    employee: 'Profesional',
    datetime: 'Horario',
    confirm: 'Confirmar',
  };

  // Bottom footer con Atrás / Siguiente
  const footer = (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={back}
        className="px-4 py-3 rounded-xl text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
      >
        {stepIndex === 0 ? 'Cancelar' : 'Atrás'}
      </button>
      {step !== 'confirm' ? (
        <button
          type="button"
          onClick={next}
          disabled={!canAdvance()}
          className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: TEAL }}
        >
          Siguiente
        </button>
      ) : (
        <button
          type="button"
          onClick={() => createAppointmentMutation.mutate()}
          disabled={createAppointmentMutation.isPending}
          className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: TEAL }}
        >
          {createAppointmentMutation.isPending ? 'Creando...' : 'Confirmar cita'}
        </button>
      )}
    </div>
  );

  // Pantalla de éxito tras crear la cita — confeti corto + detalle.
  // Cuando el usuario "Acepta" cerramos el wizard llamando onSave().
  if (createdAppointment) {
    // Empleado principal: en multi se calcula desde las assignments.
    let mainEmpName: string | undefined;
    if (isMultiEmployee && selectedAssignments.length > 0) {
      const empIds = Array.from(new Set(selectedAssignments.map((a) => a.employeeId)));
      const names = empIds
        .map((id) => employees.find((e) => e.id === id))
        .filter(Boolean)
        .map((e) => `${e!.firstName} ${e!.lastName}`);
      mainEmpName = names.join(', ');
    } else if (selectedEmployee) {
      mainEmpName = `${selectedEmployee.firstName} ${selectedEmployee.lastName}`;
    }

    return (
      <AppointmentSuccessSheet
        services={selectedServices.map((s) => ({ id: s.id, name: s.name, price: Number(s.price) }))}
        startTime={selectedStartTime}
        employeeName={mainEmpName}
        total={totalPrice}
        primaryLabel="Aceptar"
        confettiEnabled={tenantConfettiEnabled}
        confettiShape={tenantConfettiShape}
        confettiColors={tenantConfettiColors}
        onPrimary={() => {
          setCreatedAppointment(null);
          onSave();
        }}
      />
    );
  }

  return (
    <DetailSheet title="Nueva cita" onClose={onClose} size="lg" footer={footer}>
      {/* Progress bar circular — mismo patrón que el flujo del cliente */}
      <div className="flex items-center gap-2 mb-5">
        {stepsActive.map((key, idx) => {
          const isDone = stepIndex > idx;
          const isCurrent = stepIndex === idx;
          const circleStyle: React.CSSProperties = isDone
            ? { backgroundColor: TEAL, color: '#fff' }
            : isCurrent
              ? { backgroundColor: TEAL_LIGHT, color: TEAL, border: `2px solid ${TEAL}` }
              : { backgroundColor: 'var(--bg-muted)', color: 'var(--text-tertiary)' };
          return (
            <div key={key} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={circleStyle}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <span className="text-xs hidden sm:block" style={{ color: isCurrent ? TEAL : 'var(--text-tertiary)', fontWeight: isCurrent ? 500 : 400 }}>
                  {stepLabels[key]}
                </span>
              </div>
              {idx < stepsActive.length - 1 && (
                <div className="flex-1 h-0.5" style={{ backgroundColor: isDone ? TEAL : 'var(--border)' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 'client' && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Selecciona el cliente</h2>
          <SearchableSelect
            value={selectedClientId}
            onChange={setSelectedClientId}
            options={clients
              .slice()
              .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es'))
              .map((c) => ({
                id: c.id,
                label: `${c.firstName} ${c.lastName}`,
                sublabel: c.phone || c.email || undefined,
                initials: `${c.firstName?.[0] || ''}${c.lastName?.[0] || ''}`.toUpperCase(),
                avatarUrl: c.avatarUrl || null,
                color: TEAL,
              }))}
            placeholder="Buscar cliente..."
            allLabel="Seleccionar cliente"
          />
          <button
            type="button"
            onClick={() => setShowNewClient((v) => !v)}
            className="mt-3 text-sm font-medium hover:underline"
            style={{ color: TEAL }}
          >
            {showNewClient ? '— Cancelar' : '+ Registrar nuevo cliente'}
          </button>

          {showNewClient && (
            <div className="mt-3 p-4 rounded-xl border-2 space-y-3" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={newClient.firstName}
                    onChange={(e) => setNewClient((c) => ({ ...c, firstName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido *</label>
                  <input
                    type="text"
                    value={newClient.lastName}
                    onChange={(e) => setNewClient((c) => ({ ...c, lastName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#008080]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={newClient.phone}
                  onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#008080]"
                  placeholder="10 dígitos"
                  maxLength={10}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!newClient.firstName.trim() || !newClient.lastName.trim()) {
                    setError('Nombre y apellido son requeridos');
                    return;
                  }
                  createClientMutation.mutate(newClient);
                }}
                disabled={createClientMutation.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {createClientMutation.isPending ? 'Registrando...' : 'Registrar cliente'}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'service' && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Selecciona el servicio</h2>
          <p className="text-xs text-gray-500 mb-3">Puedes elegir uno o varios.</p>
          <div className="space-y-2">
            {services.map((s) => {
              const isSelected = selectedServiceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setSelectedServiceIds((prev) =>
                      isSelected ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                    )
                  }
                  className="w-full text-left p-4 rounded-xl border-2 transition-all"
                  style={
                    isSelected
                      ? { borderColor: TEAL, backgroundColor: TEAL_LIGHT }
                      : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{s.name}</p>
                      {s.description && <p className="text-sm text-gray-500 line-clamp-1">{s.description}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-gray-900">{formatCurrency(Number(s.price))}</p>
                      <p className="text-xs text-gray-500">{s.durationMinutes} min</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 'employee' && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            {isMultiEmployee ? 'Asigna un profesional por servicio' : 'Selecciona el profesional'}
          </h2>

          {isMultiEmployee ? (
            /* ─── Multi-empleado: card por servicio con pills ─── */
            <div className="space-y-3">
              {selectedServiceIds.map((sid) => {
                const svc = services.find((s) => s.id === sid);
                if (!svc) return null;
                const canDo = employees.filter((emp) =>
                  emp.employeeServices?.some((es) => es.serviceId === sid),
                );
                const assignedId = serviceEmployeeMap[sid] ?? '';
                return (
                  <div key={sid} className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">{svc.name}</p>
                    {canDo.length === 1 ? (
                      // Solo un profesional puede hacerlo: lo mostramos auto-asignado.
                      (() => {
                        const emp = canDo[0];
                        if (!serviceEmployeeMap[sid]) {
                          setTimeout(() => setServiceEmployeeMap((m) => ({ ...m, [sid]: emp.id })), 0);
                        }
                        return (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
                              style={{ backgroundColor: emp.color || TEAL }}
                            >
                              {emp.avatarUrl ? (
                                <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{emp.firstName?.[0]}{emp.lastName?.[0]}</span>
                              )}
                            </div>
                            <span className="text-sm text-gray-700">
                              {emp.firstName} {emp.lastName}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 mb-2 leading-snug">
                          Hay varios profesionales que realizan{' '}
                          <span className="font-semibold text-gray-700">{svc.name}</span>.
                          Elige uno.
                        </p>
                        <div
                          className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          {canDo.map((emp) => {
                            const isSel = assignedId === emp.id;
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() =>
                                  setServiceEmployeeMap((m) => ({ ...m, [sid]: emp.id }))
                                }
                                className={`flex-shrink-0 inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                                  isSel
                                    ? 'bg-[#008080] text-white border-[#008080]'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                <span
                                  className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden text-[10px] font-bold flex-shrink-0"
                                  style={{
                                    backgroundColor: `${emp.color || TEAL}25`,
                                    color: emp.color || TEAL,
                                  }}
                                >
                                  {emp.avatarUrl ? (
                                    <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    `${emp.firstName?.[0] ?? ''}${emp.lastName?.[0] ?? ''}`
                                  )}
                                </span>
                                {emp.firstName}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── Single-empleado: cualquiera + lista de elegibles ─── */
            <>
              <button
                type="button"
                onClick={() => {
                  setAnyEmployee(true);
                  setSelectedEmployeeId('');
                }}
                className="w-full text-left p-4 rounded-xl border-2 transition-all mb-2"
                style={
                  anyEmployee
                    ? { borderColor: TEAL, backgroundColor: TEAL_LIGHT }
                    : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Cualquier profesional disponible</p>
                    <p className="text-xs text-gray-500">Se asigna al elegir horario</p>
                  </div>
                </div>
              </button>

              {eligibleEmployees.length === 0 ? (
                <p className="text-xs text-amber-600 text-center py-6">
                  Ningún profesional tiene asignado(s) el/los servicio(s) seleccionado(s).
                </p>
              ) : (
                <div className="space-y-2">
                  {eligibleEmployees.map((emp) => {
                    const isSelected = !anyEmployee && selectedEmployeeId === emp.id;
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          setAnyEmployee(false);
                          setSelectedEmployeeId(emp.id);
                        }}
                        className="w-full text-left p-4 rounded-xl border-2 transition-all"
                        style={
                          isSelected
                            ? { borderColor: TEAL, backgroundColor: TEAL_LIGHT }
                            : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                            style={{ backgroundColor: emp.color || TEAL }}
                          >
                            {emp.avatarUrl ? (
                              <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{emp.firstName?.[0]}{emp.lastName?.[0]}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 'datetime' && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Elige fecha y hora</h2>
          {selectedServiceIds.length > 0 && (
            isMultiEmployee ? (
              <CompositeSlotPicker
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                serviceAssignments={selectedServiceIds.map((sid) => ({
                  serviceId: sid,
                  employeeId: serviceEmployeeMap[sid] || undefined,
                }))}
                services={services}
                employees={employees}
                onSelect={(startISO, endISO, assignments) => {
                  setSelectedStartTime(startISO);
                  setSelectedEndTime(endISO);
                  setSelectedAssignments(assignments);
                }}
                selectedStartTime={selectedStartTime}
              />
            ) : (
              <AvailabilityPicker
                locationId={selectedEmployee?.locationId}
                serviceIds={selectedServiceIds}
                employeeId={anyEmployee ? undefined : selectedEmployeeId || undefined}
                initialDateTime={initialDate && initialTime ? `${initialDate}T${initialTime}` : undefined}
                onSelect={(empId, start, end) => {
                  if (empId) setSelectedEmployeeId(empId);
                  setSelectedStartTime(start);
                  setSelectedEndTime(end);
                }}
                onDateChange={(dStr) => setSelectedDate(dayjs(dStr))}
              />
            )
          )}
        </div>
      )}

      {step === 'confirm' && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Confirma los datos</h2>
          <div className="space-y-3">
            {/* Cliente */}
            {selectedClient && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: TEAL }}>
                  {selectedClient.avatarUrl ? (
                    <img src={`${API_URL}${selectedClient.avatarUrl}`} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span>{selectedClient.firstName?.[0]}{selectedClient.lastName?.[0]}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Cliente</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </p>
                  {(selectedClient.phone || selectedClient.email) && (
                    <p className="text-xs text-gray-500 truncate">{selectedClient.phone || selectedClient.email}</p>
                  )}
                </div>
              </div>
            )}

            {/* Profesional(es) — modo multi muestra una fila por servicio */}
            {isMultiEmployee ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                  Equipo
                </p>
                <div className="space-y-2">
                  {selectedServiceIds.map((sid) => {
                    const svc = services.find((s) => s.id === sid);
                    const fromSlot = selectedAssignments.find((a) => a.serviceId === sid)?.employeeId;
                    const empId = fromSlot || serviceEmployeeMap[sid];
                    const emp = employees.find((e) => e.id === empId);
                    if (!svc) return null;
                    return (
                      <div key={sid} className="flex items-center gap-2">
                        {emp ? (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden"
                            style={{ backgroundColor: emp.color || TEAL }}
                          >
                            {emp.avatarUrl ? (
                              <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{emp.firstName?.[0]}{emp.lastName?.[0]}</span>
                            )}
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] text-gray-400">?</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-sm">
                          <span className="font-medium text-gray-900">{svc.name}</span>
                          <span className="text-gray-400 mx-1">·</span>
                          <span className="text-gray-600">
                            {emp ? `${emp.firstName} ${emp.lastName}` : 'Sin asignar'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              selectedEmployee && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: selectedEmployee.color || TEAL }}>
                    {selectedEmployee.avatarUrl ? (
                      <img src={`${API_URL}${selectedEmployee.avatarUrl}`} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span>{selectedEmployee.firstName?.[0]}{selectedEmployee.lastName?.[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Profesional</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </p>
                  </div>
                </div>
              )
            )}

            {/* Fecha y hora */}
            {selectedStartTime && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Fecha y hora</p>
                <p className="text-sm font-semibold text-gray-900">
                  {dayjs(selectedStartTime).format('dddd D [de] MMMM, YYYY')}
                </p>
                <p className="text-sm text-gray-600">
                  {dayjs(selectedStartTime).format('HH:mm')} – {dayjs(selectedEndTime).format('HH:mm')} ({totalDuration} min)
                </p>
              </div>
            )}

            {/* Servicios */}
            {selectedServices.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Servicios</p>
                <div className="space-y-1.5">
                  {selectedServices.map((s) => (
                    <div key={s.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{s.name}</span>
                      <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(Number(s.price))}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2 flex justify-between">
                    <span className="text-sm font-bold text-gray-900">Total</span>
                    <span className="text-sm font-bold" style={{ color: TEAL }}>{formatCurrency(totalPrice)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notas */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Notas (opcional)</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentarios para el equipo..."
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-1 focus:ring-[#008080]"
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}
    </DetailSheet>
  );
}

// ─── CompositeSlotPicker ─────────────────────────────────────────────────
// Mini picker para citas multi-empleado. Consulta /api/availability/composite
// con las asignaciones del usuario y muestra una grilla de slots. Al elegir
// uno, devuelve startTime/endTime + las assignments por servicio.
interface CompositeSlotPickerProps {
  selectedDate: Dayjs;
  onDateChange: (d: Dayjs) => void;
  serviceAssignments: Array<{ serviceId: string; employeeId?: string }>;
  services: Service[];
  employees: Employee[];
  onSelect: (
    startISO: string,
    endISO: string,
    assignments: Array<{ serviceId: string; employeeId: string; startTime?: string; endTime?: string }>,
  ) => void;
  selectedStartTime: string;
}

function CompositeSlotPicker({
  selectedDate,
  onDateChange,
  serviceAssignments,
  services,
  employees,
  onSelect,
  selectedStartTime,
}: CompositeSlotPickerProps) {
  const dateStr = selectedDate.format('YYYY-MM-DD');
  const allAssigned = serviceAssignments.every((a) => !!a.employeeId);
  const [showMonthCalendar, setShowMonthCalendar] = useState(false);
  // Mes mostrado en el calendario popover — independiente de selectedDate
  // para que el usuario pueda navegar meses sin perder la fecha activa.
  const [calendarMonth, setCalendarMonth] = useState<Dayjs>(selectedDate);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['composite-availability', dateStr, JSON.stringify(serviceAssignments)],
    queryFn: () =>
      api.post<{
        data: Array<{
          startTime: string;
          endTime: string;
          assignments?: Array<{ serviceId: string; employeeId: string; startTime: string; endTime: string }>;
        }>;
      }>('/api/availability/composite', {
        startDate: dateStr,
        endDate: dateStr,
        serviceAssignments,
      }),
    enabled: allAssigned,
    // Disponibilidad cambia constantemente (otras citas se crean en
    // paralelo). Forzamos refetch al montar el componente para que el
    // cajero no vea slots stale.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const slots = data?.data || [];

  // Filtrar slots cuyo inicio ya pasó (solo aplica hoy).
  const isToday = selectedDate.isSame(dayjs(), 'day');
  const futureSlots = slots.filter((s) => {
    if (!isToday) return true;
    return dayjs(s.startTime).isAfter(dayjs());
  });

  // Tarjetas de día: si la fecha seleccionada cae dentro de los próximos 14
  // días desde hoy, mantenemos la vista anclada en hoy (más natural). Si el
  // usuario eligió una fecha lejana desde el calendario (p.ej. 30 ago),
  // arrancamos el slider en esa fecha para que sea visible y sirva como
  // referencia visual.
  const today = dayjs().startOf('day');
  const baseDay = selectedDate.isBefore(today.add(14, 'day'), 'day') ? today : selectedDate;
  const days = Array.from({ length: 14 }, (_, i) => baseDay.add(i, 'day'));

  // ── Calendario mensual ──
  const startOfMonth = calendarMonth.startOf('month');
  const daysInMonth = calendarMonth.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => startOfMonth.add(i, 'day'));

  return (
    <div className="space-y-3">
      {/* Fila: slider horizontal + botón calendario completo */}
      <div className="flex items-stretch gap-2">
        <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-2 no-scrollbar flex-1">
          {days.map((d) => {
            const isSel = d.isSame(selectedDate, 'day');
            return (
              <button
                key={d.format('YYYY-MM-DD')}
                type="button"
                onClick={() => onDateChange(d)}
                className={`flex-shrink-0 w-14 py-2 rounded-xl text-center border-2 transition-all ${
                  isSel
                    ? 'border-[#008080] bg-[#e0f2f1] text-[#008080]'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase">
                  {d.format('ddd')}
                </div>
                <div className="text-base font-bold tabular-nums">{d.format('D')}</div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setCalendarMonth(selectedDate);
            setShowMonthCalendar((v) => !v);
          }}
          className={`flex-shrink-0 w-12 rounded-xl border-2 transition-all flex items-center justify-center ${
            showMonthCalendar
              ? 'border-[#008080] bg-[#e0f2f1] text-[#008080]'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
          aria-label="Abrir calendario completo"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </button>
      </div>

      {/* Calendario mensual desplegable */}
      {showMonthCalendar && (
        <div className="rounded-xl border-2 border-[#008080] bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setCalendarMonth((m) => m.subtract(1, 'month'))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900 capitalize">
              {calendarMonth.format('MMMM YYYY')}
            </span>
            <button
              type="button"
              onClick={() => setCalendarMonth((m) => m.add(1, 'month'))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((d) => (
              <div key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
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
                  type="button"
                  disabled={isPast}
                  onClick={() => {
                    onDateChange(day);
                    setShowMonthCalendar(false);
                  }}
                  className={`text-sm py-1.5 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-[#008080] text-white font-semibold'
                      : isToday
                        ? 'bg-[#e0f2f1] text-[#008080] font-semibold'
                        : isPast
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {day.date()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!allAssigned ? (
        <p className="text-xs text-amber-600 text-center py-4">
          Asigna profesional a cada servicio para ver horarios disponibles.
        </p>
      ) : isLoading ? (
        <div className="py-8 text-center">
          <div className="animate-spin h-6 w-6 mx-auto border-4 border-gray-200 border-t-[#008080] rounded-full" />
        </div>
      ) : isError ? (
        <p className="text-xs text-red-600 text-center py-4">
          No se pudo cargar la disponibilidad. Intenta otra fecha.
        </p>
      ) : futureSlots.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No hay horarios disponibles para esa combinación.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
          {futureSlots.map((slot) => {
            const isSel = selectedStartTime === slot.startTime;
            return (
              <button
                key={slot.startTime}
                type="button"
                onClick={() =>
                  onSelect(slot.startTime, slot.endTime, slot.assignments || [])
                }
                className={`py-1.5 text-sm rounded-lg border-2 transition-colors ${
                  isSel
                    ? 'bg-[#008080] text-white border-[#008080]'
                    : 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                {dayjs(slot.startTime).format('HH:mm')}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
