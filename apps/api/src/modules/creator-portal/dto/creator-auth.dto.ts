// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Un DTO ("Data Transfer Object") describe la FORMA que deben tener los datos que
// llegan en el cuerpo (body) de una petición. Los decoradores de class-validator
// validan cada campo automáticamente: si algo no cumple, NestJS responde 400 con
// el mensaje correspondiente, sin que tengamos que comprobarlo a mano.
//   - IsString: el campo debe ser texto.
//   - IsEmail: debe tener formato de email válido.
//   - IsOptional: el campo puede faltar (no es obligatorio).
//   - MinLength / MaxLength: longitud mínima / máxima del texto.
//   - Matches: el texto debe encajar con una expresión regular (patrón) dado.
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

// PASSWORD_RULE es una "expresión regular" (un patrón de texto) que define la
// contraseña mínima aceptable. Desglose del patrón:
//   ^                 inicio del texto
//   (?=.*[0-9])       "lookahead": exige que en algún punto haya un dígito 0-9
//   (?=.*[^A-Za-z0-9]) exige que haya al menos un símbolo (algo que NO sea letra
//                     ni número; el "^" dentro de [] significa "que NO sea")
//   .{8,}             ocho o más caracteres cualesquiera
//   $                 fin del texto
// En resumen: mínimo 8 caracteres, con al menos un número y al menos un símbolo.
const PASSWORD_RULE = /^(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

// DTO para INICIAR SESIÓN (login). Solo email + contraseña.
export class CreatorLoginDto {
  // El email debe tener formato válido; si no, se muestra "Email inválido".
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  // La contraseña debe ser texto y tener al menos 1 carácter (no vacía). Aquí no
  // aplicamos PASSWORD_RULE porque al hacer login solo comparamos contra el hash
  // guardado; las reglas de fortaleza se exigen al CREAR/CAMBIAR la contraseña.
  @IsString()
  @MinLength(1, { message: 'Ingresa tu contraseña' })
  password: string;
}

// DTO para REGISTRARSE como creador nuevo (auto-registro, queda PENDING).
export class CreatorRegisterDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  // Nombre: texto de entre 2 y 60 caracteres.
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName: string;

  // Apellido: texto de entre 2 y 60 caracteres.
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  lastName: string;

  // Teléfono OPCIONAL (@IsOptional): si se envía, debe ser texto de máx. 30.
  // El "?" en "phone?" marca la propiedad como opcional también en TypeScript.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  // Contraseña: debe cumplir el patrón fuerte PASSWORD_RULE definido arriba.
  @IsString()
  @Matches(PASSWORD_RULE, {
    message: 'La contraseña debe tener mínimo 8 caracteres, un número y un símbolo',
  })
  password: string;
}

// DTO para ESTABLECER la contraseña desde un enlace de invitación.
// Lo usa quien fue invitado por el admin: el correo trae un "token" y con él
// fija su contraseña por primera vez.
export class CreatorSetPasswordDto {
  // El token de invitación (cadena secreta del enlace). Solo validamos que sea
  // texto; su validez real (que exista y no haya expirado) se comprueba en el
  // servicio contra la base de datos.
  @IsString()
  token: string;

  // La nueva contraseña, que debe cumplir el patrón fuerte.
  @IsString()
  @Matches(PASSWORD_RULE, {
    message: 'La contraseña debe tener mínimo 8 caracteres, un número y un símbolo',
  })
  password: string;
}

// DTO para CAMBIAR la contraseña estando ya dentro (autenticado).
export class CreatorChangePasswordDto {
  // La contraseña ACTUAL: solo exigimos que no esté vacía; el servicio la
  // comparará con el hash guardado para confirmar la identidad.
  @IsString()
  @MinLength(1, { message: 'Ingresa tu contraseña actual' })
  currentPassword: string;

  // La NUEVA contraseña, que sí debe cumplir el patrón fuerte.
  @IsString()
  @Matches(PASSWORD_RULE, {
    message: 'La contraseña debe tener mínimo 8 caracteres, un número y un símbolo',
  })
  newPassword: string;
}
