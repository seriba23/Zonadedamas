'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { PosCheckout } from '@/components/pos/pos-checkout';

export default function PosPage() {
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  if (checkoutComplete) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Punto de Venta" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Pago procesado</h2>
            <p className="text-gray-500 mb-6">La transacción se completó exitosamente</p>
            <button
              onClick={() => setCheckoutComplete(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#008080' }}
            >
              Nueva venta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Punto de Venta" />
      <div className="flex-1 bg-gray-50 overflow-hidden">
        <PosCheckout onComplete={() => setCheckoutComplete(true)} />
      </div>
    </div>
  );
}
