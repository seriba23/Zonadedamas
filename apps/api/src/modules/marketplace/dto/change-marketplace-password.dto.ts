// Decoradores de validación: IsOptional (opcional), IsString (texto),
// MinLength (longitud mínima), Matches (debe cumplir un patrón regex).
import { IsOptional, IsString, MinLength, Matches } from 'class-validator';

/**
 * DTO para cambiar la contraseña. El usuario puede probar su identidad de dos
 * maneras (por eso ambos son opcionales): con su contraseña ACTUAL, o con un
 * código OTP enviado a su contacto. La contraseña NUEVA sí es obligatoria y
 * debe cumplir las reglas de seguridad.
 */
export class ChangeMarketplacePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string; // contraseña actual (una de las dos vías de prueba)

  @IsOptional()
  @IsString()
  otpCode?: string; // código de verificación (la otra vía de prueba)

  @IsString()
  // Mismas reglas de seguridad que en el registro: mínimo 6, al menos un número
  // y al menos un símbolo.
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/[0-9]/, { message: 'La contraseña debe contener al menos un número' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/, {
    message: 'La contraseña debe contener al menos un símbolo',
  })
  newPassword: string; // la nueva contraseña (obligatoria)
}
