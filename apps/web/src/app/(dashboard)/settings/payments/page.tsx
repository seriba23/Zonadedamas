'use client';

import Link from 'next/link';

/**
 * Stripe Connect (que los clientes paguen sus servicios al negocio en línea)
 * está desactivado en V1. Stripe queda reservado solo para que los negocios
 * paguen su mensualidad SaaS (ver /settings/subscription). V2 reactivará
 * cobros en línea cliente → negocio.
 */
export default function PaymentsSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Cobros en línea — próximamente</h1>
        <p className="text-sm text-gray-500 mb-6">
          La opción para aceptar pagos en línea de tus clientes a través de Stripe estará disponible en una próxima versión.
          Por ahora, los pagos de servicios y productos se registran en el Punto de venta.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/pos"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#008080' }}
          >
            Ir al Punto de venta
          </Link>
          <Link
            href="/settings/subscription"
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Mi suscripción
          </Link>
        </div>
      </div>
    </div>
  );
}
