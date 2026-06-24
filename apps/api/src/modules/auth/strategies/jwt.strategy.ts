// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: marca la clase como servicio inyectable.
//   - Logger: utilidad para imprimir mensajes (info/advertencias) en consola.
//   - UnauthorizedException: error que responde con HTTP 401 (no autorizado).
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

// PassportStrategy: función-base de NestJS que envuelve una "estrategia" de
// Passport. Passport es la librería estándar de autenticación: una "estrategia"
// es un método concreto de validar al usuario (aquí, validar un JWT).
import { PassportStrategy } from '@nestjs/passport';

// De "passport-jwt" (la estrategia específica para tokens JWT):
//   - ExtractJwt: ayuda a extraer el token de la petición (ej. de la cabecera).
//   - Strategy: la clase de estrategia JWT que vamos a extender/configurar.
import { ExtractJwt, Strategy } from 'passport-jwt';

// PrismaService: puente hacia la base de datos para verificar que el usuario del
// token aún existe y sigue activo.
import { PrismaService } from '../../../prisma/prisma.service';

// JWT = "JSON Web Token". Es una cadena firmada que viaja en cada petición y
// guarda en su interior ("payload" = carga útil) datos del usuario. Esta interfaz
// describe qué campos contiene NUESTRO payload:
export interface JwtPayload {
  sub: string;          // "subject": el id del usuario dueño del token.
  tenantId: string;     // id del negocio (tenant) al que pertenece.
  email: string;        // correo del usuario.
  permissions?: string[]; // lista de permisos ("module.action"); opcional ("?").
  iat?: number;         // "issued at": cuándo se emitió (segundos UNIX). Lo pone JWT.
  exp?: number;         // "expiration": cuándo caduca (segundos UNIX). Lo pone JWT.
}

// Devuelve la clave secreta con la que se firman/verifican los JWT. La firma es
// lo que impide que alguien falsifique un token: sin el secreto no se puede
// generar una firma válida.
function getJwtSecret(): string {
  // Leemos la variable de entorno JWT_SECRET (definida fuera del código).
  const secret = process.env.JWT_SECRET;
  // Si NO hay secreto configurado...
  if (!secret) {
    // ...y estamos en producción, es un fallo grave de seguridad -> lanzamos error.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // En desarrollo solo avisamos y usamos un secreto por defecto (inseguro).
    Logger.warn(
      'JWT_SECRET not set — using insecure default. Set JWT_SECRET for production.',
      'JwtStrategy',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  // Si sí hay secreto, lo devolvemos.
  return secret;
}

// @Injectable marca esta estrategia como un servicio que NestJS gestiona.
@Injectable()
// La clase EXTIENDE (hereda de) PassportStrategy(Strategy): así NestJS la
// registra como la estrategia 'jwt' por defecto. Cuando un endpoint use el
// JwtAuthGuard, Passport ejecutará esta estrategia automáticamente.
export class JwtStrategy extends PassportStrategy(Strategy) {
  // El constructor recibe PrismaService (inyectado por NestJS) y guardado como
  // this.prisma (private readonly = propiedad privada de solo lectura).
  constructor(private readonly prisma: PrismaService) {
    // super(...) llama al constructor de la clase padre (la estrategia JWT) para
    // CONFIGURAR cómo se valida el token:
    super({
      // De dónde se saca el token: de la cabecera "Authorization: Bearer <token>".
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration: false => SÍ respetar la caducidad (rechazar expirados).
      ignoreExpiration: false,
      // La clave secreta con la que se verifica la firma del token.
      secretOrKey: getJwtSecret(),
    });
  }

  // validate() se ejecuta SOLO si el token tenía firma válida y no estaba caducado.
  // Recibe el "payload" (los datos decodificados del token) y debe devolver el
  // objeto del usuario que quedará disponible en la petición (req.user). Si algo
  // no cuadra, lanza un 401 para bloquear la petición.
  async validate(payload: JwtPayload) {
    // Rechazar tokens de la PLATAFORMA (superadmin) en endpoints de tenant.
    // "(payload as any)" evita un choque de tipos para leer un campo extra "role"
    // que no está en la interfaz JwtPayload. "===" compara valor y tipo exactos.
    if ((payload as any).role === 'platform_admin') {
      throw new UnauthorizedException('Token de plataforma no válido para endpoints de tenant');
    }

    // Un token de tenant DEBE traer tenantId. Si falta, es inválido.
    if (!payload.tenantId) {
      throw new UnauthorizedException('Token inválido: falta tenantId');
    }

    // Verificamos en la base de datos que el usuario del token sigue existiendo,
    // pertenece a ese tenant y está activo (multi-tenant: filtrar por tenantId).
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        isActive: true,
      },
    });

    // Si no se encontró (borrado o desactivado), invalidamos la sesión.
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    // Lo que retornamos aquí es lo que NestJS coloca en req.user y que el
    // decorador @CurrentUser() entrega a los controladores.
    // "payload.permissions || []": si no hubiera permisos, usamos lista vacía
    // ("||" devuelve el lado derecho cuando el izquierdo es null/undefined/vacío).
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      permissions: payload.permissions || [],
    };
  }
}
