// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: mismos decoradores de validación de "class-validator" que en el DTO de
// creación (ver create-supplier.dto.ts para el detalle de cada uno):
//   - IsEmail: formato de correo. IsOptional: campo no obligatorio.
//   - IsString: debe ser texto. Matches: debe cumplir una expresión regular.
//   - MinLength: longitud mínima de texto.
// ─────────────────────────────────────────────────────────────────────────────
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

// UpdateSupplierDto define las reglas al EDITAR un proveedor. Diferencia clave
// frente al de creación: AQUÍ TODOS los campos son opcionales (todos llevan
// @IsOptional y "?"), porque al actualizar se envían solo los campos que cambian.
export class UpdateSupplierDto {
  // name: opcional aquí, pero si viene debe ser texto de mínimo 1 carácter.
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // contactName: opcional. Si viene, texto.
  @IsOptional()
  @IsString()
  contactName?: string;

  // email: opcional. Si viene, formato de correo válido.
  @IsOptional()
  @IsEmail()
  email?: string;

  // phone: opcional. Si viene, exactamente 10 dígitos (mismo patrón que en crear).
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'El telefono debe tener exactamente 10 digitos' })
  phone?: string;

  // address: opcional. Si viene, texto.
  @IsOptional()
  @IsString()
  address?: string;

  // notes: opcional. Notas internas en texto libre.
  @IsOptional()
  @IsString()
  notes?: string;
}
