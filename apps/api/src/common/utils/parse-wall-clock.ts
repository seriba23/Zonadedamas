/**
 * Parsea un string ISO "wall-clock" (sin TZ explícita) tratándolo SIEMPRE
 * como UTC, independiente de la TZ del proceso Node.
 *
 * Necesario porque `new Date("2026-06-09T12:00:00")` (sin Z) interpreta el
 * string en la TZ del proceso — y si el server no está en UTC, el valor
 * guardado en la DB queda desplazado por el offset local. Eso ocurre
 * históricamente cada vez que dev/local corre el API en una TZ distinta de
 * UTC, y rompe la convención del proyecto: las citas se almacenan como
 * "wall-clock de la sucursal" tal cual, sin conversión.
 *
 * Si el string ya trae Z u offset (`+05:00`, `-06:00`, etc.), se confía en
 * la zona declarada (caso poco común en este proyecto).
 */
export function parseWallClock(iso: string | Date): Date {
  if (iso instanceof Date) return iso;
  if (!iso) return new Date(NaN);
  // Detecta Z al final o offset ±HH:MM/±HHMM. Si los trae, respeta la TZ.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) return new Date(iso);
  // Naive (sin TZ) → forzar UTC para preservar el wall-clock literal.
  return new Date(iso + 'Z');
}
