'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { useCurrency } from '@/lib/hooks/use-currency';
import { ConfettiCelebration } from '@/components/ui/confetti-celebration';

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SuccessService {
  id: string;
  name: string;
  price: number;
  employeeName?: string;
}

interface AppointmentSuccessSheetProps {
  /** Nombre del negocio. En el flujo del cliente se muestra; en el admin se
   * puede omitir o pasar el del tenant actual. */
  businessName?: string;
  /** Servicios contratados (nombre, precio y opcional empleado por servicio). */
  services: SuccessService[];
  /** ISO string del inicio de la cita. */
  startTime: string;
  /** Nombre completo del profesional principal (si hay uno solo). */
  employeeName?: string;
  /** Total de la cita en la moneda actual. */
  total: number;
  /** Puntos ganados con la reserva. Si null/0 no se muestra. */
  pointsEarned?: number;
  /** Texto del botón primario. Default "Aceptar". */
  primaryLabel?: string;
  /** Texto del botón secundario. Si null no se muestra. */
  secondaryLabel?: string;
  /** Callback del botón primario. */
  onPrimary: () => void;
  /** Callback del botón secundario. Opcional. */
  onSecondary?: () => void;
  /** Si el tenant deshabilitó la animación de confeti, pásalo como false. */
  confettiEnabled?: boolean;
}

/**
 * Pantalla de éxito tras reservar/crear cita. Estilo unificado para
 * cliente del marketplace y admin del dashboard, basado en la card que
 * usaba el flujo del cliente (negocio + servicios + horario + profesional
 * + total + puntos). Disparа confeti corto (5s, partículas reducidas).
 */
export function AppointmentSuccessSheet({
  businessName,
  services,
  startTime,
  employeeName,
  total,
  pointsEarned,
  primaryLabel = 'Aceptar',
  secondaryLabel,
  onPrimary,
  onSecondary,
  confettiEnabled = true,
}: AppointmentSuccessSheetProps) {
  const { format: formatCurrency } = useCurrency();
  const [confettiDone, setConfettiDone] = useState(false);

  return (
    <>
      {confettiEnabled && (
        <ConfettiCelebration
          show={!confettiDone}
          duration={5000}
          particlesPerBurst={20}
          onComplete={() => setConfettiDone(true)}
        />
      )}

      <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center px-4">
        <div
          className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col border-2 animate-bounce-in"
          style={{ borderColor: TEAL }}
        >
          {/* Header con check */}
          <div className="px-6 pt-6 pb-3 text-center">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: TEAL_LIGHT }}
            >
              <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Reserva confirmada</h2>
            <p className="text-sm text-gray-500 mt-1">
              Tu cita ha sido reservada exitosamente.
            </p>
          </div>

          {/* Detalle */}
          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
            {businessName && (
              <Row label="Negocio" value={businessName} />
            )}

            <Row
              label={services.length === 1 ? 'Servicio' : 'Servicios'}
              value={services.map((s) => s.name).join(', ')}
            />

            <Row
              label="Fecha y hora"
              value={dayjs(startTime).format('D [de] MMM [de] YYYY, h:mm A')}
            />

            {employeeName && (
              <Row label="Profesional" value={employeeName} />
            )}

            <Row label="Total" value={formatCurrency(total)} valueBold />

            {pointsEarned != null && pointsEarned > 0 && (
              <div
                className="rounded-xl p-3 flex items-center justify-between"
                style={{ backgroundColor: TEAL_LIGHT }}
              >
                <span className="text-xs font-medium" style={{ color: TEAL }}>
                  Puntos ganados
                </span>
                <span className="text-sm font-bold" style={{ color: TEAL }}>
                  +{pointsEarned} pts
                </span>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="border-t border-gray-100 p-4 space-y-2">
            <button
              onClick={onPrimary}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: TEAL }}
            >
              {primaryLabel}
            </button>
            {secondaryLabel && onSecondary && (
              <button
                onClick={onSecondary}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, valueBold }: { label: string; value: string; valueBold?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm text-gray-900 mt-0.5 ${valueBold ? 'font-bold' : ''}`}>
        {value}
      </p>
    </div>
  );
}
