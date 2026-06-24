// 'use client' porque usa hooks y el DOM del navegador.
'use client';

// useEffect = efectos tras render. ReactNode = contenido pintable.
import { useEffect, type ReactNode } from 'react';
// createPortal = inyecta el panel directamente en <body> para que flote.
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// PROPS del Drawer (panel lateral que se desliza desde la derecha).
export interface DrawerProps {
  title: string; // título de la cabecera
  onClose: () => void; // función para cerrar
  children: ReactNode; // contenido del cuerpo
  width?: 'sm' | 'md' | 'lg'; // ancho del panel
  footer?: ReactNode; // contenido opcional del pie (ej. botones de acción)
}

// Diccionario ancho -> clase Tailwind. w-80 ≈ 20rem, w-96 ≈ 24rem.
const widthClasses = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[32rem]',
};

// Componente Drawer: cajón lateral. Igual filosofía que Modal pero pegado a un
// lado en vez de centrado.
export function Drawer({
  title,
  onClose,
  children,
  width = 'md',
  footer,
}: DrawerProps) {
  // EFECTO 1: cerrar con tecla Escape (suscribir al montar, limpiar al desmontar).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // EFECTO 2: bloquear el scroll del fondo mientras el cajón está abierto.
  useEffect(() => {
    const original = document.body.style.overflow; // guardamos valor previo
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original; // lo restauramos al cerrar
    };
  }, []);

  // JSX del cajón.
  const content = (
    // Capa fija a pantalla completa; flex para alinear el panel a un lado.
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay oscuro; clic = cerrar. aria-hidden por ser decorativo. */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel que se desliza desde la derecha. right-0 top-0 h-full = pegado al
          borde derecho y de altura completa; flex-col apila cabecera/cuerpo/pie. */}
      <div
        className={cn(
          'absolute right-0 top-0 h-full bg-white shadow-2xl flex flex-col',
          widthClasses[width],
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header (cabecera con título y botón de cerrar). */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2
            id="drawer-title"
            className="text-lg font-semibold text-gray-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Cerrar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body (cuerpo): ocupa el espacio restante y permite scroll vertical. */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer (pie): solo se pinta si se pasó la prop "footer" (&& condicional). */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // En el servidor no existe document; evitamos pintar allí.
  if (typeof document === 'undefined') return null;
  // Inyectamos el cajón al final del <body> con un portal.
  return createPortal(content, document.body);
}
