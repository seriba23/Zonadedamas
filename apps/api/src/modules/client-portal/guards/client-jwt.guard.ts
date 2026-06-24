// ─────────────────────────────────────────────────────────────────────────────
// GUARD (guardia) de autenticación para el portal del cliente.
// Un "guard" en NestJS es un portero: se ejecuta ANTES del método del
// controlador y decide si la petición puede pasar o se rechaza. Si lo pones con
// @UseGuards(ClientJwtGuard) sobre un endpoint, ese endpoint exigirá un token
// válido de cliente para poder usarse.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: marca la clase como inyectable (NestJS la puede crear y usar).
//   - UnauthorizedException: error listo que responde con HTTP 401 (no autorizado).
import { Injectable, UnauthorizedException } from '@nestjs/common';

// AuthGuard es el guard base de Passport (la librería de autenticación). Al
// llamarlo con el nombre de una estrategia ('client-jwt'), crea un guard que
// usará ESA estrategia para validar el token. Aquí 'client-jwt' es la estrategia
// definida en strategies/client-jwt.strategy.ts.
import { AuthGuard } from '@nestjs/passport';

@Injectable() // <- Servicio inyectable de NestJS.
// "extends AuthGuard('client-jwt')" => heredamos toda la lógica del guard de
// Passport para la estrategia 'client-jwt' (extraer el token del header, validarlo,
// etc.) y solo personalizamos una parte: el manejo del resultado.
export class ClientJwtGuard extends AuthGuard('client-jwt') {
  // handleRequest se llama DESPUÉS de que la estrategia intenta validar el token.
  // Recibe:
  //   - err: un error si algo falló durante la validación (o null si no hubo).
  //   - user: lo que devolvió el método validate() de la estrategia (los datos
  //     del cliente) o false/null si la validación falló.
  //   - _info: información extra de Passport (no la usamos; el "_" delante del
  //     nombre es una convención para indicar "parámetro que ignoro").
  // El "<TUser = any>" es un genérico de TypeScript: permite tipar lo que se
  // devuelve; por defecto "any" (cualquier cosa).
  handleRequest<TUser = any>(err: any, user: any, _info: any): TUser {
    // "err || !user" se lee como "si hubo un error O NO hay usuario".
    // El operador "||" (O lógico) es verdadero si CUALQUIERA de los lados lo es.
    // "!user" es verdadero cuando user es null/false/undefined (no autenticado).
    if (err || !user) {
      // "throw err || new Unauthorized..." => si existe un error concreto, lo
      // relanzamos tal cual; si no (err es null), lanzamos un 401 genérico.
      throw err || new UnauthorizedException('Autenticación de cliente requerida');
    }
    // Si todo está bien, devolvemos el usuario. NestJS lo coloca en req.user,
    // de donde los controladores lo leen (req.user.clientId, req.user.tenantId).
    return user;
  }
}
