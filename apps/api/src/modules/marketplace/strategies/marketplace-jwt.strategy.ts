// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: marca la clase como inyectable.
//   - Logger: utilidad para escribir mensajes en la consola/registro del servidor.
//   - UnauthorizedException: error que responde con HTTP 401.
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

// PassportStrategy: clase base de NestJS para registrar una "estrategia" de
// autenticación con Passport.
import { PassportStrategy } from '@nestjs/passport';

// De passport-jwt (la librería que valida tokens JWT):
//   - ExtractJwt: herramienta para decir DE DÓNDE sacar el token de la petición.
//   - Strategy: la estrategia concreta de JWT que vamos a configurar.
import { ExtractJwt, Strategy } from 'passport-jwt';

// PrismaService: puente hacia la base de datos (para verificar que el usuario
// del token todavía existe y está activo).
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Forma (estructura) del contenido que viaja DENTRO del token JWT del
 * marketplace. Una "interface" describe qué campos tiene un objeto.
 */
export interface MarketplaceJwtPayload {
  sub: string;             // "subject": el id del usuario dueño del token.
  email: string;           // el correo del usuario.
  type: 'marketplace';     // marca fija que distingue este token de otros tipos.
  iat?: number;            // "issued at": cuándo se emitió (opcional, lo pone JWT).
  exp?: number;            // "expiration": cuándo caduca (opcional, lo pone JWT).
}

/**
 * Devuelve la clave secreta con la que se firman/verifican los JWT.
 * Si no está configurada en las variables de entorno, en producción es un
 * error grave; en desarrollo avisa y usa una clave insegura por defecto.
 */
function getJwtSecret(): string {
  // Leemos la variable de entorno JWT_SECRET (configurada fuera del código).
  const secret = process.env.JWT_SECRET;
  // Si NO existe esa variable...
  if (!secret) {
    // ...y estamos en producción, abortamos: no se permite arrancar sin clave.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // En desarrollo solo avisamos en el registro (segundo argumento = contexto).
    Logger.warn(
      'JWT_SECRET not set — using insecure default. Set JWT_SECRET for production.',
      'MarketplaceJwtStrategy',
    );
    // Y devolvemos una clave de relleno SOLO para desarrollo.
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  // Si la variable existía, devolvemos su valor.
  return secret;
}

/**
 * Estrategia 'marketplace-jwt': enseña a Passport CÓMO validar el token de un
 * usuario del marketplace. La usan los guards MarketplaceJwtGuard (obligatorio)
 * y MarketplaceJwtOptionalGuard (opcional).
 */
@Injectable()
// Registramos la estrategia JWT con el nombre 'marketplace-jwt'.
export class MarketplaceJwtStrategy extends PassportStrategy(Strategy, 'marketplace-jwt') {
  // El constructor recibe PrismaService (inyectado por NestJS) y lo guarda como
  // this.prisma para consultar la base de datos en validate().
  constructor(private readonly prisma: PrismaService) {
    // super(...) configura la estrategia base de passport-jwt:
    super({
      // De dónde sacar el token: del header "Authorization: Bearer <token>".
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // false = NO ignorar la expiración (un token caducado se rechaza).
      ignoreExpiration: false,
      // Clave para verificar la firma del token (la de arriba).
      secretOrKey: getJwtSecret(),
    });
  }

  // validate() se ejecuta DESPUÉS de que Passport verifique la firma y la
  // expiración. Recibe el contenido ya decodificado del token (payload) y
  // decide si el usuario es válido. Lo que devuelve queda disponible como
  // req.user en el endpoint.
  async validate(payload: MarketplaceJwtPayload) {
    // Comprobamos que el token sea realmente de tipo 'marketplace'. "!==" es
    // "distinto de". Si fuera un token de otro portal (dashboard, cliente...),
    // lo rechazamos para que no se cuele aquí.
    if (payload.type !== 'marketplace') {
      throw new UnauthorizedException('Token no válido para marketplace');
    }

    // Buscamos en la base de datos al usuario del token (payload.sub = su id),
    // pero solo si SIGUE activo (isActive) y es un cliente del marketplace
    // (isClient). findFirst = trae el primer registro que cumpla todo esto.
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, isClient: true },
    });

    // Si no se encontró (cuenta borrada/desactivada/no es cliente), rechazamos.
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Devolvemos un objeto compacto con lo esencial. Esto será "req.user" en los
    // controladores. "as const" fija el tipo de 'type' al literal 'marketplace'
    // (no a un string genérico), lo que ayuda al chequeo de tipos.
    return {
      marketplaceUserId: payload.sub,
      email: payload.email,
      type: 'marketplace' as const,
    };
  }
}
