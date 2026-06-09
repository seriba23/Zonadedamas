/**
 * Setup global de dayjs. Importar UNA vez en el layout root para garantizar
 * que `dayjs.utc(...)` esté disponible en todas las páginas.
 *
 * El plugin utc es crítico: las horas de citas se almacenan como "wall-clock
 * raw" etiquetado como UTC en la DB (ver `parseWallClock` en backend y la
 * doc de `booking-time.ts`). Cualquier `dayjs(iso).format(...)` sin utc
 * convierte al TZ del browser y rompe la convención.
 *
 * Usar `dayjs.utc(iso).format(...)` para horarios de citas, slots y
 * disponibilidad. Para fechas sin componente de hora (ej. hoy/ayer en TZ
 * del usuario), `dayjs()` sin utc sigue siendo correcto.
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/es';

dayjs.extend(utc);
dayjs.locale('es');
