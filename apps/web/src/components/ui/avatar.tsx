'use client';

import { useState, useEffect } from 'react';
import { resolveImageUrl } from '@/lib/utils';

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

interface AvatarProps {
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Tailwind size classes for the wrapper, ej "w-10 h-10". Default w-10 h-10. */
  className?: string;
  /** Tailwind class for the initials text size, ej "text-sm". Default text-xs. */
  textClassName?: string;
  /** Color de fondo/iniciales. Default teal del proyecto. */
  color?: string;
  /** Alt text para la imagen. Default vacio. */
  alt?: string;
}

/**
 * Avatar que cae a iniciales coloreadas cuando la imagen falla.
 *
 * Importante: usamos `onError` del <img> para detectar URLs rotas (referer
 * blocked, formato no soportado por el browser, 404 silencioso de Google).
 * Sin esto, los avatares de Google que fallan dejaban el <img> roto sin
 * mostrar fallback aunque el JSX lo tuviera.
 */
export function Avatar({
  avatarUrl,
  firstName,
  lastName,
  className = 'w-10 h-10',
  textClassName = 'text-xs',
  color = TEAL,
  alt = '',
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolved = resolveImageUrl(avatarUrl);

  // Si cambia la URL, reseteamos el flag de error (puede haber nueva imagen).
  useEffect(() => {
    setImgFailed(false);
  }, [resolved]);

  const initials = `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || '?';
  const showImage = !!resolved && !imgFailed;
  const bgColor = `${color}26`; // 26 hex = ~15% opacity, suficiente para contraste con teal text

  return (
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`}
      style={{ backgroundColor: showImage ? TEAL_LIGHT : bgColor }}
    >
      {showImage ? (
        <img
          src={resolved!}
          alt={alt}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={`font-bold ${textClassName}`} style={{ color }}>
          {initials}
        </span>
      )}
    </div>
  );
}
