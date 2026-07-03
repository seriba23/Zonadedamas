// 'use client' = se ejecuta en el navegador (usa hooks y el DOM).
'use client';

// useEffect = ejecuta efectos tras el render. type ReactNode = tipo "cualquier
// contenido pintable" (para children).
import { useEffect, type ReactNode } from 'react';
// createPortal = renderiza el modal en OTRO lugar del DOM (directamente en
// document.body) en vez de donde está el componente. Así el modal flota encima
// de todo sin que lo recorten contenedores con overflow.
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// PROPS del Modal.
export interface ModalProps {
  title: string; // título que aparece en la cabecera
  onClose: () => void; // función que se llama para cerrar (tipo: función sin args)
  children: ReactNode; // contenido del cuerpo del modal
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; // ancho máximo del diálogo
  className?: string;
}

// Diccionario tamaño -> clase de ancho máximo (max-w-*).
const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[80vw]', // 80% del ancho de la ventana (viewport width)
};

// Componente Modal: ventana emergente centrada con fondo oscurecido.
export function Modal({
  title,
  onClose,
  children,
  size = 'md',
  className,
}: ModalProps) {
  // EFECTO 1: cerrar con la tecla Escape.
  useEffect(() => {
    // handleKeyDown se ejecuta en cada pulsación de tecla.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose(); // si fue Escape, cerramos
    }
    // Nos "suscribimos" al evento de teclado del documento.
    document.addEventListener('keydown', handleKeyDown);
    // La función que retorna un useEffect es la "limpieza": se ejecuta al
    // desmontar el componente. Aquí quitamos el listener para no dejar fugas.
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]); // se re-suscribe si cambia onClose

  // EFECTO 2: bloquear el scroll del fondo mientras el modal está abierto.
  useEffect(() => {
    // Guardamos el valor original de overflow para restaurarlo luego.
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // congela el scroll del body
    // Limpieza: al cerrar el modal, devolvemos el scroll a como estaba.
    return () => {
      document.body.style.overflow = original;
    };
  }, []); // [] vacío = se ejecuta una sola vez al montar, limpia al desmontar

  // content = el JSX completo del modal. Lo guardamos en variable para luego
  // inyectarlo con el portal.
  const content = (
    // Capa que cubre toda la pantalla: fixed inset-0 = pegado a los 4 bordes;
    // z-50 = muy por encima; flex + center = centra el diálogo.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay (fondo oscuro semitransparente). bg-black/60 = negro al 60%.
          Sin backdrop-blur: en algunos GPU/zoom de Chrome el backdrop-filter
          rasteriza el diálogo borroso. Al hacer clic, cierra. aria-hidden lo
          oculta a lectores de pantalla (es decorativo). */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog (la tarjeta blanca del modal). z-10 para quedar SOBRE el overlay. */}
      <div
        className={cn(
          // relative para superponerse al overlay; rounded-2xl esquinas muy
          // redondeadas; shadow-xl sombra grande; flex-col apila cabecera/cuerpo;
          // max-h-[90vh] limita la altura al 90% de la pantalla.
          'relative w-full rounded-2xl shadow-xl z-10 flex flex-col max-h-[90vh]',
          sizeClasses[size],
          className,
        )}
        // var(--bg-surface) = color de superficie del tema (respeta modo oscuro).
        style={{ backgroundColor: 'var(--bg-surface)' }}
        // Atributos ARIA para accesibilidad: indican que es un diálogo modal y
        // qué elemento es su título.
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header (cabecera): título a la izquierda y botón de cerrar a la derecha. */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2
            id="modal-title"
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
          {/* Botón "X" de cerrar. aria-label le da nombre accesible (no tiene
              texto visible, solo el icono). */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            aria-label="Cerrar"
          >
            {/* Icono de "X" dibujado con dos líneas cruzadas (d="..."). */}
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

        {/* Body — min-h-0 es necesario para que overflow-y-auto realmente
            permita scroll dentro de un flex column con max-h en el padre. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );

  // En el servidor "document" no existe (no hay navegador). Si es así, no
  // pintamos nada (return null) para evitar errores en el renderizado del server.
  if (typeof document === 'undefined') return null;
  // createPortal inserta "content" directamente dentro de <body>, fuera del
  // árbol normal del componente, para que el modal flote sobre toda la página.
  return createPortal(content, document.body);
}
