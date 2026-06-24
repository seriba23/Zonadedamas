// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" traemos "decoradores" de validación. Un DTO (Data
// Transfer Object) es una clase que describe la FORMA que debe tener el JSON
// que llega del cliente. Cada decorador "@" pone arriba de una propiedad
// una REGLA que ese campo debe cumplir; si no la cumple, NestJS rechaza la
// petición con error 400 antes de ejecutar nada.
//   - IsEmail: el valor debe ser un correo válido (ej. "a@b.com").
//   - IsOptional: el campo puede venir o no (no es obligatorio).
//   - IsString: el valor debe ser texto.
//   - Matches: el texto debe coincidir con una expresión regular (un patrón).
//   - MinLength: el texto debe tener al menos N caracteres.
//   - ValidateNested: valida también las reglas de un objeto ANIDADO (dentro).
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
// "Type" (de class-transformer) le dice al validador a QUÉ clase convertir un
// objeto anidado, para que sepa qué reglas aplicarle. Hace falta junto con
// ValidateNested.
import { Type } from 'class-transformer';

// DTO del "dueño" (owner) que se crea junto con el negocio. Describe los datos
// de la persona que será administradora de la cuenta.
export class CreateOwnerDto {
  // El email del dueño debe ser un correo válido.
  @IsEmail()
  email: string;

  // La contraseña debe ser texto y tener al menos 6 caracteres.
  @IsString()
  @MinLength(6)
  password: string;

  // Nombre del dueño (texto obligatorio).
  @IsString()
  firstName: string;

  // Apellido del dueño (texto obligatorio).
  @IsString()
  lastName: string;
}

// DTO principal: los datos para dar de alta (onboarding) un negocio nuevo.
export class CreateTenantDto {
  // Nombre del negocio: texto de al menos 2 caracteres.
  @IsString()
  @MinLength(2)
  name: string;

  // "slug": el nombre corto que aparece en la URL del negocio. La expresión
  // regular /^[a-z0-9-]+$/ exige: desde el inicio (^) hasta el final ($), solo
  // letras minúsculas (a-z), números (0-9) y guiones (-), uno o más (+). Si
  // no cumple, se muestra el mensaje en español.
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'El slug solo puede contener letras minúsculas, números y guiones',
  })
  slug: string;

  // Email de contacto del negocio (debe ser un correo válido).
  @IsEmail()
  email: string;

  // Zona horaria (ej. "America/Mexico_City"). El "?" indica que es OPCIONAL:
  // si no viene, el servicio usará un valor por defecto ("UTC").
  @IsOptional()
  @IsString()
  timezone?: string;

  // Moneda (ej. "MXN"). También opcional; por defecto será "MXN".
  @IsOptional()
  @IsString()
  currency?: string;

  // "owner": objeto ANIDADO con los datos del dueño. ValidateNested hace que
  // se validen también las reglas de CreateOwnerDto, y @Type le dice al
  // validador que este objeto es un CreateOwnerDto.
  @ValidateNested()
  @Type(() => CreateOwnerDto)
  owner: CreateOwnerDto;
}
