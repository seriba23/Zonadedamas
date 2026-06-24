// ─────────────────────────────────────────────────────────────────────────────
// DTOs del PERFIL del cliente. Este archivo define DOS clases:
//   1) ClientUpdateProfileDto  → datos para actualizar el perfil.
//   2) ClientChangePasswordDto → datos para cambiar la contraseña.
// ─────────────────────────────────────────────────────────────────────────────

// Importamos decoradores de validación de "class-validator":
//   - IsString: el valor debe ser texto.
//   - IsOptional: el campo puede faltar.
//   - IsDateString: el valor debe ser una fecha en formato texto ISO
//     (ej. "1990-05-23"), no un objeto Date.
//   - MinLength / Matches: para validar la fuerza de la nueva contraseña.
import {
  IsString,
  IsOptional,
  IsDateString,
  MinLength,
  Matches,
} from 'class-validator';

// DTO para PUT /portal/:tenantSlug/profile.
// TODOS los campos son opcionales: el cliente puede actualizar solo los que
// quiera. Lo que no envíe, simplemente no se toca.
export class ClientUpdateProfileDto {
  // Nombre (opcional, texto).
  @IsOptional()
  @IsString()
  firstName?: string;

  // Apellido (opcional, texto).
  @IsOptional()
  @IsString()
  lastName?: string;

  // Correo (opcional, texto).
  @IsOptional()
  @IsString()
  email?: string;

  // Teléfono (opcional, texto).
  @IsOptional()
  @IsString()
  phone?: string;

  // Fecha de nacimiento (opcional). Debe llegar como texto con formato de fecha
  // ISO; el servicio luego lo convierte a un objeto Date para guardarlo.
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  // Género (opcional, texto). Ej.: "MALE", "FEMALE", "NON_BINARY", etc.
  @IsOptional()
  @IsString()
  gender?: string;
}

// DTO para PUT /portal/:tenantSlug/profile/password.
export class ClientChangePasswordDto {
  // Contraseña ACTUAL: necesaria para verificar que quien cambia la clave es
  // realmente el dueño de la cuenta. Obligatoria, texto.
  @IsString()
  currentPassword: string;

  // NUEVA contraseña: se le aplican las mismas reglas de fuerza que en el
  // registro (mínimo 8 caracteres, al menos un número y al menos un símbolo).
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/[0-9]/, { message: 'La contraseña debe contener al menos un número' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/, {
    message: 'La contraseña debe contener al menos un símbolo',
  })
  newPassword: string;
}
