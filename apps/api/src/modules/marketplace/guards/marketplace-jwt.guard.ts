// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador (etiqueta "@") que marca esta clase para que NestJS
//     pueda crearla e inyectarla donde se necesite.
//   - UnauthorizedException: error listo para usar que hace que la API responda
//     con código HTTP 401 (no autorizado) cuando se lanza.
import { Injectable, UnauthorizedException } from '@nestjs/common';

// AuthGuard es la clase base de Passport (la librería de autenticación). Al
// extenderla y pasarle el nombre de una "estrategia" ('marketplace-jwt'),
// obtenemos un guard que valida el token JWT del usuario de marketplace antes
// de dejar entrar a un endpoint.
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard OBLIGATORIO de autenticación para marketplace.
 *
 * Se coloca con @UseGuards(MarketplaceJwtGuard) sobre los endpoints que SOLO
 * pueden usar usuarios logueados. Si no hay token válido, corta la petición
 * con un error 401 y el usuario NO entra.
 */
@Injectable() // <- Marca la clase como inyectable de NestJS.
// Extiende AuthGuard usando la estrategia llamada 'marketplace-jwt'
// (definida en strategies/marketplace-jwt.strategy.ts).
export class MarketplaceJwtGuard extends AuthGuard('marketplace-jwt') {
  // handleRequest decide qué hacer con el resultado de validar el token.
  // Passport lo llama con: err (un error si lo hubo), user (los datos del
  // usuario si el token era válido) e _info (detalles extra que aquí ignoramos,
  // por eso lleva "_" al inicio). <TUser = any> es un tipo genérico: el tipo
  // del usuario devuelto, que por defecto es "any" (cualquiera).
  handleRequest<TUser = any>(err: any, user: any, _info: any): TUser {
    // Si hubo un error (err) O no hay usuario (!user, token inválido/ausente),
    // entonces cortamos la petición. El "||" significa "o lo uno o lo otro".
    if (err || !user) {
      // Lanzamos el error: si "err" ya existía lo relanzamos tal cual; si no,
      // creamos un 401 nuevo con mensaje en español. El "err || new ..." usa
      // err si tiene valor, y si no, el segundo.
      throw err || new UnauthorizedException('Autenticación de marketplace requerida');
    }
    // Si todo bien, devolvemos el usuario para que el endpoint pueda usarlo.
    return user;
  }
}
