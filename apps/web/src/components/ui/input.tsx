// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// forwardRef = permite reenviar una "ref" hacia el <input> real del DOM (útil
// para que un formulario padre pueda enfocarlo o leer su valor directamente).
// type InputHTMLAttributes = TIPO de TS con TODAS las props nativas de un
// <input> (value, onChange, placeholder, type, name, etc.).
import { forwardRef, type InputHTMLAttributes } from 'react';
// cn = helper para combinar clases CSS condicionalmente.
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS del Input. Hereda las props nativas del <input> y añade 3 propias.
// ─────────────────────────────────────────────────────────────────────────────
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; // etiqueta de texto encima del campo (opcional)
  error?: string; // mensaje de error en rojo bajo el campo (opcional)
  hint?: string; // texto de ayuda en gris bajo el campo (opcional)
}

// Componente Input: un campo de texto reutilizable con etiqueta, error y ayuda.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  // Desestructuramos las props que usamos y agrupamos el resto en ...props.
  ({ label, error, hint, className, id, ...props }, ref) => {
    // inputId = identificador para enlazar la <label> con el <input> (el clic en
    // la etiqueta enfoca el campo). Si nos pasan "id" lo usamos; si no (||),
    // generamos uno a partir del label: minúsculas y espacios -> guiones.
    // El "?." (optional chaining) evita error si label es undefined.
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      // Contenedor a todo el ancho disponible.
      <div className="w-full">
        {/* Renderizado condicional: solo pintamos la etiqueta si "label" existe. */}
        {label && (
          <label
            htmlFor={inputId} // asocia esta etiqueta con el input de ese id
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref} // reenviamos la ref al input real
          id={inputId}
          className={cn(
            // Estilos base: ancho completo, padding, borde, esquinas redondeadas.
            'w-full px-3 py-2 border rounded-lg text-sm outline-none transition-all',
            // Al enfocar: aro y borde teal.
            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            // Color del texto de marcador (placeholder).
            'placeholder:text-gray-400',
            // Ternario (condición ? siVerdadero : siFalso): si hay error, borde
            // rojo; si no, borde gris normal.
            error
              ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
              : 'border-gray-300',
            // Estilo cuando está deshabilitado.
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            className, // clases extra del usuario
          )}
          {...props} // resto de props nativas (value, onChange, type, etc.)
        />
        {/* Si hay error, lo mostramos en rojo bajo el campo. */}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {/* Mostramos la ayuda SOLO si hay hint Y no hay error (&& encadenado). */}
        {hint && !error && (
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        )}
      </div>
    );
  },
);

// Nombre visible en las React DevTools.
Input.displayName = 'Input';
