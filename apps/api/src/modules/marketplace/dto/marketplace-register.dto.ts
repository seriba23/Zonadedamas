// Decoradores de validación:
//   - IsEmail: debe tener formato de correo válido.
//   - IsNotEmpty: no puede estar vacío.
//   - IsOptional: el campo puede faltar (no es obligatorio).
//   - IsString: debe ser texto.
//   - Matches: debe cumplir una expresión regular (un patrón de caracteres).
//   - MinLength: longitud mínima del texto.
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/**
 * DTO de registro: valida los datos que envía alguien para crear su cuenta de
 * marketplace.
 */
export class MarketplaceRegisterDto {
  @IsEmail() // debe ser un correo válido
  email: string;

  @IsString()
  // Mínimo 6 caracteres; el "message" personaliza el error que verá el usuario.
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  // /[0-9]/ = debe contener AL MENOS un dígito (un número del 0 al 9).
  @Matches(/[0-9]/, { message: 'La contraseña debe contener al menos un número' })
  // Esta expresión exige AL MENOS un símbolo (cualquiera de la lista entre []).
  @Matches(/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/, {
    message: 'La contraseña debe contener al menos un símbolo',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string; // nombre

  @IsString()
  @IsNotEmpty()
  lastName: string; // apellido

  @IsOptional() // el teléfono es opcional (el "?" en "phone?" lo confirma)
  @IsString()
  phone?: string;

  // Token de "reclamo" (viene del enlace de WhatsApp que envió un negocio):
  // vincula la ficha walk-in de ese negocio a esta cuenta recién creada.
  @IsOptional()
  @IsString()
  claimToken?: string;
}
