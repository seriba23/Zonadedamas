'use client';

interface Props {
  password: string;
  confirmPassword: string;
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
export function PasswordMatch({ password, confirmPassword, className }: Props) {
  if (!confirmPassword) return null;
  const matches = password === confirmPassword;

  return (
    <div className={`flex items-center gap-1.5 text-[11px] mt-1.5 ${className || ''}`}>
      {matches ? (
        <>
          <svg
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: '#008080' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span className="font-medium" style={{ color: '#008080' }}>
            Las contraseñas coinciden
          </span>
        </>
      ) : (
        <>
          <svg
            className="w-3.5 h-3.5 flex-shrink-0 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="font-medium text-red-600">Las contraseñas no coinciden</span>
        </>
      )}
    </div>
  );
}
