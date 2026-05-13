/**
 * Parse a date range bound from a query string.
 * Accepts both `YYYY-MM-DD` (legacy) and full ISO (`YYYY-MM-DDTHH:mm:ss.sssZ`).
 * For date-only inputs, fills the time with start/end of day in UTC.
 */
export function parseRangeBound(input: string, mode: 'start' | 'end'): Date {
  if (input.includes('T')) return new Date(input);
  const suffix = mode === 'start' ? 'T00:00:00Z' : 'T23:59:59Z';
  return new Date(input + suffix);
}
