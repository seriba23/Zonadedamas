'use client';

import { checkPassword } from '@/lib/password-validation';

interface Props {
  password: string;
  className?: string;
}

/**
 * Listado de reglas de contraseña con check verde teal cuando se cumplen,
 * circulo gris cuando no. Pensado para ir debajo del input de password
 * para que el usuario vea en tiempo real que le falta cumplir.
 */
export function PasswordRules({ password, className }: Props) {
  const c = checkPassword(password);
  const rules: { ok: boolean; label: string }[] = [
    { ok: c.hasMinLength, label: 'Mínimo 6 caracteres' },
    { ok: c.hasNumber, label: 'Al menos 1 número' },
    { ok: c.hasSymbol, label: 'Al menos 1 símbolo (!@#$...)' },
  ];

  return (
    <ul className={`space-y-1 mt-1.5 ${className || ''}`}>
      {rules.map((r) => (
        <li key={r.label} className="flex items-center gap-1.5 text-[11px]">
          {r.ok ? (
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
          ) : (
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
