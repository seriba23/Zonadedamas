// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos las piezas para construir un "interceptor". Un interceptor
// es código que se ejecuta ANTES y/o DESPUÉS de cada petición, sin estar dentro
// del controlador. Aquí lo usamos para bloquear o avisar según el estado de la
// suscripción del negocio.
//   - Injectable: marca la clase como inyectable por NestJS.
//   - NestInterceptor: la "interfaz" (contrato) que debe cumplir un interceptor.
//   - ExecutionContext: objeto con información del contexto de la petición actual
//     (de él sacamos la request HTTP).
//   - CallHandler: el "siguiente paso" del flujo; con next.handle() dejamos que
//     la petición continúe hacia el controlador.
//   - ForbiddenException: error que responde con HTTP 403 (prohibido).
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';

// De RxJS:
//   - Observable: un "flujo" de datos asíncrono. Los interceptores de NestJS
//     devuelven un Observable con la respuesta.
import { Observable } from 'rxjs';

// PrismaService: puente a la base de datos para leer la suscripción del negocio.
import { PrismaService } from '../../prisma/prisma.service';

// Lista de RUTAS SIEMPRE PERMITIDAS, aunque la cuenta esté suspendida. Son rutas
// esenciales (login, ver/pagar la suscripción, etc.) que el negocio debe poder
// usar para poder regularizar su situación.
const ALWAYS_ALLOWED_PATHS = [
  '/api/auth/me',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/subscription',
  '/api/subscription/usage',
  '/api/subscription/invoices',
  // Rutas de pago/renovación de la suscripción: deben seguir disponibles aunque
  // la cuenta esté bloqueada, para que el negocio pueda PAGAR y reactivarse.
  '/api/stripe/subscription',
];

// Prefijo de las rutas de la PLATAFORMA (superadmin). Estas nunca dependen de la
// suscripción de un negocio concreto, así que las dejamos pasar siempre.
const PLATFORM_PREFIX = '/api/platform';

@Injectable() // <- Marca la clase como inyectable de NestJS.
// "implements NestInterceptor" obliga a esta clase a tener el método intercept().
export class SubscriptionStatusInterceptor implements NestInterceptor {
  // El constructor recibe el PrismaService inyectado por NestJS, guardado como
  // propiedad de solo lectura para consultar la suscripción.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // intercept(): se ejecuta en CADA petición que pase por este interceptor.
  // Recibe:
  //   - context: el contexto de ejecución (de aquí sacamos la request).
  //   - next: el "siguiente paso"; next.handle() continúa hacia el controlador.
  // Devuelve: una promesa con un Observable (el flujo de la respuesta).
  // ───────────────────────────────────────────────────────────────────────────
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // switchToHttp().getRequest() obtiene el objeto "request" HTTP (la petición
    // entrante con su URL, método, usuario, etc.).
    const request = context.switchToHttp().getRequest();
    // request.url puede traer una "query string" (ej. "/api/x?foo=1"). La
    // partimos por "?" y nos quedamos con el trozo [0] (la ruta sin parámetros).
    // El "?." evita romper si url fuera undefined; el "|| ''" usa texto vacío
    // como respaldo si quedara algo nulo. Así "path" siempre es un string.
    const path = request.url?.split('?')[0] || '';
    // El método HTTP de la petición: 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'...
    const method = request.method;

    // Si la ruta es de plataforma, pública, o está en la lista de siempre
    // permitidas, NO aplicamos ninguna restricción: dejamos pasar la petición.
    if (
      // startsWith comprueba si la ruta EMPIEZA por ese prefijo.
      path.startsWith(PLATFORM_PREFIX) ||
      path.startsWith('/api/public') ||
      // some() recorre la lista ALWAYS_ALLOWED_PATHS y devuelve true en cuanto
      // UNA ruta "p" sea un prefijo de la ruta actual (¿alguna coincide?).
      ALWAYS_ALLOWED_PATHS.some((p) => path.startsWith(p))
    ) {
      return next.handle(); // continúa sin bloquear.
    }

    // Solo aplicamos los controles a usuarios autenticados de un negocio.
    const user = request.user; // el usuario que el guardia de auth dejó en la request.
    // "!user?.tenantId" => si no hay usuario, o el usuario no tiene tenantId,
    // no es un usuario de negocio: dejamos pasar (no hay suscripción que validar).
    if (!user?.tenantId) {
      return next.handle();
    }

    // Buscamos la suscripción del negocio del usuario.
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    // Si el negocio no tiene suscripción (cuentas antiguas o gratuitas), no hay
    // nada que restringir: dejamos pasar.
    if (!subscription) {
      return next.handle();
    }

    // ── ESTADOS QUE REQUIEREN PAGO (PAST_DUE o SUSPENDED): se bloquea TODO el
    // acceso salvo la propia sección de suscripción (las rutas de pago y
    // /api/subscription ya se filtraron arriba). Sin plazos: el negocio queda
    // limitado a la sección de suscripción hasta que renueve. El frontend usa el
    // código 'SUBSCRIPTION_INACTIVE' para llevarlo a esa sección.
    if (subscription.status === 'SUSPENDED' || subscription.status === 'PAST_DUE') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'SUBSCRIPTION_INACTIVE',
        message: 'Renueva tu suscripción para reactivar tus beneficios en Siliba.',
      });
    }

    // Si el estado no requiere pago (p. ej. activo o trial vigente), dejamos pasar.
    return next.handle();
  }
}
