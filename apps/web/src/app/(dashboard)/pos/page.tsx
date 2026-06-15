'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PosCheckout } from '@/components/pos/pos-checkout';
import { PosHistory } from '@/components/pos/pos-history';

type Tab = 'sale' | 'history';

export default function PosPage() {
  const searchParams = useSearchParams();
  // ?appointmentId=XYZ → el POS arranca con esa cita ya cargada en el flujo
  // de cobro. Se usa cuando el cajero pulsa "Proceder al pago" tras
  // finalizar una cita en /calendar.
  const initialAppointmentId = searchParams.get('appointmentId') || undefined;
  // ?reservationId=XYZ → el POS arranca en la tab Apartados con ese
  // apartado pre-seleccionado. Se usa desde el detalle de /reservations
  // con el boton "Cobrar ahora".
  const initialReservationId = searchParams.get('reservationId') || undefined;
  const [tab, setTab] = useState<Tab>('sale');

  return (
    <div className="flex flex-col h-full">
      {/* Tabs Nueva venta / Historial — estándar del proyecto:
          rounded-lg + border, activo teal sólido. */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setTab('sale')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'sale' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Nueva venta
            </button>
            <button
              onClick={() => setTab('history')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                tab === 'history' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Historial
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 overflow-hidden">
        {tab === 'sale' ? (
          // onComplete vacío: el cierre del flujo lo maneja el paso receipt
          // dentro del propio PosCheckout (botón "Nueva venta" / "Confirmar pago").
          <PosCheckout
            onComplete={() => { /* no-op */ }}
            initialAppointmentId={initialAppointmentId}
            initialReservationId={initialReservationId}
          />
        ) : (
          <PosHistory />
        )}
      </div>
    </div>
  );
}
