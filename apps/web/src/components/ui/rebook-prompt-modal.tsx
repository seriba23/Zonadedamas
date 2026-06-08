'use client';

import { useRouter } from 'next/navigation';

const TEAL = '#008080';

interface RebookPromptModalProps {
  show: boolean;
  clientId: string;
  clientFirstName: string;
  /** Cierra sin agendar. */
  onDismiss: () => void;
}

/**
 * Modal "¿Agendar nueva cita?" al cerrar el flujo de cierre. Si el operador
 * elige "Sí", navega a /calendar?clientId=X — el calendar abre el wizard con
 * el cliente preseleccionado y solo falta elegir servicio/fecha.
 */
export function RebookPromptModal({
  show,
  clientId,
  clientFirstName,
  onDismiss,
}: RebookPromptModalProps) {
  const router = useRouter();

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] p-4"
      onClick={onDismiss}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#e0f2f1' }}>
            <svg className="w-7 h-7" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75M12 12.75h.008v.008H12v-.008zM12 15.75h.008v.008H12v-.008zM9.75 12.75h.008v.008H9.75v-.008zM9.75 15.75h.008v.008H9.75v-.008zM7.5 12.75h.008v.008H7.5v-.008zM7.5 15.75h.008v.008H7.5v-.008zM14.25 12.75h.008v.008h-.008v-.008zM14.25 15.75h.008v.008h-.008v-.008zM16.5 12.75h.008v.008h-.008v-.008zM16.5 15.75h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            ¿Agendar nueva cita con <span style={{ color: TEAL }}>{clientFirstName}</span>?
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Te llevamos al calendario con los datos del cliente ya cargados.
          </p>
        </div>

        <div className="px-6 pb-6 pt-4 flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            No, terminar
          </button>
          <button
            onClick={() => router.push(`/calendar?clientId=${encodeURIComponent(clientId)}`)}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: TEAL }}
          >
            Sí, agendar
          </button>
        </div>
      </div>
    </div>
  );
}
