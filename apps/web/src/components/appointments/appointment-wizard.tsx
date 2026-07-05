// 'use client': esta directiva le dice a Next.js que este componente se ejecuta
// en el navegador (no en el servidor). Necesario para usar hooks de React,
// manejar estado, y responder a eventos del usuario.
'use client';

// Importamos los hooks de React que necesitamos:
// - useState: para variables reactivas (si cambian, la UI se actualiza)
// - useMemo: para calcular valores derivados y no repetir trabajo en cada render
// - useEffect: para ejecutar efectos secundarios (p. ej. limpiar estado cuando cambia algo)
import { useState, useMemo, useEffect } from 'react';
// React Query: herramienta para manejar datos del servidor.
// - useQuery: para consultas GET (leer datos)
// - useMutation: para operaciones de escritura (crear, actualizar)
// - useQueryClient: para acceder al caché y poder invalidarlo
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// dayjs: librería para manejar fechas y horas. Mucho más sencilla que Date nativo.
// Dayjs es el TIPO TypeScript del objeto de fecha dayjs.
import dayjs, { Dayjs } from 'dayjs';
// api: cliente HTTP del proyecto. Tiene métodos .get(), .post(), etc.
import { api } from '@/lib/api';
// DetailSheet: componente de panel lateral deslizante (drawer) del sistema.
import { DetailSheet } from '@/components/ui/detail-sheet';
// SearchableSelect: input con autocompletado para buscar clientes en una lista grande.
import { SearchableSelect } from '@/components/ui/searchable-select';
// AvailabilityPicker: selector de fecha y slot de tiempo (modo single-empleado).
import { AvailabilityPicker } from '@/components/calendar/availability-picker';
// useCurrency: hook que devuelve la función formatCurrency según la moneda del tenant.
import { useCurrency } from '@/lib/hooks/use-currency';
// AppointmentSuccessSheet: pantalla de éxito con confeti que se muestra al crear la cita.
import { AppointmentSuccessSheet } from './appointment-success-sheet';

// Constantes de color para no repetir los valores hexadecimales en todo el archivo.
// TEAL es el color primario del sistema (#008080).
const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';
// API_URL: URL base del backend. Usa la variable de entorno si existe, o localhost en dev.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// WizardStep: tipo unión que representa los pasos posibles del wizard.
// Cada valor es un string literal. TypeScript solo permitirá esos valores exactos.
type WizardStep = 'client' | 'service' | 'employee' | 'datetime' | 'confirm';

// AppointmentWizardProps: interfaz que define las props que recibe este componente.
// ? al final del nombre = prop opcional (puede no enviarse).
interface AppointmentWizardProps {
  onClose: () => void;       // Función a llamar para cerrar el wizard
  onSave: () => void;        // Función a llamar cuando se crea la cita con éxito
  initialDate?: string;      // YYYY-MM-DD — fecha pre-seleccionada (del calendario)
  initialTime?: string;      // HH:mm — hora pre-seleccionada
  initialEmployeeId?: string;// Si viene, saltamos el step de profesional
  initialClientId?: string;  // Si viene, saltamos el step de cliente (rebook)
  initialServiceIds?: string[]; // Si vienen, pre-seleccionamos los mismos servicios (rebook desde POS)
}

// Interfaz para el objeto Cliente que devuelve el backend.
// null = el campo existe pero tiene valor nulo; undefined = no vino en la respuesta.
interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

// Interfaz para el objeto Servicio.
interface Service {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  category?: string | null;
}

// Interfaz para el objeto Empleado. employeeServices lista los servicios asignados.
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  color?: string;                           // Color hexadecimal del empleado en el calendario
  locationId?: string;                      // Ubicación donde trabaja (necesaria al crear la cita)
  employeeServices?: { serviceId: string }[];// Servicios que puede realizar este empleado
}

// ── Componente principal ───────────────────────────────────────────────────
// Wizard de 5 pasos para crear una cita nueva: cliente → servicio → profesional
// → fecha/hora → confirmar. Soporta modo multi-empleado cuando distintos servicios
// requieren distintos profesionales.
export function AppointmentWizard({
  onClose,
  onSave,
  initialDate,
  initialTime,
  initialEmployeeId,
  initialClientId,
  initialServiceIds,
}: AppointmentWizardProps) {
  // useQueryClient: acceso al caché global de React Query para invalidar queries.
  const queryClient = useQueryClient();
  // formatCurrency: función que formatea números como moneda ("$150.00").
  const { format: formatCurrency } = useCurrency();

  // ── Estado del wizard ──
  // useState<WizardStep>(valor_inicial): crea una variable reactiva del tipo WizardStep.
  // Si viene un cliente preseleccionado (rebook tras cerrar cita), saltamos
  // el step 'client' al step de servicios para ahorrar un paso.
  // Al reagendar el MISMO servicio desde el POS vienen cliente + servicios +
  // empleado: saltamos directo a fecha/hora (solo falta elegir la nueva fecha).
  const rebookPrefilled = !!(initialClientId && initialServiceIds?.length && initialEmployeeId);
  const [step, setStep] = useState<WizardStep>(
    rebookPrefilled ? 'datetime' : initialClientId ? 'service' : 'client',
  );
  // selectedClientId: el ID del cliente elegido. Si vino initialClientId, lo usamos.
  const [selectedClientId, setSelectedClientId] = useState(initialClientId || '');
  // selectedServiceIds: array de IDs de servicios elegidos (puede ser más de uno).
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(initialServiceIds || []);
  // selectedEmployeeId: ID del profesional elegido (vacío si es "cualquier disponible").
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
  // anyEmployee: true si el usuario eligió "Cualquier profesional disponible".
  const [anyEmployee, setAnyEmployee] = useState(false);
  // serviceEmployeeMap: diccionario { serviceId → employeeId } para modo multi-empleado.
  // Record<string, string> es un tipo TypeScript para objetos con claves/valores string.
  // Multi-empleado: cuando ningún empleado puede hacer TODOS los servicios,
  // pero hay empleados que cubren AL MENOS UNO. El usuario asigna empleado
  // por servicio. Esto replica el flujo del marketplace cliente.
  const [serviceEmployeeMap, setServiceEmployeeMap] = useState<Record<string, string>>({});
  // selectedDate: la fecha elegida en el picker, tipo Dayjs (objeto de dayjs).
  // dayjs(initialDate) crea un objeto Dayjs desde la cadena "YYYY-MM-DD".
  // dayjs() sin argumento = hoy.
  const [selectedDate, setSelectedDate] = useState<Dayjs>(
    initialDate ? dayjs(initialDate) : dayjs(),
  );
  // selectedStartTime/End: strings ISO "YYYY-MM-DDTHH:mm:00" del slot elegido.
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [selectedEndTime, setSelectedEndTime] = useState('');
  // selectedAssignments: array con las asignaciones de profesional por servicio
  // que devuelve el CompositeSlotPicker (modo multi-empleado).
  // Slot composite: assignments por servicio elegidas por el backend.
  const [selectedAssignments, setSelectedAssignments] = useState<Array<{ serviceId: string; employeeId: string; startTime?: string; endTime?: string }>>([]);
  // notes: texto libre del cajero para el equipo (instrucciones especiales).
  const [notes, setNotes] = useState('');
  // error: mensaje de error a mostrar al usuario (null = sin error).
  const [error, setError] = useState<string | null>(null);
  // createdAppointment: la cita creada por el backend. Si tiene valor, mostramos
  // la pantalla de éxito. Tras crear la cita exitosamente mostramos la pantalla de éxito con
  // confeti. NO cerramos el wizard hasta que el usuario acepte.
  const [createdAppointment, setCreatedAppointment] = useState<any | null>(null);

  // ── Formulario de nuevo cliente ──
  // showNewClient: true = el formulario de alta de cliente está visible.
  const [showNewClient, setShowNewClient] = useState(false);
  // newClient: objeto con los campos del formulario de nuevo cliente.
  // Se usa un objeto en lugar de 4 useState separados para simplificar el código.
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  // ── Queries: consultas al backend para cargar los datos necesarios ────────
  // useQuery({ queryKey, queryFn }) carga datos del servidor con caché automático.
  // queryKey: identificador del caché. Si dos queries tienen el mismo key, comparten datos.
  // queryFn: función que hace la petición HTTP. Solo se llama si los datos no están en caché.
  // data?.data: acceso seguro al cuerpo de la respuesta (?. evita error si data es undefined).
  // || []: si data?.data es null/undefined, usa array vacío como valor por defecto.

  // Carga todos los clientes del tenant (max 100) para el SearchableSelect.
  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => api.get<{ data: Client[] }>('/api/clients?perPage=100'),
  });
  const clients = clientsData?.data || [];

  // Carga la configuración del tenant actual para saber si el confeti está
  // activo y con qué estilos mostrarlo. Si el campo no existe → default a true.
  // Para saber si el tenant tiene el confeti activado en el modal de éxito,
  // y con qué figura/colores. Si no hay data o el campo no llega, default a
  // true (comportamiento previo).
  const { data: tenantCurrentData } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: () => api.get<{ data: any }>('/api/tenants/current'),
  });
  const tenantConfettiEnabled =
    (tenantCurrentData as any)?.data?.confettiEnabled !== false;
  const tenantConfettiShapes: string[] | null =
    (tenantCurrentData as any)?.data?.confettiStyles ?? null;
  const tenantConfettiShape: string | null =
    (tenantCurrentData as any)?.data?.confettiStyle ?? null;
  const tenantConfettiColors: string[] | null =
    (tenantCurrentData as any)?.data?.confettiColors ?? null;

  // Carga todos los servicios activos del tenant para el selector de servicios.
  const { data: servicesData } = useQuery({
    queryKey: ['services-all'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services?perPage=100'),
  });
  // El backend ya filtra por isActive=true en findAll, así que no hace falta
  // filtrar otra vez en frontend.
  const services = servicesData?.data || [];

  // dateStr: la fecha seleccionada en formato "YYYY-MM-DD" para las queries.
  // .format('YYYY-MM-DD'): método de dayjs que formatea la fecha como cadena.
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

  // ── Derivados: valores calculados desde el estado ─────────────────────────
  // useMemo(función, [dependencias]) memoiza el resultado: solo recalcula cuando
  // cambia alguna de las dependencias. Evita operaciones costosas en cada render.

  // Filtrado de empleados — mismo patrón que el marketplace cliente.
  //  - employeesWithAll: cubren TODOS los servicios → flujo single-empleado
  //  - employeesWithAny: cubren AL MENOS UNO → fallback para multi-empleado
  //  - isMultiEmployee: ningún empleado solo cubre todo y hay candidatos
  //    parciales → asigna empleado por servicio.

  // employeesWithAll: empleados que pueden realizar TODOS los servicios elegidos.
  // .filter() devuelve solo los que cumplen la condición.
  // .every() devuelve true si TODOS los elementos del array cumplen la condición.
  // .some() devuelve true si AL MENOS UNO cumple la condición.
  // emp.employeeServices?.some(...) : ?. evita error si employeeServices es undefined.
  const employeesWithAll = useMemo(() => {
    if (selectedServiceIds.length === 0) return employees; // Sin servicios → todos son válidos
    return employees.filter((emp) =>
      selectedServiceIds.every((sid) =>
        emp.employeeServices?.some((es) => es.serviceId === sid),
      ),
    );
  }, [employees, selectedServiceIds]); // Recalcular solo cuando cambien employees o servicios

  // employeesWithAny: empleados que pueden realizar AL MENOS UNO de los servicios.
  // Usado como fallback cuando ningún empleado puede con todos.
  const employeesWithAny = useMemo(() => {
    if (selectedServiceIds.length === 0) return employees;
    return employees.filter((emp) =>
      selectedServiceIds.some((sid) =>
        emp.employeeServices?.some((es) => es.serviceId === sid),
      ),
    );
  }, [employees, selectedServiceIds]);

  // isMultiEmployee: true cuando hay 2+ servicios Y hay empleados que pueden
  // atender al menos uno. En ese caso, el wizard pide asignación por servicio.
  // En el admin SIEMPRE asignamos por servicio cuando hay multi-servicio,
  // aunque exista alguien que pueda hacer todo. El admin necesita
  // flexibilidad para distribuir trabajo (María para Manicure, Sofía para
  // Nail art) aunque María sola pudiera con todo. El cliente del marketplace
  // sólo activa multi cuando NADIE cubre todo — esa diferencia es intencional.
  const isMultiEmployee = selectedServiceIds.length > 1 && employeesWithAny.length > 0;

  // eligibleEmployees: si hay empleados que pueden con todo → los mostramos.
  // Si no hay ninguno → mostramos los parciales (modo multi). Ternario simple.
  const eligibleEmployees = employeesWithAll.length > 0 ? employeesWithAll : employeesWithAny;

  // Al cambiar los servicios elegidos:
  //  - Limpia del map las asignaciones de servicios que ya no están seleccionados.
  //  - Resetea el slot elegido (duración total puede haber cambiado).
  // Limpieza al cambiar la selección de servicios:
  //  - Saca del map entradas cuyo serviceId ya no está seleccionado.
  //  - Resetea el slot y assignments porque la duración total cambia.
  useEffect(() => {
    // setServiceEmployeeMap((prev) => ...): forma funcional de actualizar estado.
    // prev = valor anterior; devolvemos el nuevo valor.
    setServiceEmployeeMap((prev) => {
      const next: Record<string, string> = {};
      // Solo conservamos entradas cuyo serviceId sigue seleccionado.
      // "sid in prev": el operador in verifica si la clave existe en el objeto.
      for (const sid of selectedServiceIds) {
        if (sid in prev) next[sid] = prev[sid];
      }
      return next; // El nuevo mapa sin servicios obsoletos
    });
    setSelectedStartTime(''); // Limpia el slot (puede no ser válido ya)
    setSelectedEndTime('');
    setSelectedAssignments([]);
  }, [selectedServiceIds]); // Se ejecuta cada vez que cambia la lista de servicios

  // Objetos completos a partir de los IDs seleccionados.
  // .find() busca el primer elemento que cumple la condición; devuelve undefined si no hay.
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  // Duración total: suma de minutos de todos los servicios elegidos.
  // .reduce(acumulador, inicio) suma cada durationMinutes; || 0 evita NaN.
  const totalDuration = selectedServices.reduce((s, x) => s + (x.durationMinutes || 0), 0);
  // Precio total: suma de precios. Number(x.price) convierte de string a número.
  const totalPrice = selectedServices.reduce((s, x) => s + Number(x.price), 0);

  // ── Mutations: operaciones de escritura ───────────────────────────────────
  // useMutation({ mutationFn, onSuccess, onError }) es para operaciones que
  // CREAN o MODIFICAN datos (POST/PUT/DELETE). No cachea resultados como useQuery.
  // .mutate(payload): llama la mutación desde la UI.
  // .isPending: true mientras espera respuesta (para deshabilitar botones).

  // Crea un nuevo cliente en el backend (desde el formulario de alta rápida).
  const createClientMutation = useMutation({
    mutationFn: (data: any) => api.post<{ data: Client }>('/api/clients', data),
    onSuccess: (res: any) => {
      // Invalida la lista de clientes para que aparezca el nuevo cliente en el dropdown.
      queryClient.invalidateQueries({ queryKey: ['clients-all'] });
      setSelectedClientId(res.data.id);
      setShowNewClient(false);
      setNewClient({ firstName: '', lastName: '', email: '', phone: '' });
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'No se pudo crear el cliente');
    },
  });

  // Crea la cita en el backend con todos los datos del wizard.
  // Es la mutación más compleja: maneja modo single-empleado y multi-empleado,
  // y detecta si el slot se ocupó entre la consulta de disponibilidad y el POST.
  const createAppointmentMutation = useMutation({
    mutationFn: () => {
      // ── Determinar empleado principal y asignaciones por servicio ──
      // Dependiendo del modo (single vs multi), armamos el payload de forma distinta.
      let mainEmployeeId = selectedEmployeeId; // Modo single-empleado por defecto
      // serviceAssignments solo existe en modo multi-empleado.
      let serviceAssignments: Array<{ serviceId: string; employeeId: string }> | undefined;

      if (isMultiEmployee) {
        // Modo multi-empleado: construimos el mapa final de { serviceId → employeeId }.
        // Prioridad: assignments del slot composite (backend) > elecciones del usuario.
        // Multi-empleado: preferimos las assignments resueltas por el slot
        // composite (porque el backend pudo desambiguar "Cualquiera" a un
        // empleado real). Si no las tenemos, caemos al map del usuario.
        const finalMap: Record<string, string> = {};
        for (const sid of selectedServiceIds) {
          // .find() busca la assignment del backend para este servicio.
          // ?. evita error si selectedAssignments no tiene ese servicio.
          const fromSlot = selectedAssignments.find((a) => a.serviceId === sid)?.employeeId;
          // Si el backend la resolvió → la usamos; si no → usamos la del usuario; si no → vacío.
          finalMap[sid] = fromSlot || serviceEmployeeMap[sid] || '';
        }
        // Construimos el array de asignaciones para el backend.
        // .filter((a) => !!a.employeeId): eliminamos asignaciones sin empleado (vacías).
        // !! convierte el valor a booleano: '' → false, 'abc' → true.
        const assignments = selectedServiceIds
          .map((sid) => ({ serviceId: sid, employeeId: finalMap[sid] }))
          .filter((a) => !!a.employeeId);
        // Validación: todos los servicios deben tener profesional.
        if (assignments.length !== selectedServiceIds.length) {
          throw new Error('Cada servicio debe tener un profesional asignado');
        }
        mainEmployeeId = assignments[0].employeeId; // El primero como empleado principal
        serviceAssignments = assignments;
      }

      // Buscar la locationId del empleado principal para incluirla en el POST.
      // El backend la necesita para saber en qué sede se realizará la cita.
      // Buscar locationId del empleado principal (o cualquier elegible si "any")
      const empForLocation =
        employees.find((e) => e.id === mainEmployeeId) ||
        eligibleEmployees[0]; // Fallback: toma el primero elegible si no encontró el exacto
      if (!empForLocation?.locationId) {
        throw new Error('El profesional no tiene ubicación asignada');
      }

      // Enviamos el POST con todos los datos.
      // ...(serviceAssignments && { serviceAssignments }): spread condicional.
      // Si serviceAssignments es undefined, no agrega esa propiedad al objeto.
      // Si existe, la agrega: { ..., serviceAssignments: [...] }.
      // notes || undefined: si notes es cadena vacía, mandamos undefined (no incluir la clave).
      return api.post('/api/appointments', {
        clientId: selectedClientId,
        employeeId: mainEmployeeId,
        locationId: empForLocation.locationId,
        serviceIds: selectedServiceIds,
        startTime: selectedStartTime,
        source: 'MANUAL',          // Indica que la cita la creó el admin (no el marketplace)
        ...(serviceAssignments && { serviceAssignments }),
        notes: notes || undefined,
      });
    },
    onSuccess: (res: any) => {
      // Invalida el caché de citas para que el calendario se actualice.
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      // Guardamos la cita para mostrar la pantalla de éxito con confeti.
      // res?.data || res : si la respuesta tiene .data, la usamos; si no, res directamente.
      setCreatedAppointment(res?.data || res);
    },
    onError: (err: any) => {
      // Extraemos el mensaje de error (puede estar en distintos lugares según el error).
      // || '': si ninguno existe, cadena vacía para no romper el .test() siguiente.
      const msg = err?.message || err?.response?.data?.message || '';
      // Detección de "race condition": el slot se ocupó entre la consulta de
      // disponibilidad y el POST. Esto pasa en sistemas multi-usuario.
      // /regex/.test(msg): busca el patrón en el string. /i = case-insensitive.
      // Si el slot ya fue tomado (race entre la consulta de disponibilidad
      // y el POST, o cache stale), invalida la disponibilidad y devuelve
      // al usuario al paso de horario con datos frescos en vez de dejar
      // un mensaje contradictorio en el paso de confirmación.
      if (/ya está reservado|ya esta reservado/i.test(msg)) {
        // Invalidamos toda la disponibilidad en caché para mostrar datos frescos.
        queryClient.invalidateQueries({ queryKey: ['all-slots'] });
        queryClient.invalidateQueries({ queryKey: ['availability'] });
        queryClient.invalidateQueries({ queryKey: ['composite-availability'] });
        // Limpiamos el slot elegido y retrocedemos al paso de horario.
        setSelectedStartTime('');
        setSelectedEndTime('');
        setSelectedAssignments([]);
        setStep('datetime'); // Vuelve al paso anterior para que el usuario elija otro slot
        setError(
          'Ese horario acaba de ocuparse. Elige otro slot disponible.',
        );
        return; // Salimos sin ejecutar el setError de abajo
      }
      setError(msg || 'No se pudo crear la cita');
    },
  });

  // ── Navegación de steps ───────────────────────────────────────────────────
  // stepsActive: lista ordenada de los pasos que debe completar el usuario.
  // Si viene initialEmployeeId, omitimos el paso 'employee' (ya está elegido).
  // ...spread: expande el array en la posición; si es [], no agrega nada.
  // (... as WizardStep[]): cast de TypeScript para que el compilador sepa el tipo.
  // Lista dinámica de steps que se aplican (sin 'employee' si vino preseleccionado)
  const stepsActive: WizardStep[] = [
    'client',
    'service',
    ...((initialEmployeeId ? [] : ['employee']) as WizardStep[]),
    'datetime',
    'confirm',
  ];
  // stepIndex: la posición del paso actual en stepsActive (0-based).
  // .indexOf(step): devuelve -1 si no encuentra el elemento, o su posición.
  const stepIndex = stepsActive.indexOf(step);

  // canAdvance: verifica si el usuario puede avanzar al siguiente paso.
  // Devuelve true si el paso actual tiene datos suficientes.
  // !! convierte a booleano: !!'' = false, !!'abc' = true.
  function canAdvance(): boolean {
    if (step === 'client') return !!selectedClientId;   // Necesita cliente
    if (step === 'service') return selectedServiceIds.length > 0; // Al menos un servicio
    if (step === 'employee') {
      if (isMultiEmployee) {
        // Modo multi: cada servicio necesita un profesional concreto asignado.
        // Cada servicio debe tener un empleado CONCRETO asignado.
        // (Quitamos "Cualquiera" porque el endpoint composite no acepta
        // employeeId vacío.) Los servicios con un solo profesional posible
        // se autoasignan en la UI.
        // .every() devuelve true solo si todos cumplen la condición.
        // !!serviceEmployeeMap[sid]: el servicio sid tiene un empleado asignado.
        return selectedServiceIds.every((sid) => !!serviceEmployeeMap[sid]);
      }
      // Modo single: basta con elegir "cualquiera" o un empleado específico.
      return anyEmployee || !!selectedEmployeeId;
    }
    if (step === 'datetime') return !!selectedStartTime; // Necesita slot elegido
    return true; // 'confirm': siempre puede avanzar (el botón llama a createMutation)
  }

  // next: avanza al siguiente paso si canAdvance() es true.
  function next() {
    setError(null); // Limpiar error al intentar avanzar
    if (!canAdvance()) return;
    const i = stepsActive.indexOf(step);
    // Si no es el último paso, avanzamos al siguiente.
    if (i < stepsActive.length - 1) setStep(stepsActive[i + 1]);
  }

  // back: retrocede un paso, o cierra el wizard si estamos en el primero.
  function back() {
    setError(null);
    const i = stepsActive.indexOf(step);
    if (i > 0) setStep(stepsActive[i - 1]); // Retrocede un paso
    else onClose(); // Si ya estamos en el primero → cierra el wizard
  }

  // ── JSX: estructura visual del wizard ────────────────────────────────────

  // stepLabels: texto legible para mostrar en la barra de progreso.
  // Record<WizardStep, string>: tipo TypeScript para objeto cuyas claves son WizardStep.
  // ── Render por step ──
  const stepLabels: Record<WizardStep, string> = {
    client: 'Cliente',
    service: 'Servicio',
    employee: 'Profesional',
    datetime: 'Horario',
    confirm: 'Confirmar',
  };

  // footer: JSX constante con los botones "Atrás" y "Siguiente/Confirmar".
  // Se pasa como prop a DetailSheet, que lo pega en la parte inferior del panel.
  // En el último paso ('confirm'), el botón llama a createAppointmentMutation.mutate()
  // en lugar de next(). El ternario step !== 'confirm' lo decide.
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

  // Si la cita ya fue creada exitosamente, mostramos la pantalla de éxito
  // con confeti en lugar del wizard. El renderizado condicional con if/return
  // es una técnica llamada "early return": en lugar de un ternario gigante,
  // devolvemos antes de llegar al return principal.
  // Pantalla de éxito tras crear la cita — confeti corto + detalle.
  // Cuando el usuario "Acepta" cerramos el wizard llamando onSave().
  if (createdAppointment) {
    // Calculamos el nombre del profesional para mostrarlo en la confirmación.
    // En modo multi-empleado, pueden ser varios nombres separados por coma.
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
        confettiShapes={tenantConfettiShapes}
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
// Sub-componente interno (no exportado) para citas multi-empleado.
// Muestra un slider de 14 días y una cuadrícula de slots disponibles.
// Consulta /api/availability/composite con las asignaciones del usuario
// y muestra una grilla de slots. Al elegir uno, devuelve:
//   - startTime/endTime: el rango horario del slot
//   - assignments: array de { serviceId, employeeId, startTime, endTime }
//     con el profesional asignado a cada servicio por el backend.
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
  // dateStr: la fecha seleccionada como cadena "YYYY-MM-DD" para las queries.
  const dateStr = selectedDate.format('YYYY-MM-DD');
  // allAssigned: true si TODOS los servicios tienen un empleado asignado.
  // Solo cuando allAssigned es true habilitamos la query (enabled: allAssigned).
  const allAssigned = serviceAssignments.every((a) => !!a.employeeId);
  // showMonthCalendar: controla si el popover de calendario mensual está visible.
  const [showMonthCalendar, setShowMonthCalendar] = useState(false);
  // calendarMonth: el mes que se muestra en el popover — independiente de selectedDate
  // para que el usuario pueda navegar meses sin perder la fecha activa.
  const [calendarMonth, setCalendarMonth] = useState<Dayjs>(selectedDate);

  // Consulta los slots disponibles para la fecha y asignaciones actuales.
  // queryKey incluye serviceAssignments serializado (JSON.stringify): si cambian
  // las asignaciones, la query se vuelve a ejecutar automáticamente.
  // enabled: allAssigned → solo consulta si todos los servicios tienen profesional.
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
    enabled: allAssigned, // Solo ejecuta la query si todos los servicios tienen profesional
    // staleTime: 0 → los datos se consideran "viejos" inmediatamente.
    // refetchOnMount: 'always' → siempre recarga al montar el componente.
    // Esto es necesario porque la disponibilidad cambia constantemente
    // (otras citas se crean en paralelo) y no queremos mostrar slots stale.
    // Disponibilidad cambia constantemente (otras citas se crean en
    // paralelo). Forzamos refetch al montar el componente para que el
    // cajero no vea slots stale.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // slots: los slots disponibles devueltos por el backend (o array vacío).
  const slots = data?.data || [];

  // futureSlots: filtra los slots pasados cuando la fecha es hoy.
  // isToday: true si la fecha seleccionada es el día de hoy.
  // dayjs(s.startTime).isAfter(dayjs()): el slot empieza en el futuro.
  // Filtrar slots cuyo inicio ya pasó (solo aplica hoy).
  const isToday = selectedDate.isSame(dayjs(), 'day');
  const futureSlots = slots.filter((s) => {
    if (!isToday) return true; // Fechas futuras: mostrar todos los slots
    return dayjs(s.startTime).isAfter(dayjs()); // Hoy: solo slots que aún no pasaron
  });

  // days: array de 14 objetos Dayjs comenzando desde hoy (o desde selectedDate
  // si es una fecha lejana). Array.from({ length: 14 }, (_, i) => ...) crea
  // un array de 14 elementos: _ ignora el valor, i es el índice (0–13).
  // Tarjetas de día: si la fecha seleccionada cae dentro de los próximos 14
  // días desde hoy, mantenemos la vista anclada en hoy (más natural). Si el
  // usuario eligió una fecha lejana desde el calendario (p.ej. 30 ago),
  // arrancamos el slider en esa fecha para que sea visible y sirva como
  // referencia visual.
  const today = dayjs().startOf('day'); // Hoy a las 00:00:00
  const baseDay = selectedDate.isBefore(today.add(14, 'day'), 'day') ? today : selectedDate;
  const days = Array.from({ length: 14 }, (_, i) => baseDay.add(i, 'day'));

  // ── Calendario mensual (popover) ──
  // startOfMonth: el primer día del mes actual del calendario.
  // daysInMonth: cuántos días tiene el mes (28, 29, 30 o 31).
  // firstDayOfWeek: el día de la semana del primer día del mes (0=Dom, 1=Lun…).
  //   Necesario para dejar celdas vacías al inicio del grid del calendario.
  // calendarDays: array con todos los días del mes como objetos Dayjs.
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
                {dayjs.utc(slot.startTime).format('HH:mm')}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
