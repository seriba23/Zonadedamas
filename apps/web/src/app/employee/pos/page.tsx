'use client';

// ============================================================
// Punto de Venta del portal del EMPLEADO/FREELANCER.
// Reusa los mismos componentes del POS del dashboard (PosCheckout +
// PosHistory). Solo es accesible si el empleado tiene `posEnabled` activado
// por el admin, o si es freelancer (dueño). El backend además bloquea las
// mutaciones (payments.create) si no corresponde.
// ============================================================

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PosCheckout } from '@/components/pos/pos-checkout';
import { PosHistory } from '@/components/pos/pos-history';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTenantTier } from '@/lib/hooks/use-tenant-tier';

type Tab = 'sale' | 'history';

export default function EmployeePosPage() {
  const { user } = useAuth();
  const { isFreelancer } = useTenantTier();
  const searchParams = useSearchParams();
  // ?appointmentId=XYZ → el POS arranca con esa cita ya cargada (cuando el
  // empleado pulsa "Proceder al pago" tras finalizar una cita).
  const initialAppointmentId = searchParams.get('appointmentId') || undefined;
  // ?reservationId=XYZ → arranca en Apartados con ese apartado pre-seleccionado.
  const initialReservationId = searchParams.get('reservationId') || undefined;
  const [tab, setTab] = useState<Tab>('sale');

  // Guard de UI: si no tiene acceso al POS, mostramos un aviso en vez de la
  // pantalla de cobro (el backend ya rechazaría las operaciones igualmente).
  const hasPosAccess = !!user?.posEnabled || isFreelancer;
  if (user && !hasPosAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-gray-900">Punto de Venta no disponible</p>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Pide a tu administrador que active tu acceso al Punto de Venta.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs Nueva venta / Historial — estándar del proyecto. */}
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
