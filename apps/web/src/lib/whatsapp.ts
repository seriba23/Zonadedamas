// Helpers para construir links a WhatsApp con mensaje preescrito.
// El usuario hace tap → se abre WhatsApp (web/native) con el mensaje
// listo para enviar al negocio. Cero fricción y los negocios mexicanos
// ya viven en WhatsApp.

// Las rutas que se enlazan aquí (/c/:token, /calendar, /dashboard/...) viven
// en la APP (app.siliba.com), no en la landing estática (siliba.com). Por eso
// el fallback debe ser app.siliba.com: si apunta a siliba.com el cliente recibe
// un 404 al abrir el link de confirmar/reagendar.
const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL || 'https://app.siliba.com';

/**
 * Normaliza un teléfono al formato que espera wa.me (solo dígitos, sin +).
 * "+52 55 1234 5678" → "525512345678"
 */
function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null; // demasiado corto para ser válido
  return digits;
}

/**
 * Construye la URL wa.me con mensaje codificado. Devuelve null si el
 * teléfono no es válido — el caller debe ocultar el botón en ese caso.
 */
export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/** Mensaje preescrito para una compra de la tienda. */
export function buildPurchaseMessage(opts: {
  tenantName: string;
  productName?: string;
  code?: string | null;
  reservationId?: string;
}): string {
  const ref = opts.code ? `#${opts.code}` : opts.reservationId ? `#${opts.reservationId.substring(0, 8).toUpperCase()}` : '';
  const product = opts.productName ? ` del producto *${opts.productName}*` : '';
  const link = opts.reservationId
    ? `\n\nVer apartado: ${WEB_BASE}/dashboard/reservations`
    : '';
  return `Hola ${opts.tenantName}, soy cliente desde Siliba. Quería coordinar la entrega y/o pago${product}.\nReferencia: ${ref}${link}`;
}

// Nombres de meses y días en español para formatear sin convertir TZ.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Formatea un ISO raw como "Viernes 23 de mayo a las 15:30" sin convertir TZ.
 */
function formatBookingDateLong(iso?: string): string {
  if (!iso) return '';
  const datePart = iso.substring(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '';
  // Usamos Date.UTC + getUTCDay() para que el día de la semana coincida
  // con la fecha calendárica, sin TZ shift.
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = DIAS[dt.getUTCDay()];
  const month = MESES[m - 1];
  const timeMatch = /T(\d{2}):(\d{2})/.exec(iso);
  const time = timeMatch ? ` a las ${timeMatch[1]}:${timeMatch[2]}` : '';
  return `${weekday} ${d} de ${month}${time}`;
}

/** Mensaje preescrito para una cita. */
export function buildAppointmentMessage(opts: {
  tenantName: string;
  serviceName?: string;
  startTime?: string;
  appointmentId?: string;
}): string {
  const ref = opts.appointmentId ? `#${opts.appointmentId.substring(0, 8).toUpperCase()}` : '';
  const service = opts.serviceName ? ` del servicio *${opts.serviceName}*` : '';
  const when = opts.startTime ? ` del ${formatBookingDateLong(opts.startTime)}` : '';
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
export function buildReminderMessage(opts: {
  clientFirstName: string;
  tenantName: string;
  serviceName?: string;
  employeeFirstName?: string;
  startTime?: string;
  token: string;
}): string {
  const greeting = `Hola ${opts.clientFirstName},`;
  const service = opts.serviceName ? ` de *${opts.serviceName}*` : '';
  const employee = opts.employeeFirstName ? ` con ${opts.employeeFirstName}` : '';
  const when = opts.startTime ? ` el ${formatBookingDateLong(opts.startTime)}` : '';
  const link = `${WEB_BASE}/c/${opts.token}`;

  return (
    `${greeting}\n` +
    `Te recordamos tu cita${service}${when}${employee} en *${opts.tenantName}*.\n\n` +
    `Confírmala o reagenda aquí:\n${link}`
  );
}

/** Mensaje preescrito para un pago (genérico). */
export function buildPaymentMessage(opts: {
  tenantName: string;
  kind: 'appointment' | 'product';
  code?: string | null;
  reservationId?: string;
  appointmentId?: string | null;
  description?: string;
}): string {
  if (opts.kind === 'product') {
    return buildPurchaseMessage({
      tenantName: opts.tenantName,
      productName: opts.description,
      code: opts.code,
      reservationId: opts.reservationId,
    });
  }
  return buildAppointmentMessage({
    tenantName: opts.tenantName,
    serviceName: opts.description,
    appointmentId: opts.appointmentId || undefined,
  });
}
