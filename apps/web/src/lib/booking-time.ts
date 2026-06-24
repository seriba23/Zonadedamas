// dayjs: librería ligera para fechas. utc: plugin que añade el modo UTC.
// La importación de 'dayjs/locale/es' carga el idioma español.
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/es';

dayjs.locale('es'); // español por defecto al formatear
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
// formatBookingTime(): saca la hora "HH:mm" de un texto ISO leyéndola tal cual.
export function formatBookingTime(iso: string): string {
  // Si nos pasan algo vacío/null (falsy), devolvemos texto vacío sin reventar.
  if (!iso) return '';
  // Regex: busca una "T" seguida de 2 dígitos, ":", y 2 dígitos más.
  //   - \d significa "un dígito"; {2} significa "exactamente 2 de ellos".
  //   - Los paréntesis (...) son "grupos de captura": guardan lo que coincide
  //     para poder leerlo después por su número.
  // .exec(iso) ejecuta el patrón sobre el texto. Devuelve un arreglo con la
  // coincidencia completa en [0] y cada grupo en [1], [2]... o null si no halló.
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  // Ternario: si hubo coincidencia (m no es null), armamos "HH:mm" con los dos
  // grupos capturados (m[1]=horas, m[2]=minutos). Si no, devolvemos vacío.
  return m ? `${m[1]}:${m[2]}` : '';
}

/** Extrae HH:mm:ss del ISO string sin convertir TZ. */
// formatBookingTimeSec(): igual que la anterior pero incluyendo los segundos.
export function formatBookingTimeSec(iso: string): string {
  if (!iso) return '';
  // Tres grupos: horas, minutos y segundos.
  const m = /T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}:${m[3]}` : '';
}

/** Extrae YYYY-MM-DD del ISO string. */
// bookingDateOnly(): devuelve solo la parte de fecha (sin la hora).
export function bookingDateOnly(iso: string): string {
  if (!iso) return '';
  // Los primeros 10 caracteres de un ISO son "AAAA-MM-DD".
  return iso.substring(0, 10);
}

/**
 * Formatea la fecha sin convertir TZ. Soporta variantes:
 *  - 'long': "Martes 22 de mayo de 2026"
 *  - 'short': "22 may 2026"
 *  - 'numeric': "22/05/2026"
 *  - 'weekday-short': "Mar 22"
 */
// formatBookingDate(): formatea la fecha en varios estilos según "variant".
// "variant" solo puede ser uno de esos 4 textos (es un "union type"); si no se
// pasa, vale 'short' por el "= 'short'".
export function formatBookingDate(
  iso: string,
  variant: 'long' | 'short' | 'numeric' | 'weekday-short' = 'short',
): string {
  if (!iso) return '';
  // Tomamos solo la parte de fecha (10 chars) y la pasamos a dayjs. Al no
  // incluir hora, no hay riesgo de desfase de zona horaria.
  const d = dayjs(iso.substring(0, 10));
  // .isValid() devuelve false si la fecha no se pudo interpretar. El "!" niega:
  // "si NO es válida, devolvemos vacío".
  if (!d.isValid()) return '';
  // "switch" elige un bloque según el valor de "variant" (como varios if/else).
  switch (variant) {
    case 'long': {
      // Formato largo: "lunes 22 de mayo de 2026". Los [corchetes] son texto
      // literal. dddd=día de semana, MMMM=mes completo, YYYY=año.
      const s = d.format('dddd D [de] MMMM [de] YYYY');
      // dayjs devuelve el día en minúscula; ponemos la primera letra en
      // mayúscula: charAt(0).toUpperCase() (primera letra) + slice(1) (el resto).
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    case 'numeric':
      // "22/05/2026" (DD=día, MM=mes, YYYY=año, todo con 2/4 dígitos).
      return d.format('DD/MM/YYYY');
    case 'weekday-short': {
      // "lun 22" -> capitalizado "Lun 22". ddd=día de semana abreviado.
      const s = d.format('ddd D');
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    case 'short':
    // "default" cubre tanto el caso 'short' como cualquier valor inesperado.
    default:
      // "22 may 2026" (MMM=mes abreviado).
      return d.format('D MMM YYYY');
  }
}

/** Devuelve solo el número de día. Ej: "22". */
// formatBookingDay(): extrae los dos dígitos del día del mes.
export function formatBookingDay(iso: string): string {
  if (!iso) return '';
  // En "AAAA-MM-DD" los caracteres 8 y 9 son el día. substring(8,10) los toma.
  return iso.substring(8, 10);
}

/** Devuelve mes corto en mayúsculas. Ej: "MAY". */
// formatBookingMonthShort(): devuelve el nombre abreviado del mes en mayúsculas.
export function formatBookingMonthShort(iso: string): string {
  if (!iso) return '';
  const datePart = iso.substring(0, 10); // "AAAA-MM-DD"
  if (!datePart) return '';
  // split('-') parte "2026-05-22" en ["2026","05","22"]. .map(Number) convierte
  // cada trozo de texto a número: [2026, 5, 22]. La desestructuración los
  // guarda en y (año), m (mes) y d (día).
  const [y, m, d] = datePart.split('-').map(Number);
  // Si alguno faltó o es 0 (falsy), la fecha es inválida -> vacío.
  if (!y || !m || !d) return '';
  // Date.UTC + timeZone:'UTC' evita el desfase
  // Date.UTC(año, mesDesde0, día, hora,...) crea la fecha en UTC. OJO: el mes va
  // de 0 a 11, por eso "m - 1" (mayo=5 se pasa como 4). Ponemos la hora 12:00
  // para quedar lejos de la medianoche y evitar saltos de día por la TZ.
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // toLocaleDateString formatea la fecha según idioma. Pedimos solo el mes
  // abreviado, forzando timeZone:'UTC' para que no se mueva. .toUpperCase() lo
  // pone en mayúsculas: "may" -> "MAY".
  return dt.toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' }).toUpperCase();
}

/** Devuelve día de la semana en minúsculas. Ej: "viernes". */
// formatBookingWeekday(): devuelve el día de la semana completo (en minúsculas).
export function formatBookingWeekday(iso: string): string {
  if (!iso) return '';
  const datePart = iso.substring(0, 10);
  if (!datePart) return '';
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // weekday:'long' pide el nombre completo del día ("viernes").
  return dt.toLocaleDateString('es-MX', { weekday: 'long', timeZone: 'UTC' });
}

/** Fecha + hora juntos para "lun 22 may, 12:00". */
// formatBookingDateTime(): combina fecha corta y hora en un solo texto.
export function formatBookingDateTime(iso: string): string {
  if (!iso) return '';
  // Reutilizamos los helpers de arriba: la fecha en formato "Lun 22" y la hora.
  const date = formatBookingDate(iso, 'weekday-short');
  const time = formatBookingTime(iso);
  // Si hay hora, unimos "fecha, hora"; si no, devolvemos solo la fecha.
  return time ? `${date}, ${time}` : date;
}

/**
 * Comparar si una cita está "hoy o después" según la TZ de la sucursal.
 * Recibe el ISO raw de la cita y la TZ del negocio (ej. 'America/Mexico_City').
 * Si la TZ falta, asume que el server ya está en hora del negocio.
 */
// isBookingUpcoming(): dice si una cita es "de ahora en adelante" (true) o si ya
// pasó (false). "tenantTimezone?" lleva un "?" -> es opcional (puede no pasarse).
export function isBookingUpcoming(iso: string, tenantTimezone?: string | null): boolean {
  if (!iso) return false;
  // Comparamos string a string en formato 'YYYY-MM-DDTHH:mm:ss' para
  // evitar conversión de TZ.
  // Truco: dos fechas escritas como "AAAA-MM-DDTHH:mm:ss" se pueden comparar
  // como TEXTO y el orden alfabético coincide con el orden cronológico. Así
  // evitamos crear objetos Date (que convertirían la zona horaria).
  const apptStr = iso.substring(0, 19); // "2026-05-22T12:00:00"
  // Hora actual en la zona del negocio, en ese mismo formato de texto.
  const nowStr = nowInTenantTz(tenantTimezone);
  // ">=" entre textos: true si la cita es igual o posterior a "ahora".
  return apptStr >= nowStr;
}

/** Devuelve 'YYYY-MM-DDTHH:mm:ss' del momento actual en la TZ dada. */
// nowInTenantTz(): da el instante actual pero "visto" desde una zona horaria
// concreta, como texto. Recibe la zona (opcional) y devuelve un string.
export function nowInTenantTz(timezone?: string | null): string {
  // Si no nos dan zona, usamos la de Ciudad de México por defecto.
  const tz = timezone || 'America/Mexico_City';
  // try/catch: intentamos el cálculo "bueno"; si algo falla (ej. zona inválida)
  // saltamos al catch con un plan B, en lugar de romper la app.
  try {
    // Intl.DateTimeFormat con la TZ devuelve componentes locales.
    // formatToParts() devuelve la fecha partida en piezas etiquetadas
    // ({type:'year', value:'2026'}, {type:'month', value:'05'}, ...).
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, // formato 24h (sin AM/PM)
    }).formatToParts(new Date()); // new Date() = el instante actual real
    // get(): función flecha auxiliar. Busca en "parts" la pieza cuyo type sea
    // "t" y devuelve su value. find() recorre el arreglo y devuelve el PRIMER
    // elemento que cumpla la condición (o undefined). El "?." (optional
    // chaining) lee .value solo si find encontró algo; si no, gracias al "|| '00'"
    // devolvemos '00' para no romper el formato.
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    // Reensamblamos el texto "AAAA-MM-DDTHH:mm:ss" con cada pieza.
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  } catch {
    // Fallback simple sin TZ.
    // Plan B: la hora UTC del navegador, recortada a los primeros 19 chars.
    return new Date().toISOString().substring(0, 19);
  }
}
