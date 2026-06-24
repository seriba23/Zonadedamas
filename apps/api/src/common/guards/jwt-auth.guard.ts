// ─────────────────────────────────────────────────────────────────────────────
// GUARD JwtAuthGuard — "el portero que pide el token JWT antes de entrar"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: un "guard" en NestJS es un portero. Antes de que una petición
// llegue al método del controlador, el guard decide si la DEJA PASAR o la
// RECHAZA. Este guard verifica que la petición traiga un token JWT válido en la
// cabecera Authorization. Si es válido, deja pasar y guarda el usuario en
// request.user; si no, devuelve error 401 (no autorizado). Excepción: si la
// ruta está marcada con @Public(), deja pasar sin pedir token.

// De NestJS:
//   - ExecutionContext: contexto de la petición (request, response, qué método
//     y qué clase se van a ejecutar).
//   - Injectable: marca esta clase como inyectable (NestJS la puede crear y
//     pasar a otros componentes automáticamente).
//   - UnauthorizedException: error listo que responde con HTTP 401.
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
// Reflector: utilidad para LEER la metadata (las "notas adhesivas") que pusieron
// decoradores como @Public(). Es la contraparte de SetMetadata.
import { Reflector } from '@nestjs/core';
// AuthGuard de Passport: clase base que ya trae toda la lógica para validar el
// token con la "estrategia" llamada 'jwt'. Nosotros la EXTENDEMOS (heredamos)
// para añadirle el detalle de las rutas públicas.
import { AuthGuard } from '@nestjs/passport';
// La clave de la nota "isPublic", definida en el decorador @Public().
// Importarla asegura que leemos exactamente la misma clave que se escribió.
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// @Injectable(): la clase puede inyectarse/usarse como guard en todo el sistema.
@Injectable()
// "extends AuthGuard('jwt')": heredamos el portero estándar de Passport
// configurado con la estrategia 'jwt'. Así reutilizamos su validación de token
// y solo personalizamos lo necesario.
export class JwtAuthGuard extends AuthGuard('jwt') {
  // El constructor recibe (inyectado) un Reflector para poder leer metadata.
  // "private reflector" lo guarda como propiedad (this.reflector).
  constructor(private reflector: Reflector) {
    // super() llama al constructor de la clase padre (AuthGuard). Es obligatorio
    // hacerlo al heredar antes de usar "this".
    super();
  }

  // canActivate es el método que el portero ejecuta para decidir si pasa o no.
  // Devuelve true (pasa) o false/lanza error (no pasa).
  canActivate(context: ExecutionContext) {
    // Preguntamos si la ruta está marcada como pública. getAllAndOverride busca
    // la nota IS_PUBLIC_KEY en DOS lugares y, si está en ambos, el primero gana:
    //   - context.getHandler(): el método concreto (ej. el endpoint).
    //   - context.getClass(): la clase controladora completa.
    // El <boolean> indica que esperamos un valor booleano (true/false).
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la ruta es pública, dejamos pasar sin verificar token alguno.
    if (isPublic) {
      return true;
    }

    // Si NO es pública, delegamos en el comportamiento del padre (AuthGuard),
    // que se encarga de leer y validar el token JWT de verdad.
    return super.canActivate(context);
  }

  // handleRequest lo llama Passport DESPUÉS de intentar validar el token. Aquí
  // decidimos qué hacer con el resultado.
  //   - err: un error si la validación falló por excepción.
  //   - user: el usuario decodificado del token (o false/null si no hubo token
  //     válido).
  //   - _info: detalles extra (no los usamos; el "_" indica que se ignora).
  //   - "<TUser = any>": tipo genérico del usuario devuelto; por defecto "any".
  handleRequest<TUser = any>(err: any, user: any, _info: any): TUser {
    // Si hubo un error O no hay usuario, rechazamos la petición.
    // "throw err || new UnauthorizedException(...)" usa el operador OR "||":
    // lanza el error original si existe; si no, lanza un 401 genérico.
    if (err || !user) {
      throw err || new UnauthorizedException('Autenticación requerida');
    }
    // Todo bien: devolvemos el usuario, que NestJS dejará en request.user.
    return user;
  }
}
