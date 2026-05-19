import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date | dayjs.Dayjs, format = 'D [de] MMM [de] YYYY'): string {
  return dayjs(date).format(format);
}

export function formatTime(time: string): string {
  // Converts "HH:mm" to "h:mm A"
  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || '00';
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
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
export function formatTimeUtc(input: string | Date): string {
  const iso = typeof input === 'string' ? input : input.toISOString();
  return iso.substring(11, 16);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Resolves an image URL — returns absolute URLs as-is, prepends API_URL to relative paths */
export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_URL}${path}`;
}
