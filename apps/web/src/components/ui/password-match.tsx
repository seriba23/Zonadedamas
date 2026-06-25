// Componente de cliente: usa lógica condicional basada en el estado de los inputs.
'use client';

// ─── Definición de las props ─────────────────────────────────────────────────
interface Props {
  // La contraseña original que el usuario escribió en el primer campo.
  password: string;

  // Lo que el usuario escribe en el segundo campo "Confirmar contraseña".
  confirmPassword: string;

  // Clases CSS adicionales opcionales para personalizar márgenes u otros estilos.
  className?: string;
}

/**
 * Feedback visual para confirmacion de contraseña. Pensado para ir debajo
 * del input "Confirmar contraseña" — consistente con <PasswordRules>.
 *
 * - confirmPassword vacio  → null (no mostramos nada hasta que el user
 *   empiece a escribir, evita ruido visual).
 * - Coincide               → check teal + "Las contraseñas coinciden".
 * - No coincide            → X rojo + "Las contraseñas no coinciden".
 */
// Desestructuramos las tres props directamente en los parámetros de la función.
export function PasswordMatch({ password, confirmPassword, className }: Props) {
  // Salida temprana: si el campo de confirmación está vacío, no mostramos nada.
  // Un string vacío "" es "falsy" en JavaScript, así que !confirmPassword es true
  // cuando el campo está vacío. Devolver null en React no renderiza nada.
  if (!confirmPassword) return null;

  // Comparamos los dos strings con ===. En JavaScript, === compara por valor
  // para strings primitivos, así que esto es true solo si son exactamente iguales.
  const matches = password === confirmPassword;

  return (
    // Contenedor con flexbox en fila (items-center: alinea verticalmente al centro).
    // className || '': si className es undefined, usamos string vacío (sin error).
    <div className={`flex items-center gap-1.5 text-[11px] mt-1.5 ${className || ''}`}>
      {/* Renderizado condicional con ternario: si coinciden → check verde, si no → X roja */}
      {matches ? (
        // Fragment (<>...</>): agrupa múltiples elementos sin div extra en el DOM.
        // Necesario porque queremos retornar el SVG Y el span como un solo bloque.
        <>
          {/* Palomita (checkmark) en color teal — las contraseñas coinciden */}
          <svg
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: '#008080' }}   // color teal del proyecto
            fill="none"
            stroke="currentColor"          // usa el color definido en style.color
            viewBox="0 0 24 24"
            strokeWidth={3}
          >
            {/* Trayecto SVG de la palomita: una línea que va ↗ y luego ↗ más largo */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span className="font-medium" style={{ color: '#008080' }}>
            Las contraseñas coinciden
          </span>
        </>
      ) : (
        // Las contraseñas NO coinciden: mostramos X roja + mensaje de error
        <>
          {/* Icono X (cruz): dos líneas diagonales que se cruzan */}
          <svg
            className="w-3.5 h-3.5 flex-shrink-0 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            {/* Primera diagonal: de esquina inferior-izquierda a superior-derecha */}
            {/* Segunda diagonal: de esquina superior-izquierda a inferior-derecha */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="font-medium text-red-600">Las contraseñas no coinciden</span>
        </>
      )}
    </div>
  );
}
