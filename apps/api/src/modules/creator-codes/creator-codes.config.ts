/**
 * Reglas económicas del sistema de códigos de creador.
 *
 * NOTA IMPORTANTE (a confirmar en pruebas): los montos están expresados como
 * número entero de unidades monetarias y se aplican en la MISMA moneda que el
 * precio de la suscripción de Stripe (se lee dinámicamente de la price). Si el
 * precio está en MXN, $50 = 50 MXN; si está en USD, $50 = 50 USD. Ajustar aquí
 * si el negocio define otros montos/moneda.
 */

// "type" crea un ALIAS de tipo: damos un nombre a un conjunto de valores
// permitidos. Aquí CreatorTenantKind solo puede valer 'BUSINESS' (un negocio
// con varios empleados) o 'FREELANCER' (un profesional independiente). El "|"
// se lee como "o": el valor es uno U otro de esos dos textos exactos.
// ─────────────────────────────────────────────────────────────────────────────
// Este archivo NO tiene imports ni clases: solo define las REGLAS ECONÓMICAS
// (constantes) y unas funciones de cálculo (helpers) que el resto del módulo
// reutiliza. Centralizar aquí los montos y plazos evita repetir números mágicos
// por todo el código y facilita cambiarlos en un solo lugar.
// ─────────────────────────────────────────────────────────────────────────────

export type CreatorTenantKind = 'BUSINESS' | 'FREELANCER';

/** Descuento al cliente durante los meses 1-2 (un solo uso de por vida). */
// "export const" = constante (valor fijo que no cambia) visible desde otros
// archivos. "Record<CreatorTenantKind, number>" es un objeto-diccionario cuyas
// CLAVES son los dos tipos de tenant y cuyos VALORES son números. Así, según el
// tipo de negocio, sabemos cuánto descuento darle al cliente al inicio.
export const CREATOR_DISCOUNT: Record<CreatorTenantKind, number> = {
  BUSINESS: 50,   // un negocio recibe 50 de descuento
  FREELANCER: 25, // un freelancer recibe 25 de descuento
};

/** Comisión mensual al influencer a partir del mes 3, mientras el cliente siga activo. */
// Mismo formato que arriba, pero esto es lo que GANA el influencer cada mes
// (a partir del mes 3) por cada cliente que sigue pagando su suscripción.
export const CREATOR_COMMISSION: Record<CreatorTenantKind, number> = {
  BUSINESS: 50,   // por cada negocio referido activo: 50 al mes
  FREELANCER: 25, // por cada freelancer referido activo: 25 al mes
};

/** Meses con descuento al inicio. */
// Durante estos primeros meses el cliente recibe descuento y el influencer
// todavía NO cobra comisión. Pasados estos meses empieza la comisión.
export const DISCOUNT_MONTHS = 2;

/** Ventana (días) para que, tras cancelar, el cliente conserve su código original. */
// Si el cliente cancela y vuelve dentro de estos 30 días, mantiene su código.
export const CLIENT_REACTIVATION_DAYS = 30;

/** Ventana (días) para que, tras cancelar, el influencer conserve la comisión. */
// Si el cliente referido cancela, el influencer aún puede "recuperarlo" si el
// cliente reactiva dentro de estos 60 días. Pasados los 60, se da por perdido.
export const INFLUENCER_REACTIVATION_DAYS = 60;

// Función que normaliza el tipo de tenant. Recibe "tenantType", que puede venir
// como texto, o como null/undefined (no definido). Devuelve siempre uno de los
// dos valores válidos de CreatorTenantKind.
export function tenantKind(tenantType: string | null | undefined): CreatorTenantKind {
  // Operador ternario: condición ? valorSiVerdad : valorSiFalso.
  // "===" compara valor Y tipo de forma estricta (sin conversiones raras).
  // Si el texto es exactamente 'FREELANCER' devolvemos 'FREELANCER'; en cualquier
  // otro caso (incluido null/undefined) asumimos 'BUSINESS' por defecto.
  return tenantType === 'FREELANCER' ? 'FREELANCER' : 'BUSINESS';
}

// Milisegundos que tiene un día: 24 horas * 60 minutos * 60 segundos * 1000 ms.
// Lo usamos para convertir diferencias de tiempo (en ms) a días.
const DAY_MS = 24 * 60 * 60 * 1000;

/** Meses completos transcurridos entre dos fechas. */
// Recibe dos fechas (from = inicio, to = fin) y devuelve cuántos MESES COMPLETOS
// han pasado entre ellas (un número entero).
export function monthsBetween(from: Date, to: Date): number {
  // "let" = variable que SÍ puede cambiar luego (a diferencia de const).
  // Calculamos los meses en dos partes:
  //   1) diferencia de años * 12 (cada año son 12 meses).
  //   2) más la diferencia de número de mes (getMonth() da 0=enero ... 11=dic).
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // Ajuste: si el DÍA del mes final es menor que el del inicial, todavía no se
  // ha completado el último mes, así que restamos 1. Ej.: del 15-ene al 10-feb
  // aún no es "1 mes completo".
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

/** Días completos transcurridos entre dos fechas. */
export function daysBetween(from: Date, to: Date): number {
  // getTime() devuelve la fecha en milisegundos. Restamos fin - inicio para
  // obtener la distancia en ms, la dividimos entre los ms de un día y con
  // Math.floor() quitamos los decimales (redondeo hacia abajo) => días enteros.
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

// Alias de tipo con los 4 estados posibles de un cliente referido.
export type ReferralState = 'ACTIVO' | 'PAGANDO' | 'EN_RIESGO' | 'PERDIDO';

/**
 * Estado de un cliente referido, derivado del uso + la suscripción del tenant.
 * ACTIVO = pagando, dentro de meses 1-2 (descuento).
 * PAGANDO = mes 3+, activo, genera comisión.
 * EN_RIESGO = canceló, dentro de la ventana de 60d.
 * PERDIDO = canceló y pasó la ventana (o lostAt marcado).
 */
// Parámetros:
//   - usage: el "uso del código" (cuándo se aplicó y si ya se marcó como perdido).
//   - sub: la suscripción del negocio referido (su estado y si se canceló), o null.
//   - now: el momento actual; por defecto new Date() (ahora). Permite pasar otra
//     fecha para pruebas. Devuelve uno de los 4 estados (ReferralState).
export function referralState(
  usage: { appliedAt: Date; lostAt: Date | null },
  sub: { status: string; cancelledAt: Date | null } | null,
  now: Date = new Date(),
): ReferralState {
  // Si el uso ya tiene fecha de "perdido" (lostAt), el cliente está PERDIDO.
  // "if (usage.lostAt)" es verdad cuando lostAt NO es null (tiene una fecha).
  if (usage.lostAt) return 'PERDIDO';

  // "?." (optional chaining): si "sub" es null, NO intenta leer .status y
  // devuelve undefined sin romper. Así "status" será el estado de la suscripción
  // o undefined si no hay suscripción.
  const status = sub?.status;
  if (status === 'ACTIVE') {
    // Suscripción activa: si aún está dentro de los meses de descuento => ACTIVO;
    // si ya pasó ese periodo (mes 3+) => PAGANDO (genera comisión).
    return monthsBetween(usage.appliedAt, now) < DISCOUNT_MONTHS ? 'ACTIVO' : 'PAGANDO';
  }
  // Cancelada / suspendida / sin suscripción
  // Si hay fecha de cancelación, decidimos según cuántos días han pasado:
  if (sub?.cancelledAt) {
    // Si pasaron MÁS días que la ventana de reactivación (60) => PERDIDO;
    // si todavía está dentro de la ventana => EN_RIESGO (puede volver).
    return daysBetween(sub.cancelledAt, now) > INFLUENCER_REACTIVATION_DAYS
      ? 'PERDIDO'
      : 'EN_RIESGO';
  }
  // Sin fecha de cancelación clara (p. ej. suspendida sin cancelledAt): lo
  // tratamos como EN_RIESGO por precaución.
  return 'EN_RIESGO';
}
