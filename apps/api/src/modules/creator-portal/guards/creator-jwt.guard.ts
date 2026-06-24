// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: marca esta clase como servicio inyectable (etiqueta "@").
//   - UnauthorizedException: error que responde con HTTP 401 (no autorizado).
import { Injectable, UnauthorizedException } from '@nestjs/common';

// AuthGuard es el "guardia" base de Passport en NestJS: un guard es un portero
// que decide si una petición puede entrar a un endpoint o no.
import { AuthGuard } from '@nestjs/passport';

// @Injectable() permite que NestJS gestione este guard.
@Injectable()
// Creamos nuestro guard heredando de AuthGuard('creator-jwt'). Al pasarle el
// nombre 'creator-jwt' le decimos: "para validar, usa la estrategia que se llama
// creator-jwt" (la que definimos en strategies/creator-jwt.strategy.ts).
// Este guard se aplica en el controlador con @UseGuards(CreatorJwtGuard).
export class CreatorJwtGuard extends AuthGuard('creator-jwt') {
  // handleRequest se ejecuta DESPUÉS de que la estrategia intentó validar el token.
  // Aquí decidimos qué hacer con el resultado.
  //   - err: un posible error ocurrido durante la validación.
  //   - user: lo que devolvió validate() en la estrategia (o null/false si falló).
  //   - _info: información extra (p.ej. token vencido). El "_" delante indica que
  //     no la usamos, pero el método igual la recibe.
  // <TUser = any> es un "genérico": el tipo del usuario; por defecto "any".
  handleRequest<TUser = any>(err: any, user: any, _info: any): TUser {
    // Si hubo un error O no hay usuario, bloqueamos el acceso.
    if (err || !user) {
      // "err || new Unauthorized..." => si existe un error concreto, lo lanzamos
      // tal cual; si no ("err" es null/undefined), lanzamos uno genérico 401.
      // El "||" devuelve el primer valor que sea "verdadero".
      throw err || new UnauthorizedException('Autenticación de creador requerida');
    }
    // Si todo bien, devolvemos el usuario; NestJS lo pondrá en req.user.
    return user;
  }
}
