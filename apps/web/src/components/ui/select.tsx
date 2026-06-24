// forwardRef = reenvía la ref al <select> real. type SelectHTMLAttributes =
// TIPO con las props nativas de un <select> (value, onChange, name, etc.).
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils'; // helper para combinar clases CSS

// SelectOption = forma de cada opción del desplegable: un valor interno y la
// etiqueta visible para el usuario.
export interface SelectOption {
  value: string; // valor que se guarda (ej. "es")
  label: string; // texto que ve el usuario (ej. "Español")
}

// PROPS del Select. Hereda las nativas y añade etiqueta, error, ayuda,
// la lista de opciones y un placeholder (texto guía cuando no hay selección).
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[]; // [] significa "array de SelectOption"
  placeholder?: string;
}

// Componente Select: un desplegable reutilizable con etiqueta/error/ayuda.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, hint, options, placeholder, className, id, ...props },
    ref,
  ) => {
    // selectId = id para enlazar la etiqueta con el campo. Si no nos dan id,
    // lo derivamos del label (minúsculas, espacios -> guiones). "?." evita
    // error si label no existe.
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {/* Etiqueta opcional encima del desplegable. */}
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            // appearance-none quita el estilo nativo del navegador para poder
            // estilarlo nosotros; bg-white = fondo blanco.
            'w-full px-3 py-2 border rounded-lg text-sm outline-none transition-all appearance-none bg-white',
            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            // Borde rojo si hay error, gris si no (ternario).
            error
              ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
              : 'border-gray-300',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        >
          {/* Opción guía (placeholder): valor vacío y disabled para que no se
              pueda seleccionar de verdad; solo orienta al usuario. */}
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {/* Renderizado de LISTA: .map() recorre el array "options" y crea un
              <option> por cada elemento. "opt" es cada opción del array.
              La prop "key" es OBLIGATORIA y única: ayuda a React a identificar
              cada elemento de la lista para actualizarla eficientemente. */}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Mensaje de error (rojo) si existe. */}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {/* Ayuda (gris) solo si hay hint y NO hay error. */}
        {hint && !error && (
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select'; // nombre en React DevTools
