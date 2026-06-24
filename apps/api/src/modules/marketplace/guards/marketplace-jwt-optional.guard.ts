// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Injectable: marca la clase como inyectable de NestJS (para que el framework
// pueda crearla y usarla como guard).
import { Injectable } from '@nestjs/common';

// AuthGuard: clase base de Passport para crear guards basados en estrategias.
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard OPCIONAL de autenticación para marketplace.
 *
 * A diferencia del guard obligatorio, este NO corta la petición si falta el
 * token: simplemente deja pasar. Si hay token válido, adjunta el usuario;
 * si no, adjunta null. Se usa en endpoints "públicos pero personalizables":
 * por ejemplo, el listado de negocios se ve sin login, pero SI hay login se
 * marca cuáles son favoritos del usuario (campo isFavorited).
 */
@Injectable()
export class MarketplaceJwtOptionalGuard extends AuthGuard('marketplace-jwt') {
  // handleRequest aquí ignora el error (_err lleva "_" porque no lo usamos):
  // pase lo que pase, no lanzamos excepción. Devolvemos el usuario si existe,
  // y si no, null. "user || null" => usa "user" si tiene valor, si no, null.
  handleRequest<TUser = any>(_err: any, user: any): TUser {
    return user || null;
  }
}
