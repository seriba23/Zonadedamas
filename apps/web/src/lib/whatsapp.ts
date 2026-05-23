// Helpers para construir links a WhatsApp con mensaje preescrito.
// El usuario hace tap → se abre WhatsApp (web/native) con el mensaje
// listo para enviar al negocio. Cero fricción y los negocios mexicanos
// ya viven en WhatsApp.

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL || 'https://siliba.com';

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

/** Mensaje preescrito para una cita. */
export function buildAppointmentMessage(opts: {
  tenantName: string;
  serviceName?: string;
  startTime?: string;
  appointmentId?: string;
}): string {
  const ref = opts.appointmentId ? `#${opts.appointmentId.substring(0, 8).toUpperCase()}` : '';
  const service = opts.serviceName ? ` del servicio *${opts.serviceName}*` : '';
  // Mostramos la hora "tal cual viene" del backend (hora del negocio) sin
  // conversión de TZ.
  let when = '';
  if (opts.startTime) {
    const m = /T(\d{2}):(\d{2})/.exec(opts.startTime);
    const datePart = opts.startTime.substring(0, 10);
    when = ` del ${datePart}${m ? ` a las ${m[1]}:${m[2]}` : ''}`;
  }
  const link = opts.appointmentId
    ? `\n\nVer cita: ${WEB_BASE}/calendar?appointmentId=${opts.appointmentId}`
    : '';
  return `Hola ${opts.tenantName}, soy cliente desde Siliba. Quería preguntar sobre mi cita${service}${when}.\nReferencia: ${ref}${link}`;
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
