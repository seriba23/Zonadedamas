'use client';

import { useEffect, type ReactNode } from 'react';

interface DetailSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Ancho máximo en desktop. `md` = max-w-md (default), `sm` = max-w-sm,
   * `lg` = max-w-lg, `xl` = max-w-2xl. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Subtítulo opcional debajo del título, en gris pequeño. */
  subtitle?: string;
}

/**
 * Patrón oficial de detalle de la plataforma: bottom sheet adaptativo.
 *
 * Mobile: ocupa todo el ancho y aparece desde abajo con esquinas superiores
 *   redondeadas (`items-end` + `rounded-t-2xl`).
 * Desktop: se centra y limita su ancho (`md:items-center` + `md:max-w-md` +
 *   `md:rounded-2xl`).
 *
 * Identidad visual:
 *  - Borde teal 2px (`#008080`).
 *  - Header sticky con título + botón cerrar blanco con sombra pronunciada
 *    y icono X teal con trazo grueso (queda legible sobre cualquier fondo).
 *  - Cuerpo scroleable hasta 90vh.
 *  - Footer opcional fijo abajo con separador.
 *
 * Cierre: click en el overlay o en la X. Click en el contenido no propaga.
 * Tecla ESC también cierra.
 *
 * Úsalo para detalle de entidades (venta, cita, producto, etc.) en lugar
 * de inventar variantes propias.
 */
export function DetailSheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md',
}: DetailSheetProps) {
  // ESC para cerrar — comportamiento estándar de cualquier diálogo.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const widthClass =
    size === 'sm'
      ? 'md:max-w-sm'
      : size === 'lg'
        ? 'md:max-w-lg'
        : size === 'xl'
          ? 'md:max-w-2xl'
          : 'md:max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full ${widthClass} md:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col border-2`}
        style={{ borderColor: '#008080' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center ring-1 ring-black/5 hover:scale-105 transition-transform flex-shrink-0"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            aria-label="Cerrar"
          >
            <svg
              className="w-5 h-5"
              style={{ color: '#008080' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {/* Footer opcional */}
        {footer && (
          <div className="border-t border-gray-100 bg-white p-4 flex-shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}
