// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un servicio
//     que NestJS puede crear e inyectar automáticamente donde haga falta.
//   - Logger: utilidad para escribir mensajes en la consola del servidor
//     (avisos, errores...). La usamos para advertir si falta el secreto del JWT.
//   - UnauthorizedException: error listo para usar que hace que la API responda
//     con código HTTP 401 (no autorizado) cuando el token es inválido.
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

// PassportStrategy es la "fábrica" que convierte una estrategia de Passport
// (librería estándar de autenticación) en una clase que NestJS entiende.
import { PassportStrategy } from '@nestjs/passport';

// De passport-jwt (la estrategia para autenticar con tokens JWT):
//   - ExtractJwt: ayudante para indicar DE DÓNDE sacar el token (aquí, del
//     header "Authorization: Bearer <token>").
//   - Strategy: la estrategia JWT en sí, que verifica la firma y la expiración.
import { ExtractJwt, Strategy } from 'passport-jwt';

// PrismaService es nuestro "puente" hacia la base de datos. Lo usamos para
// comprobar que el creador (influencer) del token todavía existe y no está
// suspendido.
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Forma (la "plantilla de tipos") del contenido que viaja DENTRO del token JWT
 * de un creador. Cuando firmamos el token (en el servicio) guardamos estos
 * campos; cuando lo verificamos aquí, los recibimos de vuelta.
 *   - sub: "subject" (sujeto). Convención JWT para el id del usuario; aquí es
 *     el id del influencer.
 *   - email: el correo del creador (informativo).
 *   - type: marca fija 'creator'. Sirve para distinguir este token de los de
 *     otros portales (cliente, empleado, admin...) y que no se mezclen.
 *   - iat / exp: los pone el propio JWT. "iat"=instante de emisión y "exp"=
 *     instante de expiración (en segundos). El "?" indica que son opcionales
 *     porque al firmar no los escribimos nosotros, los añade la librería.
 */
export interface CreatorJwtPayload {
  sub: string;
  email: string;
  type: 'creator';
  iat?: number;
  exp?: number;
}

/**
 * Devuelve el "secreto" con el que se firman y verifican los JWT. El secreto es
 * una contraseña interna del servidor: solo quien la conoce puede crear tokens
 * válidos, así nadie puede falsificarlos.
 */
function getJwtSecret(): string {
  // Leemos la variable de entorno JWT_SECRET (configurada fuera del código).
  const secret = process.env.JWT_SECRET;
  // Si NO hay secreto definido...
  if (!secret) {
    // ...y estamos en producción, es un fallo grave: detenemos todo con un error,
    // porque jamás debe usarse un secreto por defecto en un servidor real.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // En desarrollo solo avisamos por consola y seguimos con un secreto de
    // prueba (cómodo para programar, pero inseguro: NO usar en producción).
    Logger.warn(
      'JWT_SECRET not set — using insecure default.',
      'CreatorJwtStrategy',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  // Si había secreto, lo devolvemos tal cual.
  return secret;
}

// @Injectable() marca esta estrategia como servicio inyectable de NestJS.
@Injectable()
// Creamos nuestra estrategia JWT y le ponemos el nombre 'creator-jwt'. Ese
// nombre es la "etiqueta" con la que el guard (CreatorJwtGuard) sabe qué
// estrategia usar. Cada portal tiene su propia estrategia con su propio nombre.
export class CreatorJwtStrategy extends PassportStrategy(Strategy, 'creator-jwt') {
  // El constructor recibe el PrismaService (inyectado por NestJS) para consultar
  // la base de datos. "private readonly" lo guarda como this.prisma (solo lectura).
  constructor(private readonly prisma: PrismaService) {
    // super(...) configura la estrategia JWT base de passport-jwt:
    super({
      // De dónde se extrae el token: del header "Authorization: Bearer <token>".
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration:false => SÍ respetamos la expiración: un token vencido
      // se rechaza automáticamente (no llega siquiera a validate()).
      ignoreExpiration: false,
      // El secreto con el que se verifica la firma del token (ver función arriba).
      secretOrKey: getJwtSecret(),
    });
  }

  // validate() se ejecuta SOLO si el token tenía firma válida y no estaba vencido.
  // Recibe el "payload" ya descifrado (los datos que metimos al firmarlo).
  // Lo que devuelve aquí es lo que NestJS pondrá en req.user para los endpoints.
  async validate(payload: CreatorJwtPayload) {
    // Segunda capa de seguridad: comprobamos que el token sea realmente de tipo
    // 'creator'. Si alguien intentara entrar con un token de otro portal, se
    // rechaza con 401.
    if (payload.type !== 'creator') {
      throw new UnauthorizedException('Token no válido para portal de creadores');
    }

    // Verificamos que el creador siga existiendo y NO esté suspendido.
    // findFirst busca el PRIMER registro que cumpla las condiciones.
    // "status: { not: 'SUSPENDED' }" => el estado debe ser distinto de SUSPENDED
    // (un creador suspendido no puede usar su token aunque siga siendo válido).
    const influencer = await this.prisma.influencer.findFirst({
      where: { id: payload.sub, status: { not: 'SUSPENDED' } },
    });
    // Si no se encontró (no existe o está suspendido), bloqueamos el acceso.
    if (!influencer) {
      throw new UnauthorizedException('Creador no encontrado o suspendido');
    }

    // Devolvemos un objeto compacto que quedará disponible como req.user en los
    // controladores. "as const" fija el tipo de 'type' al literal 'creator'
    // (en vez del genérico string), para que TypeScript lo trate como constante.
    return { influencerId: influencer.id, email: influencer.email, type: 'creator' as const };
  }
}
