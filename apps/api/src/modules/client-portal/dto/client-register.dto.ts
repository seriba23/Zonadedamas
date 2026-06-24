// ─────────────────────────────────────────────────────────────────────────────
// DTO de REGISTRO del portal del cliente.
// Describe y valida los datos que el cliente envía para crear su cuenta.
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" importamos varios decoradores de validación:
//   - IsString: el valor debe ser texto.
//   - IsOptional: el campo puede faltar (undefined); si falta, no se valida.
//   - MinLength: exige una longitud mínima de caracteres.
//   - Matches: exige que el texto COINCIDA con una expresión regular (un patrón).
import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

// Clase que representa el cuerpo del POST /portal/:tenantSlug/auth/register.
export class ClientRegisterDto {
  // Identificador principal: correo O teléfono. Es obligatorio y debe ser texto.
  @IsString()
  identifier: string; // email or phone

  // ── CONTRASEÑA con validación de FUERZA ──
  // Las tres reglas de abajo se aplican TODAS a la vez sobre el mismo campo.
  // Si alguna falla, NestJS responde 400 con el mensaje correspondiente.
  @IsString()
  // Debe medir 8 caracteres o más.
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  // /[0-9]/ es un patrón que significa "contiene al menos un dígito del 0 al 9".
  @Matches(/[0-9]/, { message: 'La contraseña debe contener al menos un número' })
  // Este patrón es una lista de símbolos permitidos entre corchetes [...].
  // Significa "contiene al menos uno de estos símbolos" (!, @, #, $, etc.).
  // Las barras invertidas "\" escapan caracteres que tienen significado especial
  // dentro de una expresión regular (como -, [, ], etc.) para tratarlos como
  // símbolos literales.
  @Matches(/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/, {
    message: 'La contraseña debe contener al menos un símbolo',
  })
  password: string;

  // Nombre del cliente. Obligatorio, texto.
  @IsString()
  firstName: string;

  // Apellido del cliente. Obligatorio, texto.
  @IsString()
  lastName: string;

  // Teléfono OPCIONAL. El "?" en "phone?" marca la propiedad como opcional en
  // TypeScript, y @IsOptional indica a la validación que puede faltar.
  // (Se usa cuando el identificador fue el correo, para guardar también su
  // teléfono si lo proporciona.)
  @IsOptional()
  @IsString()
  phone?: string;

  // Correo OPCIONAL (caso simétrico: si el identificador fue el teléfono, aquí
  // puede venir además su correo).
  @IsOptional()
  @IsString()
  email?: string;
}
