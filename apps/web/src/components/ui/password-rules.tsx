// Componente de cliente: recalcula el estado de las reglas en cada tecla pulsada.
'use client';

// Importamos la función checkPassword de nuestra biblioteca interna.
// El alias "@/" apunta a la carpeta "src/" del proyecto (configurado en tsconfig.json).
// checkPassword recibe un string y devuelve un objeto con booleanos:
// { hasMinLength: boolean, hasNumber: boolean, hasSymbol: boolean }
import { checkPassword } from '@/lib/password-validation';

// ─── Props del componente ────────────────────────────────────────────────────
interface Props {
  // La contraseña que el usuario está escribiendo (en tiempo real).
  password: string;

  // Clases CSS adicionales opcionales (para ajustar márgenes desde el padre).
  className?: string;
}

/**
 * Listado de reglas de contraseña con check verde teal cuando se cumplen,
 * circulo gris cuando no. Pensado para ir debajo del input de password
 * para que el usuario vea en tiempo real que le falta cumplir.
 */
export function PasswordRules({ password, className }: Props) {
  // Llamamos a checkPassword para obtener el estado de cada regla.
  // "c" es un objeto con propiedades booleanas:
  // c.hasMinLength → true si la contraseña tiene al menos 6 caracteres
  // c.hasNumber    → true si contiene al menos un dígito
  // c.hasSymbol    → true si contiene al menos un símbolo especial
  const c = checkPassword(password);

  // Definimos el array de reglas que vamos a mostrar.
  // Cada elemento es un objeto con dos propiedades:
  // - ok: boolean que indica si esta regla ya se cumple (viene de "c")
  // - label: texto que se muestra al usuario
  // TypeScript infiere el tipo, pero lo anotamos explícitamente para claridad:
  // Array de objetos { ok: boolean, label: string }
  const rules: { ok: boolean; label: string }[] = [
    { ok: c.hasMinLength, label: 'Mínimo 6 caracteres' },
    { ok: c.hasNumber, label: 'Al menos 1 número' },
    { ok: c.hasSymbol, label: 'Al menos 1 símbolo (!@#$...)' },
  ];

  // ── JSX retornado ────────────────────────────────────────────────────────
  return (
    // <ul>: lista HTML desordenada. space-y-1 pone espacio vertical entre items.
    // className || '': evita poner "undefined" como clase si className no se pasó.
    <ul className={`space-y-1 mt-1.5 ${className || ''}`}>
      {/* .map() itera sobre el array "rules" y crea un <li> por cada regla.
          Es como un bucle for...of pero produce JSX.
          La prop "key" es obligatoria en listas de React para que pueda
          identificar qué elemento cambió sin re-renderizar todos.
          Usamos r.label como key porque es único entre las reglas. */}
      {rules.map((r) => (
        // <li>: elemento de lista. flex en fila con items centrados.
        <li key={r.label} className="flex items-center gap-1.5 text-[11px]">
          {/* Renderizado condicional: icono diferente según r.ok */}
          {r.ok ? (
            // Regla CUMPLIDA: palomita (checkmark) teal
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: '#008080' }}    // color teal via style inline
              fill="none"
              stroke="currentColor"           // hereda el color del style
              viewBox="0 0 24 24"
              strokeWidth={3}
            >
              {/* Trazo SVG de palomita: ↗ corto y luego ↗ largo hacia arriba */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            // Regla NO cumplida: círculo vacío en gris
            // cx y cy son el centro del círculo, r es el radio (9 unidades)
            <svg
              className="w-3.5 h-3.5 flex-shrink-0 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <circle cx="12" cy="12" r="9" />
            </svg>
          )}

          {/* Texto de la regla: teal+negrita si cumplida, gris si no.
              style: objeto de estilos en línea (inline style en React).
              Si r.ok es true → aplicamos color teal. Si es false → objeto vacío {}
              (sin estilo extra, la clase text-gray-400 se encarga del color gris). */}
          <span
            className={r.ok ? 'font-medium' : 'text-gray-400'}
            style={r.ok ? { color: '#008080' } : {}}
          >
            {r.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
