// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/portal/[tenantSlug]/appointments/page.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Lista de citas del cliente en el portal de un negocio.
// URL: /portal/[tenantSlug]/appointments
//
// QUÉ MUESTRA
// -----------
// Una lista de citas dividida en dos pestañas:
//   - "Próximas": citas futuras (pendientes, confirmadas, en curso).
//   - "Pasadas": citas ya ocurridas (completadas, canceladas, ausente).
// Cada tarjeta de cita muestra: fecha, hora, profesional (con avatar),
// servicios, precio total, indicador de fotos, e invitación a dejar reseña.
//
// CÓMO OBTIENE LOS DATOS
// ----------------------
// Usa useQuery de @tanstack/react-query para hacer GET al backend.
// react-query maneja automáticamente: loading, error, caché, y revalidación.
// La query cambia según la pestaña activa (tab): ?filter=upcoming o ?filter=past.
//
// PROTECCIÓN DE RUTA
// ------------------
// useEffect verifica si el usuario está autenticado. Si no → redirige al login.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

// useQuery: hook de react-query para hacer peticiones GET y cachear el resultado.
// Cuando queryKey cambia, react-query hace una nueva petición automáticamente.
import { useQuery } from '@tanstack/react-query';
import { useClientAuth } from '@/lib/hooks/use-client-auth';

// portalApi: cliente HTTP pre-configurado con el JWT del cliente en la cabecera.
// Equivalente a creatorApi pero para el portal del cliente.
import { portalApi } from '@/lib/portal-api';

// formatCurrency: formatea un número como moneda (ej: 150 → "$150.00").
// formatDate: formatea una fecha ISO con dayjs (ej: "jue, 24 de jun").
import { formatCurrency, formatDate } from '@/lib/utils';

// dayjs: librería de fechas/horas. .utc() interpreta la fecha en UTC.
import dayjs from 'dayjs';

// PortalNav: barra de navegación inferior, importada del mismo directorio padre.
import PortalNav from '../portal-nav';

// URL del servidor de API. Si la variable de entorno no existe, usa localhost.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── INTERFACES DE TYPESCRIPT ──────────────────────────────────────────────────
// Las interfaces definen la "forma" (shape) de los objetos. TypeScript las usa
// para verificar que accedemos solo a propiedades que existen. No generan
// código JavaScript — son solo para el compilador.

// AppointmentItem: un servicio dentro de una cita (la cita puede tener varios).
// Las Snapshots guardan el precio/nombre en el MOMENTO de la reserva (aunque
// el precio del servicio cambie después, la cita guarda el precio original).
interface AppointmentItem {
  id: string;
  serviceNameSnapshot: string;   // Nombre del servicio al momento de reservar
  priceSnapshot: string | number; // Precio al momento de reservar (puede venir como string desde la API)
  durationSnapshot: number;      // Duración en minutos al momento de reservar
}

// Appointment: una cita completa con todos sus datos relacionados.
interface Appointment {
  id: string;
  startTime: string;  // ISO 8601: "2026-06-24T10:00:00Z"
  endTime: string;
  status: string;     // 'PENDING' | 'CONFIRMED' | 'COMPLETED' | etc.
  employee: {         // El profesional asignado
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;  // null si no tiene foto de perfil
    color: string;             // Color hex del profesional (para el avatar)
  };
  items: AppointmentItem[];        // Array de servicios en esta cita
  review: { id: string; rating: number } | null;  // null si aún no tiene reseña
  photos: { id: string }[];        // Fotos de resultado subidas por el staff
}

// STATUS_LABELS: diccionario de estados de cita → etiqueta visual y clases CSS.
// Patrón de "look-up table": en lugar de muchos if/else en el JSX, buscamos en
// este objeto con el estado como clave.
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En progreso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Ausente', color: 'bg-gray-100 text-gray-800' },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalAppointmentsPage() {
  // Desestructuramos del hook de auth lo que necesitamos:
  // - client: datos del cliente autenticado (nombre, email, etc.)
  // - isAuthenticated: boolean — ¿hay sesión activa?
  // - authLoading: boolean — ¿el hook aún está cargando el token guardado?
  // - tenantSlug: el identificador del negocio actual
  const { client, isAuthenticated, isLoading: authLoading, tenantSlug } = useClientAuth();
  const router = useRouter();

  // tab: controla qué pestaña está activa. 'upcoming' = próximas, 'past' = pasadas.
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  // ── EFECTO DE PROTECCIÓN DE RUTA ──────────────────────────────────────────
  // Si el usuario no está autenticado (y ya terminó de cargar el estado de auth),
  // lo enviamos al login. El array de dependencias [authLoading, isAuthenticated,
  // router, tenantSlug] hace que se verifique cada vez que alguno de esos cambia.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/portal/${tenantSlug}/login`);
    }
  }, [authLoading, isAuthenticated, router, tenantSlug]);

  // ── PETICIÓN DE CITAS CON useQuery ────────────────────────────────────────
  // useQuery: hook principal de react-query para GET requests.
  //
  // queryKey: array que identifica esta query de forma única.
  //   ['portal-appointments', tab]: cuando tab cambia (de 'upcoming' a 'past'),
  //   la key cambia → react-query hace UNA NUEVA petición automáticamente.
  //
  // queryFn: la función que HACE la petición. Se ejecuta cuando la key cambia
  //   o cuando react-query decide revalidar el caché.
  //
  // enabled: SI es false, react-query NO hace la petición. Aquí: solo hacemos
  //   la petición si el usuario está autenticado (tiene token válido).
  const { data, isLoading } = useQuery({
    queryKey: ['portal-appointments', tab],
    queryFn: () =>
      portalApi.get<{ data: Appointment[] }>(`/appointments?filter=${tab}`),
    enabled: isAuthenticated,
  });

  // Extraemos el array de citas de la respuesta.
  // (data as any): cast a any porque TypeScript no siempre infiere bien el tipo.
  // ?.data: optional chaining — si data es undefined (aún cargando), no lanza error.
  // || []: si ?.data es undefined, usamos array vacío (evita crashes al iterar).
  const appointments = (data as any)?.data || [];

  // ── RENDERS CONDICIONALES TEMPRANOS ──────────────────────────────────────
  // Spinner mientras el contexto de auth está cargando (verificando token).
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {/* Spinner CSS: círculo que rota (animate-spin). Tailwind lo hace fácil. */}
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // Si no está autenticado después de cargar → no renderizamos nada.
  // El useEffect de arriba ya habrá iniciado la redirección al login.
  if (!isAuthenticated) return null;

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  return (
    // pb-20: padding inferior de 80px para que el PortalNav no tape el contenido.
    <div className="pb-20">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 pt-6 pb-4">
        {/* client?.firstName: optional chaining — si client es null (raro),
            no lanza error. Muestra solo el nombre de pila. */}
        <h1 className="text-xl font-bold text-gray-900">
          Hola, {client?.firstName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Tus citas</p>
      </div>

      {/* SELECTOR DE PESTAÑAS */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1">
        {/* Iteramos 'as const' para preservar los tipos literales exactos */}
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                // Pestaña activa: línea inferior indigo + texto indigo
                ? 'border-indigo-600 text-indigo-600'
                // Pestaña inactiva: sin línea + texto gris
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'upcoming' ? 'Próximas' : 'Pasadas'}
          </button>
        ))}
      </div>

      {/* LISTA DE CITAS */}
      <div className="px-4 py-4 space-y-3">
        {/* RENDERIZADO CONDICIONAL CON MÚLTIPLES CASOS:
            Primero verificamos si está cargando.
            Si no carga pero no hay citas → mensaje vacío.
            Si hay citas → las renderizamos. */}
        {isLoading ? (
          // Estado de carga de la lista (diferente al authLoading)
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : appointments.length === 0 ? (
          // Estado vacío: mensaje diferente según la pestaña activa
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">
              {/* Ternario: mensaje específico según la pestaña */}
              {tab === 'upcoming'
                ? 'No tienes citas próximas'
                : 'No tienes citas pasadas'}
            </p>
            {/* Solo mostramos el botón de reservar en la pestaña de próximas,
                ya que no tendría sentido reservar desde "pasadas". */}
            {tab === 'upcoming' && (
              <button
                onClick={() => router.push(`/portal/${tenantSlug}/book`)}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Reservar cita
              </button>
            )}
          </div>
        ) : (
          // Iteramos el array de citas. apt = cada cita individual.
          appointments.map((apt: Appointment) => {
            // Buscamos el label y color del estado en el diccionario.
            // || STATUS_LABELS.PENDING: valor por defecto si el estado no está mapeado.
            const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;

            // Calculamos el precio total sumando los precios de todos los servicios.
            // .reduce((acumulador, elemento) => nueva_suma, valor_inicial):
            // recorre el array acumulando la suma. Empezamos en 0.
            // Number(i.priceSnapshot): convierte a número (puede venir como string).
            const totalPrice = apt.items.reduce(
              (sum: number, i: AppointmentItem) => sum + Number(i.priceSnapshot),
              0,
            );

            return (
              // Cada cita es un botón clicable que navega al detalle.
              // key={apt.id}: identificador único para React.
              // text-left: los botones son inline-center por defecto; esto lo alinea a la izquierda.
              <button
                key={apt.id}
                onClick={() =>
                  router.push(`/portal/${tenantSlug}/appointments/${apt.id}`)
                }
                className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-sm transition-shadow"
              >
                {/* FILA 1: fecha/hora + badge de estado */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {/* formatDate: formatea con dayjs. 'ddd, D [de] MMM' produce
                        "jue, 24 de jun". Los corchetes en dayjs escapan texto literal. */}
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(apt.startTime, 'ddd, D [de] MMM')}
                    </p>
                    {/* dayjs.utc(): interpreta la fecha como UTC (sin conversión de zona horaria).
                        .format('h:mm A'): formato 12h con AM/PM. */}
                    <p className="text-xs text-gray-500">
                      {dayjs.utc(apt.startTime).format('h:mm A')} -{' '}
                      {dayjs.utc(apt.endTime).format('h:mm A')}
                    </p>
                  </div>
                  {/* Badge de estado: usa las clases del diccionario STATUS_LABELS */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>

                {/* FILA 2: avatar del profesional + nombre + servicios */}
                <div className="flex items-center gap-3 mb-2">
                  {/* Avatar del empleado: círculo de color con foto o iniciales */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                    style={{ backgroundColor: apt.employee.color }}
                  >
                    {/* Renderizado condicional:
                        Si tiene avatarUrl → mostramos la foto.
                        Si no → mostramos las iniciales (primera letra de nombre y apellido). */}
                    {apt.employee.avatarUrl ? (
                      <img src={`${API_URL}${apt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      // <> fragment: agrupa los dos caracteres sin añadir nodo DOM
                      <>{apt.employee.firstName[0]}{apt.employee.lastName[0]}</>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {apt.employee.firstName} {apt.employee.lastName}
                    </p>
                    {/* Nombres de servicios separados por coma.
                        .map(i => i.serviceNameSnapshot): extrae solo los nombres.
                        .join(', '): los une con ", " entre ellos. */}
                    <p className="text-xs text-gray-500">
                      {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
                    </p>
                  </div>
                </div>

                {/* FILA 3: precio + indicadores opcionales */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">
                    {formatCurrency(totalPrice)}
                  </span>
                  {/* Muestra indicador de fotos solo si hay al menos una foto */}
                  {apt.photos.length > 0 && (
                    <span className="text-indigo-600">
                      {/* Pluralización manual: "1 foto" vs "2 fotos" */}
                      {apt.photos.length} foto{apt.photos.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {/* Invitación a reseña: solo si completada Y sin reseña aún */}
                  {apt.status === 'COMPLETED' && !apt.review && (
                    <span className="text-amber-600 font-medium">Dejar reseña</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Barra de navegación inferior — siempre visible en esta página */}
      <PortalNav />
    </div>
  );
}
