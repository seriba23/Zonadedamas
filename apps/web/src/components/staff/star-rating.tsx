// ============================================================
// ARCHIVO: star-rating.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Muestra una fila de 5 estrellas (★) para representar una
//   calificación. Puede usarse en dos modos:
//     - Solo lectura (por defecto): el usuario no puede hacer clic.
//     - Interactivo: el usuario puede hacer clic para elegir un valor.
//   Soporta tres tamaños (sm, md, lg) para diferentes contextos de UI.
// ¿QUÉ RECIBE? (props)
//   - rating: número de estrellas rellenas (1-5, puede ser decimal).
//   - size: 'sm' | 'md' | 'lg' — tamaño de las estrellas. Por defecto 'md'.
//   - interactive: si el usuario puede hacer clic para cambiar el valor.
//     Por defecto false (solo lectura).
//   - onChange: función llamada cuando el usuario hace clic en una estrella.
//     Recibe el número de la estrella clicada (1-5).
// ============================================================

'use client';
// Necesario para que este componente se procese en el cliente,
// ya que puede tener interacción (onClick en modo interactivo).

// ─── TIPOS ──────────────────────────────────────────────────

interface StarRatingProps {
  rating: number;           // valor actual (0-5, puede ser decimal para promedios)
  size?: 'sm' | 'md' | 'lg'; // tamaño de las estrellas (opcional, por defecto 'md')
  interactive?: boolean;    // si se puede hacer clic (opcional, por defecto false)
  onChange?: (rating: number) => void; // callback cuando el usuario elige una estrella
  // "?" indica que es opcional. Si no se pasa, es undefined.
}

// ─── CONSTANTES ─────────────────────────────────────────────

// Mapeo de tamaño a clases CSS de Tailwind.
// "Record<string, string>" = objeto cuyas claves y valores son strings.
const sizeClasses = {
  sm: 'w-4 h-4',  // 16px × 16px — para ReviewCard
  md: 'w-5 h-5',  // 20px × 20px — tamaño por defecto
  lg: 'w-6 h-6',  // 24px × 24px — para ReviewForm (más fácil de clicar)
};

// ─── COMPONENTE ─────────────────────────────────────────────
export function StarRating({
  rating,
  size = 'md',         // valor por defecto si no se pasa la prop
  interactive = false, // valor por defecto: solo lectura
  onChange,
}: StarRatingProps) {
  // Obtenemos la clase CSS correspondiente al tamaño recibido.
  // sizeClasses['sm'] → 'w-4 h-4', etc.
  const sizeClass = sizeClasses[size];

  return (
    // Fila de estrellas con pequeño espacio entre ellas.
    <div className="flex items-center gap-0.5">
      {/* [1, 2, 3, 4, 5] = array de los 5 números de estrella.
          .map() genera un botón por cada estrella.
          "star" = el número de la estrella (1, 2, 3, 4 o 5). */}
      {[1, 2, 3, 4, 5].map((star) => {
        // ¿Esta estrella debe estar rellena?
        // Math.round(rating) redondea el rating al entero más cercano.
        // Ej: rating=3.7 → Math.round(3.7)=4 → estrellas 1, 2, 3, 4 rellenas.
        // "star <= Math.round(rating)": la estrella N está rellena si N ≤ rating.
        const filled = star <= Math.round(rating);
        return (
          // Usamos un <button> para que sea semánticamente correcto
          // y accesible (se puede navegar con Tab y activar con Enter).
          <button
            key={star}         // key único para React (el número de estrella)
            type="button"      // evita enviar el formulario si está dentro de uno
            // En modo solo lectura, el botón está deshabilitado:
            // no responde a clics y no tiene cursor de puntero.
            disabled={!interactive}
            onClick={() => interactive && onChange?.(star)}
            // "interactive && onChange?.(star)":
            //   - Si interactive es false, no hace nada (cortocircuito &&).
            //   - Si interactive es true, llama onChange si está definido.
            //   - "onChange?.(star)": el "?." antes de "()" evita error si
            //     onChange no fue pasado como prop (sería undefined).
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
            // En modo interactivo: cursor de puntero + escala al hacer hover.
            // En modo solo lectura: cursor predeterminado (sin interacción).
          >
            {/* Ícono SVG de estrella */}
            <svg
              className={`${sizeClass} ${filled ? 'text-yellow-400' : 'text-gray-300'}`}
              // Si la estrella está rellena → amarillo (text-yellow-400).
              // Si no → gris claro (text-gray-300).
              // "currentColor" en fill hace que el SVG tome el color del texto.
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              {/* Path del ícono de estrella de 5 puntas */}
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
