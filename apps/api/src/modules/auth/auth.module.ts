// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Module: decorador que define un "módulo" (una agrupación de piezas que
//     trabajan juntas: controladores, servicios, imports...).
//   - Logger: utilidad para imprimir mensajes en consola.
//   - forwardRef: sirve para resolver "dependencias circulares". Si el módulo A
//     necesita a B y B necesita a A, NestJS no sabría a cuál crear primero;
//     forwardRef rompe ese empate retrasando la referencia.
import { Module, Logger, forwardRef } from '@nestjs/common';

// JwtModule: módulo de NestJS que sabe firmar y verificar tokens JWT.
import { JwtModule } from '@nestjs/jwt';
// PassportModule: integra la librería Passport (autenticación) con NestJS.
import { PassportModule } from '@nestjs/passport';

// Piezas propias de este módulo de autenticación:
import { AuthController } from './auth.controller'; // recibe las peticiones HTTP.
import { AuthService } from './auth.service';       // lógica de login/registro/etc.
import { JwtStrategy } from './strategies/jwt.strategy'; // valida los JWT entrantes.

// Otros módulos de los que dependemos:
import { RbacModule } from '../rbac/rbac.module';                 // permisos/roles.
import { NotificationsModule } from '../notifications/notifications.module'; // emails.
import { UploadsModule } from '../uploads/uploads.module';        // subida de imágenes.

// Devuelve la clave secreta para firmar los JWT. (Misma idea que en jwt.strategy:
// se duplica para que el módulo pueda configurar JwtModule al arrancar.)
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // En producción, sin secreto = error fatal (no arrancar inseguro).
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // En desarrollo, avisar y usar un secreto por defecto.
    Logger.warn(
      'JWT_SECRET not set — using insecure default. Set JWT_SECRET for production.',
      'AuthModule',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

// @Module describe el módulo: qué importa, qué controladores tiene, qué provee
// (servicios) y qué exporta para que otros módulos lo usen.
@Module({
  imports: [
    // Registra Passport indicando que la estrategia por defecto es 'jwt'.
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Configura JwtModule de forma asíncrona (registerAsync) usando una "factory"
    // (función que produce la configuración). Aquí decimos: con qué secreto firmar
    // y cuánto dura el token de acceso (JWT_EXPIRES_IN o "15m" por defecto).
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          // "||": si JWT_EXPIRES_IN no está definida, usar '15m' (15 minutos).
          expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        },
      }),
    }),
    // RbacModule envuelto en forwardRef por dependencia circular (Auth <-> Rbac).
    forwardRef(() => RbacModule),
    NotificationsModule, // para enviar correos (recuperación de contraseña).
    UploadsModule,       // para descargar/guardar avatares de login social.
  ],
  // Controladores: clases que exponen los endpoints HTTP de /api/auth.
  controllers: [AuthController],
  // Providers: servicios que NestJS crea e inyecta. Incluimos la estrategia JWT
  // para que quede registrada en Passport.
  providers: [AuthService, JwtStrategy],
  // Exports: lo que dejamos disponible para OTROS módulos que importen AuthModule
  // (el servicio de auth y el módulo JWT para firmar/verificar tokens).
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
