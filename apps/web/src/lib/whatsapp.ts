// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: whatsapp.ts
// ─────────────────────────────────────────────────────────────────────────────
// Helpers para construir links a WhatsApp con mensaje preescrito.
// El usuario hace tap → se abre WhatsApp (web/native) con el mensaje
// listo para enviar al negocio. Cero fricción y los negocios mexicanos
// ya viven en WhatsApp.
//
// Cómo funciona wa.me:
//   https://wa.me/<telefono>?text=<mensaje_codificado>
//   Al abrir esta URL, WhatsApp carga un chat con el número dado y el
//   mensaje ya escrito (pero SIN enviarlo todavía, el usuario lo confirma).
//   encodeURIComponent() convierte caracteres especiales (ñ, á, espacios,
//   saltos de línea) a su versión segura para URL (ej. "%0A" = salto de línea).
// ─────────────────────────────────────────────────────────────────────────────

// Las rutas que se enlazan aquí (/c/:token, /calendar, /dashboard/...) viven
// en la APP (app.siliba.com), no en la landing estática (siliba.com). Por eso
// el fallback debe ser app.siliba.com: si apunta a siliba.com el cliente recibe
// un 404 al abrir el link de confirmar/reagendar.
//
// NEXT_PUBLIC_WEB_URL → variable de entorno con la URL pública de la app.
// || → si no está definida, usamos el dominio de producción como valor por defecto.
const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL || 'https://app.siliba.com';

/**
 * Normaliza un teléfono al formato que espera wa.me (solo dígitos, sin +).
 * "+52 55 1234 5678" → "525512345678"
 */
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN INTERNA: normalizePhone
// ─────────────────────────────────────────────────────────────────────────────
// wa.me solo acepta dígitos en el número de teléfono, sin espacios, guiones,
// paréntesis ni el símbolo +. Esta función limpia cualquier teléfono a ese
// formato.
//
// Parámetros:
//   phone → teléfono en cualquier formato (puede ser null/undefined si
//           el negocio no lo proporcionó). El `?` hace el parámetro opcional.
//
// Devuelve: string con solo dígitos, o null si el número es inválido.
//
// /\D/g → expresión regular: \D significa "cualquier carácter que NO sea dígito".
//   La bandera 'g' (global) reemplaza TODOS los no-dígitos, no solo el primero.
// .replace(/\D/g, '') → reemplaza cada no-dígito por '' (vacío), eliminándolo.
// Ejemplo: "+52 (55) 1234-5678" → "525512345678"
function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null; // sin teléfono: no podemos construir el link
  const digits = phone.replace(/\D/g, ''); // eliminamos todo lo que no sea dígito
  if (digits.length < 8) return null; // demasiado corto para ser válido (mínimo 8 dígitos)
  return digits;
}

/**
 * Construye la URL wa.me con mensaje codificado. Devuelve null si el
 * teléfono no es válido — el caller debe ocultar el botón en ese caso.
 */
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: buildWhatsAppUrl
// ─────────────────────────────────────────────────────────────────────────────
// Construye la URL completa wa.me para abrir WhatsApp con un mensaje listo.
//
// Parámetros:
//   phone   → teléfono del negocio (cualquier formato; se normaliza internamente)
//   message → texto del mensaje preescrito (puede contener saltos de línea,
//             tildes, emojis, etc.)
//
// Devuelve: string con la URL completa, o null si el teléfono no es válido.
//           El componente que llama a esta función debe comprobar null y
//           ocultar el botón de WhatsApp si devuelve null.
//
// encodeURIComponent(message) → convierte el mensaje a formato seguro para URL:
//   espacios → %20, ñ → %C3%B1, saltos de línea (\n) → %0A, etc.
//   Sin esto, la URL sería inválida y WhatsApp no la leería bien.
export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const normalized = normalizePhone(phone); // limpiamos el teléfono
  if (!normalized) return null;            // teléfono inválido: no podemos construir el link
  // Template literal (string con backticks) que inserta los valores directamente.
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: buildPurchaseMessage
// ─────────────────────────────────────────────────────────────────────────────
// Construye el mensaje preescrito para cuando un cliente quiere coordinar
// la entrega o pago de un producto comprado en la tienda del negocio.
//
// Parámetros (en un objeto `opts`):
//   tenantName    → nombre del negocio
//   productName   → nombre del producto (opcional)
//   code          → código de cupón/referencia (opcional, puede ser null)
//   reservationId → ID del apartado/reserva (opcional)
//
// Devuelve: string con el mensaje formateado listo para enviar por WhatsApp.
//
// Lógica de la referencia (operadores ternarios anidados):
//   opts.code ? `#${opts.code}`                       → si hay código, usarlo
//   : opts.reservationId ? `#${...substring(0,8)...}` → si no, usar los primeros 8 chars del ID
//   : ''                                              → si ninguno existe, cadena vacía
//
// .substring(0, 8) → toma los primeros 8 caracteres (índice 0 incluido, 8 excluido).
// .toUpperCase()   → convierte a mayúsculas (ej. "abc12345" → "ABC12345").
// El resultado es una referencia legible, ej. "#ABC12345".
/** Mensaje preescrito para una compra de la tienda. */
export function buildPurchaseMessage(opts: {
  tenantName: string;
  productName?: string;
  code?: string | null;
  reservationId?: string;
}): string {
  // Referencia: usamos código de cupón si existe; si no, los primeros 8 chars del ID.
  const ref = opts.code ? `#${opts.code}` : opts.reservationId ? `#${opts.reservationId.substring(0, 8).toUpperCase()}` : '';
  // Nombre del producto: solo incluimos la parte si hay nombre.
  // El `*` de cada lado aplica negrita en WhatsApp.
  const product = opts.productName ? ` del producto *${opts.productName}*` : '';
  // Link al dashboard de reservas (solo si hay reservationId).
  // \n es un salto de línea en el string (nueva línea en el mensaje).
  const link = opts.reservationId
    ? `\n\nVer apartado: ${WEB_BASE}/dashboard/reservations`
    : '';
  // Template literal final: concatena todas las partes del mensaje.
  return `Hola ${opts.tenantName}, soy cliente desde Siliba. Quería coordinar la entrega y/o pago${product}.\nReferencia: ${ref}${link}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES: MESES y DIAS
// ─────────────────────────────────────────────────────────────────────────────
// Arrays con los nombres en español de meses y días de la semana.
// Se usan como "tabla de conversión": dado un número (0-11 para meses,
// 0-6 para días), obtenemos el nombre en español con MESES[m-1] o DIAS[d].
//
// Por qué no usar Date.toLocaleDateString('es-MX'):
//   Los ISO strings del backend incluyen la hora en UTC ('Z'). Si los
//   pasáramos a `new Date()` y formateáramos con la zona horaria local,
//   el día podría desplazarse (ej. "2026-06-17T01:00:00Z" en GMT-6
//   aparecería como "16 de junio"). Usando Date.UTC + getUTC* evitamos ese problema.
// Nombres de meses y días en español para formatear sin convertir TZ.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Formatea un ISO raw como "Viernes 23 de mayo a las 15:30" sin convertir TZ.
 */
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN INTERNA: formatBookingDateLong
// ─────────────────────────────────────────────────────────────────────────────
// Convierte un string ISO 8601 (ej. "2026-06-17T15:30:00Z") al formato
// legible en español "Miércoles 17 de junio a las 15:30".
//
// Parámetros:
//   iso → string ISO 8601 (puede ser undefined si no hay fecha)
//
// Devuelve: string formateado, o string vacío si no hay fecha.
//
// Detalles técnicos de cada operación:
//   iso.substring(0, 10) → toma solo la parte de fecha "YYYY-MM-DD"
//   .split('-')          → divide por guion: ["2026", "06", "17"]
//   .map(Number)         → convierte cada string a número: [2026, 6, 17]
//   [y, m, d]            → desestructuración: asigna año, mes, día
//   Date.UTC(y, m-1, d)  → timestamp UTC del día (m-1 porque Date usa 0-11)
//   dt.getUTCDay()       → día de la semana en UTC (0=domingo, 6=sábado)
//   /T(\d{2}):(\d{2})/.exec(iso) → busca "T15:30" en el ISO y captura los grupos
//     \d{2} → exactamente 2 dígitos. Los grupos () se capturan en el array de resultado.
//     exec devuelve null si no hay coincidencia (cuando no hay hora en el string).
function formatBookingDateLong(iso?: string): string {
  if (!iso) return ''; // sin fecha: devolvemos vacío
  const datePart = iso.substring(0, 10); // ej. "2026-06-17"
  // split('-') → ["2026", "06", "17"], .map(Number) → [2026, 6, 17]
  // Desestructuración: const [y, m, d] = [2026, 6, 17]  →  y=2026, m=6, d=17
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return ''; // si algún componente es 0/NaN: fecha inválida

  // Usamos Date.UTC + getUTCDay() para que el día de la semana coincida
  // con la fecha calendárica, sin TZ shift.
  // Date.UTC devuelve los milisegundos desde 1970-01-01 00:00:00 UTC.
  // m-1 porque el constructor de Date trata enero=0, febrero=1, etc.
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = DIAS[dt.getUTCDay()];  // índice 0-6 → nombre del día
  const month = MESES[m - 1];           // índice 0-11 → nombre del mes

  // Extraemos la hora del string ISO si existe.
  // /T(\d{2}):(\d{2})/ busca el patrón "T" + 2 dígitos + ":" + 2 dígitos.
  // exec() devuelve null si no hay coincidencia, o un array donde:
  //   [0] → coincidencia completa "T15:30"
  //   [1] → primer grupo capturado "15" (horas)
  //   [2] → segundo grupo capturado "30" (minutos)
  const timeMatch = /T(\d{2}):(\d{2})/.exec(iso);
  // Si hay hora, formateamos " a las HH:MM"; si no, string vacío.
  const time = timeMatch ? ` a las ${timeMatch[1]}:${timeMatch[2]}` : '';
  return `${weekday} ${d} de ${month}${time}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: buildAppointmentMessage
// ─────────────────────────────────────────────────────────────────────────────
// Construye el mensaje del cliente hacia el negocio para preguntar sobre
// una cita específica.
//
// Parámetros (en un objeto `opts`):
//   tenantName    → nombre del negocio
//   serviceName   → nombre del servicio de la cita (opcional)
//   startTime     → fecha y hora ISO de la cita (opcional)
//   appointmentId → ID de la cita (opcional; si existe, añadimos link al calendario)
//
// Devuelve: string con el mensaje formateado.
//
// Cada parte del mensaje se calcula por separado y se inserta en el template
// literal solo si tiene valor (operador ternario). Las partes opcionales
// resultan en '' (cadena vacía) si no hay datos, por lo que el mensaje
// siempre tiene sentido aunque falten campos.
/** Mensaje preescrito para una cita. */
export function buildAppointmentMessage(opts: {
  tenantName: string;
  serviceName?: string;
  startTime?: string;
  appointmentId?: string;
}): string {
  // Referencia: primeros 8 caracteres del ID en mayúsculas, ej. "#ABC12345"
  const ref = opts.appointmentId ? `#${opts.appointmentId.substring(0, 8).toUpperCase()}` : '';
  // Nombre del servicio con formato negrita WhatsApp (*texto*)
  const service = opts.serviceName ? ` del servicio *${opts.serviceName}*` : '';
  // Fecha y hora formateadas, ej. " del Miércoles 17 de junio a las 15:30"
  const when = opts.startTime ? ` del ${formatBookingDateLong(opts.startTime)}` : '';
  // Link al calendario con la cita resaltada (solo si hay ID de cita).
  // Los \n crean saltos de línea en el mensaje de WhatsApp.
  const link = opts.appointmentId
    ? `\n\nVer cita: ${WEB_BASE}/calendar?appointmentId=${opts.appointmentId}`
    : '';
  return `Hola ${opts.tenantName}, soy cliente desde Siliba. Quería preguntar sobre mi cita${service}${when}.\nReferencia: ${ref}${link}`;
}

/**
 * Mensaje del NEGOCIO HACIA EL CLIENTE como recordatorio de cita. Incluye
 * link a /c/:token donde el cliente puede confirmar, reagendar o cancelar.
 * Se compone desde la perspectiva del negocio que escribe al cliente.
 */
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: buildReminderMessage
// ─────────────────────────────────────────────────────────────────────────────
// Construye el mensaje de recordatorio que el NEGOCIO envía AL CLIENTE.
// (Flujo inverso al de buildAppointmentMessage: aquí es el negocio quien escribe.)
//
// Incluye un link especial /c/:token donde el cliente puede:
//   - Confirmar la cita
//   - Reagendarla a otra hora
//   - Cancelarla
// El token es único por cita y de un solo uso.
//
// Parámetros (en un objeto `opts`):
//   clientFirstName   → nombre del cliente (para el saludo personalizado)
//   tenantName        → nombre del negocio
//   serviceName       → nombre del servicio (opcional)
//   employeeFirstName → nombre del profesional asignado (opcional)
//   startTime         → fecha y hora ISO de la cita (opcional)
//   token             → token único para el link de confirmación (obligatorio)
//
// Devuelve: string con el mensaje listo para enviar por WhatsApp.
//
// La concatenación al final usa el operador + entre strings en lugar del
// template literal para mejorar la legibilidad cuando el mensaje es largo.
export function buildReminderMessage(opts: {
  clientFirstName: string;
  tenantName: string;
  serviceName?: string;
  employeeFirstName?: string;
  startTime?: string;
  token: string;
}): string {
  const greeting = `Hola ${opts.clientFirstName},`;                               // saludo personalizado
  const service = opts.serviceName ? ` de *${opts.serviceName}*` : '';           // nombre del servicio en negrita
  const employee = opts.employeeFirstName ? ` con ${opts.employeeFirstName}` : ''; // nombre del profesional
  const when = opts.startTime ? ` el ${formatBookingDateLong(opts.startTime)}` : ''; // fecha formateada
  // Link único de confirmación. opts.token siempre existe (campo obligatorio).
  const link = `${WEB_BASE}/c/${opts.token}`;

  // Concatenación de strings con + para organizar el mensaje en líneas legibles.
  // \n = salto de línea simple, \n\n = párrafo (línea en blanco entre secciones).
  return (
    `${greeting}\n` +
    `Te recordamos tu cita${service}${when}${employee} en *${opts.tenantName}*.\n\n` +
    `Confírmala o reagenda aquí:\n${link}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: buildPaymentMessage
// ─────────────────────────────────────────────────────────────────────────────
// Función genérica que construye el mensaje de WhatsApp apropiado según
// el tipo de pago: producto comprado o cita de servicio.
// Evita que los llamadores tengan que saber qué función específica llamar.
//
// Parámetros (en un objeto `opts`):
//   tenantName    → nombre del negocio
//   kind          → 'appointment' para citas, 'product' para compras de tienda
//   code          → código de cupón/referencia (opcional, puede ser null)
//   reservationId → ID del apartado (para productos, opcional)
//   appointmentId → ID de la cita (para citas, opcional, puede ser null)
//   description   → nombre del producto o del servicio (opcional)
//
// Devuelve: string con el mensaje formateado.
//
// Lógica de despacho:
//   Si kind === 'product' → usamos buildPurchaseMessage
//   Si no (implícitamente kind === 'appointment') → usamos buildAppointmentMessage
//
// `opts.appointmentId || undefined`:
//   Si appointmentId es null, lo convertimos a undefined para que los tipos
//   cuadren con el parámetro opcional de buildAppointmentMessage (string | undefined).
//   null || undefined → undefined (porque null es falsy, || usa el lado derecho).
/** Mensaje preescrito para un pago (genérico). */
export function buildPaymentMessage(opts: {
  tenantName: string;
  kind: 'appointment' | 'product'; // solo estos dos valores son válidos
  code?: string | null;
  reservationId?: string;
  appointmentId?: string | null;
  description?: string;
}): string {
  // Si es un producto, delegamos en buildPurchaseMessage.
  if (opts.kind === 'product') {
    return buildPurchaseMessage({
      tenantName: opts.tenantName,
      productName: opts.description,  // la descripción es el nombre del producto
      code: opts.code,
      reservationId: opts.reservationId,
    });
  }
  // Si es una cita (el else implícito cuando kind !== 'product'),
  // delegamos en buildAppointmentMessage.
  return buildAppointmentMessage({
    tenantName: opts.tenantName,
    serviceName: opts.description,        // la descripción es el nombre del servicio
    // null || undefined → undefined (conversión de null a undefined para el tipo)
    appointmentId: opts.appointmentId || undefined,
  });
}
