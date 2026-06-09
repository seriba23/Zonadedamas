import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/es';

dayjs.locale('es');
// Plugin utc: necesario para `dayjs.utc(iso).format(...)`. Sin esto, dayjs
// interpreta el ISO con `Z` y lo convierte al TZ del browser al formatear,
// rompiendo la convención de wall-clock raw del proyecto (ver doc abajo).
dayjs.extend(utc);

/**
 * Helpers para mostrar horas de citas SIN convertir a TZ del browser.
 *
 * El backend guarda `startTime` como "hora local de la sucursal" en raw
 * (DateTime sin TZ explícita). El cliente solo necesita leerla y mostrarla
 * tal cual — convertirla con `new Date().toLocaleTimeString()` rompe todo
 * porque el browser asume UTC y convierte a TZ local del usuario.
 *
 * Estos helpers extraen las componentes del string ISO directamente.
 */

/** Extrae HH:mm del ISO string sin convertir TZ. */
export function formatBookingTime(iso: string): string {
  if (!iso) return '';
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : '';
}

/** Extrae HH:mm:ss del ISO string sin convertir TZ. */
export function formatBookingTimeSec(iso: string): string {
  if (!iso) return '';
  const m = /T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}:${m[3]}` : '';
}

/** Extrae YYYY-MM-DD del ISO string. */
export function bookingDateOnly(iso: string): string {
  if (!iso) return '';
  return iso.substring(0, 10);
}

/**
 * Formatea la fecha sin convertir TZ. Soporta variantes:
 *  - 'long': "Martes 22 de mayo de 2026"
 *  - 'short': "22 may 2026"
 *  - 'numeric': "22/05/2026"
 *  - 'weekday-short': "Mar 22"
 */
export function formatBookingDate(
  iso: string,
  variant: 'long' | 'short' | 'numeric' | 'weekday-short' = 'short',
): string {
  if (!iso) return '';
  const d = dayjs(iso.substring(0, 10));
  if (!d.isValid()) return '';
  switch (variant) {
    case 'long': {
      const s = d.format('dddd D [de] MMMM [de] YYYY');
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    case 'numeric':
      return d.format('DD/MM/YYYY');
    case 'weekday-short': {
      const s = d.format('ddd D');
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    case 'short':
    default:
      return d.format('D MMM YYYY');
  }
}

/** Devuelve solo el número de día. Ej: "22". */
export function formatBookingDay(iso: string): string {
  if (!iso) return '';
  return iso.substring(8, 10);
}

/** Devuelve mes corto en mayúsculas. Ej: "MAY". */
export function formatBookingMonthShort(iso: string): string {
  if (!iso) return '';
  const datePart = iso.substring(0, 10);
  if (!datePart) return '';
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '';
  // Date.UTC + timeZone:'UTC' evita el desfase
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' }).toUpperCase();
}

/** Devuelve día de la semana en minúsculas. Ej: "viernes". */
export function formatBookingWeekday(iso: string): string {
  if (!iso) return '';
  const datePart = iso.substring(0, 10);
  if (!datePart) return '';
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString('es-MX', { weekday: 'long', timeZone: 'UTC' });
}

/** Fecha + hora juntos para "lun 22 may, 12:00". */
export function formatBookingDateTime(iso: string): string {
  if (!iso) return '';
  const date = formatBookingDate(iso, 'weekday-short');
  const time = formatBookingTime(iso);
  return time ? `${date}, ${time}` : date;
}

/**
 * Comparar si una cita está "hoy o después" según la TZ de la sucursal.
 * Recibe el ISO raw de la cita y la TZ del negocio (ej. 'America/Mexico_City').
 * Si la TZ falta, asume que el server ya está en hora del negocio.
 */
export function isBookingUpcoming(iso: string, tenantTimezone?: string | null): boolean {
  if (!iso) return false;
  // Comparamos string a string en formato 'YYYY-MM-DDTHH:mm:ss' para
  // evitar conversión de TZ.
  const apptStr = iso.substring(0, 19); // "2026-05-22T12:00:00"
  const nowStr = nowInTenantTz(tenantTimezone);
  return apptStr >= nowStr;
}

/** Devuelve 'YYYY-MM-DDTHH:mm:ss' del momento actual en la TZ dada. */
export function nowInTenantTz(timezone?: string | null): string {
  const tz = timezone || 'America/Mexico_City';
  try {
    // Intl.DateTimeFormat con la TZ devuelve componentes locales.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  } catch {
    // Fallback simple sin TZ.
    return new Date().toISOString().substring(0, 19);
  }
}
