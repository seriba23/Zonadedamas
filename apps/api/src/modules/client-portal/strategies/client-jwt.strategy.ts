// ─────────────────────────────────────────────────────────────────────────────
// ESTRATEGIA JWT del portal del cliente.
// Una "estrategia" de Passport define CÓMO se valida la autenticación. Esta
// estrategia se llama 'client-jwt': extrae el token del header, lo verifica con
// la clave secreta y, si es válido, comprueba en la base de datos que el cliente
// exista y esté activo. El guard (ClientJwtGuard) usa esta estrategia.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: marca la clase como inyectable.
//   - Logger: utilidad para escribir mensajes en la consola/registro del servidor.
//   - UnauthorizedException: error que responde con HTTP 401.
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

// PassportStrategy: función base de NestJS para crear una estrategia de Passport.
import { PassportStrategy } from '@nestjs/passport';

// De "passport-jwt" (estrategia JWT de Passport):
//   - ExtractJwt: ayudantes para sacar el token de la petición (del header, etc.).
//   - Strategy: la clase de la estrategia JWT propiamente dicha.
import { ExtractJwt, Strategy } from 'passport-jwt';

// PrismaService: nuestro puente a la base de datos, para confirmar que el
// cliente del token todavía existe y está activo.
import { PrismaService } from '../../../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// Forma del "payload" (contenido) del token JWT del cliente.
// Una "interface" describe qué campos lleva un objeto, solo para TypeScript.
// Cuando se firma el token (en el servicio), se guardan estos datos dentro.
// ─────────────────────────────────────────────────────────────────────────────
export interface ClientJwtPayload {
  sub: string;        // "subject": el id del cliente (estándar JWT).
  tenantId: string;   // a qué negocio (tenant) pertenece este cliente.
  email?: string;     // correo (opcional, puede no existir si se registró con teléfono).
  phone?: string;     // teléfono (opcional).
  type: 'client';     // marca que ES un token de CLIENTE (no de empleado/admin).
  iat?: number;       // "issued at": cuándo se emitió (lo añade JWT automáticamente).
  exp?: number;       // "expiration": cuándo expira (también automático).
}

// ─────────────────────────────────────────────────────────────────────────────
// Función que obtiene la clave secreta para verificar/firmar los tokens.
// La clave debe ser secreta y estar en una variable de entorno (process.env).
// ─────────────────────────────────────────────────────────────────────────────
function getJwtSecret(): string {
  // Leemos la variable de entorno JWT_SECRET.
  const secret = process.env.JWT_SECRET;
  // "if (!secret)" => si NO hay clave configurada...
  if (!secret) {
    // ...en producción es un error grave: la app no debe arrancar sin clave real.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // En desarrollo solo avisamos con una advertencia y usamos una clave por
    // defecto (NUNCA usar esta clave en producción: cualquiera podría falsificar
    // tokens).
    Logger.warn(
      'JWT_SECRET not set — using insecure default. Set JWT_SECRET for production.',
      'ClientJwtStrategy',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  // Si sí había clave, la devolvemos.
  return secret;
}

@Injectable() // <- Servicio inyectable de NestJS.
// Creamos la estrategia heredando de PassportStrategy. El segundo argumento,
// 'client-jwt', es el NOMBRE de la estrategia: así el guard sabe cuál usar.
export class ClientJwtStrategy extends PassportStrategy(Strategy, 'client-jwt') {
  // El constructor recibe PrismaService (inyectado por NestJS) y, ANTES de poder
  // usar "this", debe llamar a super(...) para configurar la estrategia base.
  constructor(private readonly prisma: PrismaService) {
    super({
      // De dónde se saca el token: del header "Authorization: Bearer <token>".
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration: false => SÍ respetamos la expiración (un token vencido
      // se rechaza automáticamente).
      ignoreExpiration: false,
      // La clave con la que se verifica la firma del token.
      secretOrKey: getJwtSecret(),
    });
  }

  // validate() se ejecuta SOLO si el token tenía firma válida y no estaba vencido.
  // Recibe el "payload" (los datos guardados dentro del token). Aquí hacemos
  // comprobaciones extra de negocio y devolvemos el objeto que quedará en req.user.
  async validate(payload: ClientJwtPayload) {
    // "payload.type !== 'client'" => "!==" es "estrictamente distinto de".
    // Si el token NO es de tipo cliente (p. ej. es de un empleado), lo rechazamos:
    // evita que un token de otro portal sirva para entrar aquí.
    if (payload.type !== 'client') {
      throw new UnauthorizedException('Token no válido para portal de clientes');
    }

    // "if (!payload.tenantId)" => si falta el negocio en el token, es inválido.
    if (!payload.tenantId) {
      throw new UnauthorizedException('Token inválido: falta tenantId');
    }

    // Confirmamos en la base de datos que el cliente del token sigue existiendo,
    // pertenece a ese tenant y está activo. (Un token podría seguir siendo válido
    // criptográficamente aunque el cliente haya sido desactivado.)
    const client = await this.prisma.client.findFirst({
      where: {
        id: payload.sub,           // el id del cliente (sub del token)
        tenantId: payload.tenantId, // del mismo negocio (filtro multi-tenant)
        isActive: true,            // que no esté desactivado
        // OR = se cumple si CUALQUIERA de estas condiciones es verdadera.
        // Aceptamos al cliente si tiene contraseña propia (se registró en el
        // portal) O si está enlazado a un usuario del sistema (userId).
        // "{ not: null }" es un operador de Prisma: "el campo NO es null".
        OR: [
          { passwordHash: { not: null } },
          { userId: { not: null } },
        ],
      },
    });

    // Si no se encontró un cliente que cumpla todo lo anterior, rechazamos.
    if (!client) {
      throw new UnauthorizedException('Cliente no encontrado o inactivo');
    }

    // Devolvemos un objeto "limpio" con los datos que los controladores usarán
    // a través de req.user. Nota: aquí renombramos "sub" a "clientId" para que
    // sea más legible en el resto del código.
    return {
      clientId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      phone: payload.phone,
      // "as const" fija el tipo del valor como el literal exacto 'client'
      // (en vez del tipo genérico string), útil para comparaciones de tipo.
      type: 'client' as const,
    };
  }
}
