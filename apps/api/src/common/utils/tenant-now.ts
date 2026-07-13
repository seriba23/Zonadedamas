/**
 * "Ahora" en la zona horaria del negocio, devuelto como un Date "wall-clock"
 * (UTC-naive) para poder compararlo directamente contra las horas de cita, que
 * este proyecto guarda como wall-clock de la sucursal forzado a UTC (ver
 * parse-wall-clock.ts). Sin esto, comparar una hora de cita "09:00Z" contra el
 * instante real quedaría desplazado por el offset de la zona del negocio.
 *
 * Ej.: negocio en 'America/Mexico_City' (UTC-6) a las 09:00 locales →
 *   nowInTimezoneAsWallClock('America/Mexico_City') ≈ 2026-07-11T09:00:00Z
 * que es exactamente la base de las horas de los slots ("${fecha}T09:00:00Z").
 *
 * Si no hay zona (o es inválida), cae al instante real (new Date()).
 */
export function nowInTimezoneAsWallClock(timeZone?: string | null): Date {
  const now = new Date();
  if (!timeZone) return now;
  try {
    // Intl nos da los componentes de fecha/hora YA en la zona del negocio.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    // en-CA usa formato 24h; a medianoche algunas plataformas devuelven "24".
    let hour = get('hour');
    if (hour === '24') hour = '00';
    // Reconstruimos como UTC (sufijo Z) para preservar el wall-clock literal.
    return new Date(
      `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`,
    );
  } catch {
    // Zona inválida u otro fallo: usamos el instante real como aproximación.
    return now;
  }
}
