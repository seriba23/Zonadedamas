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
// Parámetro "iso": puede ser un texto ISO o ya un objeto Date (el tipo
// "string | Date" admite ambos). Devuelve siempre un Date.
export function parseWallClock(iso: string | Date): Date {
  // Si ya nos pasaron un Date, no hay nada que parsear: lo devolvemos tal cual.
  // "instanceof Date" comprueba que el valor sea un objeto Date.
  if (iso instanceof Date) return iso;
  // Si el texto es vacío/null/undefined ("!iso" es verdadero en esos casos),
  // devolvemos una fecha INVÁLIDA (new Date(NaN)). Quien la reciba podrá
  // detectar el problema con isNaN(fecha.getTime()).
  if (!iso) return new Date(NaN);
  // Detecta Z al final o offset ±HH:MM/±HHMM. Si los trae, respeta la TZ.
  // La expresión regular /.../ analiza el texto:
  //   - "Z$": termina en la letra Z (zona UTC declarada).
  //   - "|" : O...
  //   - "[+-]\d{2}:?\d{2}$": termina en un offset como +05:00, -0600, etc.
  //     ([+-] = signo, \d{2} = dos dígitos, :? = dos puntos opcionales).
  // .test(iso) devuelve true si el texto encaja. Si trae zona, confiamos en ella.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) return new Date(iso);
  // Naive (sin TZ) → forzar UTC para preservar el wall-clock literal.
  // Al no haber zona, le pegamos una "Z" al final para que JavaScript lo
  // interprete como UTC y NO lo desplace según la zona horaria del servidor.
  return new Date(iso + 'Z');
}
