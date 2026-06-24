// ─────────────────────────────────────────────────────────────────────────────
// DTO = "Data Transfer Object" (objeto de transferencia de datos). Describe la
// FORMA que debe tener el JSON que el cliente envía, y sus REGLAS de validación.
// Si el JSON no cumple las reglas, NestJS rechaza la petición con error 400 y NO
// llega siquiera al servicio. Aquí cada "@" sobre un campo es un validador.
// ─────────────────────────────────────────────────────────────────────────────

// De class-validator importamos los validadores (decoradores) que usaremos:
import {
  IsString,   // exige que el valor sea texto.
  IsEmail,    // exige que sea un email con formato válido.
  IsOptional, // marca el campo como opcional (puede faltar).
  MinLength,  // longitud mínima de texto.
  MaxLength,  // longitud máxima de texto.
  Matches,    // exige que el texto cumpla una expresión regular (patrón).
} from 'class-validator';

// Expresión regular (patrón de texto) para el teléfono:
//   ^   = inicio del texto
//   \d  = un dígito (0-9); {10} = exactamente 10 veces
//   $   = fin del texto
// En conjunto: el teléfono debe ser EXACTAMENTE 10 dígitos, nada más.
const PHONE_RULE = /^\d{10}$/;
// Mensaje de error que se mostrará si el teléfono no cumple el patrón.
const PHONE_MSG = 'El teléfono debe tener exactamente 10 dígitos, sin espacios';

// DTO para CREAR un influencer (POST). Aquí los campos clave son obligatorios.
export class CreateInfluencerDto {
  // El email debe tener formato válido; si no, muestra "Email inválido".
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  // firstName: texto, mínimo 2 y máximo 60 caracteres.
  @IsString()
  @MinLength(2, { message: 'El nombre es muy corto' })
  @MaxLength(60)
  firstName: string;

  // lastName: texto, mínimo 2 y máximo 60 caracteres.
  @IsString()
  @MinLength(2, { message: 'El apellido es muy corto' })
  @MaxLength(60)
  lastName: string;

  // phone: opcional. Si viene, debe ser texto y cumplir el patrón de 10 dígitos.
  // El "?" en "phone?" indica que la propiedad puede no estar presente.
  @IsOptional()
  @IsString()
  @Matches(PHONE_RULE, { message: PHONE_MSG })
  phone?: string;

  // notes: opcional. Texto libre de hasta 2000 caracteres (notas internas).
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// DTO para ACTUALIZAR un influencer (PATCH). Aquí TODOS los campos son
// opcionales: solo se valida lo que el admin decida enviar para cambiar.
export class UpdateInfluencerDto {
  // firstName opcional: si viene, texto entre 2 y 60 caracteres.
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName?: string;

  // lastName opcional: si viene, texto entre 2 y 60 caracteres.
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  lastName?: string;

  // phone opcional: si viene, texto que cumpla el patrón de 10 dígitos.
  @IsOptional()
  @IsString()
  @Matches(PHONE_RULE, { message: PHONE_MSG })
  phone?: string;

  // notes opcional: si viene, texto de hasta 2000 caracteres.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
