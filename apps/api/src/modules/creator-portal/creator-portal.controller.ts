// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS, los decoradores para construir endpoints HTTP:
//   - Controller: marca la clase como controlador (grupo de endpoints).
//   - Post / Get: marcan un método como endpoint que responde a POST o GET.
//   - Body: lee el cuerpo (JSON) que envía el cliente en la petición.
//   - Req: da acceso al objeto "request" completo (de ahí sacamos req.user).
//   - UseGuards: aplica un "guard" (portero) que protege el endpoint.
import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';

// Throttle = limitador de peticiones (anti-abuso). Restringe cuántas veces se
// puede llamar a un endpoint en una ventana de tiempo.
import { Throttle } from '@nestjs/throttler';

// El servicio con la lógica real (consultas a BD, hashing, firma de tokens...).
// El controlador solo recibe la petición y se la delega al servicio.
import { CreatorPortalService } from './creator-portal.service';

// El guard que exige un token JWT de creador válido en los endpoints protegidos.
import { CreatorJwtGuard } from './guards/creator-jwt.guard';

// El guard del JWT PRINCIPAL de Siliba (clientes/profesionales/admin). Lo usamos
// en el endpoint SSO: valida la sesión normal del usuario para emitir, a partir
// de ella, un token de creador (sin pedir login otra vez).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Los DTOs que validan la forma de los datos que llegan en cada petición.
import {
  CreatorLoginDto,
  CreatorRegisterDto,
  CreatorSetPasswordDto,
  CreatorChangePasswordDto,
} from './dto/creator-auth.dto';

// @Controller('creator') => todas las rutas de esta clase empiezan con
// "/api/creator" (el prefijo "/api" se añade globalmente en otra parte).
@Controller('creator')
export class CreatorPortalController {
  // Inyección de dependencias: NestJS crea el servicio y lo guarda en
  // this.service (solo lectura) para usarlo en todos los métodos.
  constructor(private readonly service: CreatorPortalService) {}

  // ─── Público ──────────────────────────────────────
  // (Estos endpoints NO llevan guard: cualquiera puede llamarlos, porque son
  //  los que permiten entrar/registrarse cuando aún no hay token.)

  // POST /api/creator/auth/login — iniciar sesión.
  // Límite: 10 intentos por minuto (ttl=60000 ms) por IP, para frenar ataques
  // de fuerza bruta sobre la contraseña.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('auth/login')
  async login(@Body() dto: CreatorLoginDto) {
    // @Body() valida el cuerpo contra CreatorLoginDto y nos lo entrega en "dto".
    // "await" espera el resultado del servicio (consulta lenta a BD).
    const data = await this.service.login(dto);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data };
  }

  // POST /api/creator/auth/register — auto-registro de un creador nuevo.
  // Límite más estricto (5/min): crear cuentas es más sensible que loguearse.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('auth/register')
  async register(@Body() dto: CreatorRegisterDto) {
    const data = await this.service.register(dto);
    return { data };
  }

  // POST /api/creator/auth/set-password — fijar contraseña desde el enlace de
  // invitación (el body trae el token de invitación + la nueva contraseña).
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('auth/set-password')
  async setPassword(@Body() dto: CreatorSetPasswordDto) {
    const data = await this.service.setPasswordFromToken(dto);
    return { data };
  }

  // POST /api/creator/auth/from-session — SSO desde la sesión de Siliba.
  // Va protegido por el JWT PRINCIPAL (no el de creador): el usuario ya inició
  // sesión en su consola normal. Tomamos su correo verificado (req.user.email)
  // y, si es un creador aprobado, devolvemos un token de creador para entrar al
  // portal sin volver a autenticarse.
  @UseGuards(JwtAuthGuard)
  @Post('auth/from-session')
  async fromSession(@Req() req: any) {
    const data = await this.service.tokenFromSession(req.user.email);
    return { data };
  }

  // POST /api/creator/auth/apply-from-session — "solicitar unirme" al programa
  // usando la sesión de Siliba ya activa (sin crear un login aparte). Crea la
  // solicitud PENDING con el correo/nombre de la cuenta. Protegido por el JWT
  // principal (el usuario debe estar logueado en Siliba).
  @UseGuards(JwtAuthGuard)
  @Post('auth/apply-from-session')
  async applyFromSession(@Req() req: any) {
    const data = await this.service.applyFromSession(req.user.email);
    return { data };
  }

  // ─── Protegido (creator-jwt) ──────────────────────
  // (A partir de aquí, todos los endpoints llevan @UseGuards(CreatorJwtGuard):
  //  exigen un token de creador válido. El guard pone los datos del creador en
  //  req.user, de donde leemos req.user.influencerId.)

  // GET /api/creator/me — datos del creador autenticado (su propio perfil).
  @UseGuards(CreatorJwtGuard)
  @Get('me')
  async me(@Req() req: any) {
    // req.user.influencerId proviene del validate() de la estrategia JWT.
    return this.service.me(req.user.influencerId);
  }

  // POST /api/creator/change-password — cambiar la contraseña estando logueado.
  @UseGuards(CreatorJwtGuard)
  @Post('change-password')
  async changePassword(@Req() req: any, @Body() dto: CreatorChangePasswordDto) {
    // Pasamos el id del creador (de quién es la cuenta) + los datos del cambio.
    return this.service.changePassword(req.user.influencerId, dto);
  }

  // GET /api/creator/dashboard — métricas/resumen del panel del creador.
  @UseGuards(CreatorJwtGuard)
  @Get('dashboard')
  async dashboard(@Req() req: any) {
    return this.service.dashboard(req.user.influencerId);
  }

  // GET /api/creator/stripe/status — estado de su conexión con Stripe (cobros).
  @UseGuards(CreatorJwtGuard)
  @Get('stripe/status')
  async stripeStatus(@Req() req: any) {
    return this.service.stripeStatus(req.user.influencerId);
  }

  // POST /api/creator/stripe/onboarding-link — genera el enlace para que el
  // creador complete su alta en Stripe Connect y pueda recibir pagos.
  @UseGuards(CreatorJwtGuard)
  @Post('stripe/onboarding-link')
  async stripeOnboarding(@Req() req: any) {
    return this.service.stripeOnboardingLink(req.user.influencerId);
  }
}
