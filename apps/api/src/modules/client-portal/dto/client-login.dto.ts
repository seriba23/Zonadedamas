// ─────────────────────────────────────────────────────────────────────────────
// DTO de LOGIN del portal del cliente.
// Un "DTO" (Data Transfer Object) es una clase que describe la FORMA exacta de
// los datos que esperamos recibir en el cuerpo (body) de una petición. NestJS,
// junto con "class-validator", revisa automáticamente que lo que llega cumpla
// estas reglas; si no, responde con error 400 (petición inválida) antes de que
// el código del controlador se ejecute siquiera.
// ─────────────────────────────────────────────────────────────────────────────

// De la librería "class-validator" importamos el decorador @IsString.
// Un decorador es una etiqueta que empieza con "@" y se pone justo encima de
// una propiedad para añadirle una regla de validación.
//   - @IsString: exige que el valor recibido sea una cadena de texto (string).
import { IsString } from 'class-validator';

// La clase que representa el cuerpo del POST /portal/:tenantSlug/auth/login.
export class ClientLoginDto {
  // "identifier" es el dato con el que el cliente se identifica: puede ser su
  // correo electrónico O su número de teléfono (el servicio decide cuál es
  // según si contiene "@"). Debe ser texto.
  @IsString()
  identifier: string; // email or phone

  // La contraseña en texto plano que el cliente teclea. Debe ser texto.
  // (Aquí no validamos su fuerza porque al iniciar sesión solo comparamos; la
  // fuerza se exige al REGISTRARSE y al CAMBIAR la contraseña.)
  @IsString()
  password: string;
}
