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
      {/* Toggle Nueva venta / Historial — cápsula (sistema soft), activo teal. */}
      <div className="border-b px-4 py-3" style={{ backgroundColor: 'var(--soft-card)', borderColor: 'var(--soft-border)' }}>
        <div className="max-w-2xl mx-auto flex justify-center">
          <div className="inline-flex p-1 rounded-full" style={{ backgroundColor: 'var(--soft-tint)' }}>
            {(['sale', 'history'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${tab === t ? 'text-white' : 'text-[#5b6e6a]'}`}
                style={tab === t ? { backgroundColor: '#008080' } : {}}
              >
                {t === 'sale' ? 'Nueva venta' : 'Historial'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden" style={{ backgroundColor: '#f5f8f7' }}>
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
