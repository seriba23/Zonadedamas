// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/profile/page.tsx
// ROL: Página de perfil del usuario cliente en el marketplace.
//
// ¿Qué muestra?
//   1. Hero Card: avatar, nombre, email, proveedor social (si aplica).
//   2. Grid de estadísticas: total servicios, favoritos, galería.
//   3. Galería de fotos de resultados (opcional, toggle).
//   4. Botones: "Cambiar perfil" y "Cerrar sesión".
//   5. Lightbox al hacer click en una foto de la galería.
//
// Componentes auxiliares definidos en este archivo:
//   - AppointmentCard: tarjeta de una cita (usada en el perfil).
//   - GalleryLightbox: modal para ver una foto a tamaño grande.
//   - ProfileCouponCard: tarjeta de cupón en el perfil.
// ============================================================

// 'use client': usa hooks de React y Next.js → se ejecuta en el navegador.
'use client';

// useState: estado local (sección activa, foto del lightbox, GPS...).
// useEffect: efectos secundarios (GPS, redirección si no autenticado).
import { useState, useEffect } from 'react';

// useRouter: para navegar a otras páginas del marketplace.
import { useRouter } from 'next/navigation';

// Link: para navegación declarativa con <Link href="...">.
import Link from 'next/link';

// useQuery: para pedir datos a la API (stats, galería, recompensas, favoritos).
// useMutation: para operaciones de escritura.
// useQueryClient: para invalidar queries.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// dayjs: librería de manejo de fechas, más moderna que moment.js.
// 'dayjs/locale/es': importa la localización en español para dayjs.
import dayjs from 'dayjs';
import 'dayjs/locale/es';

// useMarketplaceAuth: contexto de autenticación del marketplace.
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

// signOutAll: cierra TODAS las sesiones del sistema (admin, staff, marketplace, portal).
import { signOutAll } from '@/lib/sign-out-all';

// marketplaceApi: cliente HTTP del marketplace con auth automática.
import { marketplaceApi } from '@/lib/marketplace-api';

// formatCurrency: formatea números como moneda. Ej: 1200 → "$1,200 MXN".
// resolveImageUrl: convierte rutas relativas de imágenes en URLs absolutas.
import { formatCurrency, resolveImageUrl } from '@/lib/utils';

// Avatar: componente que muestra foto o iniciales coloreadas del usuario.
import { Avatar } from '@/components/ui/avatar';

// Activamos la localización en español para todas las fechas con dayjs.
dayjs.locale('es');

// ─── Constantes de configuración ─────────────────────────────────────
// URL base de la API para construir URLs absolutas de imágenes.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Colores del tema. Constantes para evitar repetición y errores de tipeo.
const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

// ─── Función: formatExpiry ─────────────────────────────────────────
// Formatea una fecha ISO a un formato legible en español.
// Ej: "2026-07-15T00:00:00.000Z" → "15 jul 2026".
// Si dateStr es null → devuelve null (sin fecha de vencimiento).
function formatExpiry(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Función: daysLeft ─────────────────────────────────────────────
// Calcula cuántos días faltan hasta una fecha dada.
// Devuelve null si dateStr es null; 0 o negativo si ya venció.
// Ej: fecha = mañana → 1. Fecha = ayer → -1.
function daysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null;
  // Date.getTime() devuelve milisegundos desde epoch (1 ene 1970).
  // Restamos fecha futura - fecha actual = diferencia en ms.
  const diff = new Date(dateStr).getTime() - Date.now();
  // Convertimos ms a días y redondeamos hacia arriba (Math.ceil).
  // 1000ms * 60s * 60min * 24h = ms en un día.
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Configuración de colores y etiquetas por estado de cita ────────
// Objeto que mapea cada estado de cita a su label y clases Tailwind de color.
// Record<string, ...>: tipo TypeScript para un objeto con claves string.
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-50 text-yellow-700' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-50 text-blue-700' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-50 text-orange-700' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-50 text-purple-700' },
  COMPLETED: { label: 'Completada', color: 'bg-green-50 text-green-700' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-50 text-red-700' },
  NO_SHOW: { label: 'Ausente', color: 'bg-gray-100 text-gray-600' },
};

// ─── Interfaz: Appointment ─────────────────────────────────────────
// Estructura de una cita tal como la devuelve la API del marketplace.
interface Appointment {
  id: string;
  startTime: string;  // ISO 8601, UTC. Ej: "2026-06-20T14:00:00.000Z".
  endTime: string;
  status: string;     // 'PENDING' | 'CONFIRMED' | 'COMPLETED' | etc.
  tenant: {           // El negocio donde se hace la cita.
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    address?: string | null;
    locations?: { id: string; name: string; address?: string | null; latitude?: number | null; longitude?: number | null }[];
  };
  employee: {         // El profesional que atiende.
    id: string;
    firstName: string;
    lastName: string;
    color: string;    // Color del empleado (para el avatar).
    avatarUrl: string | null;
  };
  items: {            // Servicios incluidos en la cita (snapshot al momento de reservar).
    id: string;
    serviceNameSnapshot: string;  // Nombre del servicio al momento de reservar.
    priceSnapshot: string | number; // Precio al momento de reservar.
    durationSnapshot: number;       // Duración en minutos al momento de reservar.
  }[];
  payments?: {        // Pagos asociados (puede no haber aún).
    id: string;
    status: string;   // 'COMPLETED' | 'PENDING' | 'REFUNDED'.
    paymentMethod: string;
    totalAmount: string | number;
  }[];
}

// ─── Interfaz: GalleryCategory ─────────────────────────────────────
// Fotos de resultados agrupadas por categoría de servicio.
interface GalleryCategory {
  name: string;    // Nombre de la categoría (ej: "Cortes de cabello").
  photos: {
    id: string;
    imageUrl: string;    // Ruta relativa de la imagen (se prefija con API_URL).
    serviceName: string; // Nombre del servicio que originó la foto.
    date: string;        // Fecha de la foto.
    tenantName: string;  // Nombre del negocio.
    tenantSlug: string;  // Slug para navegar al negocio.
  }[];
}

// ─── Interfaz: FavoriteBusiness ────────────────────────────────────
// Datos básicos de un negocio favorito (para contar y listar).
interface FavoriteBusiness {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  businessType: string | null;
  address: string | null;
  averageRating: number | null;
  totalReviews: number;
}

// ─── Interfaz: Stats ────────────────────────────────────────────────
// Estadísticas del usuario para el grid del perfil.
interface Stats {
  totalServices: number;  // Total de servicios recibidos.
  totalPoints: number;    // Puntos acumulados (recompensas).
  totalPhotos: number;    // Fotos de resultados disponibles.
}

// ─── Helpers ───────────────────────────────────────────

// relativeTime: convierte una fecha ISO en texto relativo amigable.
// Devuelve { label: string, urgent: boolean }.
//   urgent=true → se mostrará en rojo (cita inmediata o muy próxima).
function relativeTime(isoString: string): { label: string; urgent: boolean } {
  const now = dayjs();
  const dt = dayjs(isoString);
  // diff() calcula la diferencia entre dos fechas en la unidad indicada.
  const diffMins = dt.diff(now, 'minute');
  const diffHours = dt.diff(now, 'hour');
  const diffDays = dt.diff(now, 'day');

  // Ramas condicionales para diferentes rangos de tiempo:
  if (diffMins < 0) return { label: 'Ahora', urgent: true };         // Ya pasó o está ocurriendo.
  if (diffMins < 60) return { label: `En ${diffMins} min`, urgent: true }; // Menos de 1 hora.
  if (diffHours < 24) return { label: `Hoy a las ${dt.format('h:mm A')}`, urgent: true }; // Hoy.
  if (diffDays === 1) return { label: `Mañana a las ${dt.format('h:mm A')}`, urgent: false }; // Mañana.
  if (diffDays <= 6) return { label: `En ${diffDays} días`, urgent: false }; // Esta semana.
  return { label: dt.format('D [de] MMM'), urgent: false }; // Ej: "15 de jul".
}

// calcDistanceKm: calcula la distancia en km entre dos puntos GPS
// usando la fórmula de Haversine (distancia en esfera terrestre).
// Devuelve null si no tenemos las coordenadas necesarias.
function calcDistanceKm(
  userGps: { lat: number; lng: number } | null,
  lat?: number | null,
  lng?: number | null,
): number | null {
  // Si falta alguna coordenada → no podemos calcular.
  if (!userGps || !lat || !lng) return null;
  const R = 6371; // Radio de la Tierra en km.
  // Convertimos diferencias de grados a radianes (Math.PI / 180).
  const dLat = ((lat - userGps.lat) * Math.PI) / 180;
  const dLng = ((lng - userGps.lng) * Math.PI) / 180;
  // Fórmula de Haversine: calcula la distancia en la superficie de una esfera.
  const a =
    Math.sin(dLat / 2) ** 2 + // ** es operador de potencia (al cuadrado).
    Math.cos((userGps.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Componente: AppointmentCard ────────────────────────────────────
// Muestra una tarjeta de cita con:
//   - Logo y nombre del negocio + estado de pago + estado de la cita.
//   - Fecha, hora, duración total.
//   - Avatar y nombre del empleado + servicios + precio total.
//   - Badge de tiempo relativo (ej: "Mañana a las 3:00 PM").
//   - Distancia al negocio (si tenemos GPS del usuario).
//
// PROPS:
//   apt: Appointment → los datos de la cita.
//   userGps: coordenadas GPS del usuario (puede ser null).
function AppointmentCard({
  apt,
  userGps,
}: {
  apt: Appointment;
  userGps: { lat: number; lng: number } | null;
}) {
  const router = useRouter();

  // Obtenemos la configuración de color/label para el estado actual.
  // Si el status no está en STATUS_CONFIG → usamos un fallback gris.
  const status = STATUS_CONFIG[apt.status] || {
    label: apt.status,
    color: 'bg-gray-100 text-gray-600',
  };

  // totalPrice: suma de todos los precios de los ítems de la cita.
  // .reduce(acumulador, valorInicial): itera los ítems sumando precios.
  // Number(item.priceSnapshot || 0): convierte string a número (|| 0 evita NaN).
  const totalPrice = apt.items.reduce(
    (sum, item) => sum + Number(item.priceSnapshot || 0),
    0,
  );

  // totalDuration: suma de todas las duraciones en minutos.
  const totalDuration = apt.items.reduce(
    (sum, item) => sum + (item.durationSnapshot || 0),
    0,
  );

  // isUpcoming: true si la cita es futura (no completada ni cancelada).
  // .includes(apt.status): busca el estado en el array de estados "próximos".
  const isUpcoming = ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(apt.status);

  // relative: tiempo relativo solo para citas futuras (null para pasadas).
  const relative = isUpcoming ? relativeTime(apt.startTime) : null;

  // Calculamos la distancia al negocio (si tenemos GPS):
  // apt.tenant.locations?.[0]: primer elemento del array de ubicaciones (si existe).
  // El ?. (optional chaining) evita error si locations es null o vacío.
  const loc = apt.tenant.locations?.[0];
  const distKm = calcDistanceKm(userGps, loc?.latitude, loc?.longitude);

  // distLabel: texto formateado de la distancia para mostrar al usuario.
  // distKm < 1: si es menos de 1km, mostramos en metros (más preciso y útil).
  const distLabel = distKm !== null
    ? distKm < 1
      ? `${Math.round(distKm * 1000)} m`   // Ej: "350 m".
      : `${distKm.toFixed(1)} km`           // Ej: "2.3 km". .toFixed(1) = 1 decimal.
    : null; // null = sin distancia (sin GPS o sin coordenadas del negocio).

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Fila superior: logo del negocio + badges de estado de pago y cita. */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        {/* Link al detalle del negocio (página pública del negocio). */}
        <Link
          href={`/marketplace/${apt.tenant.slug}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          {/* Mini avatar del negocio: logo si existe, inicial si no. */}
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {apt.tenant.logoUrl ? (
              <img src={`${API_URL}${apt.tenant.logoUrl}`} alt="" className="w-full h-full object-cover" />
            ) : (
              // .name[0]: primer carácter del nombre del negocio como letra inicial.
              <span className="text-xs font-bold text-gray-400">{apt.tenant.name[0]}</span>
            )}
          </div>
          <span className="text-xs font-semibold text-gray-700">{apt.tenant.name}</span>
        </Link>

        {/* Badges: estado de pago (si hay) + estado de la cita. */}
        <div className="flex items-center gap-1.5">
          {/* apt.payments?.[0]: muestra el estado del primer pago si existe.
              El badge de pago tiene colores diferentes según el estado. */}
          {apt.payments?.[0] && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              apt.payments[0].status === 'COMPLETED'
                ? 'bg-green-100 text-green-700'
                : apt.payments[0].status === 'PENDING'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
            }`}>
              {/* Ternario encadenado para el texto del estado de pago. */}
              {apt.payments[0].status === 'COMPLETED' ? 'Pagado' :
               apt.payments[0].status === 'PENDING' ? 'Pago pendiente' :
               apt.payments[0].status === 'REFUNDED' ? 'Reembolsado' : apt.payments[0].status}
            </span>
          )}
          {/* Badge del estado de la cita (usa las clases de STATUS_CONFIG). */}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Fila de fecha/hora y badges de tiempo relativo/distancia. */}
      <div className="flex items-start justify-between mb-3">
        <div>
          {/* dayjs.utc(): interpreta el timestamp como UTC (zona horaria del servidor).
              .format('ddd, D [de] MMM YYYY'): ej: "vie, 20 de jun 2026".
              [de] entre corchetes: texto literal (no es un token de formato). */}
          <p className="text-sm font-semibold text-gray-900">
            {dayjs.utc(apt.startTime).format('ddd, D [de] MMM YYYY')}
          </p>
          <p className="text-xs text-gray-500">
            {dayjs.utc(apt.startTime).format('h:mm A')} – {dayjs.utc(apt.endTime).format('h:mm A')}
            {/* Duración total: solo si hay ítems con duración.
                totalDuration >= 60: si es 60 o más minutos → convertimos a horas.
                Math.floor(totalDuration / 60): horas completas.
                totalDuration % 60: minutos restantes (% = módulo/residuo). */}
            {totalDuration > 0 && (
              <span className="ml-1.5 text-gray-400">
                · {totalDuration >= 60
                  ? `${Math.floor(totalDuration / 60)}h${totalDuration % 60 > 0 ? ` ${totalDuration % 60}m` : ''}`
                  : `${totalDuration}min`}
              </span>
            )}
          </p>
        </div>

        {/* Columna derecha: badge de tiempo relativo + distancia. */}
        <div className="flex flex-col items-end gap-1">
          {/* Badge de tiempo relativo: solo para citas futuras. */}
          {relative && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                // relative.urgent: si es urgente → fondo rojo; si no → fondo teal.
                relative.urgent
                  ? 'bg-red-50 text-red-600'
                  : 'text-white'
              }`}
              style={relative.urgent ? {} : { backgroundColor: TEAL }}
            >
              {relative.label}
            </span>
          )}
          {/* Badge de distancia: solo si tenemos GPS y coordenadas del negocio. */}
          {distLabel && (
            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {distLabel}
            </span>
          )}
        </div>
      </div>

      {/* Fila inferior: avatar del empleado + servicios + precio total.
          Es un button porque al hacer click va al perfil del profesional. */}
      <button
        onClick={() => router.push(`/marketplace/${apt.tenant.slug}/professional/${apt.employee.id}`)}
        className="flex items-center gap-3 w-full text-left"
      >
        {/* Avatar del empleado: foto si tiene; si no, iniciales con su color. */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: apt.employee.color || TEAL }}
        >
          {apt.employee.avatarUrl ? (
            <img src={`${API_URL}${apt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
          ) : (
            // Iniciales: primera letra del nombre + primera letra del apellido.
            // [0]: accede al primer carácter del string.
            <>{apt.employee.firstName[0]}{apt.employee.lastName[0]}</>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700">
            {apt.employee.firstName} {apt.employee.lastName}
          </p>
          {/* Lista de servicios separados por coma.
              .map((i) => i.serviceNameSnapshot): extrae solo el nombre de cada ítem.
              .join(', '): une los nombres con ", ". Ej: "Corte, Tinte, Manicure". */}
          <p className="text-xs text-gray-500 truncate">
            {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
          </p>
        </div>

        {/* Precio total formateado.
            (apt.tenant as any)?.currency: moneda del negocio ('MXN', 'USD', etc.).
            || 'MXN': moneda por defecto si no está configurada. */}
        <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
          {formatCurrency(totalPrice, (apt.tenant as any)?.currency || 'MXN')}
        </span>
      </button>
    </div>
  );
}

// ─── Componente: GalleryLightbox ────────────────────────────────────
// Modal a pantalla completa para ver una foto de la galería en grande.
//
// PROPS:
//   photo: objeto con los datos de la foto a mostrar.
//   onClose: función que se llama para cerrar el lightbox.
function GalleryLightbox({
  photo,
  onClose,
}: {
  photo: GalleryCategory['photos'][0]; // Tipo derivado: un elemento del array photos.
  onClose: () => void;
}) {
  return (
    // Overlay a pantalla completa con fondo negro semi-opaco (bg-black/80).
    // fixed inset-0: cubre toda la pantalla.
    // z-50: por encima de todo.
    // onClick={onClose}: click fuera del panel → cierra el lightbox.
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Panel del lightbox: fondo blanco con bordes redondeados.
          onClick={(e) => e.stopPropagation(): evita que el click en el panel
          se propague al overlay y cierre el lightbox al hacer click dentro del panel. */}
      <div
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {/* Imagen a tamaño completo.
              max-h-[60vh]: máximo 60% de la altura de la pantalla.
              object-contain: muestra la imagen completa sin recortar. */}
          <img
            src={`${API_URL}${photo.imageUrl}`}
            alt={photo.serviceName}
            className="w-full max-h-[60vh] object-contain bg-gray-50"
          />
          {/* Botón de cierre superpuesto sobre la imagen (esquina superior derecha). */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Metadatos de la foto: nombre del servicio y negocio + fecha. */}
        <div className="p-4">
          <p className="text-sm font-semibold text-gray-900">{photo.serviceName}</p>
          {/* &middot; es la entidad HTML para el punto medio "·". */}
          <p className="text-xs text-gray-500 mt-1">
            {photo.tenantName} &middot; {dayjs(photo.date).format('D [de] MMM YYYY')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Contact Change Form ───────────────────────────────

// ─── Tipo de sección activa ─────────────────────────────────────────
// Controla qué contenido se muestra debajo del hero card.
// 'default' → botones de sesión (ninguna sección expandida).
// 'services' → historial de servicios.
// 'favorites' → lista de favoritos.
// 'gallery' → galería de fotos.
// 'points' → historial de puntos.
type ActiveSection = 'default' | 'services' | 'favorites' | 'gallery' | 'points';

// ─── Componente principal: MarketplaceProfilePage ───────────────────
export default function MarketplaceProfilePage() {
  // Extraemos del contexto de auth lo que necesitamos para el perfil.
  const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser, profiles, activeProfile, setActiveProfile } =
    useMarketplaceAuth();

  const router = useRouter();
  const queryClient = useQueryClient();

  // activeSection: qué sección expandida está activa (por defecto: ninguna).
  const [activeSection, setActiveSection] = useState<ActiveSection>('default');

  // selectedCategory: categoría de la galería seleccionada.
  // null = mostrar todas las fotos de todas las categorías.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // lightboxPhoto: foto seleccionada para ver en el lightbox.
  // null = lightbox cerrado.
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryCategory['photos'][0] | null>(null);

  // userGps: coordenadas GPS del usuario para calcular distancias.
  // null = sin GPS disponible.
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);

  // toggle: función auxiliar para el toggle de secciones.
  // Si la sección ya está activa → la desactiva (vuelve a 'default').
  // Si está inactiva → la activa.
  const toggle = (section: ActiveSection) =>
    setActiveSection((prev) => (prev === section ? 'default' : section));

  // Efecto: redirigir al login si no está autenticado.
  // Se ejecuta cuando cambian authLoading o isAuthenticated.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/marketplace/login?redirect=/marketplace/profile');
    }
  }, [authLoading, isAuthenticated, router]);

  // Efecto: obtener GPS del usuario para calcular distancias.
  // Se ejecuta UNA sola vez al montar (array de dependencias vacío []).
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        // Callback de éxito: guardamos las coordenadas.
        (pos) => setUserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        // Callback de error: no hacemos nada (la app funciona sin GPS).
        () => {},
        { timeout: 5000 }, // Tiempo máximo de espera: 5 segundos.
      );
    }
  }, []);

  // ─── Query: Estadísticas del usuario ────────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ['marketplace-my-stats', activeProfile?.id || 'self'],
    queryFn: () =>
      marketplaceApi.get<{ data: Stats }>(
        activeProfile?.id ? `/my-stats?profileId=${activeProfile.id}` : '/my-stats',
      ),
    enabled: isAuthenticated, // Solo si está autenticado.
  });
  // Extraemos los datos o usamos defaults seguros.
  const stats: Stats = (statsData as any)?.data || { totalServices: 0, totalPoints: 0, totalPhotos: 0 };

  // ─── Query: Galería de fotos de resultados ───────────────────────────
  const { data: galleryData } = useQuery({
    queryKey: ['marketplace-my-gallery', activeProfile?.id || 'self'],
    queryFn: () =>
      marketplaceApi.get<{ data: GalleryCategory[] }>(
        activeProfile?.id ? `/my-gallery?profileId=${activeProfile.id}` : '/my-gallery',
      ),
    enabled: isAuthenticated,
  });
  const galleryCategories: GalleryCategory[] = (galleryData as any)?.data || [];

  // ─── Query: Recompensas canjeadas (cupones activos) ──────────────────
  const { data: rewardsData } = useQuery({
    queryKey: ['marketplace-my-rewards', activeProfile?.id || 'self'],
    queryFn: () =>
      marketplaceApi.get<{ data: any[] }>(
        activeProfile?.id ? `/my-rewards?profileId=${activeProfile.id}` : '/my-rewards',
      ),
    enabled: isAuthenticated,
  });
  const myRewards: any[] = (rewardsData as any)?.data || [];

  // ─── Query: Recompensas disponibles para canjear ─────────────────────
  const { data: availableRewardsData } = useQuery({
    queryKey: ['marketplace-available-rewards'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/available-rewards'),
    enabled: isAuthenticated,
  });
  const availableRewards: any[] = (availableRewardsData as any)?.data || [];

  // ─── Query: Favoritos (solo el conteo) ──────────────────────────────
  // Favoritos — solo el conteo, el listado vive en /marketplace?favorites=1
  const { data: favoritesData } = useQuery({
    queryKey: ['marketplace-my-favorites'],
    queryFn: () => marketplaceApi.get<{ data: FavoriteBusiness[] }>('/my-favorites'),
    enabled: isAuthenticated,
  });
  const favorites: FavoriteBusiness[] = (favoritesData as any)?.data || [];

  // ─── Filtrado de fotos de la galería ────────────────────────────────
  // filteredPhotos: fotos a mostrar según la categoría seleccionada.
  // Si selectedCategory es null → mostramos TODAS las fotos de TODAS las categorías.
  // galleryCategories.flatMap((c) => c.photos): aplana el array de arrays en uno solo.
  //   flatMap es equivalente a .map(...).flat() → transforma y aplana en un paso.
  // Si selectedCategory tiene valor → filtramos la categoría y mostramos sus fotos.
  const filteredPhotos = selectedCategory
    ? galleryCategories.find((c) => c.name === selectedCategory)?.photos || []
    : galleryCategories.flatMap((c) => c.photos);

  // ─── Función: cerrar sesión global ──────────────────────────────────
  const handleLogout = async () => {
    // Cierra TODAS las sesiones (admin/staff, marketplace, portal) y
    // elimina el selector persistido. Sin esto el usuario que pasó por
    // el selector queda con sesión admin viva y /login restaura el
    // selector en vez del form de login.
    await signOutAll();
    router.push('/login');
  };

  // ─── Función: cambiar perfil (sin logout) ───────────────────────────
  // Sin logout: lleva al /login para que el sistema muestre el selector
  // de perfil (cliente/profesional/administrador) si la sesión sigue
  // viva, o el formulario de login si necesita autenticarse de nuevo.
  const handleChangeProfile = () => {
    router.push('/login');
  };

  // ─── Pantalla de carga ───────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: TEAL }} />
      </div>
    );
  }

  // Si no está autenticado o no hay usuario → no renderizamos nada
  // (el useEffect de arriba habrá iniciado la redirección al login).
  if (!isAuthenticated || !user) return null;

  // initials: las dos primeras letras del nombre+apellido en mayúsculas.
  // Se usan como fallback cuando no hay foto de perfil.
  // (user.firstName || '')[0]: primera letra del nombre, o '' si no hay nombre.
  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();

  // ── Identidad mostrada = PERFIL ACTIVO (estilo Netflix) ──────────────
  // Si el usuario está dentro de uno de sus perfiles (tutor o hijo), el hero
  // muestra el nombre/foto de ESE perfil. Si no hay perfil activo, cae a la
  // cuenta. El email siempre es el de la cuenta (no es por perfil).
  const heroFirstName = activeProfile?.firstName || user.firstName;
  const heroLastName = activeProfile?.lastName || user.lastName;
  const heroColor = activeProfile?.color || undefined;
  // ¿El perfil activo es el TITULAR (SELF/default)? Solo ese comparte identidad
  // con la cuenta y, por tanto, hereda su foto si el perfil no tiene una propia.
  const isOwnerProfile = !activeProfile || activeProfile.relationship === 'SELF' || activeProfile.isDefault;
  // La foto SIEMPRE corresponde al perfil activo. Si un perfil secundario (hijo)
  // no tiene foto, se muestran SUS iniciales — nunca la foto de la cuenta.
  const heroAvatarUrl = activeProfile
    ? activeProfile.avatarUrl || (isOwnerProfile ? user.avatarUrl : undefined)
    : user.avatarUrl;

  return (
    <div className="min-h-screen bg-gray-50 safe-top">


      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* ─── Hero Card: foto, nombre, email ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center relative">
          {/* Modo oscuro removido en V1 — pendiente para V2 (requiere
              auditar todos los componentes del marketplace para
              asegurar contraste/legibilidad). Ver
              project_v2_dark_mode.md. */}
          {/* Botón de configuración en esquina superior derecha. */}
          <div className="absolute top-4 right-4 flex items-center gap-1">
            <Link
              href="/marketplace/settings"
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Configuración"
            >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            </Link>
          </div>
          {/* Avatar — click to edit profile */}
          {/* Avatar grande clicable: lleva a /marketplace/settings para editar. */}
          <Link href="/marketplace/settings" className="block mx-auto mb-3 relative w-20 h-20 group">
            {/* Avatar: componente con foto o iniciales.
                group: clase padre para CSS de hover de grupo en Tailwind.
                group-hover:bg-black/30: al pasar el mouse, oscurece el avatar. */}
            <Avatar
              avatarUrl={heroAvatarUrl}
              firstName={heroFirstName}
              lastName={heroLastName}
              color={heroColor}
              className="w-20 h-20"
              textClassName="text-2xl"
            />
            {/* Overlay con ícono de edición que aparece al hacer hover. */}
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
            </div>
          </Link>

          {/* Nombre del perfil activo + email de la cuenta. */}
          <h1 className="text-lg font-bold text-gray-900">
            {heroFirstName} {heroLastName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>

          {/* ─── Perfiles (estilo Netflix) ───────────────────────────────
              En lugar de un icono para "cambiar de perfil", mostramos los
              perfiles directamente: tocar uno cambia el perfil activo (su foto
              y nombre pasan al hero). El último botón abre la gestión. */}
          {profiles && profiles.length > 0 && (
            <div className="mt-4 flex items-end justify-center gap-3 flex-wrap">
              {profiles.map((p) => {
                const isActive = activeProfile?.id === p.id;
                // El chip del titular (SELF/default) hereda la foto de la cuenta
                // si no tiene una propia; los hijos muestran solo sus iniciales.
                const isOwnerChip = p.relationship === 'SELF' || p.isDefault;
                const chipAvatarUrl = p.avatarUrl || (isOwnerChip ? user.avatarUrl : undefined);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveProfile(p)}
                    className="flex flex-col items-center gap-1 w-16 group/prof"
                    title={`${p.firstName} ${p.lastName}`}
                  >
                    <span
                      className="rounded-full p-0.5 transition-all"
                      style={{ boxShadow: isActive ? `0 0 0 2px ${TEAL}` : '0 0 0 2px transparent' }}
                    >
                      <Avatar
                        avatarUrl={chipAvatarUrl}
                        firstName={p.firstName}
                        lastName={p.lastName}
                        color={p.color || undefined}
                        className="w-12 h-12"
                        textClassName="text-base"
                      />
                    </span>
                    <span className={`text-[11px] leading-tight truncate w-full text-center ${isActive ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                      {p.firstName}
                    </span>
                  </button>
                );
              })}
              {/* Gestionar perfiles (agregar/editar hijos). */}
              <button
                type="button"
                onClick={() => router.push('/marketplace/profiles')}
                className="flex flex-col items-center gap-1 w-16"
                title="Administrar perfiles"
              >
                <span className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                <span className="text-[11px] leading-tight text-gray-500">Administrar</span>
              </button>
            </div>
          )}

          {/* Badge del proveedor social (Google/Facebook) si el usuario
              inició sesión con una red social en vez de email/contraseña.
              (user as any).socialProvider: usamos "as any" porque el tipo
              del usuario no declara esta propiedad explícitamente en TypeScript. */}
          {(user as any).socialProvider && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                {/* Renderizado condicional: muestra el logo de Google o de Facebook. */}
                {(user as any).socialProvider === 'google' ? (
                  // SVG del logo de Google con sus 4 colores corporativos.
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                ) : (
                  // SVG del logo de Facebook en su azul corporativo.
                  <svg className="w-3.5 h-3.5" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                )}
                Conectado con {(user as any).socialProvider === 'google' ? 'Google' : 'Facebook'}
              </span>
            </div>
          )}
        </div>

        {/* ─── Grid de estadísticas + botón galería ────────────────────── */}
        {/* grid grid-cols-3 gap-3: 3 columnas de igual tamaño con separación. */}
        <div className="grid grid-cols-3 gap-3">
          {/* Celda 1: Total de servicios recibidos.
              No es clicable → solo muestra el dato numerico. */}
          {/* Servicios: solo dato, no accionable — el listado de citas
              pasadas vive en /marketplace/appointments (tab Citas). */}
          <div
            className="rounded-xl border p-4 text-center"
            style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}
          >
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {stats.totalServices}
            </p>
            <p className="text-xs text-gray-500 mt-1">Servicios</p>
          </div>

          {/* Celda 2: Favoritos.
              Clicable → navega a /marketplace?favorites=1. */}
          {/* Favoritos: lleva a /marketplace?favorites=1 — el listado vive
              ahi (Negocios con filtro de favoritos activo), no en el perfil. */}
          <button
            onClick={() => router.push('/marketplace?favorites=1')}
            className="rounded-xl border p-4 text-center transition-all hover:bg-gray-50"
            style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}
          >
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {favorites.length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Favoritos</p>
          </button>

          {/* Celda 3: Galería → navega a /marketplace/gallery. */}
          <button
            onClick={() => router.push('/marketplace/gallery')}
            className="rounded-xl p-4 text-center transition-colors text-white"
            style={{ backgroundColor: TEAL }}
          >
            <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0 0 21.75 19.5V4.5A1.5 1.5 0 0 0 20.25 3H3.75A1.5 1.5 0 0 0 2.25 4.5v15A1.5 1.5 0 0 0 3.75 21Z" />
            </svg>
            <p className="text-xs font-medium">Galería</p>
          </button>
        </div>

        {/* Servicios: el dato vive solo en el grid de arriba. La historia
            de citas pasadas se muestra en /marketplace/appointments. */}

        {/* Favoritos: el listado vive en /marketplace?favorites=1 (no aqui). */}

        {/* ─── Galería de fotos (toggle desde Galeria) ────────────────── */}
        {/* Solo se muestra si activeSection === 'gallery'. */}
        {activeSection === 'gallery' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {/* Estado vacío: sin fotos aún. */}
            {galleryCategories.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">
                  Aun no tienes fotos de servicios completados
                </p>
              </div>
            ) : (
              <>
                {/* Filtros de categoría en fila horizontal con scroll. */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                  {/* Botón "Todas": desactiva el filtro de categoría. */}
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                    style={selectedCategory === null
                      ? { backgroundColor: TEAL, color: 'white' }
                      : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                    }
                  >
                    {/* Conteo total: suma de las fotos de todas las categorías.
                        .reduce((s, c) => s + c.photos.length, 0):
                        itera las categorías sumando el largo de cada photos array. */}
                    Todas ({galleryCategories.reduce((s, c) => s + c.photos.length, 0)})
                  </button>
                  {/* Botones por categoría.
                      .map((cat) => ...): genera un botón por cada categoría. */}
                  {galleryCategories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                      style={selectedCategory === cat.name
                        ? { backgroundColor: TEAL, color: 'white' }
                        : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                      }
                    >
                      {cat.name} ({cat.photos.length})
                    </button>
                  ))}
                </div>

                {/* Grid de fotos en 3 columnas.
                    .map((photo) => ...): renderiza cada foto como un botón clicable. */}
                <div className="grid grid-cols-3 gap-2">
                  {filteredPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => setLightboxPhoto(photo)}
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
                    >
                      {/* aspect-square: mantiene la foto cuadrada sin importar su tamaño real.
                          object-cover: recorta la foto para llenar el cuadrado. */}
                      <img
                        src={`${API_URL}${photo.imageUrl}`}
                        alt={photo.serviceName}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Próximas citas y cupones se ven en sus secciones dedicadas */}
        {activeSection === 'default' && (
          <div className="space-y-3"></div>
        )}

        {/* Quick link "Historial de Pagos" eliminado del perfil. Los pagos
            ahora viven como tercera pestaña dentro de /marketplace/appointments
            (Citas | Compras | Pagos). */}

        {/* ─── Botones: cambiar perfil y cerrar sesión ─────────────────── */}
        {activeSection === 'default' && (
          <div className="space-y-2">
            {/* Botón "Cambiar perfil": lleva al selector de tipo de usuario (/login).
                El usuario puede elegir entre cliente/profesional/admin. */}
            <button
              onClick={handleChangeProfile}
              className="w-full border border-gray-200 bg-white text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Elige el tipo de acceso
            </button>
            {/* Botón "Cerrar sesión": llama a signOutAll y redirige a /login. */}
            <button
              onClick={handleLogout}
              className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Lightbox de foto: solo visible si lightboxPhoto no es null. */}
      {lightboxPhoto && (
        <GalleryLightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)} // Al cerrar, borramos la foto seleccionada.
        />
      )}
    </div>
  );
}

// ─── Componente: ProfileCouponCard ──────────────────────────────────
// Tarjeta estilo "ticket" para mostrar un cupón/recompensa canjeada.
// Tiene un stub (talón) izquierdo de color + separador perforado + contenido.
//
// PROPS:
//   redemption: any → el objeto de canje de la recompensa.
//   disabled?: boolean → si true, el cupón está usado o vencido (modo gris).
function ProfileCouponCard({ redemption, disabled = false }: { redemption: any; disabled?: boolean }) {
  // Extraemos los objetos anidados del canje.
  const reward = redemption.reward;   // La recompensa original.
  const tenant = redemption.tenant;   // El negocio que emitió la recompensa.

  // isDiscount: true si es un descuento; false si es un servicio gratuito.
  const isDiscount = reward?.type === 'DESCUENTO';

  // Formateamos la fecha de vencimiento y calculamos días restantes.
  const expiry = formatExpiry(redemption.expiresAt);
  const days = daysLeft(redemption.expiresAt);

  // isUrgent: true si quedan 7 días o menos Y el cupón no está usado/vencido.
  const isUrgent = days !== null && days <= 7 && !disabled;

  // valueLabel: el texto principal del stub izquierdo (ej: "-20%", "$50", "GRATIS").
  const valueLabel = isDiscount
    ? (reward?.discountMode === 'PERCENT'
      ? `-${Number(reward.discountAmount)}%`   // Porcentaje de descuento.
      : `$${reward?.discountAmount ?? ''}`)    // Cantidad fija de descuento.
    : 'GRATIS'; // Tipo SERVICIO → el servicio es gratuito.

  // statusLabel: etiqueta para cupones usados o vencidos.
  const statusLabel = redemption.status === 'USED' ? 'USADO' : 'VENCIDO';

  // displayLabel: lo que se muestra en el stub según si está activo o no.
  const displayLabel = disabled ? statusLabel : valueLabel;

  // stubFontSize: ajusta el tamaño de fuente del stub según la longitud del texto.
  // Textos más largos necesitan fuente más pequeña para caber en el espacio.
  const stubFontSize = displayLabel.length <= 4 ? '1.125rem' : displayLabel.length <= 6 ? '0.875rem' : '0.75rem';

  return (
    // Contenedor relativo para el efecto de gris si disabled.
    // filter: 'grayscale(0.5)': desatura 50% los colores cuando disabled.
    // opacity: 0.65: hace el cupón semi-transparente cuando disabled.
    <div
      className="relative"
      style={{ filter: disabled ? 'grayscale(0.5)' : undefined, opacity: disabled ? 0.65 : 1 }}
    >
      {/* Tarjeta con layout de ticket: stub | separador | contenido. */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>

        {/* ── Stub izquierdo (talón del ticket) ──
            Muestra el valor del cupón (descuento o GRATIS/estado).
            w-20: ancho fijo de 80px para el stub.
            Los 2 círculos absolutos simulan los "mordidos" del ticket. */}
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: disabled ? '#9ca3af' : '#008080' }}
        >
          {/* Texto del valor/estado. */}
          <span
            className="text-white font-black leading-tight text-center break-all w-full px-2"
            style={{ fontSize: stubFontSize, wordBreak: 'break-all' }}
          >
            {displayLabel}
          </span>

          {/* Etiqueta secundaria del stub (solo para cupones activos). */}
          {!disabled && (
            <span className="text-white/70 text-[9px] uppercase tracking-wider">
              {isDiscount ? 'descuento' : 'servicio'}
            </span>
          )}

          {/* Círculos de "mordido" del ticket (superior e inferior del borde derecho). */}
          <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
          <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
        </div>

        {/* ── Separador perforado ──
            Array.from({ length: 9 }): crea un array de 9 elementos vacíos.
            .map((_, i)): itera 9 veces (i = índice, _ = valor ignorado).
            Cada iteración renderiza un punto gris para simular perforación. */}
        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        {/* ── Contenido principal del cupón ──
            flex-1: ocupa todo el espacio restante a la derecha del stub. */}
        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            {/* Nombre del cupón + badge del negocio. */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">{reward?.name || 'Cupón'}</p>
              {tenant && (
                <span className="text-[10px] font-medium text-[#008080] bg-teal-50 px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[120px]">
                  {tenant.name}
                </span>
              )}
            </div>

            {/* Descripción del beneficio. */}
            {reward && (
              <p className="text-xs text-gray-500 mt-0.5">
                {isDiscount
                  ? (reward.discountMode === 'PERCENT'
                    ? `${Number(reward.discountAmount)}% de descuento`
                    : `$${reward.discountAmount} de descuento`)
                  : (reward.service?.name ? `${reward.service.name} gratis` : 'Servicio gratis')}
              </p>
            )}
          </div>

          {/* Fila inferior: fecha de vencimiento + botón de acción. */}
          <div className="flex items-center justify-between mt-2 gap-2">
            {/* Badge de vencimiento: rojo si es urgente, gris si no. */}
            {expiry && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0"
                style={isUrgent ? { backgroundColor: '#fef2f2', color: '#dc2626' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-semibold whitespace-nowrap">
                  {/* Texto urgente si quedan ≤7 días; normal si no. */}
                  {isUrgent ? `¡Vence en ${days}d!` : `Vence ${expiry}`}
                </span>
              </div>
            )}

            {/* Botón "CANJEAR" o etiqueta del estado según si está activo. */}
            {!disabled ? (
              // Cupón activo: botón que lleva al negocio para canjearlo.
              <Link
                href={tenant?.slug ? `/marketplace/${tenant.slug}` : '/marketplace'}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white transition-transform active:scale-95"
                style={{ backgroundColor: '#008080', letterSpacing: '0.05em' }}
              >
                CANJEAR
              </Link>
            ) : (
              // Cupón inactivo: solo muestra el estado textual.
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {statusLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
