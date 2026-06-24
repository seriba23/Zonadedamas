// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" importamos "decoradores" (etiquetas "@") que validan los
// datos que llegan en el cuerpo (JSON) de la petición. NestJS, junto con el
// ValidationPipe global, lee estos decoradores y rechaza (error 400) cualquier
// dato que no cumpla las reglas, ANTES de que llegue al controlador.
//   - IsEmail: exige que el valor sea un correo electrónico con formato válido.
//   - IsString: exige que el valor sea una cadena de texto (string).
//   - MinLength: exige una longitud mínima de caracteres.
import { IsEmail, IsString, MinLength } from 'class-validator';

// DTO = "Data Transfer Object" (objeto de transferencia de datos). Es una clase
// que describe EXACTAMENTE qué campos esperamos recibir del cliente y con qué
// reglas. Aquí: el cuerpo de POST /api/auth/login.
export class LoginDto {
  // El campo "email" debe ser un correo válido (ej. "ana@correo.com").
  @IsEmail()
  email: string;

  // El campo "password" debe ser texto y tener al menos 6 caracteres.
  @IsString()
  @MinLength(6)
  password: string;
}
