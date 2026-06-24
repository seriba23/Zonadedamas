// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// clsx: función para combinar clases CSS de forma condicional. Recibe textos,
// objetos o arreglos y devuelve un único string de clases. "type ClassValue"
// importa solo el TIPO (no código) que describe qué acepta clsx como entrada.
import { clsx, type ClassValue } from 'clsx';
// twMerge: de "tailwind-merge". Cuando dos clases de Tailwind se contradicen
// (ej. "p-2" y "p-4"), deja solo la última y elimina la duplicada/conflictiva.
import { twMerge } from 'tailwind-merge';
// dayjs: librería ligera de fechas (formatear, parsear, etc.).
import dayjs from 'dayjs';
// Carga el idioma español dentro de dayjs (meses/días en español).
import 'dayjs/locale/es';

// Fija español como idioma por defecto al formatear fechas con dayjs.
dayjs.locale('es');

// cn(): junta varias clases CSS en un solo string, resolviendo conflictos de
// Tailwind. "...inputs" es un "rest parameter": agrupa TODOS los argumentos que
// reciba en un arreglo llamado "inputs". Así puedes llamar cn('a', 'b', cond &&
// 'c'). Primero clsx arma el string condicional y luego twMerge limpia choques.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Default MXN — la mayoría de tenants opera en pesos mexicanos. USD como
// fallback era trampa: si alguien omitía currency, se mostraba en dólares
// silenciosamente y confundía al usuario. Siempre que sea posible, pasa
// currency explícito (tenant.currency / product.currency).
// formatCurrency(): convierte un número (ej. 1500) en texto de dinero con
// formato (ej. "$1,500.00"). Recibe "amount" (el monto) y "currency" (la
// moneda; si no se pasa, usa 'MXN' por el "= 'MXN'", que es un valor por
// defecto). Devuelve un string. "Intl.NumberFormat" es una herramienta nativa
// del navegador para formatear números según país e idioma ('es-MX' = español
// de México). style:'currency' añade el símbolo y los decimales de dinero.
export function formatCurrency(amount: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',     // formatear como dinero (con símbolo de moneda)
    currency,              // qué moneda (MXN, USD, etc.)
    minimumFractionDigits: 2, // siempre mostrar 2 decimales como mínimo
    maximumFractionDigits: 2, // y como máximo 2 (no muestra más)
  }).format(amount); // .format(numero) produce el texto final
}

// formatDate(): formatea una fecha como texto legible. "date" puede ser un
// string ISO, un objeto Date, o un objeto dayjs (el "|" es "o uno u otro tipo").
// "format" es el patrón de salida (por defecto "1 de may de 2026"). En el
// patrón, lo que va entre [corchetes] se imprime literal (no se interpreta).
export function formatDate(date: string | Date | dayjs.Dayjs, format = 'D [de] MMM [de] YYYY'): string {
  // dayjs(date) crea un objeto dayjs a partir de la fecha y .format() lo pinta.
  return dayjs(date).format(format);
}

// formatTime(): convierte una hora en formato 24h "HH:mm" (ej. "14:30") a
// formato 12h con AM/PM (ej. "2:30 PM"). Recibe un string y devuelve un string.
export function formatTime(time: string): string {
  // Converts "HH:mm" to "h:mm A"
  // split(':') parte "14:30" en el arreglo ["14","30"]. La desestructuración
  // [hoursStr, minutesStr] guarda el primer trozo en hoursStr y el segundo en
  // minutesStr.
  const [hoursStr, minutesStr] = time.split(':');
  // parseInt(texto, 10) convierte "14" en el número 14. El 10 indica base
  // decimal (base 10), para no confundir con números en octal/hexadecimal.
  const hours = parseInt(hoursStr, 10);
  // "minutesStr || '00'": si minutesStr existe lo usa; si fuera vacío/undefined
  // (valor "falsy"), usa '00'. El "||" devuelve el primer valor "verdadero".
  const minutes = minutesStr || '00';
  // Operador ternario "condición ? siVerdad : siFalso". Si la hora es 12 o más,
  // es PM; si no, AM.
  const period = hours >= 12 ? 'PM' : 'AM';
  // "hours % 12" es el resto de dividir entre 12 (convierte 13->1, 14->2...).
  // Si ese resto es 0 (medianoche o mediodía), mostramos 12 en su lugar.
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  // Construimos el texto final con plantilla `...${variable}...`.
  return `${displayHour}:${minutes} ${period}`;
}

/**
 * Extrae "HH:mm" de un datetime ISO sin convertir TZ.
 *
 * Las citas se guardan con la hora "del negocio" interpretada como UTC raw,
 * para mantener consistencia con la generacion de slots del backend
 * (availability service). Usar dayjs/Date local convertiria a la TZ del
 * browser y shiftearia el horario (ej. 9:00 AM se mostraria como 3:00 AM en
 * UTC-6). Este helper lee el UTC tal cual, que coincide con la hora del
 * negocio que el usuario seleccionó.
 */
// formatTimeUtc(): extrae la hora "HH:mm" de una fecha ISO SIN convertir zona
// horaria (ver el comentario largo de arriba). Recibe un string ISO o un Date.
export function formatTimeUtc(input: string | Date): string {
  // "typeof input === 'string'" pregunta si el dato ya es texto. Si lo es, lo
  // usamos tal cual; si es un Date, lo convertimos a texto ISO con
  // .toISOString() (ej. "2026-05-22T14:30:00.000Z").
  const iso = typeof input === 'string' ? input : input.toISOString();
  // .substring(11, 16) toma los caracteres desde la posición 11 hasta la 15
  // (la 16 no se incluye). En un ISO, esas posiciones son justo "HH:mm".
  // Posiciones:  2026-05-22T14:30  →  índice 11='1', 12='4', 13=':', 14='3', 15='0'.
  return iso.substring(11, 16);
}

// getInitials(): arma las iniciales de una persona (ej. "Juan", "Pérez" -> "JP")
// para mostrarlas en un avatar cuando no hay foto.
export function getInitials(firstName: string, lastName: string): string {
  // .charAt(0) toma el primer carácter de cada nombre. Los unimos y
  // .toUpperCase() los pasa a mayúsculas.
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// truncate(): recorta un texto si es más largo que "maxLength" y le añade "..."
// al final. Sirve para no desbordar tarjetas o listas con textos muy largos.
export function truncate(str: string, maxLength: number): string {
  // Si ya es suficientemente corto, lo devolvemos sin tocar.
  if (str.length <= maxLength) return str;
  // .slice(0, maxLength) toma los primeros "maxLength" caracteres y le pegamos
  // los tres puntos.
  return `${str.slice(0, maxLength)}...`;
}

// API_URL: dirección base de la API (backend). process.env.NEXT_PUBLIC_API_URL
// es una "variable de entorno": un valor de configuración que se define fuera
// del código (en un archivo .env). En Next.js, las que empiezan con
// NEXT_PUBLIC_ son visibles también en el navegador. Si no está definida, el
// "||" usa la dirección local por defecto (el server de desarrollo).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Resolves an image URL — returns absolute URLs as-is, prepends API_URL to relative paths */
// resolveImageUrl(): convierte la ruta de una imagen en una URL usable. Si la
// imagen ya es una URL completa, la deja igual; si es una ruta relativa
// (ej. "/uploads/foto.jpg"), le antepone la dirección de la API. "path" puede
// ser string, null o undefined (los "| null | undefined" lo permiten).
export function resolveImageUrl(path: string | null | undefined): string | null {
  // Si no hay ruta (null, undefined o vacía -> "falsy"), devolvemos null.
  if (!path) return null;
  // .startsWith('http...') comprueba si el texto EMPIEZA con eso. Si ya es una
  // URL absoluta (externa o de un CDN), la devolvemos sin cambios.
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // En otro caso es una ruta del backend: la unimos a la URL base de la API.
  return `${API_URL}${path}`;
}
