// Decoradores de validación: IsEmail (correo válido), IsOptional (puede faltar),
// IsString (texto).
import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * DTO para cambiar el contacto (email o teléfono) de la cuenta. Todos los
 * campos son opcionales porque normalmente se cambia uno a la vez. El otpCode
 * es el código de verificación de un solo uso (One-Time Password) que confirma
 * que la persona realmente controla ese correo/teléfono.
 */
export class ChangeMarketplaceContactDto {
  @IsOptional()
  @IsEmail()
  email?: string; // nuevo correo (opcional)

  @IsOptional()
  @IsString()
  phone?: string; // nuevo teléfono (opcional)

  @IsOptional()
  @IsString()
  otpCode?: string; // código de verificación (opcional)
}
