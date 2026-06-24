// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: decorador que marca esta clase como servicio inyectable.
//   - Logger: utilidad para escribir mensajes en la consola del servidor.
//   - UnauthorizedException: error listo para usar que responde con HTTP 401.
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

// PassportStrategy: función "base" de @nestjs/passport. La usamos para crear una
// clase de estrategia de autenticación adaptada a NestJS.
import { PassportStrategy } from '@nestjs/passport';

// De passport-jwt (la estrategia de Passport especializada en tokens JWT):
//   - ExtractJwt: ayudante para indicar DE DÓNDE se saca el token de la petición.
//   - Strategy: la clase de estrategia JWT en sí, que validará la firma del token.
import { ExtractJwt, Strategy } from 'passport-jwt';

// PrismaService: nuestro "puente" hacia la base de datos (consultas SQL desde JS).
import { PrismaService } from '../../../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// FORMA DEL PAYLOAD DEL TOKEN
// ─────────────────────────────────────────────────────────────────────────────
// "interface" describe la forma (los campos) que tendrá el contenido decodificado
// del token JWT del super-admin. No genera código: solo ayuda a TypeScript a
// avisarnos si usamos un campo que no existe.
export interface PlatformJwtPayload {
  sub: string;            // "subject": el id del usuario de plataforma (dueño del token).
  email: string;          // correo del super-admin.
  role: 'platform_admin'; // rol fijo: solo este valor es válido aquí.
  iss?: string;           // "issuer": quién emitió el token. El "?" = campo opcional.
  iat?: number;           // "issued at": momento de emisión (segundos). Opcional.
  exp?: number;           // "expiration": momento de expiración (segundos). Opcional.
}

// ─────────────────────────────────────────────────────────────────────────────
// SECRETO DE FIRMA DEL JWT
// ─────────────────────────────────────────────────────────────────────────────
// Devuelve la "clave secreta" con la que se firma/verifica el token. Esa clave
// debe ser la MISMA al firmar (en el servicio) y al verificar (aquí).
function getJwtSecret(): string {
  // Leemos la variable de entorno JWT_SECRET (configurada fuera del código).
  const secret = process.env.JWT_SECRET;
  // "if (!secret)" se lee "si NO hay secreto" (vacío/undefined es "falso").
  if (!secret) {
    // En producción NO permitimos arrancar sin secreto: es un riesgo grave.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // En desarrollo solo avisamos por consola (segundo argumento = "contexto").
    Logger.warn(
      'JWT_SECRET not set — using insecure default.',
      'PlatformJwtStrategy',
    );
    // Y usamos un secreto por defecto, claramente marcado como "no para producción".
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  // Si la variable existía, devolvemos su valor.
  return secret;
}

// @Injectable() permite que NestJS cree esta estrategia e inyecte sus dependencias.
@Injectable()
// Creamos la estrategia JWT del super-admin.
//   - "PassportStrategy(Strategy, 'platform-jwt')": construimos una clase base a
//     partir de la estrategia JWT de passport-jwt y le ponemos el NOMBRE
//     'platform-jwt'. Ese nombre es el que usa el guard (AuthGuard('platform-jwt')).
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  // El constructor recibe PrismaService (inyectado por NestJS) y lo guarda como
  // propiedad de solo lectura (this.prisma) para consultar la base de datos.
  constructor(private readonly prisma: PrismaService) {
    // super({...}) configura la estrategia base de Passport ANTES de poder usar
    // "this". Aquí decimos cómo extraer y verificar el token:
    super({
      // De dónde sale el token: del header "Authorization: Bearer <token>".
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // false = NO ignorar la expiración (un token vencido se rechaza).
      ignoreExpiration: false,
      // La clave secreta para verificar la firma del token.
      secretOrKey: getJwtSecret(),
      // Solo aceptamos tokens cuyo emisor (issuer) sea 'siliba-platform'. Así un
      // token de otro sistema (clientes, negocios) no sirve para el super-admin.
      issuer: 'siliba-platform',
    });
  }

  // validate(): Passport llama a este método AUTOMÁTICAMENTE después de verificar
  // la firma y la expiración del token. Recibe el "payload" ya decodificado.
  // Lo que devolvamos aquí se inyecta en "req.user" para usarlo en los controllers.
  async validate(payload: PlatformJwtPayload) {
    // Comprobación extra de seguridad: el rol DEBE ser exactamente 'platform_admin'.
    // "!==" significa "distinto de" (compara valor y tipo). Si no coincide, 401.
    if (payload.role !== 'platform_admin') {
      throw new UnauthorizedException('Token inválido para esta plataforma');
    }

    // Verificamos que el usuario del token siga existiendo y esté activo.
    // findFirst = "encuentra el primer registro que cumpla". payload.sub es el id.
    const user = await this.prisma.platformUser.findFirst({
      where: { id: payload.sub, isActive: true },
    });

    // Si no se encontró (borrado o desactivado tras emitir el token), rechazamos.
    if (!user) {
      throw new UnauthorizedException('Usuario de plataforma no encontrado o inactivo');
    }

    // Devolvemos un objeto compacto que NestJS pondrá en req.user. Solo incluimos
    // lo necesario. "as const" fija el tipo del rol al literal exacto 'platform_admin'.
    return {
      userId: payload.sub,
      email: payload.email,
      role: 'platform_admin' as const,
    };
  }
}
