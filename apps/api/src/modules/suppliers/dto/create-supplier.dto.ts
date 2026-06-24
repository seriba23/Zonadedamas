// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: de "class-validator" traemos "decoradores" de validación. Son etiquetas
// "@" que se ponen sobre cada propiedad para comprobar automáticamente que el dato
// recibido cumple una regla; si no la cumple, NestJS responde error 400.
//   - IsEmail: el valor debe tener formato de correo electrónico.
//   - IsOptional: el campo puede no venir (no es obligatorio). Si falta, las
//     demás validaciones de ese campo se omiten.
//   - IsString: el valor debe ser texto.
//   - Matches: el valor debe cumplir una expresión regular (un patrón de texto).
//   - MinLength: el texto debe tener al menos N caracteres.
// ─────────────────────────────────────────────────────────────────────────────
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

// CreateSupplierDto define la "forma" y las reglas de los datos que se aceptan
// al CREAR un proveedor. Cada propiedad lleva encima sus validaciones.
export class CreateSupplierDto {
  // name: obligatorio. Debe ser texto y tener mínimo 1 carácter (no vacío).
  // (No lleva IsOptional, por eso es requerido.)
  @IsString()
  @MinLength(1)
  name: string;

  // contactName: opcional. Si viene, debe ser texto.
  // El "?" en "contactName?" indica a TypeScript que la propiedad puede faltar.
  @IsOptional()
  @IsString()
  contactName?: string;

  // email: opcional. Si viene, debe tener formato de correo válido.
  @IsOptional()
  @IsEmail()
  email?: string;

  // phone: opcional. Si viene, debe ser texto y cumplir la expresión regular
  // /^\d{10}$/, que significa: del inicio (^) al final ($), exactamente 10
  // dígitos (\d = un dígito 0-9, {10} = diez veces). Si no cumple, muestra el
  // mensaje personalizado de "message".
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'El telefono debe tener exactamente 10 digitos' })
  phone?: string;

  // address: opcional. Si viene, debe ser texto.
  @IsOptional()
  @IsString()
  address?: string;

  // notes: opcional. Notas internas en texto libre.
  @IsOptional()
  @IsString()
  notes?: string;
}
