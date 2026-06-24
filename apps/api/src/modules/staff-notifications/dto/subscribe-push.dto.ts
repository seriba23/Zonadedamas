// Importamos "decoradores de validación" de class-validator. Estos se ponen
// arriba de cada campo y hacen que NestJS rechace automáticamente una petición
// si el dato no cumple la regla (responde error 400 sin que escribamos código).
//   - IsNotEmpty: el campo no puede estar vacío.
//   - IsObject: el campo debe ser un objeto JSON.
//   - IsOptional: el campo puede faltar (si falta, no se valida lo demás).
//   - IsString: el campo debe ser texto.
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

// Un DTO ("Data Transfer Object") describe la forma de los datos que ENTRAN
// por la API. PushKeys describe las dos claves de cifrado que el navegador
// genera al suscribirse a push. Se usa como "sub-objeto" dentro del DTO grande.
class PushKeys {
  // "p256dh" = clave pública del navegador (curva P-256) para cifrar el push.
  // El "!" tras el nombre le dice a TypeScript "confía, siempre tendrá valor".
  @IsString()      // debe ser texto
  @IsNotEmpty()    // no puede venir vacío
  p256dh!: string;

  // "auth" = secreto de autenticación que también participa en el cifrado.
  @IsString()
  @IsNotEmpty()
  auth!: string;
}

// DTO principal del endpoint "suscribirse a push". Es exactamente lo que el
// navegador entrega cuando el usuario acepta recibir notificaciones.
export class SubscribePushDto {
  // "endpoint" = la URL única del servicio push del navegador (a dónde se
  // envía el mensaje para que llegue a ESE dispositivo). Obligatoria.
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  // "keys" = el objeto con las dos claves de arriba (p256dh y auth). Obligatorio.
  @IsObject()
  @IsNotEmpty()
  keys!: PushKeys;

  // "userAgent" = texto que identifica el navegador/dispositivo (opcional).
  // El "?" indica que puede no venir; @IsOptional lo permite explícitamente.
  @IsOptional()
  @IsString()
  userAgent?: string;
}
