// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los decoradores para construir endpoints HTTP:
//   - Body: lee el cuerpo (JSON) que envía el cliente en un POST.
//   - Controller: marca la clase como controlador (grupo de endpoints).
//   - Get / Post: marcan un método como endpoint GET o POST.
//   - UseGuards: aplica un "guardián" a una ruta (aquí, exigir token válido).
//   - Req: da acceso al objeto de la petición HTTP completa (request).
import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';

// Throttle: limitador de peticiones (anti-fuerza-bruta/spam). Se configura abajo.
import { Throttle } from '@nestjs/throttler';

// El servicio con la lógica real (consultar BD, comparar contraseñas, firmar JWT).
import { PlatformAuthService } from './platform-auth.service';

// El guard que protege rutas exigiendo un JWT válido de super-admin.
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';

// De class-validator: decoradores que validan AUTOMÁTICAMENTE los campos del DTO.
//   - IsString: el valor debe ser texto.
//   - IsEmail: el valor debe tener formato de correo electrónico.
import { IsString, IsEmail } from 'class-validator';

// DTO ("Data Transfer Object") = la forma esperada del cuerpo de la petición.
// PlatformLoginDto describe el cuerpo del login: email + contraseña.
class PlatformLoginDto {
  @IsEmail()        // valida que "email" sea un correo válido.
  email: string;

  @IsString()       // valida que "password" sea texto.
  password: string;
}

// DTO del endpoint refresh: solo necesita el refreshToken (texto).
class PlatformRefreshDto {
  @IsString()
  refreshToken: string;
}

// DTO del endpoint logout: igualmente solo el refreshToken a revocar.
class PlatformLogoutDto {
  @IsString()
  refreshToken: string;
}

// @Controller('platform/auth') => todas las rutas de esta clase empiezan con
// "/api/platform/auth" (el prefijo "/api" se añade globalmente en otra parte).
@Controller('platform/auth')
export class PlatformAuthController {
  // Inyección de dependencias: NestJS crea el servicio y lo guarda en this.authService
  // (solo lectura). El controlador solo recibe la petición y delega en el servicio.
  constructor(private readonly authService: PlatformAuthService) {}

  // ── POST /api/platform/auth/login ─────────────────────────────────────────
  // Límite: máximo 5 intentos por minuto (ttl=60000 ms) desde la misma IP, para
  // frenar ataques de fuerza bruta contra la contraseña. Si se supera => 429.
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  // @Body() dto: NestJS valida el cuerpo contra PlatformLoginDto y lo entrega aquí.
  async login(@Body() dto: PlatformLoginDto) {
    // Pasamos correo y contraseña al servicio, que devuelve los tokens y el usuario.
    const result = await this.authService.login(dto.email, dto.password);
    // Respondemos con el formato estándar del proyecto: { data: ... }.
    return { data: result };
  }

  // ── POST /api/platform/auth/refresh ───────────────────────────────────────
  // Canjea un refreshToken válido por un nuevo par de tokens (renovar sesión).
  @Post('refresh')
  async refresh(@Body() dto: PlatformRefreshDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return { data: result };
  }

  // ── POST /api/platform/auth/logout ────────────────────────────────────────
  // @UseGuards(PlatformJwtAuthGuard): exige un access token válido para llamar aquí.
  @UseGuards(PlatformJwtAuthGuard)
  @Post('logout')
  async logout(@Body() dto: PlatformLogoutDto) {
    // Revocamos el refreshToken para que ya no pueda volver a usarse.
    await this.authService.logout(dto.refreshToken);
    // No devolvemos datos sensibles, solo un mensaje de confirmación.
    return { data: { message: 'Sesión cerrada exitosamente' } };
  }

  // ── GET /api/platform/auth/me ─────────────────────────────────────────────
  // Devuelve los datos del super-admin autenticado (el dueño del token).
  @UseGuards(PlatformJwtAuthGuard)
  @Get('me')
  // @Req() req: accedemos a la petición. Gracias al guard, req.user fue rellenado
  // por la estrategia JWT (con userId, email, role).
  async getMe(@Req() req: any) {
    // Pasamos el id del usuario (req.user.userId) al servicio para traer su ficha.
    const result = await this.authService.getMe(req.user.userId);
    return { data: result };
  }
}
