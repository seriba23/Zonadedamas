// Reglas de contraseña unificadas para todo el frontend.
// Coherencia: mismo set se valida en /register (admin, profesional, cliente)
// y en /marketplace/settings (cambio de password).

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_SYMBOL_REGEX = /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/;
export const PASSWORD_NUMBER_REGEX = /[0-9]/;

export interface PasswordCheck {
  hasMinLength: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  valid: boolean;
}

export function checkPassword(pwd: string): PasswordCheck {
  const hasMinLength = pwd.length >= PASSWORD_MIN_LENGTH;
  const hasNumber = PASSWORD_NUMBER_REGEX.test(pwd);
  const hasSymbol = PASSWORD_SYMBOL_REGEX.test(pwd);
  return {
    hasMinLength,
    hasNumber,
    hasSymbol,
    valid: hasMinLength && hasNumber && hasSymbol,
  };
}

/**
 * Retorna el primer error encontrado (string) o null si la password es valida.
 * Pensado para usarse en validate* functions de formularios.
 */
export function validatePassword(pwd: string): string | null {
  const c = checkPassword(pwd);
  if (!c.hasMinLength) return `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`;
  if (!c.hasNumber) return 'Debe contener al menos un número';
  if (!c.hasSymbol) return 'Debe contener al menos un símbolo';
  return null;
}
