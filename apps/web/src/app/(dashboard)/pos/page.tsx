'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { PosCheckout } from '@/components/pos/pos-checkout';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';

interface Appointment {
  id: string;
  startTime: string;
  client?: { firstName: string; lastName: string };
  items?: Array<{ serviceNameSnapshot: string; priceSnapshot: number; durationSnapshot: number }>;
  status: string;
}

export default function PosPage() {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const { data } = useQuery({
    queryKey: ['appointments-today'],
    queryFn: () =>
      api.get<{ data: Appointment[] }>(
        `/api/appointments?startDate=${today}&endDate=${today}&status=CONFIRMED`,
      ),
  });

  const appointments = (data?.data || []).filter(
    (a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED',
  );

  if (checkoutComplete) {
    return (
      <div className="flex flex-col h-full">
        <Header title="POS" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Pago procesado
            </h2>
            <p className="text-gray-500 mb-6">
              La transacción se completó exitosamente
            </p>
            <button
              onClick={() => {
                setCheckoutComplete(false);
                setSelectedAppointmentId(null);
              }}
              className="btn-primary"
            >
              Nueva transacción
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="POS - Punto de Venta" />

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Appointment selector */}
        <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Citas de hoy
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {formatDate(new Date())}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* No appointment option */}
            <button
              onClick={() => setSelectedAppointmentId(null)}
              className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${!selectedAppointmentId ? 'bg-primary-50' : ''}`}
            >
              <p className="text-sm font-medium text-gray-700">
                Venta directa
              </p>
              <p className="text-xs text-gray-500">Sin cita previa</p>
            </button>

            {appointments.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400">
                No hay citas pendientes hoy
              </div>
            ) : (
              appointments.map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => setSelectedAppointmentId(apt.id)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedAppointmentId === apt.id ? 'bg-primary-50 border-l-2 border-l-primary-600' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {apt.client
                        ? `${apt.client.firstName} ${apt.client.lastName}`
                        : 'Cliente'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTime(
                        new Date(apt.startTime).toTimeString().slice(0, 5),
                      )}
                    </p>
                  </div>
                  {apt.items && apt.items.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {apt.items
                        .map((i) => i.serviceNameSnapshot)
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel - Checkout */}
        <div className="flex-1 bg-gray-50">
          <PosCheckout
            appointmentId={selectedAppointmentId || undefined}
            onComplete={() => setCheckoutComplete(true)}
          />
        </div>
      </div>
    </div>
  );
}
