// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/app/c/[token]/page.tsx
//
// CONCEPTO: Página pública de recordatorio y gestión de cita.
// URL: /c/[token]  (ej. /c/abc123def456...)
//
// Esta página se abre cuando el cliente recibe un LINK por WhatsApp/SMS/Email
// recordándole su cita próxima. El TOKEN en la URL es su credencial única:
// no requiere login, el token identifica al cliente y a la cita.
//
// RUTA DINÁMICA [token]: el token es un identificador opaco (UUIDv4 o similar)
// que el backend genera al crear la cita y que caduca después de la fecha.
//
// VISTAS DEL COMPONENTE (estado "view"):
//  'detail'    → Muestra los detalles de la cita + botones de acción
//  'reschedule'→ Formulario para elegir nueva fecha y hora
//  'cancel'    → Confirmación de cancelación con campo de motivo
//  'success'   → Pantalla de éxito con confeti (según la acción realizada)
//
// ACCIONES DISPONIBLES (si la cita está activa):
//  - Confirmar asistencia   → POST /api/public/c/:token/confirm
//  - Reagendar              → POST /api/public/c/:token/reschedule
//  - Cancelar               → POST /api/public/c/:token/cancel
//
// CONSULTAS:
//  - Detalles de la cita: GET /api/public/c/:token
//  - Slots disponibles:   GET /api/public/c/:token/availability?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import Link from 'next/link';
// useParams lee el parámetro dinámico [token] de la URL.
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
// ConfettiCelebration: componente que lanza confeti animado en pantalla.
// Se usa para celebrar cuando el cliente confirma o reagenda su cita.
import { ConfettiCelebration } from '@/components/ui/confetti-celebration';
// WhatsApp: para que el cliente mande la captura del anticipo al negocio.
import { buildWhatsAppUrl, buildDepositProofMessage, buildTransferInstructions } from '@/lib/whatsapp';

/** Formatea una hora con AM/PM (ej. "3:30 PM").
 *  toLocaleTimeString: método nativo del Date de JS para formatear horas.
 *  'en-US': usa el formato americano (AM/PM en vez de 24h).
 *  hour12: true → usa formato de 12 horas con AM/PM. */
function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Pagina publica del recordatorio de cita. El cliente abre el link
 * que recibio por WhatsApp y aqui puede:
 *  - Confirmar la cita
 *  - Reagendar a otro horario disponible del mismo empleado
 *  - Cancelar
 *
 * Sin auth. El token (en la URL) es la unica credencial.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── INTERFACES DE DATOS ──────────────────────────────────────────────────────
// Describen la estructura de los objetos que devuelve la API.
// "Snapshot" en los campos de item: el precio y duración se guardaron al momento
// de hacer la reserva (para que no cambien si el negocio modifica los precios
// después de que el cliente ya reservó). Es el "patrón snapshot".

// Un ítem/servicio dentro de la cita
interface AppointmentItem {
  serviceNameSnapshot: string;  // Nombre del servicio al momento de reservar
  priceSnapshot: number;        // Precio al momento de reservar
  durationSnapshot: number;     // Duración al momento de reservar
  serviceId: string;
}

// El empleado que atiende la cita
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  color?: string | null;   // Color teal o personalizado del empleado
}

// La sucursal donde se atiende
interface Location {
  name: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;   // Coordenadas GPS para Google Maps
  longitude?: number | null;
}

// El negocio dueño de la cita
interface Tenant {
  name: string;
  slug: string;            // Identificador URL del negocio (ej. 'salon-maria')
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  tenantType?: string;     // 'FREELANCER' o 'BUSINESS'
  depositEnabled?: boolean;
  shopSpeiBankName?: string | null;
  shopSpeiHolderName?: string | null;
  shopSpeiClabe?: string | null;
  phone?: string | null;
  businessPhone?: string | null;
}

// La cita completa con toda su información relacionada
interface Appointment {
  id: string;
  startTime: string;        // ISO datetime de inicio de la cita
  endTime: string;          // ISO datetime de fin de la cita
  status: string;           // 'CONFIRMED', 'PENDING', 'CANCELLED', 'COMPLETED', 'NO_SHOW'
  confirmedAt?: string | null;  // Fecha en que el cliente confirmó (null = no confirmada)
  client: { firstName: string; lastName: string };
  employee: Employee;
  items: AppointmentItem[];  // Array de servicios en la cita
  location: Location;
  tenant: Tenant;
  // Anticipo (depósito): snapshot del requerimiento + montos.
  depositRequired?: boolean;
  depositAmount?: string | number | null;
  depositPaid?: string | number | null;
  depositWaived?: boolean;
}

// Un slot de tiempo disponible para reagendar
interface Slot {
  startTime: string;   // ISO datetime del inicio del slot
  available: boolean;  // true si el slot está libre
}

// Color teal de la marca Siliba (#008080)
const TEAL = '#008080';

// Los cuatro estados visuales posibles de esta página.
type View = 'detail' | 'reschedule' | 'cancel' | 'success';
// El tipo de acción exitosa realizada (para mostrar mensaje apropiado).
type SuccessKind = 'confirmed' | 'rescheduled' | 'cancelled';

export default function ReminderPage() {
  // useParams con tipo genérico: especifica que el token es un string.
  const params = useParams<{ token: string }>();
  const token = params.token;

  // ─── ESTADO VISUAL ────────────────────────────────────────────────────────
  // "view" controla cuál de las 4 pantallas se muestra.
  const [view, setView] = useState<View>('detail');
  // "successKind" recuerda qué acción exitosa se realizó para mostrar
  // el mensaje correcto en la pantalla de éxito.
  const [successKind, setSuccessKind] = useState<SuccessKind | null>(null);
  // "confettiDone" es true cuando el confeti ya terminó de animarse.
  // Se pasa al componente ConfettiCelebration para que sepa cuándo parar.
  const [confettiDone, setConfettiDone] = useState(false);
  // Mensaje de error de las mutaciones (null = sin error).
  const [error, setError] = useState<string | null>(null);

  // ─── ESTADO DE REAGENDA ───────────────────────────────────────────────────
  // Estados de reagenda
  // "pickedDate": la fecha que el cliente seleccionó para reagendar.
  // useState con función inicializadora (lazy init): la función se ejecuta
  // SOLO en el primer render para calcular el valor inicial.
  // Inicia en "mañana" (hoy + 1 día) en formato 'YYYY-MM-DD'.
  const [pickedDate, setPickedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);  // Mañana
    // .toISOString() → "2026-06-18T06:00:00.000Z"
    // .split('T')[0] → "2026-06-18" (solo la parte de la fecha)
    return d.toISOString().split('T')[0];
  });
  // El slot horario específico que eligió para reagendar (null si no eligió aún).
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);

  // ─── ESTADO DE CANCELACIÓN ────────────────────────────────────────────────
  // Cancelacion
  // El motivo opcional de cancelación que el cliente puede escribir.
  const [cancelReason, setCancelReason] = useState('');

  // ─── QUERY: CARGAR LA CITA ────────────────────────────────────────────────
  // Carga los detalles de la cita usando el token de la URL como identificador.
  // retry: false → si hay un error (ej. token inválido/expirado), no reintenta.
  // refetch: función para volver a cargar los datos manualmente (la usamos
  //          después de confirmar/cancelar para refrescar el estado en pantalla).
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reminder', token],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/public/c/${token}`);
      if (!res.ok) throw new Error('not found');
      const json = await res.json();
      // "json.data as Appointment": le decimos a TypeScript que trate
      // json.data como tipo Appointment (aserción de tipo).
      return json.data as Appointment;
    },
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/public/c/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo confirmar');
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccessKind('confirmed');
      setView('success');
      refetch();
    },
    onError: (err: Error) => setError(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/public/c/${token}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo cancelar');
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccessKind('cancelled');
      setView('success');
      refetch();
    },
    onError: (err: Error) => setError(err.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!pickedSlot) throw new Error('Elige un horario');
      const res = await fetch(`${API_URL}/api/public/c/${token}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: pickedSlot }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo reagendar');
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccessKind('rescheduled');
      setView('success');
      refetch();
    },
    onError: (err: Error) => setError(err.message),
  });

  const { data: availability, isLoading: loadingSlots } = useQuery({
    queryKey: ['reminder-availability', token, pickedDate],
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/api/public/c/${token}/availability?date=${pickedDate}`,
      );
      if (!res.ok) throw new Error('availability error');
      const json = await res.json();
      return json.data as { slots: Slot[] };
    },
    enabled: view === 'reschedule',
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-[#008080] rounded-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-sm text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-gray-900 mb-1">Enlace no válido</h1>
          <p className="text-sm text-gray-500">
            El enlace que abriste es inválido o ha expirado. Si tienes dudas, contacta al negocio.
          </p>
        </div>
      </div>
    );
  }

  // ─── DATOS DERIVADOS ──────────────────────────────────────────────────────
  // Alias conveniente para no escribir "data" todo el tiempo.
  const apt = data;
  // Template literal para nombre completo del empleado.
  const fullName = `${apt.employee.firstName} ${apt.employee.lastName}`;
  // .map() extrae solo el nombre de cada ítem, .join(', ') une con comas.
  // Resultado: "Corte de cabello, Tinte, Peinado"
  const services = apt.items.map((it) => it.serviceNameSnapshot).join(', ');
  // Suma de duraciones de todos los servicios (en minutos).
  // || 0: si durationSnapshot es null/undefined/0, usa 0.
  const totalDuration = apt.items.reduce((s, it) => s + (it.durationSnapshot || 0), 0);
  // Suma de precios. Number() convierte a número por si viene como string del backend.
  const totalPrice = apt.items.reduce((s, it) => s + Number(it.priceSnapshot || 0), 0);
  // Convertimos el string ISO de la cita a un objeto Date nativo de JavaScript.
  const startDate = new Date(apt.startTime);
  // La cita está "inactiva" (no se puede actuar sobre ella) si su status es
  // CANCELLED, COMPLETED o NO_SHOW.
  // .includes() verifica si el status está en ese array.
  const isInactiveStatus = ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(apt.status);
  // La cita ya está confirmada si el status es CONFIRMED Y tiene fecha de confirmación.
  // "!!" convierte a booleano: !!null → false, !!'2026-06-17T10:00:00' → true
  const isAlreadyConfirmed = apt.status === 'CONFIRMED' && !!apt.confirmedAt;

  // Anticipo pendiente: la cita lo requiere, no fue exonerado y aún no se cubre.
  // En ese caso el cliente no puede autoconfirmar; debe transferir y mandar la
  // captura por WhatsApp (la confirmación la da el negocio).
  const depositPaidNum = Number(apt.depositPaid ?? 0);
  const depositAmountNum = Number(apt.depositAmount ?? 0);
  const depositPending =
    !!apt.depositRequired && !apt.depositWaived && depositPaidNum < depositAmountNum;
  const depositRemaining = Math.max(0, depositAmountNum - depositPaidNum);

  // Link a Google Maps: usa coordenadas si existen, si no la dirección.
  // La URL de Google Maps acepta tanto coordenadas GPS como texto de búsqueda.
  const mapsUrl =
    apt.location?.latitude != null && apt.location?.longitude != null
      // Si tenemos coordenadas exactas, las usamos (más preciso).
      ? `https://www.google.com/maps/search/?api=1&query=${apt.location.latitude},${apt.location.longitude}`
      // Si no, buscamos por nombre + dirección de texto.
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${apt.location?.name || ''} ${apt.location?.address || ''}`.trim(),
        )}`;

  // ──── Pantalla de éxito a pantalla completa con animación ────
  if (view === 'success') {
    const cancelled = successKind === 'cancelled';
    return (
      <>
        <style>{`@keyframes cPop{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}@keyframes cCheck{0%{transform:scale(0)}70%{transform:scale(1.15)}100%{transform:scale(1)}}`}</style>
        {!cancelled && (
          <ConfettiCelebration
            show={!confettiDone}
            duration={5000}
            particlesPerBurst={20}
            onComplete={() => setConfettiDone(true)}
          />
        )}
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-10">
          <div
            className="w-full max-w-sm bg-white rounded-2xl border-2 overflow-hidden text-center shadow-sm"
            style={{ borderColor: cancelled ? '#fca5a5' : TEAL, animation: 'cPop .45s ease-out both' }}
          >
            <div className="px-6 pt-8 pb-6">
              <div
                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
                style={{
                  backgroundColor: cancelled ? '#fee2e2' : '#e0f2f1',
                  color: cancelled ? '#dc2626' : TEAL,
                  animation: 'cCheck .5s .15s ease-out both',
                }}
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  {cancelled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  )}
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {successKind === 'confirmed' && '¡Cita confirmada!'}
                {successKind === 'rescheduled' && '¡Cita reagendada!'}
                {cancelled && 'Cita cancelada'}
              </h1>
              <p className="text-sm text-gray-500">
                {successKind === 'confirmed' && (
                  <>Te esperamos en <span className="font-semibold text-gray-700">{apt.tenant.name}</span>.</>
                )}
                {successKind === 'rescheduled' && 'Te enviaremos un nuevo recordatorio antes de tu cita.'}
                {cancelled && 'Esperamos verte pronto.'}
              </p>
            </div>
            {apt.tenant.slug && (
              <div className="border-t border-gray-100 p-4">
                <Link
                  href={`/marketplace/${apt.tenant.slug}`}
                  className="block w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: TEAL }}
                >
                  Ver perfil del negocio
                </Link>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Portada del negocio (igual que en la vista de reseña) */}
      <div className="relative safe-top">
        <div
          className="h-40"
          style={{ background: `linear-gradient(to right, ${TEAL}, #006666)` }}
        >
          {apt.tenant.coverImageUrl && (
            <img
              src={`${API_URL}${apt.tenant.coverImageUrl}`}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 relative">
        {/* Logo + nombre del negocio, montado sobre la portada */}
        <div className="-mt-10 mb-3 flex items-end gap-3">
          <div className="w-16 h-16 rounded-full bg-white border-4 border-white shadow-md overflow-hidden flex items-center justify-center flex-shrink-0">
            {apt.tenant.logoUrl ? (
              <img src={`${API_URL}${apt.tenant.logoUrl}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-gray-400">{apt.tenant.name.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Recordatorio</p>
            <h1 className="text-lg font-bold text-gray-900 truncate">{apt.tenant.name}</h1>
          </div>
        </div>

        {/* Tarjeta de detalle de la cita */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Tu cita</p>
            <p className="text-lg font-semibold text-gray-900">
              {startDate.toLocaleDateString('es', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {fmtTime(startDate)}
              {totalDuration > 0 && ` · ${totalDuration} min`}
            </p>
          </div>

          {/* Servicios */}
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Servicio</p>
            <p className="text-sm text-gray-900">{services}</p>
            {totalPrice > 0 && (
              <p className="text-sm font-semibold text-[#008080] mt-0.5">
                ${totalPrice.toLocaleString('es-MX')}
              </p>
            )}
          </div>

          {/* Profesional */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: apt.employee.color || TEAL }}
            >
              {apt.employee.avatarUrl ? (
                <img src={`${API_URL}${apt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <>{apt.employee.firstName[0]}{apt.employee.lastName[0]}</>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Profesional</p>
              <p className="text-sm font-medium text-gray-900">{fullName}</p>
            </div>
          </div>

          {/* Ubicación y teléfono con acciones (tap → maps / llamar) */}
          {apt.location && (apt.location.address || apt.location.phone) && (
            <div className="px-5 py-3 border-b border-gray-100 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">
                {apt.location.name}
              </p>

              {apt.location.address && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 group"
                >
                  <span className="w-9 h-9 rounded-full bg-[#e0f2f1] text-[#008080] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </span>
                  <span className="text-sm text-gray-700 flex-1 group-hover:text-[#008080] transition-colors">
                    {apt.location.address}
                  </span>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </a>
              )}

              {apt.location.phone && (
                <a
                  href={`tel:${apt.location.phone}`}
                  className="flex items-center gap-3 group"
                >
                  <span className="w-9 h-9 rounded-full bg-[#e0f2f1] text-[#008080] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                  </span>
                  <span className="text-sm text-gray-700 flex-1 group-hover:text-[#008080] transition-colors">
                    {apt.location.phone}
                  </span>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* Estado actual / banner */}
          {isInactiveStatus && (
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500">
                Estado: {apt.status === 'CANCELLED' ? 'Cancelada' : apt.status === 'COMPLETED' ? 'Completada' : 'No asistió'}
              </p>
            </div>
          )}

          {isAlreadyConfirmed && (
            <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs font-medium text-green-800">¡Cita confirmada! Te esperamos.</p>
            </div>
          )}
        </div>

        {/* Anticipo pendiente: instrucciones de transferencia + WhatsApp para
            mandar la captura. El cliente NO puede autoconfirmar; lo confirma el
            negocio al recibir el anticipo. */}
        {!isInactiveStatus && view === 'detail' && depositPending && (
          <div className="mt-4 rounded-2xl border-2 p-4" style={{ borderColor: '#008080', backgroundColor: '#e0f2f1' }}>
            <p className="text-sm font-bold text-gray-900 mb-1">Anticipo para confirmar tu cita</p>
            <p className="text-xs text-gray-600 leading-snug mb-3">
              Para confirmar tu cita realiza el anticipo de <span className="font-bold">${depositRemaining}</span> por transferencia y envía tu comprobante por WhatsApp. El negocio confirmará tu cita al recibirlo.
            </p>
            {(() => {
              const instr = buildTransferInstructions({
                bankName: apt.tenant.shopSpeiBankName,
                holderName: apt.tenant.shopSpeiHolderName,
                clabe: apt.tenant.shopSpeiClabe,
              });
              if (!instr) return null;
              return (
                <div className="rounded-lg bg-white border border-teal-200 p-3 mb-3">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Datos para la transferencia</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{instr}</p>
                </div>
              );
            })()}
            {(() => {
              const phone = apt.tenant.businessPhone || apt.tenant.phone;
              const url = phone ? buildWhatsAppUrl(phone, buildDepositProofMessage({
                clientFirstName: apt.client.firstName,
                tenantName: apt.tenant.name,
                amount: depositRemaining,
              })) : null;
              if (!url) return null;
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold transition-colors"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                  Enviar comprobante
                </a>
              );
            })()}
          </div>
        )}

        {/* Acciones — solo si la cita está activa */}
        {!isInactiveStatus && view === 'detail' && (
          <div className="mt-4 space-y-2">
            {!isAlreadyConfirmed && !depositPending && (
              <button
                type="button"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="w-full py-3.5 rounded-xl bg-[#008080] text-white font-semibold hover:bg-[#006666] disabled:opacity-50 transition-colors"
              >
                {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar mi cita'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setView('reschedule'); setError(null); }}
              className="w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Reagendar
            </button>
            <button
              type="button"
              onClick={() => { setView('cancel'); setError(null); }}
              className="w-full py-3 rounded-xl border border-red-200 bg-white text-red-600 font-medium hover:bg-red-50 transition-colors"
            >
              Cancelar cita
            </button>
          </div>
        )}

        {/* ──── Reagendar ──── */}
        {view === 'reschedule' && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              Elige nueva fecha y hora con {apt.employee.firstName}
            </p>

            <label className="text-xs text-gray-500 block mb-1">Fecha</label>
            <input
              type="date"
              value={pickedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => { setPickedDate(e.target.value); setPickedSlot(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
            />

            <label className="text-xs text-gray-500 block mb-1">Horarios disponibles</label>
            {loadingSlots ? (
              <p className="text-xs text-gray-400 py-3">Buscando horarios...</p>
            ) : !availability?.slots?.length ? (
              <p className="text-xs text-gray-400 py-3">No hay horarios para esa fecha.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 mb-3 max-h-48 overflow-y-auto">
                {availability.slots.filter((s) => s.available).map((slot) => {
                  const dt = new Date(slot.startTime);
                  const label = fmtTime(dt);
                  const isSelected = pickedSlot === slot.startTime;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => setPickedSlot(slot.startTime)}
                      className={`text-xs py-1.5 rounded border transition-colors ${
                        isSelected
                          ? 'bg-[#008080] text-white border-[#008080]'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-[#008080]/50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 mb-2">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setView('detail'); setError(null); setPickedSlot(null); }}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => { setError(null); rescheduleMutation.mutate(); }}
                disabled={!pickedSlot || rescheduleMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666] disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? 'Reagendando...' : 'Reagendar'}
              </button>
            </div>
          </div>
        )}

        {/* ──── Cancelar ──── */}
        {view === 'cancel' && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-1">
              ¿Seguro que quieres cancelar?
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Esta acción no se puede deshacer. El negocio será notificado.
            </p>
            <label className="text-xs text-gray-500 block mb-1">Motivo (opcional)</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="Por qué necesitas cancelar..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 resize-none"
            />

            {error && (
              <p className="text-xs text-red-600 mb-2">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setView('detail'); setError(null); }}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => { setError(null); cancelMutation.mutate(); }}
                disabled={cancelMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
