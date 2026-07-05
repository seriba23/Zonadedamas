// 'use client' = directiva de Next.js. Marca este archivo como "Componente de
// Cliente": se ejecuta en el navegador (no solo en el servidor). Es OBLIGATORIO
// cuando usamos hooks de estado (useState/useEffect) o eventos del navegador.
'use client';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Hooks de React:
//   - useState: crea una "variable de estado" que, al cambiar, vuelve a pintar
//     el componente.
//   - useEffect: ejecuta código como "efecto secundario" después del render
//     (p.ej. cuando cambia un valor concreto).
import { useState, useEffect } from 'react';
// resolveImageUrl = utilidad que normaliza una URL de imagen (la convierte en
// una URL completa válida, o devuelve null si no hay imagen).
import { resolveImageUrl } from '@/lib/utils';

// TEAL = color principal del proyecto (#008080). Constante para reutilizarlo.
const TEAL = '#008080';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS del Avatar.
// ─────────────────────────────────────────────────────────────────────────────
interface AvatarProps {
  // avatarUrl = URL de la foto. Puede ser string, null o no venir (opcional).
  avatarUrl?: string | null;
  firstName?: string | null; // nombre (para las iniciales)
  lastName?: string | null; // apellido (para las iniciales)
  /** Tailwind size classes for the wrapper, ej "w-10 h-10". Default w-10 h-10. */
  className?: string;
  /** Tailwind class for the initials text size, ej "text-sm". Default text-xs. */
  textClassName?: string;
  /** Color de fondo/iniciales. Default teal del proyecto (respeta dark mode). */
  color?: string;
  /** Alt text para la imagen. Default vacio. */
  alt?: string;
  /** Anillo distintivo alrededor del avatar (ej. cliente con cuenta verificada
   *  en la plataforma). Verde, con separación del círculo. */
  ring?: boolean;
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
  // Desestructuramos las props con valores por defecto.
  avatarUrl,
  firstName,
  lastName,
  className = 'w-10 h-10', // tamaño por defecto del círculo
  textClassName = 'text-xs', // tamaño por defecto de las iniciales
  color = TEAL, // color por defecto: teal del proyecto
  alt = '', // texto alternativo de la imagen
  ring = false, // anillo verde de "cuenta verificada"
}: AvatarProps) {
  // useState devuelve un par: [valorActual, funciónParaCambiarlo].
  // imgFailed = true cuando la imagen no se pudo cargar (URL rota, 404, etc.).
  // Empieza en false (asumimos que la imagen cargará bien).
  const [imgFailed, setImgFailed] = useState(false);
  // resolved = URL final normalizada (o null si no hay imagen).
  const resolved = resolveImageUrl(avatarUrl);

  // useEffect se ejecuta DESPUÉS de pintar, y SOLO cuando cambia algo de su
  // "array de dependencias" (aquí [resolved]). Si llega una URL nueva,
  // reseteamos el flag de error para darle otra oportunidad de cargar.
  useEffect(() => {
    setImgFailed(false);
  }, [resolved]);

  // initials = primera letra del nombre + primera del apellido, en mayúsculas.
  //   - (firstName || '') -> si firstName es null/undefined, usamos cadena vacía.
  //   - [0] -> primer carácter (o undefined si la cadena está vacía).
  //   - || '' -> si no hay carácter, vacío.
  //   - || '?' al final -> si ambas quedan vacías, mostramos un "?".
  const initials = `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || '?';
  // showImage = true si HAY url (!!resolved la convierte a booleano) Y la imagen
  // no ha fallado. Decide si pintamos <img> o las iniciales.
  const showImage = !!resolved && !imgFailed;
  // isDefaultTeal = true si seguimos usando el color por defecto del proyecto.
  const isDefaultTeal = color === TEAL;
  // Si es el teal por defecto, usamos las CSS vars del proyecto para que
  // el avatar respete dark mode automaticamente. Si el caller pasa un color
  // custom (ej. color del empleado), respetamos ese color en ambos modos.
  // bgColor = color de fondo del círculo. Ternario: si es el teal por defecto,
  // usamos una variable CSS del proyecto (respeta modo oscuro); si no, usamos el
  // color custom + "26" al final (en hex, 26 ≈ 15% de opacidad: fondo tenue).
  const bgColor = isDefaultTeal ? 'var(--primary-tint)' : `${color}26`;
  // fgColor = color del texto de las iniciales (frente). Misma lógica.
  const fgColor = isDefaultTeal ? 'var(--primary-tint-fg)' : color;

  return (
    // Círculo contenedor. rounded-full = círculo; overflow-hidden recorta la foto
    // a la forma circular; flex-shrink-0 evita que se encoja en layouts flex.
    // El backgroundColor se aplica con style en línea (color dinámico).
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${ring ? 'ring-2 ring-offset-2 ring-[#12a86e] ring-offset-white' : ''} ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {/* Renderizado condicional con TERNARIO: si showImage es true mostramos la
          imagen; si es false, mostramos las iniciales. */}
      {showImage ? (
        <img
          src={resolved!} // "!" le dice a TS "confía, no es null aquí"
          alt={alt}
          className="w-full h-full object-cover" // llena y recorta sin deformar
          referrerPolicy="no-referrer" // evita bloqueos de Google por "referer"
          // onError = manejador de evento: si la imagen falla al cargar,
          // marcamos imgFailed=true para mostrar las iniciales de respaldo.
          onError={() => setImgFailed(true)}
        />
      ) : (
        // Iniciales coloreadas como respaldo cuando no hay foto válida.
        <span className={`font-bold ${textClassName}`} style={{ color: fgColor }}>
          {initials}
        </span>
      )}
    </div>
  );
}
