'use client';

// Sección propia de "Métodos de pago" del negocio (efectivo, SPEI, tarjeta),
// independiente de la tienda. Antes esta ruta era un placeholder de "Cobros en
// línea (Stripe) — próximamente"; los cobros en línea cliente→negocio siguen
// reservados para V2, pero la configuración de métodos de pago aceptados sí
// vive aquí ahora (la usa la tienda y el anticipo de citas).
import { PaymentMethodsContent } from '@/components/settings/payment-methods-content';

export default function PaymentsSettingsPage() {
  return <PaymentMethodsContent />;
}
