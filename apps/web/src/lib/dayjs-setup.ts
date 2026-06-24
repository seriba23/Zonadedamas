/**
 * Setup global de dayjs. Se importa desde DOS lugares: el RootLayout (server)
 * y Providers (client). Ambos son necesarios porque Next.js App Router tiene
 * bundles separados para server y client — si solo se importa en el layout,
 * los Client Components ven una instancia de dayjs sin el plugin extendido.
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
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "dayjs" es una librería muy pequeña para trabajar con fechas y horas
// (parsear, formatear, sumar/restar días, etc.). Es la alternativa ligera a la
// vieja "moment.js". Aquí importamos su función principal.
import dayjs from 'dayjs';
// Un "plugin" es un trozo de código opcional que añade capacidades extra a
// dayjs. Este plugin "utc" habilita el modo UTC: poder hacer `dayjs.utc(...)`
// para leer/formatear una fecha SIN convertirla a la zona horaria del navegador.
import utc from 'dayjs/plugin/utc';
// Esta importación NO trae una variable; solo "carga" el idioma español dentro
// de dayjs (nombres de meses y días en español: enero, lunes, etc.). El simple
// hecho de importarlo registra el idioma en la librería.
import 'dayjs/locale/es';

// extend() "engancha" el plugin a dayjs. A partir de aquí ya existe `dayjs.utc`.
// Si no llamáramos a esto, `dayjs.utc(...)` sería undefined y daría error.
dayjs.extend(utc);
// locale('es') fija el español como idioma por defecto al formatear fechas.
// Ej.: dayjs().format('dddd') devolverá "lunes" en lugar de "Monday".
dayjs.locale('es');
