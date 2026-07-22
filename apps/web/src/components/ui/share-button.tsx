// ============================================================
// ShareButton — botón reutilizable de "Compartir".
//
// Comportamiento:
//   - En móvil/navegadores compatibles usa la Web Share API nativa
//     (navigator.share) → abre la hoja de compartir del sistema
//     (WhatsApp, mensajes, etc.).
//   - Si no está disponible (ej. escritorio) copia el enlace al
//     portapapeles y muestra el SuccessPopup estándar del proyecto.
//
// Estilos configurables por props (`className` / `iconClassName`) para
// adaptarlo a cada superficie (hero translúcido, header, píldora...).
// ============================================================
'use client';

import { useState } from 'react';
import { SuccessPopup } from './success-popup';

interface ShareButtonProps {
  /** Título que verá el usuario en la hoja de compartir nativa. */
  title: string;
  /** Texto/descripción que acompaña al enlace al compartir. */
  text: string;
  /** URL a compartir. */
  url: string;
  /** Clases del botón (color, tamaño, forma...). */
  className?: string;
  /** Clases del icono (tamaño/color del SVG). */
  iconClassName?: string;
  /** Texto opcional junto al icono (ej. "Compartir"). */
  label?: string;
  /** aria-label accesible. Default: "Compartir". */
  ariaLabel?: string;
  /** Detiene la propagación del clic (útil dentro de tarjetas clicables). */
  stopPropagation?: boolean;
}

export function ShareButton({
  title,
  text,
  url,
  className = '',
  iconClassName = 'w-5 h-5',
  label,
  ariaLabel = 'Compartir',
  stopPropagation = true,
}: ShareButtonProps) {
  // Controla el popup de confirmación tras copiar el enlace (fallback).
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    // navigator.share solo existe en contextos seguros (https) y móviles.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // El usuario canceló la hoja de compartir: no hacemos nada.
      }
      return;
    }
    // Fallback: copiar al portapapeles y confirmar con el popup estándar.
    try {
      await navigator.clipboard.writeText(`${text} ${url}`.trim());
      setCopied(true);
    } catch {
      // Último recurso: seleccionar vía prompt no es viable sin diálogo;
      // dejamos el enlace en consola para no romper el flujo.
      // eslint-disable-next-line no-console
      console.warn('No se pudo copiar el enlace al portapapeles:', url);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-label={ariaLabel}
        className={className}
      >
        {/* Icono de compartir (share nodes) — outline. */}
        <svg
          className={iconClassName}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
          />
        </svg>
        {label && <span>{label}</span>}
      </button>

      <SuccessPopup
        show={copied}
        title="Enlace copiado"
        message="Ya puedes pegarlo donde quieras para compartirlo."
        onClose={() => setCopied(false)}
        autoClose={2000}
      />
    </>
  );
}
