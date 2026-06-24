// Reglas de contraseña unificadas para todo el frontend.
// Coherencia: mismo set se valida en /register (admin, profesional, cliente)
// y en /marketplace/settings (cambio de password).
//
// Tener estas reglas en UN solo archivo evita que cada formulario invente sus
// propias reglas y termine pidiendo cosas distintas en cada pantalla.

// "export const" = constante que se puede importar desde otros archivos.
// Longitud mínima exigida a cualquier contraseña: 6 caracteres.
export const PASSWORD_MIN_LENGTH = 6;
// Una "expresión regular" (regex) es un patrón para buscar caracteres dentro de
// un texto. Va entre barras /.../. Aquí, los corchetes [...] significan "que
// haya AL MENOS uno de estos caracteres". Esta lista son símbolos comunes
// (!, @, #, etc.). El \ delante de algunos caracteres los "escapa" para que se
// traten como símbolos literales y no como parte de la sintaxis del regex.
export const PASSWORD_SYMBOL_REGEX = /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/;
// Este patrón [0-9] significa "que haya al menos un dígito del 0 al 9".
export const PASSWORD_NUMBER_REGEX = /[0-9]/;

// "interface" describe la FORMA de un objeto (qué campos tiene y de qué tipo).
// No genera código; solo sirve para que TypeScript valide que usamos bien el
// objeto. Aquí describimos el resultado de revisar una contraseña.
export interface PasswordCheck {
  hasMinLength: boolean; // ¿cumple la longitud mínima?
  hasNumber: boolean;    // ¿contiene al menos un número?
  hasSymbol: boolean;    // ¿contiene al menos un símbolo?
  valid: boolean;        // ¿cumple TODAS las reglas a la vez?
}

// checkPassword(): revisa una contraseña y devuelve un objeto con el detalle de
// qué reglas cumple. Recibe "pwd" (la contraseña en texto) y devuelve un
// PasswordCheck. Útil para pintar checkmarks de "requisitos" en pantalla.
export function checkPassword(pwd: string): PasswordCheck {
  // .length es la cantidad de caracteres. ">=" pregunta si es mayor o igual.
  const hasMinLength = pwd.length >= PASSWORD_MIN_LENGTH;
  // .test(texto) en un regex devuelve true si el patrón aparece en el texto.
  const hasNumber = PASSWORD_NUMBER_REGEX.test(pwd);
  const hasSymbol = PASSWORD_SYMBOL_REGEX.test(pwd);
  // Devolvemos un objeto con los tres chequeos individuales y un "valid" final.
  return {
    hasMinLength,
    hasNumber,
    hasSymbol,
    // "&&" es el "Y lógico": valid es true solo si los TRES son true a la vez.
    valid: hasMinLength && hasNumber && hasSymbol,
  };
}

/**
 * Retorna el primer error encontrado (string) o null si la password es valida.
 * Pensado para usarse en validate* functions de formularios.
 */
// validatePassword(): a diferencia de checkPassword (que devuelve el detalle
// completo), esta devuelve un MENSAJE de error listo para mostrar, o null si
// todo está bien. Devuelve el PRIMER problema que encuentra, de arriba a abajo.
export function validatePassword(pwd: string): string | null {
  // Reutilizamos checkPassword para no repetir la lógica de los regex.
  const c = checkPassword(pwd);
  // "!c.hasMinLength" se lee "si NO cumple la longitud mínima". El "!" niega.
  // Las comillas invertidas `...` permiten incrustar variables con ${...}.
  if (!c.hasMinLength) return `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`;
  if (!c.hasNumber) return 'Debe contener al menos un número';
  if (!c.hasSymbol) return 'Debe contener al menos un símbolo';
  // Si llegamos aquí, no hubo ningún error: la contraseña es válida.
  return null;
}
