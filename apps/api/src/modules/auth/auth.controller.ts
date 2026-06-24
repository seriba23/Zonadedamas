// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS, los decoradores (etiquetas "@") y errores para construir endpoints:
//   - BadRequestException: error HTTP 400 (petición inválida).
//   - Body: lee el cuerpo (JSON) que envía el cliente.
//   - ConflictException: error HTTP 409 (conflicto, p.ej. recurso ya existe).
//   - Controller: marca la clase como controlador (grupo de endpoints).
//   - Get / Post / Put: marcan un método como endpoint de ese verbo HTTP.
//   - Param: lee un trozo variable de la URL (ej. el :code).
//   - UseGuards: aplica "guardias" (guards) que protegen el endpoint (ej. exigir login).
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

// El servicio con toda la lógica de autenticación (login, registro, etc.).
import { AuthService } from './auth.service';
// PrismaService: acceso directo a la base de datos (usado en register-as-professional).
import { PrismaService } from '../../prisma/prisma.service';

// DTOs (objetos de transferencia de datos): describen y validan cada cuerpo recibido.
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import {
  ForgotPasswordDto,
  VerifyResetCodeDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';

// @Public(): decorador propio que marca un endpoint como ABIERTO (sin login).
// Sirve para que el guard global de JWT ignore esa ruta.
import { Public } from '../../common/decorators/public.decorator';
// JwtAuthGuard: guard que EXIGE un JWT válido para entrar al endpoint.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// @CurrentUser(): decorador que inyecta el usuario autenticado (lo que devolvió
// JwtStrategy.validate). JwtPayload es el tipo de esos datos (userId, tenantId...).
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
// Validadores para los DTOs definidos AQUÍ mismo (abajo).
import { IsString, IsOptional, MinLength } from 'class-validator';

// DTO local para el cuerpo de POST /api/auth/logout: solo el refreshToken a revocar.
class LogoutDto {
  @IsString()
  refreshToken: string;
}

// DTO local para PUT /api/auth/change-password: contraseña actual + nueva (mín 8).
class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

// @Controller('auth') => todas las rutas empiezan con "/api/auth" (el prefijo
// "/api" se agrega globalmente en otra parte).
@Controller('auth')
export class AuthController {
  // INYECCIÓN DE DEPENDENCIAS: NestJS crea e inyecta estos servicios. Quedan como
  // propiedades de solo lectura (this.authService, this.prisma).
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // ── POST /api/auth/login ── Endpoint público de inicio de sesión.
  @Public() // <- sin necesidad de estar logueado para llamarlo.
  @Post('login')
  async login(@Body() dto: LoginDto) {
    // @Body() valida y entrega el cuerpo como LoginDto. Llamamos al servicio con
    // email y contraseña, y "await" espera el resultado (consulta a la BD).
    const result = await this.authService.login(dto.email, dto.password);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: result };
  }

  // ── POST /api/auth/register ── Alta de cuenta (afiliado/particular/freelancer).
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return { data: result };
  }

  // ── POST /api/auth/social ── Inicio de sesión / alta con Google o Facebook.
  @Public()
  @Post('social')
  async socialLogin(@Body() dto: SocialLoginDto) {
    const result = await this.authService.socialLogin(dto);
    return { data: result };
  }

  // ── GET /api/auth/invite-preview/:code ── Vista previa de una invitación.
  // Muestra al profesional a qué negocio se uniría antes de registrarse.
  @Public()
  @Get('invite-preview/:code')
  async getInvitePreview(@Param('code') code: string) {
    // @Param('code') toma el valor de la posición :code de la URL.
    return this.authService.getInvitePreview(code);
  }

  // ── POST /api/auth/refresh ── Canjea un refresh token por un access token nuevo.
  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return { data: result };
  }

  // ── POST /api/auth/forgot-password ── Paso 1 del olvido: enviar código por email.
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Respuesta DELIBERADAMENTE genérica: no revelamos si el correo existe o no
    // (evita que un atacante descubra qué correos están registrados).
    return {
      data: {
        message:
          'Si existe una cuenta con ese correo, recibiras un codigo para restablecer tu contrasena.',
      },
    };
  }

  // ── POST /api/auth/verify-reset-code ── Paso 2: verificar el código de 6 dígitos.
  @Public()
  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    // Devuelve un resetToken temporal que habilita el paso 3.
    const result = await this.authService.verifyResetCode(dto.email, dto.code);
    return { data: result };
  }

  // ── POST /api/auth/reset-password ── Paso 3: fijar la nueva contraseña.
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.resetToken, dto.newPassword);
    return { data: { message: 'Contrasena actualizada' } };
  }

  // ── POST /api/auth/logout ── Cierra sesión revocando el refresh token.
  // @UseGuards(JwtAuthGuard): exige estar autenticado (token de acceso válido).
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    // @CurrentUser() inyecta el usuario autenticado (aquí no se usa, pero el guard
    // garantiza que la petición viene de alguien logueado).
    @CurrentUser() user: JwtPayload,
    @Body() dto: LogoutDto,
  ) {
    await this.authService.logout(dto.refreshToken);
    return { data: { message: 'Sesión cerrada exitosamente' } };
  }

  // ── GET /api/auth/me ── Devuelve el perfil del usuario logueado (datos, permisos...).
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    // Tomamos userId y tenantId del token (vía @CurrentUser) para buscar el perfil.
    const result = await this.authService.getMe(user.userId, user.tenantId);
    return { data: result };
  }

  // ── PUT /api/auth/change-password ── Cambiar contraseña estando logueado.
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
    return { data: { message: 'Contraseña actualizada' } };
  }

  // ── POST /api/auth/register-as-professional ── Convierte al usuario logueado en
  // empleado/profesional de su propio negocio (crea su ficha de Employee). Esta
  // lógica vive aquí en el controlador (no en el servicio) por simplicidad.
  @UseGuards(JwtAuthGuard)
  @Post('register-as-professional')
  async registerAsProfessional(@CurrentUser() userPayload: JwtPayload) {
    // Desestructuración: sacamos userId y tenantId del objeto del usuario logueado.
    const { userId, tenantId } = userPayload;

    // ¿Ya existe un empleado para este usuario en este tenant? Si sí, no duplicamos.
    const existing = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (existing) {
      // 409 Conflict: el recurso ya existe.
      throw new ConflictException('Ya tienes un perfil de profesional');
    }

    // Necesitamos una sucursal/ubicación activa donde anclar al empleado.
    const location = await this.prisma.location.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!location) {
      throw new BadRequestException('No hay ubicaciones activas');
    }

    // Releemos el usuario para copiar sus datos (nombre, correo, teléfono).
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Creamos la ficha de empleado con los datos del usuario y el color de marca.
    const employee = await this.prisma.employee.create({
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        locationId: location.id,
        tenantId,
        userId,
        color: '#008080', // teal por defecto.
      },
    });

    // Creamos automáticamente su horario por defecto: Lun-Sáb 09:00-18:00.
    // "as const" fija el tipo exacto de cada texto (evita choques con el enum).
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
    await this.prisma.employeeSchedule.createMany({
      // .map(...) recorre cada día de la semana y construye su fila de horario.
      data: days.map((day) => ({
        employeeId: employee.id,
        dayOfWeek: day,
        // isWorking: trabaja todos los días EXCEPTO domingo. "day !== 'SUNDAY'" es
        // true para lunes-sábado y false para domingo ("!==" = distinto de).
        isWorking: day !== 'SUNDAY',
        startTime: '09:00',
        endTime: '18:00',
        effectiveFrom: new Date('2020-01-01'),
      })),
    });

    return { data: employee };
  }
}
