// Componente de cliente: usa useRouter (navegación) y maneja eventos del DOM.
'use client';

// useRouter: hook de Next.js que permite navegar entre páginas desde código
// (sin que el usuario haga clic en un <a> o <Link>).
import { useRouter } from 'next/navigation';

// Color teal del proyecto para reutilizarlo en múltiples elementos del modal.
const TEAL = '#008080';

// ─── Props del componente ────────────────────────────────────────────────────
interface RebookPromptModalProps {
  // Si true, el modal es visible. Si false, el componente no renderiza nada.
  show: boolean;

  // ID único del cliente (para pasarlo como parámetro en la URL del calendario).
  clientId: string;

  // Nombre del cliente para mostrarlo en el título del modal.
  clientFirstName: string;

  /** Cierra sin agendar. */
  // Función del padre que se llama cuando el usuario cierra el modal sin agendar.
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
  // useRouter() devuelve el objeto router de Next.js.
  // router.push('/ruta') navega a esa ruta sin recargar la página completa
  // (navegación client-side, más rápida que un enlace normal).
  const router = useRouter();

  // Salida temprana: si show es false, no renderizamos nada (null).
  // Esto "desmonta" el modal del DOM cuando no es necesario.
  if (!show) return null;

  // ── JSX retornado: el modal ───────────────────────────────────────────────
  return (
    // Fondo semitransparente (overlay) que cubre toda la pantalla.
    // - fixed inset-0: position:fixed, top/right/bottom/left todos en 0.
    // - bg-black/60: negro con 60% de opacidad (el "/60" es la opacidad en Tailwind).
    // - z-[60]: z-index personalizado (60) para que quede encima de otros elementos.
    // - items-end sm:items-center: en móvil el modal aparece desde abajo;
    //   en pantallas "sm" (≥640px) aparece centrado verticalmente.
    // - onClick={onDismiss}: clic en el fondo oscuro cierra el modal.
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] p-4"
      onClick={onDismiss}
    >
      {/* Tarjeta blanca del modal.
          onClick={(e) => e.stopPropagation(): detiene la propagación del evento.
          Sin esto, cualquier clic DENTRO del modal también alcanzaría el div
          exterior y llamaría a onDismiss, cerrando el modal inesperadamente.
          e.stopPropagation() hace que el evento "se detenga" y no suba al padre. */}
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sección superior: ícono + título + descripción */}
        <div className="px-6 pt-6 pb-2 text-center">
          {/* Círculo teal claro con ícono de calendario en el centro */}
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#e0f2f1' }}>
            {/* SVG de ícono de calendario (cuadrícula de días) */}
            <svg className="w-7 h-7" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75M12 12.75h.008v.008H12v-.008zM12 15.75h.008v.008H12v-.008zM9.75 12.75h.008v.008H9.75v-.008zM9.75 15.75h.008v.008H9.75v-.008zM7.5 12.75h.008v.008H7.5v-.008zM7.5 15.75h.008v.008H7.5v-.008zM14.25 12.75h.008v.008h-.008v-.008zM14.25 15.75h.008v.008h-.008v-.008zM16.5 12.75h.008v.008h-.008v-.008zM16.5 15.75h.008v.008h-.008v-.008z" />
            </svg>
          </div>

          {/* Título del modal con el nombre del cliente en teal */}
          <h2 className="text-lg font-bold text-gray-900">
            {/* {clientFirstName} se interpola en el JSX directamente */}
            ¿Agendar nueva cita con <span style={{ color: TEAL }}>{clientFirstName}</span>?
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Te llevamos al calendario con los datos del cliente ya cargados.
          </p>
        </div>

        {/* Sección de botones: dos opciones lado a lado (flex gap-2) */}
        <div className="px-6 pb-6 pt-4 flex gap-2">
          {/* Botón "No, terminar": llama a onDismiss (cierra el modal sin navegar) */}
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            No, terminar
          </button>

          {/* Botón "Sí, agendar": navega al calendario con el clientId en la URL.
              encodeURIComponent(clientId) convierte el ID a formato seguro para URL
              (reemplaza caracteres especiales como espacios por %20, etc.).
              Ejemplo: si clientId = "abc 123", la URL queda /calendar?clientId=abc%20123 */}
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
