// IMPORTS: decoradores de validación de class-validator (etiquetas "@").
//   - IsEmail: el valor debe ser un correo válido.
//   - IsString: el valor debe ser texto.
//   - Length: exige una longitud EXACTA o un rango (mín, máx) de caracteres.
//   - MinLength: exige una longitud mínima.
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

// ── PASO 1 del olvido de contraseña ──
// DTO del cuerpo de POST /api/auth/forgot-password. El usuario escribe su correo
// y el backend le envía un código de 6 dígitos por email.
export class ForgotPasswordDto {
  // Solo necesitamos el correo, y debe ser válido.
  @IsEmail()
  email: string;
}

// ── PASO 2 del olvido de contraseña ──
// DTO del cuerpo de POST /api/auth/verify-reset-code. El usuario envía su correo
// junto con el código de 6 dígitos que recibió, para que el backend lo verifique.
export class VerifyResetCodeDto {
  @IsEmail()
  email: string;

  // El código debe ser texto y tener EXACTAMENTE 6 caracteres (Length(6, 6)).
  // El objeto { message: ... } personaliza el mensaje de error mostrado al usuario.
  @IsString()
  @Length(6, 6, { message: 'El codigo debe tener 6 digitos' })
  code: string;
}

// ── PASO 3 del olvido de contraseña ──
// DTO del cuerpo de POST /api/auth/reset-password. Tras verificar el código, el
// usuario manda un "resetToken" (entregado en el paso 2) más la nueva contraseña.
export class ResetPasswordDto {
  // Token temporal de recuperación devuelto por verify-reset-code.
  @IsString()
  resetToken: string;

  // La nueva contraseña debe ser texto y tener al menos 8 caracteres.
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  newPassword: string;
}
