// ============================================================
// COMPONENTE: AppointmentModal
// ============================================================
// ¿Qué hace?
//   Muestra un panel lateral (DetailSheet) que sirve para DOS cosas:
//   1. VER una cita existente: muestra estado, cliente, empleado, servicios,
//      fotos del resultado, y botones de acción (cancelar / reagendar /
//      finalizar / recordatorio WhatsApp).
//   2. CREAR una cita nueva: formulario con buscador de cliente, selector de
//      servicios (checkboxes), selector de empleado y calendario de
//      disponibilidad (AvailabilityPicker).
//
// Modo edición vs. creación:
//   - Si llega la prop `appointmentId` → modo edición (ver cita existente).
//   - Si NO llega → modo creación (formulario vacío).
//
// Principales conceptos React usados aquí:
//   • useState   — variables reactivas (el valor cambia → pantalla se actualiza)
//   • useEffect  — código que corre como "efecto secundario" al montar o cambiar deps
//   • useRef     — referencia a un elemento del DOM (sin re-renderizar)
//   • useQuery   — petición GET al backend (React Query)
//   • useMutation — petición POST/PUT/DELETE al backend (React Query)
//   • Renderizado condicional (&&, ternario ? : ) — muestra partes distintas
//     según el estado actual
// ============================================================

'use client'; // Indica a Next.js que este componente corre en el navegador (cliente), no en el servidor.

// ── Imports de React ─────────────────────────────────────────────────────────
// useState: crea variables que React "observa"; cuando cambian, re-renderiza.
// useEffect: ejecuta código en respuesta a cambios (similar a "escuchar eventos").
// useRef: crea una referencia que apunta a un elemento DOM sin causar re-render.
import { useState, useEffect, useRef } from 'react';
// useRouter: permite navegar a otras páginas desde código (ej. router.push('/pos')).
import { useRouter } from 'next/navigation';
// useQuery: obtiene datos del backend y los cachea automáticamente.
// useMutation: envía cambios al backend (crear, actualizar, borrar).
// useQueryClient: accede al cache global para invalidarlo (forzar re-fetch).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// api: cliente HTTP del proyecto (envuelve fetch con manejo de errores y tokens JWT).
import { api } from '@/lib/api';
// DetailSheet: panel lateral deslizante que envuelve el contenido del modal.
import { DetailSheet } from '@/components/ui/detail-sheet';
// AppointmentStatusBadge: pequeña píldora de color que muestra el estado de la cita.
import { AppointmentStatusBadge } from '@/components/ui/badge';
// AvailabilityPicker: mini-calendario + grilla de slots horarios disponibles.
import { AvailabilityPicker } from '@/components/calendar/availability-picker';
// SearchableSelect: dropdown con buscador interno (para elegir clientes).
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CensorEyesModal } from '@/components/ui/censor-eyes-modal';
// formatDate / formatTime: convierte fechas ISO a texto legible ("Lun 15 ene").
// resolveImageUrl: construye la URL completa de una imagen del servidor.
import { formatDate, formatTime, resolveImageUrl } from '@/lib/utils';
// formatBookingTime: extrae "HH:mm" de un string ISO respetando que las horas
// se guardan como UTC-raw (la hora del negocio sin offset real).
import { formatBookingTime } from '@/lib/booking-time';
// dayjs: librería para manejar fechas fácilmente (equivalente a moment.js).
import dayjs from 'dayjs';
// useCurrency: hook que devuelve la función `format` para moneda local (ej. "$1,200").
import { useCurrency } from '@/lib/hooks/use-currency';
// useAuth: hook que devuelve el usuario autenticado actual (admin/cajero).
import { useAuth } from '@/lib/hooks/use-auth';
// usePermissions: hook con hasPermission() para mostrar/ocultar acciones según
// el permiso del usuario (un empleado ve menos botones que un admin).
import { usePermissions } from '@/lib/hooks/use-permissions';
// buildReminderMessage / buildWhatsAppUrl: arman el mensaje y la URL de WhatsApp
// para el recordatorio que se envía al cliente.
import {
  buildReminderMessage,
  buildWhatsAppUrl,
  buildDepositRequestMessage,
  buildDepositRemainderMessage,
} from '@/lib/whatsapp';

// ── Interfaces de TypeScript ──────────────────────────────────────────────────
// Una "interface" es como un contrato: describe exactamente qué campos tiene
// un objeto. TypeScript comprueba que el código respete ese contrato.
// El signo "?" después del nombre de un campo significa que es OPCIONAL
// (puede no venir en el objeto).

// Representa un servicio del negocio (ej. "Manicure, 60 min, $300").
interface Service {
  id: string;           // Identificador único (UUID)
  name: string;         // Nombre del servicio
  durationMinutes: number; // Duración en minutos
  price: number;        // Precio
  color?: string;       // Color asignado (opcional, para el punto de color en la UI)
}

// Representa a un empleado/profesional del negocio.
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  locationId?: string;  // Sucursal donde trabaja; es obligatorio para crear citas
}

// Representa a un cliente (quien recibe el servicio).
interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;       // Email (puede no tener)
  phone?: string;       // Teléfono (puede no tener)
  dateOfBirth?: string | null; // Para detectar si es menor de edad
}

// Calcula si una fecha de nacimiento corresponde a un menor de edad (<18).
function isMinorFromDob(dob?: string | null): boolean {
  if (!dob) return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 18;
}

// Un ítem dentro de una cita — guarda "snapshot" (copia) del precio y duración
// al momento de reservar, por si el precio cambia después.
interface AppointmentItem {
  id: string;
  serviceId: string;
  serviceNameSnapshot: string;   // Nombre del servicio tal como era al reservar
  priceSnapshot: number;         // Precio al momento de la reserva
  durationSnapshot: number;      // Duración al momento de la reserva
  commissionSnapshot: number | null; // Comisión del empleado (null si no aplica)
}

// Foto del resultado subida por el staff (portafolio de trabajos).
interface AppointmentPhoto {
  id: string;
  imageUrl: string;           // Ruta relativa al servidor (ej. "/uploads/...")
  caption: string | null;     // Pie de foto (puede ser null)
  serviceId?: string | null;  // Servicio al que pertenece la foto (opcional)
  createdAt: string;          // Fecha ISO de cuando se subió
}

// Apartado (reserva de producto) ligado a esta cita.
// El cliente pidió un producto que se le entrega en su visita.
interface ProductReservation {
  id: string;
  product: { id: string; name: string; imageUrl?: string }; // El producto apartado
  quantity: number;               // Cuántas unidades
  unitPrice: number;              // Precio por unidad
  status: string;                 // PENDING | CONFIRMED | READY | DELIVERED | CANCELLED
  fulfillmentType: string;        // Cómo se entrega
  preferredPaymentMethod: string; // Cómo prefiere pagar el cliente
}

// La cita completa con todos sus datos relacionados.
interface Appointment {
  id: string;
  clientId: string;
  client?: Client;            // Datos del cliente (puede no venir poblado)
  employeeId: string;
  employee?: Employee;        // Datos del empleado (puede no venir poblado)
  startTime: string;          // Fecha/hora inicio en ISO (UTC-raw)
  endTime: string;            // Fecha/hora fin en ISO (UTC-raw)
  status: string;             // PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | etc.
  notes?: string;             // Notas del cliente para el staff
  internalNotes?: string;     // Notas internas (solo ve el negocio)
  discountAmount?: number;    // Descuento aplicado (cupón o puntos)
  redemptionId?: string;      // ID del canje de cupón (si aplica)
  pointsSpent?: number;       // Puntos de lealtad usados para pagar
  // El cupón canjeado con su código y recompensa — puede ser null si no usó cupón.
  redemption?: {
    id: string;
    code: string;
    pointsSpent: number;
    reward: { name: string; type: string; discountAmount?: number | null; discountMode?: string | null };
  } | null;
  items?: AppointmentItem[];                 // Lista de servicios de la cita
  photos?: AppointmentPhoto[];               // Fotos del resultado
  productReservations?: ProductReservation[]; // Apartados de productos
  reminderSentAt?: string | null;            // Cuándo se mandó el recordatorio WA (null = nunca)
  photoConsent?: boolean | null;             // null=sin responder, true=autoriza, false=no autoriza
  // Anticipo (depósito): snapshot del requerimiento + montos + exoneración.
  depositRequired?: boolean;
  depositAmount?: string | number | null;
  depositPaid?: string | number | null;
  depositWaived?: boolean;
  tenant?: { name?: string; depositInstructions?: string | null } | null;
}

// Resultado del endpoint que verifica si hay un slot disponible
// justo después de que termina una cita existente (para agregar más servicios).
interface CheckAfterResult {
  immediatelyAvailable: boolean; // ¿Hay slot libre inmediatamente después?
  immediateSlot: { startTime: string; endTime: string } | null; // El slot disponible más cercano
  nextAvailable: { date: string; startTime: string; endTime: string } | null; // Siguiente slot en días futuros
}

// ── Props del componente ──────────────────────────────────────────────────────
// "Props" son los parámetros que recibe el componente desde quien lo usa.
// Es como los argumentos de una función, pero para componentes React.
interface AppointmentModalProps {
  appointmentId?: string;       // Si viene → modo edición; si no → modo creación
  initialStartTime?: string;    // Hora inicial pre-seleccionada (desde el click en el calendario)
  initialClientId?: string;     // Cliente pre-seleccionado (ej. al reagendar desde el perfil del cliente)
  initialEmployeeId?: string;   // Empleado pre-seleccionado
  onClose: () => void;          // Función que llama el padre cuando se cierra el modal
  onSave: () => void;           // Función que llama el padre cuando se guarda exitosamente
  onCreateAnother?: (clientId: string, employeeId: string) => void; // Para encadenar "Crear otra cita"
  // posBasePath: prefijo de ruta para el Punto de Venta. El dashboard lo deja
  // vacío (→ "/pos"); el portal del empleado pasa "/employee" (→ "/employee/pos").
  posBasePath?: string;
}

// ── Componente principal ──────────────────────────────────────────────────────
// Una función que empieza con mayúscula y devuelve JSX es un "componente React".
// Las llaves { } en los parámetros son "desestructuración": extraen las props
// directamente en variables con el mismo nombre.
export function AppointmentModal({
  appointmentId,
  initialStartTime,
  initialClientId,
  initialEmployeeId,
  onClose,
  onSave,
  onCreateAnother,
  posBasePath,
}: AppointmentModalProps) {
  // useQueryClient() devuelve el objeto global de cache de React Query.
  // Lo usamos para "invalidar" (borrar) entradas del cache cuando cambian datos,
  // forzando que se vuelvan a pedir al servidor.
  const queryClient = useQueryClient();

  // !! convierte cualquier valor a booleano: si appointmentId es una cadena
  // no vacía → true (modo edición); si es undefined → false (modo creación).
  const isEditing = !!appointmentId;

  // ── useState: variables de estado del formulario ──────────────────────────
  // useState<tipo>(valorInicial) devuelve [valorActual, funcionParaCambiar].
  // Cuando se llama la función de cambio, React re-renderiza el componente.

  // Lista de IDs de los servicios que el usuario marcó con checkbox.
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Hook de moneda: format("$1234.56") según la configuración del tenant.
  const { format: formatCurrency } = useCurrency();

  // ID del empleado seleccionado. Si llegó initialEmployeeId, arranca pre-llenado.
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(initialEmployeeId || '');

  // Hora de inicio/fin elegida en el AvailabilityPicker (formato ISO sin TZ).
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [selectedEndTime, setSelectedEndTime] = useState('');

  // Texto del buscador de clientes (no se usa ya directamente; SearchableSelect
  // filtra internamente, pero se mantiene por compatibilidad futura).
  const [clientSearch, setClientSearch] = useState('');

  // ID del cliente seleccionado. Se pre-llena si llegó initialClientId.
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '');

  // Notas opcionales del cajero para el profesional.
  const [notes, setNotes] = useState('');

  // Mensaje de error del formulario (null = sin error).
  const [formError, setFormError] = useState<string | null>(null);

  // Motivo de cancelación que escribe el cajero en el textarea.
  const [cancelReason, setCancelReason] = useState('');

  // Si true, muestra el bloque de "Motivo de cancelación" en pantalla.
  const [showCancelForm, setShowCancelForm] = useState(false);
  // Panel de "Confirmar anticipo" + el monto recibido que el negocio captura.
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositInput, setDepositInput] = useState('');

  // Si true, muestra el sub-panel de reagendamiento (AvailabilityPicker de nuevo).
  const [rescheduleMode, setRescheduleMode] = useState(false);

  // Nuevas hora inicio/fin elegidas al reagendar.
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');

  // ── Estado para subida de fotos del resultado ─────────────────────────────

  // useRouter: para redirigir al POS tras finalizar la cita.
  const router = useRouter();

  // true mientras se está subiendo una foto al servidor (muestra "Subiendo...").
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Servicio al que se asignará la próxima foto (cuando la cita tiene 2+
  // servicios, para clasificar el portafolio por servicio como en el cierre
  // del empleado). null = usa el primer servicio por defecto.
  const [photoServiceId, setPhotoServiceId] = useState<string | null>(null);
  // "Cubrir ojos": abre el editor de censura antes de subir. Default activado si
  // el cliente es menor de edad (lo ajusta un effect cuando carga la cita).
  const [coverEyes, setCoverEyes] = useState(false);
  const [pendingCensor, setPendingCensor] = useState<{ file: File; serviceId?: string | null } | null>(null);

  // Flag para encadenar "Finalizar sin foto" → upload → completar.
  // Si el cliente sí autorizó fotos pero no hay ninguna, al pulsar "Finalizar"
  // abrimos el selector de archivo; cuando termina el upload, completamos la cita.
  const [autoCompleteOnNextUpload, setAutoCompleteOnNextUpload] = useState(false);

  // Ref del input file oculto que dispara el "Finalizar" cuando no hay foto.
  // useRef<HTMLInputElement>(null) crea una "referencia" al elemento <input>
  // para poder llamar .click() programáticamente desde el botón "Finalizar".
  const finalizeFileInputRef = useRef<HTMLInputElement>(null);

  // ── Fecha activa para filtrar empleados disponibles ───────────────────────
  // Extraemos solo la parte de fecha ("YYYY-MM-DD") del initialStartTime.
  // split('T')[0] divide el string ISO en ["2026-06-10", "09:00:00"] y toma la primera parte.
  const initialDateStr = initialStartTime ? initialStartTime.split('T')[0] : undefined;

  // La fecha que muestra el mini-calendario (sincronizada con AvailabilityPicker).
  // Cuando cambia, re-consulta los empleados disponibles ese día.
  const [activeDate, setActiveDate] = useState<string | undefined>(initialDateStr);

  // ── Estado para el flujo "Agregar servicios" a una cita existente ─────────
  // Si true, muestra el panel para agregar más servicios justo después.
  const [addServicesMode, setAddServicesMode] = useState(false);

  // IDs de los nuevos servicios que el cajero quiere agregar.
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);

  // Resultado del endpoint /api/availability/check-after (ver si el empleado
  // puede atender más servicios justo después de que termine la cita actual).
  const [checkAfterResult, setCheckAfterResult] = useState<CheckAfterResult | null>(null);

  // true mientras espera respuesta del servidor al verificar disponibilidad.
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Mensaje de error específico del flujo de agregar servicios.
  const [addServiceError, setAddServiceError] = useState<string | null>(null);

  // ── useQuery: peticiones GET al backend ──────────────────────────────────
  // useQuery({ queryKey, queryFn, enabled }) hace lo siguiente:
  //   - queryKey: array que identifica este query en el cache. Si cambia,
  //     se vuelve a pedir. Ej: ['appointment', '123'] identifica la cita 123.
  //   - queryFn: la función que realmente llama al servidor.
  //   - enabled: solo ejecuta el query si esta condición es true.
  // Devuelve { data, isLoading, isError, ... }.
  // data?.data: el "?" es "optional chaining" — si data es undefined, devuelve
  // undefined en vez de lanzar un error.

  // Carga los datos de la cita existente (solo en modo edición).
  const { data: appointmentData, isLoading: loadingAppointment } = useQuery({
    queryKey: ['appointment', appointmentId],  // Clave única: cambia si appointmentId cambia
    queryFn: () =>
      api.get<{ data: Appointment }>(`/api/appointments/${appointmentId}`),
    enabled: isEditing, // Solo consulta si hay appointmentId (modo edición)
  });

  // Carga las fotos del resultado de la cita (para el portafolio del negocio).
  const { data: photosData } = useQuery({
    queryKey: ['appointment-photos', appointmentId],
    queryFn: () =>
      api.get<{ data: AppointmentPhoto[] }>(`/api/appointments/${appointmentId}/photos`),
    enabled: isEditing && !!appointmentId, // Doble guarda: solo si editamos Y hay ID
  });

  // || []: si photosData?.data es undefined (aún cargando), usa array vacío
  // para no romper el .map() o .length que se usan más adelante.
  const photos = photosData?.data || [];

  // ── Función para subir una foto al servidor ───────────────────────────────
  // Es async porque necesita esperar (await) a que el servidor responda.
  // Recibe el objeto File (el archivo elegido por el usuario) y opcionalmente
  // el serviceId al que se asigna esta foto.
  // Si "Cubrir ojos" está activo, abre el editor de censura antes de subir;
  // si no, sube directo.
  const handlePickedPhoto = (file: File, serviceId?: string | null) => {
    if (coverEyes) {
      setPendingCensor({ file, serviceId });
    } else {
      handlePhotoUpload(file, serviceId);
    }
  };

  const handlePhotoUpload = async (file: File, serviceId?: string | null) => {
    if (!appointmentId) return; // Guarda: no subir si no hay cita activa
    setUploadingPhoto(true);    // Muestra "Subiendo..." en la UI
    try {
      // api.upload envía el archivo como multipart/form-data al endpoint.
      // Si hay serviceId, lo adjunta como campo extra del formulario.
      await api.upload(
        `/api/appointments/${appointmentId}/photos`,
        file,
        serviceId ? { serviceId } : undefined,
      );
      // Invalida el cache de fotos → React Query las vuelve a pedir → pantalla actualizada.
      queryClient.invalidateQueries({ queryKey: ['appointment-photos', appointmentId] });
      // Si veníamos del botón "Finalizar" sin fotos, encadenamos completar
      // automáticamente tras un upload exitoso.
      if (autoCompleteOnNextUpload) {
        setAutoCompleteOnNextUpload(false); // Limpiamos el flag
        completeMutation.mutate();          // Completamos la cita ahora que ya hay foto
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      setAutoCompleteOnNextUpload(false); // Limpiamos el flag también en caso de error
    } finally {
      // finally se ejecuta SIEMPRE (con éxito o con error)
      setUploadingPhoto(false); // Oculta "Subiendo..."
    }
  };

  // ── Función para borrar una foto ──────────────────────────────────────────
  const handlePhotoDelete = async (photoId: string) => {
    if (!appointmentId) return;
    try {
      await api.delete(`/api/appointments/${appointmentId}/photos/${photoId}`);
      // Volvemos a pedir las fotos para que desaparezca la borrada de la UI.
      queryClient.invalidateQueries({ queryKey: ['appointment-photos', appointmentId] });
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  };

  // ── Queries de catálogos ──────────────────────────────────────────────────

  // Todos los servicios activos del negocio (para los checkboxes de selección).
  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services'),
  });

  // Empleados disponibles, filtrados por fecha activa del mini-calendario.
  // Cuando activeDate cambia (usuario navega a otro día), se re-consulta el
  // endpoint con ?workingDate=YYYY-MM-DD para traer solo empleados que trabajan ese día.
  // Esto impide seleccionar a alguien que no tiene horario asignado ese día.
  const { data: employeesData } = useQuery({
    queryKey: ['employees', activeDate || 'all'], // Clave incluye la fecha para diferenciar resultados
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

  // Si vino un initialClientId (ej. al abrir el modal desde el perfil de un cliente),
  // precargamos sus datos para mostrar su nombre aunque no esté en la lista paginada.
  const { data: initialClientData } = useQuery({
    queryKey: ['client', initialClientId],
    queryFn: () => api.get<{ data: Client }>(`/api/clients/${initialClientId}`),
    enabled: !!initialClientId && !isEditing, // Solo en modo creación con cliente predefinido
  });

  // Extraemos el objeto Appointment del resultado del query.
  // ?. es "optional chaining": si appointmentData es undefined, devuelve undefined
  // en lugar de lanzar un error tipo "Cannot read property 'data' of undefined".
  const appointment = appointmentData?.data;

  // ¿El cliente de esta cita es menor de edad? Cambia el texto del consentimiento.
  const isMinorClient = isMinorFromDob((appointment?.client as any)?.dateOfBirth);

  // Por defecto activamos "Cubrir ojos" si el cliente es menor (al cargar la cita).
  useEffect(() => {
    setCoverEyes(isMinorClient);
  }, [isMinorClient]);

  // Servicios únicos de la cita (dedup por serviceId) para clasificar las fotos
  // del resultado. effectivePhotoServiceId es el servicio destino de la próxima
  // foto: el elegido, o el primero por defecto.
  // Usamos una función inmediata (() => { ... })() que se ejecuta al declararse.
  // Map<key, value> es una estructura de clave-valor que garantiza unicidad de claves.
  const uniqueServices = (() => {
    const map = new Map<string, AppointmentItem>();
    // appointment?.items ?? [] : si items es undefined, usamos array vacío.
    // ?? es "nullish coalescing": devuelve el lado derecho solo si el izquierdo es null/undefined.
    for (const it of appointment?.items ?? []) {
      // Si ya existe este serviceId en el mapa, lo ignoramos (deduplicación).
      if (!map.has(it.serviceId)) map.set(it.serviceId, it);
    }
    // Convertimos el Map a array de valores (los AppointmentItem sin duplicados).
    return Array.from(map.values());
  })();

  // Si el usuario eligió un servicio para la foto → usa ese.
  // Si no eligió nada (null) → usa el primero de la lista.
  // ?? : si photoServiceId es null, evalúa uniqueServices[0]?.serviceId ?? null.
  const effectivePhotoServiceId = photoServiceId ?? uniqueServices[0]?.serviceId ?? null;

  // Helper: dado un serviceId, devuelve el nombre snapshot del servicio.
  // .find() busca el primero que cumple la condición. ?. evita error si no encuentra nada.
  // ?? null: si no encuentra nada, devuelve null.
  const serviceNameById = (id?: string | null) =>
    uniqueServices.find((s) => s.serviceId === id)?.serviceNameSnapshot ?? null;
  // Selector "¿de qué servicio es la foto?" — solo cuando hay 2+ servicios.
  // Renderizado condicional: si uniqueServices.length > 1 → muestra el selector,
  // si no → null (React no renderiza nada cuando se devuelve null).
  const photoServiceSelector = uniqueServices.length > 1 ? (
    <div className="mb-3">
      <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
        ¿De qué servicio es la foto?
      </p>
      <div className="flex flex-wrap gap-1.5">
        {/* .map() itera el array y devuelve un botón por cada servicio único.
            key={s.serviceId}: React necesita una "key" única en cada elemento
            de una lista para identificar cuál cambió y solo re-renderizar ese.
            active: true si este servicio es el activo actualmente. */}
        {uniqueServices.map((s) => {
          const active = effectivePhotoServiceId === s.serviceId;
          return (
            <button
              key={s.serviceId}
              type="button"
              // onClick: al hacer click, guardamos el serviceId elegido.
              // Esto cambia effectivePhotoServiceId en el siguiente render.
              onClick={() => setPhotoServiceId(s.serviceId)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
              // style con objeto: aplica estilos inline. Si está activo → teal sólido,
              // si no → borde gris y fondo blanco.
              style={active
                ? { backgroundColor: '#008080', borderColor: '#008080', color: '#fff' }
                : { backgroundColor: '#fff', borderColor: '#d1d5db', color: '#6b7280' }}
            >
              {s.serviceNameSnapshot}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  // Toggle "Cubrir ojos": al elegir una foto, abre el editor de censura antes de
  // subir. Por defecto activado si el cliente es menor de edad.
  const coverEyesToggle = (
    <label className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer">
      <span className="text-[11px] font-medium text-gray-700">
        Cubrir los ojos antes de subir
        {isMinorClient && <span className="text-[10px] text-[#008080] font-semibold"> · menor de edad</span>}
      </span>
      <input
        type="checkbox"
        checked={coverEyes}
        onChange={(e) => setCoverEyes(e.target.checked)}
        style={{ accentColor: '#008080' }}
      />
    </label>
  );

  // Extraemos los arrays de datos. || [] garantiza array vacío mientras carga.
  const services = servicesData?.data || [];
  const employees = employeesData?.data || [];
  const clientResults = clientsData?.data || [];

  // ── useEffect: limpiar la selección de empleado si ya no está disponible ──
  // useEffect(función, [dependencias]) ejecuta la función cada vez que alguna
  // de las dependencias cambia (en este caso: employees, selectedEmployeeId,
  // selectedServiceIds).
  // Aquí lo usamos para validar: si el empleado elegido no cubre ninguno de
  // los servicios seleccionados, lo deseleccionamos automáticamente.
  useEffect(() => {
    // Si el empleado seleccionado no tiene NINGUNO de los servicios actuales
    // (porque cambió la selección), lo limpiamos. Si tiene al menos uno,
    // lo dejamos: el AvailabilityPicker filtrará slots viables.
    if (selectedEmployeeId && selectedServiceIds.length > 0 && employees.length > 0) {
      // Buscamos el empleado en la lista cargada del servidor.
      const emp = employees.find((e: any) => e.id === selectedEmployeeId);
      // Extraemos los IDs de servicios que puede hacer este empleado.
      // (emp as any) fuerza el tipo a "any" porque employeeServices no está
      // en la interfaz Employee básica — viene del backend con datos extra.
      const empServiceIds: string[] = ((emp as any)?.employeeServices || []).map(
        (es: any) => es.serviceId || es.service?.id,
      );
      // .some() devuelve true si AL MENOS UN elemento cumple la condición.
      // Si ningún servicio del carrito lo puede atender este empleado → lo limpiamos.
      const hasAny = selectedServiceIds.some((sid) => empServiceIds.includes(sid));
      if (!hasAny) {
        setSelectedEmployeeId(''); // Resetea la selección
      }
    }
    // Si el empleado seleccionado ya no está en la lista filtrada por fecha,
    // también lo deseleccionamos.
    if (selectedEmployeeId && employees.length > 0 && !employees.find((e) => e.id === selectedEmployeeId)) {
      setSelectedEmployeeId('');
    }
  }, [employees, selectedEmployeeId, selectedServiceIds]); // Ejecutar cuando estas variables cambien

  // ── useMutation: peticiones de escritura al backend ──────────────────────
  // useMutation({ mutationFn, onSuccess, onError }) sirve para operaciones
  // que MODIFICAN datos (POST, PUT, DELETE).
  //   - mutationFn: la función que hace la petición HTTP.
  //   - onSuccess: se ejecuta cuando el servidor responde OK.
  //   - onError: se ejecuta si el servidor responde con error.
  //   - .mutate(payload): dispara la mutación desde la UI (ej. en un onClick).
  //   - .isPending: true mientras espera respuesta (útil para deshabilitar botones).

  // Crea una cita nueva (modo creación).
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
      // Invalida el cache de 'appointments' → el calendario se actualiza solo.
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onSave(); // Llama al callback del padre (cierra el modal y refresca)
    },
    onError: (err: { message?: string }) => {
      // err.message || '...': si el error no trae mensaje, usa el texto por defecto.
      setFormError(err.message || 'Error al crear la cita');
    },
  });

  // Crea una cita nueva con servicios adicionales justo después de la actual.
  // Mutation for creating follow-up appointment from add-services flow.
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
      // Cerramos el modo agregar servicios y limpiamos el estado.
      setAddServicesMode(false);
      setNewServiceIds([]);
      setCheckAfterResult(null);
      onSave();
    },
    onError: (err: { message?: string }) => {
      setAddServiceError(err.message || 'Error al agendar servicios adicionales');
    },
  });

  // Cancela la cita actual enviando el motivo de cancelación.
  const cancelMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointmentId}/cancel`, {
        reason: cancelReason, // El texto que escribió el cajero en el textarea
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

  // ── Recordatorio por WhatsApp ─────────────────────────────────────────────
  // Genera token + marca como enviado + abre wa.me. Lo usa el boton de
  // "Recordatorio WhatsApp" en el modal.

  // useAuth devuelve el usuario autenticado actualmente (el cajero/admin).
  const { user: authUser } = useAuth();
  // hasPermission: para mostrar/ocultar acciones según el permiso del usuario.
  // Un empleado (rol staff) NO tiene appointments.cancel → no ve "Cancelar cita".
  const { hasPermission } = usePermissions();

  // true mientras se espera la respuesta del servidor (deshabilita el botón).
  const [sendingReminder, setSendingReminder] = useState(false);

  // sendReminder: función async que:
  // 1. Llama al backend para generar un token único y marcar que se envió.
  // 2. Construye el mensaje de WhatsApp con los datos de la cita.
  // 3. Abre WhatsApp en una nueva pestaña del navegador.
  const sendReminder = async () => {
    // Doble guarda: necesitamos cita cargada Y teléfono del cliente.
    if (!appointment || !appointment.client?.phone) return;
    setSendingReminder(true);
    try {
      const res = await api.post<{ data: { token: string } }>(
        `/api/appointments/${appointmentId}/mark-reminder-sent`,
        {},
      );
      // (authUser as any)?.tenantName: forzamos el tipo a "any" porque tenantName
      // es un campo extra que el backend añade al JWT pero no está en la interfaz.
      // || 'tu negocio': valor por defecto si el campo no existe.
      const tenantName = appointment.tenant?.name || (authUser as any)?.tenantName || 'tu negocio';

      // Si la cita tiene anticipo pendiente, mandamos el mensaje de SOLICITUD de
      // anticipo (monto + instrucciones de transferencia) en vez del recordatorio
      // normal de confirmación.
      const msg = depositPending
        ? buildDepositRequestMessage({
            clientFirstName: appointment.client.firstName,
            tenantName,
            amount: depositRemaining,
            instructions: appointment.tenant?.depositInstructions,
            serviceName: appointment.items?.[0]?.serviceNameSnapshot,
            startTime: appointment.startTime,
            token: res.data.token,
          })
        : buildReminderMessage({
            clientFirstName: appointment.client.firstName,
            tenantName,
            serviceName: appointment.items?.[0]?.serviceNameSnapshot, // Primer servicio
            employeeFirstName: appointment.employee?.firstName,
            startTime: appointment.startTime,
            token: res.data.token, // Para el link de confirmación
          });

      // buildWhatsAppUrl arma la URL wa.me/52XXXXXXXXXX?text=...
      const url = buildWhatsAppUrl(appointment.client.phone, msg);
      // window.open abre WhatsApp en una nueva pestaña del navegador.
      if (url) window.open(url, '_blank');

      // Invalida el cache para que el badge "Recordatorio enviado" aparezca.
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['reminders-pending'] });
    } finally {
      setSendingReminder(false);
    }
  };

  // Tras finalizar mostramos un prompt para encadenar el cobro en el POS.
  // true = muestra el panel "¿Deseas cobrar ahora? → Proceder al pago / Cerrar".
  const [showPayPrompt, setShowPayPrompt] = useState(false);

  // Marca la cita como COMPLETED (finalizada).
  // Después muestra el panel "¿Proceder al pago?" en vez de cerrar.
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

  // Registra si el cliente autoriza (true) o no (false) el uso de sus fotos
  // en el portafolio del negocio. Es un paso obligatorio antes de "Finalizar".
  // Consentimiento del cliente para fotos del resultado. Bloquea la
  // finalización de la cita hasta que el cajero registre la respuesta.
  // - true  → habilita la subida de fotos (y obliga al menos una)
  // - false → omite las fotos del resultado
  const consentMutation = useMutation({
    // mutationFn recibe el booleano (true/false) como parámetro.
    mutationFn: (consent: boolean) =>
      api.post(`/api/appointments/${appointmentId}/photo-consent`, { consent }),
    onSuccess: () => {
      // Recarga la cita para que photoConsent actualice la UI.
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al registrar el consentimiento');
    },
  });

  // Confirma una cita pendiente (cambia estado PENDING → CONFIRMED).
  // Nota: actualmente canConfirm = false porque las citas se auto-confirman;
  // este mutation existe para el caso en que se reactive la confirmación manual.
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

  // confirmDepositMutation: el negocio confirma el anticipo (aceptar / solicitar
  // el resto / omitir). action determina el comportamiento en el backend.
  const confirmDepositMutation = useMutation({
    mutationFn: (body: { amount: number; action: 'accept' | 'request_remainder' | 'waive' }) =>
      api.post(`/api/appointments/${appointmentId}/confirm-deposit`, body),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      setShowDepositForm(false);
      // "Solicitar el resto" abre WhatsApp pidiendo el restante al cliente.
      if (vars.action === 'request_remainder') {
        const phone = (appointment as any)?.client?.phone;
        const url = phone && buildWhatsAppUrl(phone, buildDepositRemainderMessage({
          clientFirstName: appointment?.client?.firstName || '',
          tenantName: appointment?.tenant?.name || (authUser as any)?.tenantName || '',
          paid: vars.amount,
          remaining: Math.max(0, depositRemaining - vars.amount),
        }));
        if (url) window.open(url, '_blank');
        onSave();
      } else {
        onSave();
      }
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al confirmar el anticipo');
    },
  });

  // noShowMutation: marca al cliente como ausente (no se presentó a la cita).
  const noShowMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointmentId}/no-show`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      onSave();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al marcar como ausente');
    },
  });

  // Reagenda la cita a una nueva hora (elegida en el AvailabilityPicker del
  // modo reschedule). Envía solo el nuevo startTime; el backend calcula endTime.
  const rescheduleMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointmentId}/reschedule`, {
        startTime: newStartTime, // La nueva hora elegida por el cajero
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      setRescheduleMode(false); // Cierra el panel de reagendamiento
      onSave();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al reagendar la cita');
    },
  });

  // Consulta la disponibilidad del mismo profesional inmediatamente después
  // de la hora de fin de la cita actual. Así el cajero puede agregar servicios
  // adicionales en el mismo turno, sin conflictos de horario.
  // Es una función async (asíncrona): usa await para esperar la respuesta del
  // servidor antes de continuar.
  async function handleCheckAfter() {
    // Guardas: si no hay cita cargada o no se seleccionaron nuevos servicios, salimos.
    if (!appointment || newServiceIds.length === 0) return;
    setCheckingAvailability(true); // Muestra spinner mientras espera
    setAddServiceError(null);      // Limpia errores previos
    setCheckAfterResult(null);     // Limpia resultado previo
    try {
      // api.post hace una petición HTTP POST al endpoint check-after.
      // Enviamos: el empleado, los servicios nuevos, y la hora de fin actual.
      const result = await api.post<{ data: CheckAfterResult }>(
        '/api/availability/check-after',
        {
          employeeId: appointment.employeeId,
          serviceIds: newServiceIds,
          afterTime: appointment.endTime, // La cita nueva empieza donde termina la actual
        },
      );
      // Guardamos el resultado: contiene el slot disponible más próximo.
      setCheckAfterResult(result.data);
    } catch (err: any) {
      // Si el servidor devuelve error, mostramos el mensaje.
      // (err: any) tipamos como any para acceder a .message sin error TS.
      setAddServiceError(err.message || 'Error al verificar disponibilidad');
    } finally {
      // finally: se ejecuta SIEMPRE (haya error o no), para quitar el spinner.
      setCheckingAvailability(false);
    }
  }

  // Cada vez que cambia la lista de nuevos servicios (o se activa addServicesMode),
  // lanzamos automáticamente la verificación de disponibilidad.
  // El comentario eslint-disable suprime la advertencia de que handleCheckAfter
  // no está en las dependencias (es seguro porque la función no cambia entre renders).
  // Auto-check availability when services change in add-services mode
  useEffect(() => {
    if (addServicesMode && newServiceIds.length > 0 && appointment) {
      // Si estamos en modo agregar servicios y hay servicios elegidos → verificar.
      handleCheckAfter();
    } else {
      // Si quitamos todos los servicios o salimos del modo → borrar el resultado.
      setCheckAfterResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newServiceIds, addServicesMode]); // Se ejecuta cuando cambia alguno de estos

  // Confirma la creación de la cita adicional con el slot calculado por el backend.
  // startTime viene del CheckAfterResult: la hora de inicio disponible más próxima.
  function handleConfirmAddServices(startTime: string) {
    if (!appointment) return;
    // Buscamos los datos del profesional actual para obtener su locationId.
    const employee = employees.find((e) => e.id === appointment.employeeId);
    if (!employee?.locationId) {
      // ?. : acceso seguro — si employee es undefined, no lanza error.
      setAddServiceError('El profesional no tiene ubicación asignada');
      return;
    }
    // Disparamos la mutación para crear la cita adicional.
    addServicesMutation.mutate({
      clientId: appointment.clientId,     // Mismo cliente
      employeeId: appointment.employeeId, // Mismo profesional
      locationId: employee.locationId,    // Misma ubicación
      startTime,                          // Slot calculado por el backend
      serviceIds: newServiceIds,          // Los servicios adicionales elegidos
    });
  }

  // Crea una cita nueva. Recibe el evento del formulario (e: React.FormEvent)
  // para poder llamar e.preventDefault() y evitar que la página se recargue.
  function handleCreate(e: React.FormEvent) {
    // Previene el comportamiento por defecto del formulario HTML (recargar la página).
    e.preventDefault();
    // Validaciones: si falta algún campo obligatorio, mostramos error y salimos.
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
    // Todo OK: disparamos la mutación con todos los datos necesarios.
    createMutation.mutate({
      clientId: selectedClientId,
      employeeId: selectedEmployeeId,
      locationId: selectedEmployee.locationId,
      startTime: selectedStartTime,
      serviceIds: selectedServiceIds,
      notes, // Notas opcionales del cajero
    });
  }

  // ── Flags derivados del estado de la cita ─────────────────────────────────
  // statusLower: el estado en minúsculas para comparaciones uniformes.
  // appointment?.status?.toLowerCase() : doble ?. por si appointment o status es undefined.
  // || '' : si es undefined/null, usamos cadena vacía (evita errores en .includes()).
  const statusLower = appointment?.status?.toLowerCase() || '';

  // canCancel: ¿se puede cancelar la cita? Solo si está en uno de estos estados.
  // appointment && [...].includes(statusLower): evaluación corta — si appointment
  // es null/undefined, la expresión es falsa sin evaluar el .includes().
  // Cada flag combina el ESTADO de la cita con el PERMISO del usuario, para que
  // un empleado vea solo las acciones que puede ejecutar. Cancelar requiere
  // appointments.cancel (el rol staff NO lo tiene → se oculta "Cancelar cita").
  const canCancel =
    appointment &&
    ['pending', 'confirmed', 'rescheduled'].includes(statusLower) &&
    hasPermission('appointments.cancel');

  // canComplete: ¿se puede finalizar? Solo si está en progreso o confirmada.
  const canComplete =
    appointment &&
    ['confirmed', 'in_progress'].includes(statusLower) &&
    hasPermission('appointments.complete');

  // canReschedule: ¿se puede reagendar? Mismos estados que cancelar.
  const canReschedule =
    appointment &&
    ['pending', 'confirmed', 'rescheduled'].includes(statusLower) &&
    hasPermission('appointments.reschedule');

  // canConfirm: siempre false porque las citas se auto-confirman al crearlas.
  const canConfirm = false; // Citas se auto-confirman al crearse

  // canAddServices: ¿se puede agregar más servicios? No si ya está cancelada/completada.
  const canAddServices =
    appointment &&
    ['confirmed', 'rescheduled', 'in_progress'].includes(statusLower) &&
    hasPermission('appointments.create');

  // canNoShow: marcar "Ausente". Mismo permiso que finalizar (es un desenlace).
  const canNoShow =
    appointment &&
    ['pending', 'confirmed', 'rescheduled', 'in_progress'].includes(statusLower) &&
    hasPermission('appointments.complete');

  // ── Cálculos financieros ──────────────────────────────────────────────────
  // Nota: estos valores se calculan en el FRONTEND como resumen para mostrar.
  // Los totales definitivos para el cobro siempre los calcula el backend.

  // reservationsTotal: suma del costo de los productos apartados (reservas de inventario).
  // .reduce(acumulador, valorInicial) itera el array sumando un valor por elemento.
  // Si res.status === 'CANCELLED' → ese apartado no se cobra (se excluye sumando 0).
  // res.unitPrice || 0: si unitPrice es null/undefined, usa 0.
  // res.quantity || 1: si quantity es null/undefined, asume 1 unidad.
  // ?? 0 al final: si productReservations es null/undefined, el .reduce no existe → usa 0.
  const reservationsTotal = appointment?.productReservations?.reduce(
    (sum, res) =>
      res.status === 'CANCELLED' ? sum : sum + Number(res.unitPrice || 0) * (res.quantity || 1),
    0,
  ) ?? 0;

  // totalPrice: suma de los precios SNAPSHOT de cada ítem de servicio.
  // priceSnapshot es el precio que tenía el servicio al MOMENTO de la reserva
  // (no el precio actual, que puede haber cambiado).
  const totalPrice = appointment?.items?.reduce(
    (sum, item) => sum + Number(item.priceSnapshot || 0),
    0,
  ) ?? 0;

  // totalDuration: duración total acumulada de todos los servicios (en minutos).
  const totalDuration = appointment?.items?.reduce(
    (sum, item) => sum + Number(item.durationSnapshot || 0),
    0,
  ) ?? 0;

  // discount: monto de descuento aplicado (puede venir de un cupón o manual).
  // Number(...): convierte el valor a número (por si viene como string del backend).
  // || 0: si discountAmount es null/undefined/falsy, usamos 0.
  const discount = Number(appointment?.discountAmount || 0);

  // pointsSpent: puntos de fidelidad que el cliente usó para pagar.
  const pointsSpent = Number(appointment?.pointsSpent || 0);

  // paidWithPoints: true si el cliente pagó todo con puntos (pointsSpent > 0).
  // En ese caso los servicios son gratis; solo se cobran los apartados de productos.
  const paidWithPoints = pointsSpent > 0;

  // subtotalServicios: total de los servicios (alias de totalPrice para claridad).
  const subtotalServicios = totalPrice;

  // subtotalApartados: total de los productos apartados (inventario reservado).
  const subtotalApartados = reservationsTotal;

  // subtotal: suma de servicios + apartados (antes de descuentos).
  const subtotal = subtotalServicios + subtotalApartados;

  // finalTotal: el importe real que debe pagar el cliente.
  // - Si pagó con puntos (paidWithPoints = true): los servicios son $0; solo
  //   paga los apartados. Math.max(0, ...) evita totales negativos.
  // - Si no pagó con puntos: subtotal − descuento (con piso en 0).
  // Si pagó con puntos, los servicios cuestan 0; los apartados se mantienen en efectivo.
  const baseTotal = paidWithPoints
    ? Math.max(0, subtotalApartados)
    : Math.max(0, subtotal - discount);

  // Anticipo: monto ya pagado (prepago) y monto solicitado/restante.
  const depositPaidNum = Math.max(0, Number(appointment?.depositPaid ?? 0));
  const depositAmountNum = Math.max(0, Number(appointment?.depositAmount ?? 0));
  // ¿Falta confirmar el anticipo? (lo requiere, no exonerado, no cubierto y la
  // cita está pendiente). Para mostrar el botón "Confirmar anticipo".
  const depositPending =
    !!appointment?.depositRequired &&
    !appointment?.depositWaived &&
    ['pending', 'rescheduled'].includes(statusLower) &&
    depositPaidNum < depositAmountNum;
  const depositRemaining = Math.max(0, depositAmountNum - depositPaidNum);

  // finalTotal: lo que se cobra al cierre = base − anticipo ya pagado.
  const finalTotal = Math.max(0, baseTotal - depositPaidNum);

  // Devuelve el nombre completo del cliente pre-cargado para mostrarlo en el input.
  // Si se pasó initialClientId (desde el calendario), lo buscamos en los resultados
  // de búsqueda o en initialClientData (carga directa por ID).
  // Si no, buscamos el selectedClientId en los resultados actuales.
  // Get the display name for pre-filled client
  const getPrefilledClientName = () => {
    if (initialClientId) {
      const fromSearch = clientResults.find((c) => c.id === initialClientId);
      if (fromSearch) return `${fromSearch.firstName} ${fromSearch.lastName}`;
      if (initialClientData?.data) {
        const c = initialClientData.data;
        return `${c.firstName} ${c.lastName}`;
      }
      return 'Cliente seleccionado'; // Fallback mientras carga
    }
    const found = clientResults.find((c) => c.id === selectedClientId);
    return found ? `${found.firstName} ${found.lastName}` : 'Cliente seleccionado';
  };

  // Título del modal: varía según si estamos editando o creando.
  // isEditing: true si se pasó un appointmentId (modo vista/edición de cita existente).
  // loadingAppointment: true mientras se carga la cita del backend.
  // ?? '': si client firstName/lastName es null/undefined → cadena vacía (sin error).
  const modalTitle = isEditing
    ? loadingAppointment
      ? 'Cargando...'
      : `Cita — ${appointment?.client?.firstName ?? ''} ${appointment?.client?.lastName ?? ''}`
    : 'Nueva Cita';

  // ── JSX: la UI que renderiza el componente ───────────────────────────────
  // return devuelve la estructura visual (JSX). React la convierte en HTML real.
  // Todo lo que está dentro del return() se "pinta" en pantalla.
  return (
    // DetailSheet es el componente de panel deslizante (drawer) del sistema.
    // Recibe: title, onClose (función para cerrar), size ("lg" = ancho grande).
    <DetailSheet
      title={modalTitle}
      onClose={onClose}
      size="lg"
    >
      {/* Renderizado condicional con ternario: si isEditing → modo vista,
          si no → modo creación (formulario). */}
      {isEditing ? (
        // ── MODO VISTA: ver/gestionar cita existente ──────────────────────
        // Otro ternario anidado: si está cargando → skeleton, si no → contenido.
        loadingAppointment ? (
          // Skeleton: 4 rectángulos animados mientras carga la cita.
          // Array.from({ length: 4 }) crea un array de 4 elementos vacíos.
          // .map((_, i) => ): _ ignora el elemento (no lo usamos), i es el índice.
          // key={i} es obligatorio en listas; usamos el índice porque son estáticos.
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-[var(--bg-muted)] rounded animate-pulse" />
            ))}
          </div>
        ) : appointment ? (
          // ── Cita cargada: mostrar todos sus datos ─────────────────────
          <div className="space-y-5">
            {/* Renderizado condicional con &&: si formError tiene valor →
                muestra el banner de error rojo. Si está vacío → no muestra nada. */}
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {formError}
              </div>
            )}

            {/* Fila de estado y rango horario de la cita.
                AppointmentStatusBadge muestra la pastilla coloreada (PENDING, CONFIRMED…).
                formatDate convierte la ISO a "Lun 10 Jun 2026".
                formatBookingTime → formatTime convierte la hora "UTC raw" a "10:30 AM". */}
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

            {/* Grid 2 columnas: datos del cliente (izquierda) y del profesional (derecha).
                grid-cols-2: divide el espacio en 2 columnas iguales. */}
            {/* Client & Employee */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  Cliente
                </p>
                {/* Ternario: si existe el cliente → muestra avatar+nombre, si no → guión. */}
                {appointment.client ? (
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Avatar del cliente: si tiene foto → img, si no → iniciales.
                        (appointment.client as any) fuerza el tipo a "any" para acceder
                        a avatarUrl que no está en la interfaz Client básica.
                        firstName?.[0] : primera letra del nombre (?. evita error si es null).
                        ?? '' : si es null, usa cadena vacía. */}
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
                      {/* && : solo muestra el email si existe. */}
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

            {/* Bloque de servicios: solo se renderiza si hay ítems en la cita.
                appointment.items && appointment.items.length > 0 : doble guarda:
                  1. items existe (no es null/undefined)
                  2. el array tiene al menos 1 elemento. */}
            {/* Services */}
            {appointment.items && appointment.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Servicios
                </p>
                <div className="bg-[var(--bg-subtle)] rounded-lg p-3 space-y-2">
                  {/* Lista de ítems: .map() devuelve un <div> por cada servicio.
                      key={item.id}: clave única para que React identifique cambios. */}
                  {appointment.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center"
                    >
                      <div>
                        {/* serviceNameSnapshot: el nombre tal como estaba al reservar
                            (aunque el negocio haya cambiado el nombre después). */}
                        <span className="text-sm text-[var(--text-secondary)]">
                          {item.serviceNameSnapshot}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">
                          {item.durationSnapshot} min
                        </span>
                      </div>
                      {/* formatCurrency formatea el número con el símbolo monetario del tenant. */}
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {formatCurrency(Number(item.priceSnapshot))}
                      </span>
                    </div>
                  ))}
                  {/* Línea de subtotal de servicios con la duración total acumulada. */}
                  <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      Subtotal servicios ({totalDuration} min)
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {formatCurrency(subtotalServicios)}
                    </span>
                  </div>
                  {/* Solo muestra la fila de apartados si hay alguno (subtotalApartados > 0). */}
                  {subtotalApartados > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-secondary)]">Apartados (productos)</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{formatCurrency(subtotalApartados)}</span>
                    </div>
                  )}
                  {/* Solo muestra el cupón si la cita tiene redemption (canje activo). */}
                  {appointment.redemption && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-teal-700">
                        Cupón <span className="font-mono">{appointment.redemption.code}</span> · {appointment.redemption.reward.name}
                      </span>
                      {/* Muestra el monto ahorrado solo si el descuento es mayor a 0. */}
                      {discount > 0 && (
                        <span className="text-sm font-medium text-teal-700">-{formatCurrency(discount)}</span>
                      )}
                    </div>
                  )}
                  {/* Descuento manual (sin cupón): solo si discount > 0 Y no hay redemption. */}
                  {discount > 0 && !appointment.redemption && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-green-600">Descuento aplicado</span>
                      <span className="text-sm font-medium text-green-600">-{formatCurrency(discount)}</span>
                    </div>
                  )}
                  {/* Pago con puntos: solo si paidWithPoints es true (pointsSpent > 0). */}
                  {paidWithPoints && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-teal-700">Pagado con puntos</span>
                      <span className="text-sm font-medium text-teal-700">{pointsSpent} pts</span>
                    </div>
                  )}
                  {/* Anticipo ya pagado: prepago que se descuenta del total. */}
                  {depositPaidNum > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-green-600">Anticipo pagado</span>
                      <span className="text-sm font-medium text-green-600">-{formatCurrency(depositPaidNum)}</span>
                    </div>
                  )}
                  {/* CTA agregar servicios — entre el último concepto y el
                      "Total a cobrar", donde es más natural ampliar el ticket. */}
                  {/* Botón "Agregar servicios": visible si la cita está activa y
                      no estamos ya en modo de agregar servicios. */}
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
                  {/* Total final en teal. finalTotal ya tiene descuentos y puntos aplicados. */}
                  <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                    <span className="text-sm font-bold text-[var(--text-primary)]">Total a cobrar</span>
                    <span className="text-base font-bold text-[#008080]">{formatCurrency(finalTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bloque de apartados (productos reservados del inventario).
                Solo visible si hay al menos un productReservation en la cita. */}
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

            {/* Bloque de fotos de resultado del servicio.
                Solo aparece si la cita está en estado activo o completada.
                Tiene cuatro sub-estados según el consentimiento y las fotos:
                  1. consent null  → pedir consentimiento (Sí/No)
                  2. consent false → aviso "no autorizó" + botón "Cambiar y subir"
                  3. consent true, sin fotos → botón para subir la primera foto
                  4. con fotos → grid de miniaturas + tile "+" para agregar más */}
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
                        {isMinorClient ? (
                          <>
                            <p className="text-xs font-semibold text-gray-900 leading-tight">
                              Consentimiento del tutor · {appointment.client?.firstName} es menor de edad
                            </p>
                            <p className="text-[11px] text-gray-600 leading-snug mt-0.5">
                              El padre, madre o tutor debe confirmar que autoriza tomar fotos del trabajo y usarlas en el portafolio.
                              Se recomienda <span className="font-semibold">ocultar la cara del menor</span>.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-gray-900 leading-tight">Consentimiento del cliente</p>
                            <p className="text-[11px] text-gray-600 leading-snug mt-0.5">
                              ¿El cliente autoriza tomar fotos del resultado y usarlas en el portafolio del negocio?
                            </p>
                          </>
                        )}
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
                  <div>
                    {coverEyesToggle}
                    {photoServiceSelector}
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePickedPhoto(file, effectivePhotoServiceId);
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
                  </div>
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

                    {/* Selector de servicio para la próxima foto (2+ servicios) */}
                    {coverEyesToggle}
                    {photoServiceSelector}

                    {/* Grid de fotos + tile para añadir más al final */}
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map((photo) => {
                        const svcName = serviceNameById(photo.serviceId);
                        return (
                        <div key={photo.id} className="relative group aspect-square">
                          <img
                            src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${photo.imageUrl}`}
                            alt={photo.caption || 'Resultado'}
                            className="w-full h-full object-cover rounded-lg ring-1 ring-white"
                          />
                          {uniqueServices.length > 1 && svcName && (
                            <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[8px] leading-tight px-1 py-0.5 rounded-b-lg truncate">
                              {svcName}
                            </span>
                          )}
                          <button
                            onClick={() => handlePhotoDelete(photo.id)}
                            className="absolute top-1 right-1 bg-white text-red-500 rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow"
                            title="Eliminar"
                          >
                            &times;
                          </button>
                        </div>
                        );
                      })}
                      <label className="aspect-square rounded-lg border-2 border-dashed bg-white/60 flex items-center justify-center cursor-pointer hover:bg-white transition-colors" style={{ borderColor: '#008080' }}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePickedPhoto(file, effectivePhotoServiceId);
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

            {/* Panel para agregar servicios adicionales justo después de la cita.
                Solo visible cuando addServicesMode = true (botón "+ Agregar servicios"). */}
            {/* Add services mode */}
            {addServicesMode && (
              <div className="border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Agregar servicios
                  </p>
                  {/* Botón "Cancelar" resetea el modo y limpia los estados temporales. */}
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

                {/* Grid de checkboxes de servicios para elegir los adicionales.
                    max-h-40 overflow-y-auto: scroll si hay muchos servicios.
                    La clase dinámica usa plantilla de cadena para cambiar el estilo
                    del borde según si el servicio está seleccionado o no. */}
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
                      {/* input type="checkbox" oculto con sr-only (solo lectores de pantalla).
                          El estilo visual lo hace la <label> padre, no el checkbox nativo.
                          onChange: e.target.checked es true si el checkbox se marcó.
                            - Si se marcó → agrega el ID al array (spread + nuevo elemento).
                            - Si se desmarcó → filtra el array quitando ese ID. */}
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

            {/* Panel de reagendamiento: visible cuando rescheduleMode = true.
                Muestra el selector de fecha/hora y el botón de confirmación. */}
            {/* Reschedule mode */}
            {rescheduleMode && (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                  Reagendar cita
                </p>
                {/* AvailabilityPicker muestra el calendario y los slots disponibles.
                    serviceIds: los IDs de los servicios de los ítems de la cita.
                      appointment.items?.map(...) extrae los serviceId de cada ítem.
                      .filter((id): id is string => !!id) filtra los IDs vacíos/null.
                      El tipo (id): id is string es un "type guard" de TypeScript que
                      le dice al compilador que después del filtro todos son string.
                      || [] : si items es undefined, usa array vacío.
                    onSelect: callback llamado cuando el usuario elige un slot.
                      Guarda el nuevo start/end en el estado para usarlo en rescheduleMutation. */}
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

            {/* Formulario de cancelación: visible cuando showCancelForm = true.
                El cajero debe escribir el motivo antes de confirmar la cancelación. */}
            {/* Cancel form */}
            {/* Panel "Confirmar anticipo": el negocio captura el monto recibido
                por transferencia. Aceptar confirma la cita; Solicitar el resto
                (si recibió menos) pide el restante por WhatsApp y deja pendiente;
                Omitir exonera el anticipo y confirma. */}
            {showDepositForm && (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  Confirmar anticipo
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Anticipo solicitado: ${depositAmountNum}
                  {depositPaidNum > 0 ? ` · Ya recibido: $${depositPaidNum} · Falta: $${depositRemaining}` : ''}.
                </p>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto recibido</label>
                <div className="relative max-w-[200px] mb-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    value={depositInput}
                    onChange={(e) => setDepositInput(e.target.value)}
                    className="input-field pl-7"
                  />
                </div>
                {(() => {
                  const amt = Math.max(0, Number(depositInput) || 0);
                  const isLess = amt < depositRemaining;
                  const busy = confirmDepositMutation.isPending;
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmDepositMutation.mutate({ amount: amt, action: 'accept' })}
                          disabled={busy}
                          className="btn-primary flex-1"
                        >
                          {busy ? 'Procesando...' : 'Aceptar y confirmar'}
                        </button>
                        {isLess && (
                          <button
                            onClick={() => confirmDepositMutation.mutate({ amount: amt, action: 'request_remainder' })}
                            disabled={busy}
                            className="btn-secondary flex-1"
                          >
                            Solicitar el resto
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmDepositMutation.mutate({ amount: 0, action: 'waive' })}
                          disabled={busy}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Omitir anticipo
                        </button>
                        <button onClick={() => setShowDepositForm(false)} className="btn-secondary">
                          Volver
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {showCancelForm && (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                  Motivo de cancelacion
                </p>
                {/* Textarea controlado: value={cancelReason} + onChange actualiza el estado.
                    Así React siempre sabe qué hay en el campo (componente "controlado"). */}
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

            {/* Banner "Cita finalizada" que aparece después de completeMutation.
                Ofrece dos opciones: ir al POS a cobrar, o simplemente cerrar. */}
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
                      router.push(`${posBasePath ?? ''}/pos?appointmentId=${appointmentId}`);
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
            {!rescheduleMode && !showCancelForm && !addServicesMode && !showPayPrompt && !showDepositForm && (
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
                {/* Confirmar anticipo: si la cita lo requiere y aún no se cubre. */}
                {depositPending && (
                  <button
                    type="button"
                    onClick={() => { setDepositInput(String(depositRemaining)); setShowDepositForm(true); }}
                    className="btn-primary flex-1"
                  >
                    Confirmar anticipo
                  </button>
                )}
                {/* Recordatorio WhatsApp: solo para citas activas con
                    cliente que tiene telefono. Si ya se envio, muestra
                    "Reenviar". */}
                {!!appointment.client?.phone &&
                  ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(appointment.status.toUpperCase()) && (
                    <button
                      type="button"
                      onClick={sendReminder}
                      disabled={sendingReminder}
                      title={appointment.reminderSentAt ? 'Reenviar recordatorio' : 'Enviar recordatorio'}
                      className="flex-1 px-3 py-2 rounded-[10px] font-medium text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      {sendingReminder ? (
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                          {appointment.reminderSentAt ? 'Reenviar' : 'Recordatorio'}
                        </>
                      )}
                    </button>
                  )}
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
                {canNoShow && (
                  <button
                    onClick={() => noShowMutation.mutate()}
                    disabled={noShowMutation.isPending}
                    className="btn-secondary flex-1"
                  >
                    {noShowMutation.isPending ? 'Procesando...' : 'Ausente'}
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
          // Rama del ternario cuando appointment es null/undefined.
          // Ocurre si la cita fue eliminada o pertenece a otro tenant.
          // Cita no encontrada: pudo haber sido eliminada o pertenecer
          // a otro tenant. Damos contexto util al admin en vez de un
          // modal hueco con una linea solitaria.
          <div className="py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Esta cita ya no existe
            </p>
            <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto mb-4">
              Pudo haber sido eliminada o no está disponible para tu cuenta.
              Puedes cerrar este aviso y continuar navegando.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666]"
            >
              Cerrar
            </button>
          </div>
        )
      ) : (
        // ── MODO CREACIÓN: formulario para agendar una cita nueva ────────
        // <form onSubmit={handleCreate}> : cuando el usuario pulsa el botón
        // "Crear cita" (type="submit"), se dispara el evento "submit"
        // y React llama a handleCreate (que llama a e.preventDefault() primero).
        // Create mode
        <form onSubmit={handleCreate} className="space-y-5">
          {/* Error del formulario: solo visible si formError tiene valor. */}
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {formError}
            </div>
          )}

          {/* Búsqueda de cliente con autocompletado.
              SearchableSelect muestra un input que filtra la lista de opciones. */}
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

          {/* Selector de servicios con checkboxes. Al marcar/desmarcar:
              - Se limpia la hora seleccionada (el slot puede cambiar con distintos servicios).
              - Se agrega o quita el ID del array selectedServiceIds. */}
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
                  {/* Al cambiar la selección de servicios limpiamos la hora
                      elegida (el tiempo necesario puede ser diferente). */}
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

          {/* Selector de profesional. Solo muestra empleados que tienen AL MENOS UNO
              de los servicios seleccionados. La función IIFE (()=>{...})() calcula
              la lista filtrada inline y devuelve el JSX directamente. */}
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

          {/* Selector de fecha y hora. Solo aparece si ya se eligió al menos un servicio.
              selectedServiceIds.length > 0 && : si el array está vacío no muestra nada.
              AvailabilityPicker internamente consulta los slots disponibles y los muestra.
              onSelect: cuando el usuario elige un slot, recibimos (empId, start, end)
                - empId: el profesional asignado al slot (puede ser "" si es "cualquiera")
                - start/end: hora de inicio y fin del slot en formato "YYYY-MM-DDTHH:mm:00"
              onDateChange: se llama cuando el usuario navega a otro día;
                limpiamos el slot elegido para forzar nueva selección. */}
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

          {/* Botones de acción del formulario de creación.
              "Cancelar" (type="button") no envía el formulario.
              "Crear cita" (type="submit") dispara el evento submit → handleCreate.
              disabled: el botón queda deshabilitado mientras:
                - La mutación está en curso (isPending)
                - Falta algún campo obligatorio (cliente, servicios, hora, empleado)
              Esto evita doble-submit accidental. */}
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
              {/* Ternario: si está procesando → texto "Creando...", si no → "Crear cita". */}
              {createMutation.isPending ? 'Creando...' : 'Crear cita'}
            </button>
          </div>
        </form>
      )}

      {/* Editor para cubrir los ojos antes de subir la foto. */}
      {pendingCensor && (
        <CensorEyesModal
          imageFile={pendingCensor.file}
          onAccept={(edited) => {
            handlePhotoUpload(edited, pendingCensor.serviceId);
            setPendingCensor(null);
          }}
          onSkip={() => {
            handlePhotoUpload(pendingCensor.file, pendingCensor.serviceId);
            setPendingCensor(null);
          }}
          onCancel={() => {
            setPendingCensor(null);
            // Si veníamos del flujo "Finalizar sin foto", cancelar la censura no
            // debe encadenar el completar en la siguiente subida.
            setAutoCompleteOnNextUpload(false);
          }}
        />
      )}
    </DetailSheet>
  );
}
