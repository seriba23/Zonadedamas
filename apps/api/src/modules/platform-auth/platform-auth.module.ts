// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Module: decorador que declara un "módulo" (un paquete de funcionalidad que
//     agrupa controladores, servicios y dependencias).
//   - Logger: utilidad para imprimir mensajes en la consola del servidor.
import { Module, Logger } from '@nestjs/common';

// JwtModule: módulo de NestJS que sabe firmar y verificar tokens JWT. Lo
// configuramos abajo con el secreto y el tiempo de expiración.
import { JwtModule } from '@nestjs/jwt';

// PassportModule: integra la librería Passport (autenticación) con NestJS.
import { PassportModule } from '@nestjs/passport';

// Importamos las piezas propias de este módulo: el controlador (endpoints), el
// servicio (lógica) y la estrategia JWT (validación de tokens).
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';

// getJwtSecret(): devuelve la clave secreta para FIRMAR los tokens. Debe coincidir
// con la usada para verificarlos en la estrategia. (Misma lógica que la estrategia.)
function getJwtSecret(): string {
  // Leemos la variable de entorno con el secreto.
  const secret = process.env.JWT_SECRET;
  // Si no está definida ("!secret" = "si NO hay secreto")...
  if (!secret) {
    // ...en producción es un error fatal: no arrancamos sin secreto seguro.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // En desarrollo solo avisamos (el segundo argumento es el "contexto" del log).
    Logger.warn(
      'JWT_SECRET not set — using insecure default.',
      'PlatformAuthModule',
    );
    // Y devolvemos un secreto por defecto marcado como "no usar en producción".
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  // Si existía, devolvemos su valor.
  return secret;
}

// @Module({...}) describe cómo se ensambla este módulo.
@Module({
  imports: [
    // PassportModule habilita el uso de estrategias de autenticación.
    PassportModule,
    // JwtModule.registerAsync permite configurar el JWT con una "fábrica" (función
    // que se ejecuta al arrancar y devuelve la configuración).
    JwtModule.registerAsync({
      // useFactory: función que devuelve el objeto de configuración del JWT.
      useFactory: () => ({
        // Secreto con el que se firmarán los tokens.
        secret: getJwtSecret(),
        // Opciones de firma por defecto:
        signOptions: {
          // expiresIn = cuánto dura el token. Usamos la variable de entorno si
          // existe; si no, "|| '15m'" pone 15 minutos por defecto.
          expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        },
      }),
    }),
  ],
  // controllers: las clases que reciben las peticiones HTTP de este módulo.
  controllers: [PlatformAuthController],
  // providers: las clases inyectables (lógica y estrategia) que viven en el módulo.
  providers: [PlatformAuthService, PlatformJwtStrategy],
  // exports: lo que ofrecemos a OTROS módulos que importen este. Aquí exportamos
  // el servicio para que, por ejemplo, platform-admin pueda reutilizarlo.
  exports: [PlatformAuthService],
})
// La clase queda vacía: el decorador @Module ya contiene toda la configuración.
export class PlatformAuthModule {}
