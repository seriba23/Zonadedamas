// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Module: decorador que agrupa controladores, servicios y dependencias en
//     una "unidad" (módulo). Es la pieza con la que NestJS arma la aplicación.
//   - Logger: para escribir avisos en la consola del servidor.
import { Module, Logger } from '@nestjs/common';

// JwtModule: módulo oficial para FIRMAR y verificar tokens JWT. Lo configuramos
// con el secreto y el tiempo de expiración.
import { JwtModule } from '@nestjs/jwt';

// PassportModule: integra Passport (la librería de autenticación) con NestJS.
import { PassportModule } from '@nestjs/passport';

// Las piezas propias de este portal: el controlador (endpoints), el servicio
// (lógica) y la estrategia JWT (validación de tokens de creador).
import { CreatorPortalController } from './creator-portal.controller';
import { CreatorPortalService } from './creator-portal.service';
import { CreatorJwtStrategy } from './strategies/creator-jwt.strategy';

// CreatorCodesModule: otro módulo cuyo servicio reutilizamos (datos del
// dashboard del creador y la integración con Stripe Connect para cobros).
import { CreatorCodesModule } from '../creator-codes/creator-codes.module';

/**
 * Devuelve el secreto para firmar los JWT (misma lógica que en la estrategia).
 * En producción es obligatorio tenerlo; en desarrollo avisa y usa uno de prueba.
 */
function getJwtSecret(): string {
  // Leemos la variable de entorno con el secreto.
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Sin secreto en producción => error fatal (no se puede arrancar así).
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // En desarrollo avisamos y devolvemos un secreto temporal inseguro.
    Logger.warn('JWT_SECRET not set — using insecure default.', 'CreatorPortalModule');
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

// @Module(...) declara el módulo del portal de creadores y todo lo que necesita.
@Module({
  // imports: otros módulos cuyas funcionalidades necesitamos aquí.
  imports: [
    // Registramos Passport indicando que la estrategia por defecto de este
    // portal es 'creator-jwt' (la que validará los tokens de creador).
    PassportModule.register({ defaultStrategy: 'creator-jwt' }),
    // Configuramos el JwtModule de forma "asíncrona" (con una fábrica), para
    // poder calcular el secreto y la expiración en tiempo de arranque.
    JwtModule.registerAsync({
      // useFactory: función que devuelve la configuración del JWT.
      useFactory: () => ({
        // Secreto con el que se firmarán/verificarán los tokens.
        secret: getJwtSecret(),
        // expiresIn: cuánto dura el token antes de expirar. Usamos la variable
        // de entorno JWT_CREATOR_ACCESS_EXPIRY y, si no existe, el "|| '7d'"
        // aplica un valor por defecto de 7 días.
        signOptions: { expiresIn: process.env.JWT_CREATOR_ACCESS_EXPIRY || '7d' },
      }),
    }),
    // Importamos el módulo de "creator-codes" para reutilizar su servicio.
    CreatorCodesModule,
  ],
  // controllers: las clases que exponen los endpoints HTTP de este módulo.
  controllers: [CreatorPortalController],
  // providers: los servicios/estrategias que NestJS debe instanciar e inyectar.
  providers: [CreatorPortalService, CreatorJwtStrategy],
})
export class CreatorPortalModule {}
