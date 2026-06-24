// 'use client' porque usa estado/efectos y eventos del navegador.
'use client';

import { useEffect } from 'react'; // hook para el auto-cierre temporizado

// Colores del proyecto: teal sólido y teal claro (fondo del icono).
const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

// PROPS del popup de éxito.
interface SuccessPopupProps {
  show: boolean; // si true, se muestra; si false, no se pinta nada
  title: string; // título principal (ej. "¡Reserva confirmada!")
  message?: string; // mensaje secundario opcional
  onClose: () => void; // función para cerrar el popup
  /** Auto-close after ms (0 = no auto-close). Default: 0 */
  autoClose?: number; // milisegundos para cerrarse solo (0 = no se cierra solo)
}

// Componente SuccessPopup: modal centrado con check verde-teal para confirmar
// acciones exitosas (estándar del proyecto para mensajes de éxito).
export function SuccessPopup({ show, title, message, onClose, autoClose = 0 }: SuccessPopupProps) {
  // Efecto para el cierre automático.
  useEffect(() => {
    // Solo si está visible Y nos pidieron un tiempo de auto-cierre (> 0).
    if (show && autoClose > 0) {
      // setTimeout llama a onClose después de "autoClose" milisegundos.
      const timer = setTimeout(onClose, autoClose);
      // Limpieza: si el componente se cierra/cambia antes, cancelamos el timer
      // para que no intente cerrar algo ya cerrado.
      return () => clearTimeout(timer);
    }
  }, [show, autoClose, onClose]); // se reevalúa si cambia alguno de estos

  // "Return temprano": si no hay que mostrarlo, no pintamos nada.
  if (!show) return null;

  return (
    // Fondo oscuro a pantalla completa. Al hacer clic en él, cierra.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* Tarjeta blanca central. animate-in zoom-in-95 = animación de entrada
          (aparece haciendo un pequeño zoom). stopPropagation evita que el clic
          DENTRO de la tarjeta "burbujee" hasta el fondo y la cierre. */}
      <div
        className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Círculo teal claro que contiene el icono de check. mx-auto lo centra. */}
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: TEAL_LIGHT }}
        >
          {/* Icono de "tic" (check) dentro de un círculo. */}
          <svg
            className="w-8 h-8"
            style={{ color: TEAL }}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
        {/* Título en negrita. */}
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
        {/* Mensaje secundario solo si se pasó (renderizado condicional con &&). */}
        {message && <p className="text-sm text-gray-500 mb-4">{message}</p>}
        {/* Botón "Aceptar" teal. Como el color es dinámico (style en línea),
            el hover se hace con eventos del ratón cambiando el color a mano:
            - onMouseEnter: al entrar el ratón, oscurece a #006666.
            - onMouseLeave: al salir, vuelve al teal normal.
            e.currentTarget = el propio botón. */}
        <button
          onClick={onClose}
          className="w-full py-2.5 text-white rounded-xl text-sm font-medium transition-colors mt-2"
          style={{ backgroundColor: TEAL }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006666')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
