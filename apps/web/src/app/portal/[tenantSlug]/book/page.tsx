// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/portal/[tenantSlug]/book/page.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Flujo de reserva de cita en el portal del cliente. Guía al usuario paso a paso
// (wizard / multi-step form) para crear una nueva cita.
// URL: /portal/[tenantSlug]/book
//
// FLUJO DE 4 PASOS (Step)
// -----------------------
// Paso 1 → "service": seleccionar uno o más servicios.
// Paso 2 → "employee": elegir el profesional disponible para esos servicios.
// Paso 3 → "datetime": elegir fecha y horario disponible.
// Paso 4 → "confirm": revisar el resumen y confirmar la reserva.
//
// DATOS QUE CARGA
// ---------------
// - GET /services: todos los servicios activos del negocio.
// - GET /employees: todos los empleados activos.
// - POST /availability: slots disponibles para los servicios + empleado + fecha.
//   Esta query se hace BAJO DEMANDA (enabled solo en el paso 3).
//
// PARTICULARIDAD DEL PASO 3: disponibilidad
// ------------------------------------------
// La query de disponibilidad se re-ejecuta automáticamente cada vez que cambia
// selectedDate (useQuery detecta el cambio en queryKey y re-fetcha).
// ─────────────────────────────────────────────────────────────────────────────

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

// ── INTERFACES DE TIPOS ──────────────────────────────────────────────────────

// Servicio del negocio (con todos los datos necesarios para mostrarlo en el paso 1).
interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string | number;  // Puede venir como string del backend (MySQL DECIMAL)
  color: string;
  category: string | null;
}

// Empleado del negocio (incluye qué servicios puede hacer → para filtrar en paso 2).
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  color: string;
  // employeeServices: array de relaciones empleado↔servicio. Solo tiene serviceId
  // porque es lo que necesitamos para verificar qué servicios hace cada empleado.
  employeeServices: { serviceId: string }[];
}

// Slot de disponibilidad: un horario disponible para una cita.
interface Slot {
  startTime: string;    // "YYYY-MM-DDTHH:mm:00" (sin zona horaria, UTC del negocio)
  endTime: string;
  employeeId: string;
  employeeName: string;
}

// Type alias para los pasos del wizard. Solo puede ser uno de estos 4 valores.
type Step = 'service' | 'employee' | 'datetime' | 'confirm';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalBookPage() {
  const { isAuthenticated, isLoading: authLoading, tenantSlug } = useClientAuth();
  const router = useRouter();

  // queryClient: para invalidar la lista de citas después de reservar.
  const queryClient = useQueryClient();

  // ── ESTADO DEL WIZARD ─────────────────────────────────────────────────────
  // step: paso actual del flujo. Empieza en 'service' (paso 1).
  const [step, setStep] = useState<Step>('service');

  // selectedServiceIds: IDs de los servicios seleccionados. Array para permitir
  // selección múltiple (el cliente puede reservar varios servicios a la vez).
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // selectedEmployeeId: ID del profesional elegido. null si no hay selección.
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // selectedSlot: el horario elegido. null si no hay selección.
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // selectedDate: fecha en formato "YYYY-MM-DD". Por defecto, hoy.
  // dayjs().format('YYYY-MM-DD'): la fecha de hoy en ese formato.
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

  // notes: campo de notas adicionales (opcional, paso 4).
  const [notes, setNotes] = useState('');

  // ── PROTECCIÓN DE RUTA ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/portal/${tenantSlug}/login`);
    }
  }, [authLoading, isAuthenticated, router, tenantSlug]);

  // ── QUERY: SERVICIOS ──────────────────────────────────────────────────────
  // Se carga una sola vez cuando el usuario llega a la página.
  const { data: servicesData } = useQuery({
    queryKey: ['portal-services'],
    queryFn: () => portalApi.get<Service[]>('/services'),
    enabled: isAuthenticated,
  });

  // ── QUERY: EMPLEADOS ──────────────────────────────────────────────────────
  // Se carga una sola vez también.
  const { data: employeesData } = useQuery({
    queryKey: ['portal-employees'],
    queryFn: () => portalApi.get<Employee[]>('/employees'),
    enabled: isAuthenticated,
  });

  // ── QUERY: DISPONIBILIDAD (bajo demanda) ──────────────────────────────────
  // Esta query solo se ejecuta cuando estamos en el paso 3 ('datetime') Y
  // ya hay servicios y empleado seleccionados.
  // queryKey incluye los parámetros de búsqueda: cuando selectedDate cambia,
  // react-query detecta que la key cambió y refetch automáticamente.
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['portal-availability', selectedServiceIds, selectedEmployeeId, selectedDate],
    queryFn: () =>
      // Aquí usamos POST (no GET) porque el body de disponibilidad puede ser largo.
      portalApi.post<{ data: any[] }>('/availability', {
        serviceIds: selectedServiceIds,
        startDate: selectedDate,
        endDate: selectedDate,    // Mismo día: solo buscamos disponibilidad del día elegido
        employeeId: selectedEmployeeId,
      }),
    // enabled: condición compuesta con &&.
    // Todos deben ser verdaderos para que la query se ejecute:
    enabled:
      isAuthenticated &&
      step === 'datetime' &&            // Solo en el paso 3
      selectedServiceIds.length > 0 &&  // Debe haber al menos 1 servicio
      !!selectedEmployeeId,             // !! convierte a boolean: null→false, string→true
  });

  // ── MUTACIÓN: RESERVAR CITA ────────────────────────────────────────────────
  const bookMutation = useMutation({
    mutationFn: () =>
      portalApi.post('/book', {
        employeeId: selectedEmployeeId,
        serviceIds: selectedServiceIds,
        // startTime tal cual ("YYYY-MM-DDTHH:mm:00" sin TZ) — ver nota en
        // marketplace/page.tsx. El backend trabaja con horas del negocio
        // en UTC raw, igual que los slots de availability.
        // selectedSlot?.startTime: optional chaining (por si selectedSlot fuera null)
        startTime: selectedSlot?.startTime,
        // notes || undefined: si notes es '' (vacío), enviamos undefined en lugar de ''
        // (evita guardar strings vacíos en la BD).
        notes: notes || undefined,
      }),
    onSuccess: () => {
      // Invalidamos la lista de citas para que aparezca la nueva reserva.
      queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
      // Redirigimos a la lista de citas para que el cliente vea su nueva reserva.
      router.push(`/portal/${tenantSlug}/appointments`);
    },
  });

  // ── DATOS DERIVADOS ────────────────────────────────────────────────────────
  // Convertimos los datos de las queries a arrays tipados para usar en el JSX.
  // (servicesData as any): cast necesario porque react-query tipea el retorno de forma genérica.
  const services: Service[] = (servicesData as any) || [];
  const employees: Employee[] = (employeesData as any) || [];

  // availableEmployees: empleados que pueden hacer TODOS los servicios seleccionados.
  // .filter(emp => ...): mantiene solo los empleados que cumplen la condición.
  // .every(sid => ...): true si TODOS los serviceIds seleccionados están entre los
  //   servicios del empleado. Si al menos uno no está → false → ese empleado se excluye.
  // .some(es => ...): true si ALGÚN employeeService del empleado coincide con el serviceId.
  const availableEmployees = employees.filter((emp) =>
    selectedServiceIds.every((sid) =>
      emp.employeeServices.some((es) => es.serviceId === sid),
    ),
  );

  // ── APLANAR LA RESPUESTA DE DISPONIBILIDAD ────────────────────────────────
  // La API puede devolver los slots en dos formatos posibles (dependiendo de la versión).
  // Los normalizamos a un array plano de Slot para simplificar el JSX.
  const slots: Slot[] = [];
  const rawSlots = (slotsData as any)?.data || [];
  if (Array.isArray(rawSlots)) {
    // Iteramos con for...of (más legible que .forEach para loops anidados).
    for (const day of rawSlots) {
      if (day.employees) {
        // FORMATO A: { date, employees: [{ id, name, slots: [{ startTime, endTime }] }] }
        for (const emp of day.employees) {
          for (const slot of emp.slots) {
            slots.push({
              // Construimos el datetime completo combinando date + startTime del slot.
              startTime: `${day.date}T${slot.startTime}:00`,
              endTime: `${day.date}T${slot.endTime}:00`,
              employeeId: emp.id,
              employeeName: emp.name,
            });
          }
        }
      } else if (day.startTime) {
        // FORMATO B: ya es un objeto Slot completo → lo añadimos directamente.
        slots.push(day);
      }
    }
  }

  // Servicios seleccionados como objetos completos (no solo IDs).
  // .filter(s => selectedServiceIds.includes(s.id)): filtra los servicios cuyo ID
  // está en la lista de IDs seleccionados.
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));

  // Precio total y duración total: sumas de los servicios seleccionados.
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  // ── RENDERS CONDICIONALES TEMPRANOS ──────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  return (
    <div className="pb-20 min-h-screen">

      {/* HEADER CON BOTÓN ATRÁS CONTEXTUAL */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        {/* El botón de "atrás" tiene comportamiento diferente según el paso:
            - Paso 1 (service): vuelve a la página anterior (router.back())
            - Paso 2, 3, 4: vuelve al paso anterior dentro del wizard */}
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

      {/* INDICADOR DE PASOS (barra de progreso visual) */}
      <div className="bg-white px-4 py-3 flex items-center gap-2 border-b border-gray-100">
        {/* Iteramos los 4 pasos. s = nombre del paso, i = índice (0-3). */}
        {(['service', 'employee', 'datetime', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {/* Círculo numerado:
                - Paso actual: azul sólido con número blanco.
                - Pasos YA completados (i < índice del paso actual): azul claro.
                - Pasos futuros: gris claro. */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s
                  ? 'bg-indigo-600 text-white'
                  : i < ['service', 'employee', 'datetime', 'confirm'].indexOf(step)
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1}  {/* i empieza en 0, pero mostramos 1, 2, 3, 4 */}
            </div>
            {/* Línea conectora entre pasos (no la mostramos después del último) */}
            {i < 3 && <div className="w-8 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* CONTENIDO DEL PASO ACTUAL */}
      <div className="px-4 py-4 max-w-lg mx-auto">

        {/* ── PASO 1: SELECCIÓN DE SERVICIOS ───────────────────────────── */}
        {/* Solo se renderiza cuando step === 'service'. Cuando cambia el step,
            este bloque desaparece y aparece el del siguiente paso. */}
        {step === 'service' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Selecciona los servicios
            </p>
            {/* Iteramos todos los servicios del negocio */}
            {services.map((service) => {
              // ¿Este servicio ya está seleccionado?
              // .includes(): busca si service.id está en el array selectedServiceIds.
              const selected = selectedServiceIds.includes(service.id);
              return (
                <button
                  key={service.id}
                  onClick={() =>
                    // updater function: recibe el estado ANTERIOR y devuelve el nuevo.
                    setSelectedServiceIds((prev) =>
                      selected
                        // Si ya estaba seleccionado → lo QUITAMOS del array.
                        // .filter(): devuelve nuevo array sin ese ID.
                        ? prev.filter((id) => id !== service.id)
                        // Si no estaba → lo AÑADIMOS al array.
                        // Spread: [...prev, service.id] = copia del array + nuevo elemento.
                        : [...prev, service.id],
                    )
                  }
                  // Estilo diferente según si está seleccionado o no.
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
            {/* El botón "Continuar" solo aparece si hay al menos 1 servicio seleccionado */}
            {selectedServiceIds.length > 0 && (
              <button
                onClick={() => setStep('employee')}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors mt-4"
              >
                {/* Muestra el número de servicios y el precio total */}
                Continuar ({selectedServiceIds.length} servicio
                {/* Pluralización: "1 servicio" vs "2 servicios" */}
                {selectedServiceIds.length !== 1 ? 's' : ''} -{' '}
                {formatCurrency(totalPrice)})
              </button>
            )}
          </div>
        )}

        {/* ── PASO 2: SELECCIÓN DE PROFESIONAL ─────────────────────────── */}
        {step === 'employee' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Elige tu profesional
            </p>
            {/* Solo mostramos empleados que hacen TODOS los servicios seleccionados */}
            {availableEmployees.map((emp) => (
              <button
                key={emp.id}
                // Al hacer clic, guardamos el ID del empleado seleccionado.
                onClick={() => setSelectedEmployeeId(emp.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedEmployeeId === emp.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar con foto o iniciales */}
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
            {/* disabled={!selectedEmployeeId}: deshabilitado si no hay empleado elegido */}
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

        {/* ── PASO 3: SELECCIÓN DE FECHA Y HORA ────────────────────────── */}
        {step === 'datetime' && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              Selecciona fecha y hora
            </p>
            {/* Input de fecha nativo del navegador.
                min={dayjs().format('YYYY-MM-DD')}: no permite seleccionar fechas pasadas.
                Al cambiar la fecha: actualizamos selectedDate Y limpiamos el slot
                seleccionado (no tiene sentido mantener un slot de otro día). */}
            <input
              type="date"
              value={selectedDate}
              min={dayjs().format('YYYY-MM-DD')}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlot(null);  // Reseteamos el slot al cambiar de fecha
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:ring-2 focus:ring-indigo-500"
            />

            {/* Condición para mostrar los slots disponibles */}
            {slotsLoading ? (
              // Cargando la disponibilidad
              <div className="text-center py-8 text-gray-400">Buscando horarios...</div>
            ) : slots.length === 0 ? (
              // No hay slots para esa fecha
              <div className="text-center py-8 text-gray-400">
                No hay horarios disponibles para esta fecha
              </div>
            ) : (
              // Cuadrícula de 3 columnas con los horarios disponibles
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot, i) => {
                  // Verificamos si este slot es el actualmente seleccionado.
                  // Comparamos los startTime para identificarlos (los IDs no siempre están).
                  const isSelected =
                    selectedSlot?.startTime === slot.startTime;
                  return (
                    // key={i}: usamos el índice porque los slots no siempre tienen ID.
                    // Nota: key con índice puede causar problemas en listas reordenables,
                    // pero aquí los slots no se reordenan, así que es aceptable.
                    <button
                      key={i}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300'
                      }`}
                    >
                      {/* Mostramos solo la hora del slot en formato 12h (ej: "10:30 AM") */}
                      {dayjs.utc(slot.startTime).format('h:mm A')}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Continuar al paso 4: solo si hay un slot seleccionado */}
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

        {/* ── PASO 4: CONFIRMACIÓN ─────────────────────────────────────── */}
        {/* Esta condición verifica AMBAS: que estamos en 'confirm' Y que hay slot.
            Si por alguna razón no hay slot (estado inconsistente), no renderizamos. */}
        {step === 'confirm' && selectedSlot && (
          <div className="space-y-4">
            {/* Tarjeta de resumen */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Resumen de tu cita
              </p>

              <div className="space-y-3 text-sm">
                {/* Cada fila: etiqueta a la izquierda, valor a la derecha */}
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha</span>
                  <span className="font-medium text-gray-900">
                    {/* 'ddd, D [de] MMM YYYY': "jue, 24 de jun 2026" */}
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
                    {/* Buscamos el empleado por ID para mostrar su nombre.
                        .find(): devuelve el primer elemento que cumple la condición.
                        ?.firstName: optional chaining por si find devuelve undefined. */}
                    {employees.find((e) => e.id === selectedEmployeeId)?.firstName}{' '}
                    {employees.find((e) => e.id === selectedEmployeeId)?.lastName}
                  </span>
                </div>
                {/* Lista de servicios seleccionados con precios */}
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-gray-500 mb-1">Servicios</p>
                  {selectedServices.map((s) => (
                    <div key={s.id} className="flex justify-between py-0.5">
                      <span className="text-gray-700">{s.name}</span>
                      <span className="font-medium">{formatCurrency(Number(s.price))}</span>
                    </div>
                  ))}
                </div>
                {/* Total */}
                <div className="flex justify-between border-t border-gray-100 pt-2">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(totalPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Campo de notas adicionales (opcional) */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales (opcional)"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none h-20 focus:ring-2 focus:ring-indigo-500"
            />

            {/* Botón de confirmación final: dispara la mutación de reserva */}
            <button
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {bookMutation.isPending ? 'Reservando...' : 'Confirmar reserva'}
            </button>

            {/* Error de la mutación: solo se muestra si isError es true.
                bookMutation.isError: true si la petición falló.
                (bookMutation.error as any)?.message: mensaje del error. */}
            {bookMutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">
                {(bookMutation.error as any)?.message || 'Error al reservar'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Barra de navegación inferior */}
      <PortalNav />
    </div>
  );
}
