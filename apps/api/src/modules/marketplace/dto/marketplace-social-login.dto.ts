// Decoradores de validación:
//   - IsIn: el valor debe ser uno de los de una lista permitida.
//   - IsNotEmpty: no puede estar vacío.
//   - IsString: debe ser texto.
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO de login social: valida los datos para iniciar sesión con Google o
 * Facebook (en lugar de email + contraseña).
 */
export class MarketplaceSocialLoginDto {
  @IsString()
  // Solo se aceptan estos dos proveedores. El tipo 'google' | 'facebook'
  // (unión de literales) limita el valor a exactamente uno de esos dos textos.
  @IsIn(['google', 'facebook'])
  provider: 'google' | 'facebook';

  @IsString()
  @IsNotEmpty()
  token: string; // el token que devuelve Google/Facebook tras autenticar.
}
