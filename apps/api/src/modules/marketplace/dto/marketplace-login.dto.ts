// De class-validator importamos "decoradores de validación": etiquetas "@" que
// se ponen sobre cada campo para comprobar automáticamente que el dato recibido
// cumple las reglas. Si no cumple, NestJS responde con error 400.
//   - IsNotEmpty: el valor no puede estar vacío.
//   - IsString: el valor debe ser texto.
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO ("Data Transfer Object") del login del marketplace: describe y valida el
 * cuerpo (JSON) que el cliente envía para iniciar sesión.
 */
export class MarketplaceLoginDto {
  @IsString()    // debe ser texto
  @IsNotEmpty()  // no puede venir vacío
  identifier: string; // email or phone  (puede ser el correo O el teléfono)

  @IsString()
  @IsNotEmpty()
  password: string; // la contraseña
}
