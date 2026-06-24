// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Module: decorador que declara un "módulo" (una agrupación de funcionalidad
//     con sus controladores, servicios y dependencias).
//   - Logger: para escribir avisos en el registro del servidor.
//   - forwardRef: truco para resolver "dependencias circulares" (dos módulos que
//     se necesitan mutuamente). Lo usamos abajo con AppointmentsModule.
import { Module, Logger, forwardRef } from '@nestjs/common';

// JwtModule: módulo que permite FIRMAR y verificar tokens JWT (para emitir el
// token al hacer login en el marketplace).
import { JwtModule } from '@nestjs/jwt';

// PassportModule: integra Passport (sistema de estrategias de autenticación).
import { PassportModule } from '@nestjs/passport';

// Nuestro controlador (los endpoints) y nuestro servicio (la lógica).
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

// La estrategia que valida los JWT del marketplace.
import { MarketplaceJwtStrategy } from './strategies/marketplace-jwt.strategy';

// Otros módulos de la app de los que dependemos:
//   - TenantsModule: lógica de negocios/tenants.
//   - AppointmentsModule: crear/gestionar citas (lo importamos con forwardRef).
//   - StripeModule: pagos.
//   - UploadsModule: subida de archivos (fotos).
import { TenantsModule } from '../tenants/tenants.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { StripeModule } from '../stripe/stripe.module';
import { UploadsModule } from '../uploads/uploads.module';

/**
 * Devuelve la clave secreta de los JWT (igual que en la estrategia). En
 * producción es obligatoria; en desarrollo avisa y usa una por defecto.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    Logger.warn(
      'JWT_SECRET not set — using insecure default. Set JWT_SECRET for production.',
      'MarketplaceModule',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

// @Module agrupa todo lo que forma este módulo de marketplace.
@Module({
  // imports = otros módulos cuyas funcionalidades necesitamos aquí.
  imports: [
    // Registra Passport indicando que la estrategia por defecto es la nuestra.
    PassportModule.register({ defaultStrategy: 'marketplace-jwt' }),
    // Configuramos el JwtModule de forma asíncrona (useFactory = función que
    // construye la configuración).
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(), // clave para firmar los tokens.
        signOptions: {
          // Tiempo de vida del access token. Si no hay variable de entorno,
          // el "||" usa '15m' (15 minutos) por defecto.
          expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
        },
      }),
    }),
    TenantsModule,
    // forwardRef evita el error de dependencia circular entre este módulo y
    // AppointmentsModule (ambos se referencian mutuamente).
    forwardRef(() => AppointmentsModule),
    StripeModule,
    UploadsModule,
  ],
  // controllers = clases que reciben las peticiones HTTP de este módulo.
  controllers: [MarketplaceController],
  // providers = clases inyectables (lógica) que viven dentro del módulo.
  providers: [MarketplaceService, MarketplaceJwtStrategy],
  // exports = lo que este módulo comparte con otros módulos que lo importen.
  exports: [MarketplaceService, MarketplaceJwtStrategy, PassportModule, JwtModule],
})
export class MarketplaceModule {}
