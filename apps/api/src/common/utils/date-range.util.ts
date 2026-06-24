// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD parseRangeBound — "convierte una fecha de filtro en un Date exacto"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: en los filtros de la API el cliente manda fechas como texto. A
// veces solo el día ("2026-06-23") y a veces la fecha-hora completa. Esta
// función transforma ese texto en un objeto Date concreto. Si solo viene el día,
// decide si representa el INICIO del día (00:00:00) o el FINAL (23:59:59), según
// estemos filtrando "desde" o "hasta". Así, "del 1 al 1 de junio" cubre todo ese
// día completo y no un único instante.

/**
 * Parse a date range bound from a query string.
 * Accepts both `YYYY-MM-DD` (legacy) and full ISO (`YYYY-MM-DDTHH:mm:ss.sssZ`).
 * For date-only inputs, fills the time with start/end of day in UTC.
 */
// Parámetros:
//   - input: el texto de la fecha que llegó del cliente.
//   - mode: 'start' (límite inferior, inicio del día) o 'end' (límite superior,
//     fin del día). El tipo "'start' | 'end'" obliga a que sea uno de esos dos.
// Devuelve: un objeto Date.
export function parseRangeBound(input: string, mode: 'start' | 'end'): Date {
  // Si el texto ya incluye una "T", significa que trae también la hora (formato
  // ISO completo, ej. "2026-06-23T15:30:00Z"). En ese caso lo usamos tal cual.
  if (input.includes('T')) return new Date(input);
  // Si solo vino el día, elegimos qué hora añadirle según el modo (ternario):
  //   - 'start' -> el comienzo del día: 00:00:00.
  //   - 'end'   -> el final del día: 23:59:59.
  // La "Z" final fija la zona horaria en UTC para no depender de la del servidor.
  const suffix = mode === 'start' ? 'T00:00:00Z' : 'T23:59:59Z';
  // Concatenamos el día con la hora elegida y creamos el Date resultante.
  return new Date(input + suffix);
}
