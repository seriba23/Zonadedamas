/**
 * Reglas económicas del sistema de códigos de creador.
 *
 * NOTA IMPORTANTE (a confirmar en pruebas): los montos están expresados como
 * número entero de unidades monetarias y se aplican en la MISMA moneda que el
 * precio de la suscripción de Stripe (se lee dinámicamente de la price). Si el
 * precio está en MXN, $50 = 50 MXN; si está en USD, $50 = 50 USD. Ajustar aquí
 * si el negocio define otros montos/moneda.
 */

export type CreatorTenantKind = 'BUSINESS' | 'FREELANCER';

/** Descuento al cliente durante los meses 1-2 (un solo uso de por vida). */
export const CREATOR_DISCOUNT: Record<CreatorTenantKind, number> = {
  BUSINESS: 50,
  FREELANCER: 25,
};

/** Comisión mensual al influencer a partir del mes 3, mientras el cliente siga activo. */
export const CREATOR_COMMISSION: Record<CreatorTenantKind, number> = {
  BUSINESS: 50,
  FREELANCER: 25,
};

/** Meses con descuento al inicio. */
export const DISCOUNT_MONTHS = 2;

/** Ventana (días) para que, tras cancelar, el cliente conserve su código original. */
export const CLIENT_REACTIVATION_DAYS = 30;

/** Ventana (días) para que, tras cancelar, el influencer conserve la comisión. */
export const INFLUENCER_REACTIVATION_DAYS = 60;

export function tenantKind(tenantType: string | null | undefined): CreatorTenantKind {
  return tenantType === 'FREELANCER' ? 'FREELANCER' : 'BUSINESS';
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Meses completos transcurridos entre dos fechas. */
export function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

/** Días completos transcurridos entre dos fechas. */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export type ReferralState = 'ACTIVO' | 'PAGANDO' | 'EN_RIESGO' | 'PERDIDO';

/**
 * Estado de un cliente referido, derivado del uso + la suscripción del tenant.
 * ACTIVO = pagando, dentro de meses 1-2 (descuento).
 * PAGANDO = mes 3+, activo, genera comisión.
 * EN_RIESGO = canceló, dentro de la ventana de 60d.
 * PERDIDO = canceló y pasó la ventana (o lostAt marcado).
 */
export function referralState(
  usage: { appliedAt: Date; lostAt: Date | null },
  sub: { status: string; cancelledAt: Date | null } | null,
  now: Date = new Date(),
): ReferralState {
  if (usage.lostAt) return 'PERDIDO';

  const status = sub?.status;
  if (status === 'ACTIVE') {
    return monthsBetween(usage.appliedAt, now) < DISCOUNT_MONTHS ? 'ACTIVO' : 'PAGANDO';
  }
  // Cancelada / suspendida / sin suscripción
  if (sub?.cancelledAt) {
    return daysBetween(sub.cancelledAt, now) > INFLUENCER_REACTIVATION_DAYS
      ? 'PERDIDO'
      : 'EN_RIESGO';
  }
  return 'EN_RIESGO';
}
