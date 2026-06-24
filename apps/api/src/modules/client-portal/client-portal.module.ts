// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO del portal del cliente.
// En NestJS, un "módulo" es una caja que agrupa y conecta todo lo que un área
// necesita: sus controladores (endpoints), sus servicios (lógica), sus
// estrategias de auth, y los OTROS módulos de los que depende. NestJS lee este
// archivo para saber qué crear e inyectar dónde.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Module: decorador que define un módulo.
//   - Logger: para escribir advertencias en consola.
import { Module, Logger } from '@nestjs/common';

// JwtModule: módulo oficial para firmar/verificar tokens JWT.
import { JwtModule } from '@nestjs/jwt';

// PassportModule: módulo de autenticación; aquí registramos la estrategia por
// defecto del portal ('client-jwt').
import { PassportModule } from '@nestjs/passport';

// El controlador (endpoints) y el servicio (lógica) de este portal.
import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';

// La estrategia JWT propia del cliente.
import { ClientJwtStrategy } from './strategies/client-jwt.strategy';

// Otros módulos de los que dependemos:
//   - TenantsModule: para resolver el negocio a partir de su "slug" (nombre en URL).
//   - AppointmentsModule: lógica de citas (crear, cancelar, reagendar) reutilizada.
//   - AvailabilityModule: cálculo de horarios disponibles.
import { TenantsModule } from '../tenants/tenants.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AvailabilityModule } from '../availability/availability.module';

// ─────────────────────────────────────────────────────────────────────────────
// Misma función que en la estrategia: obtiene la clave secreta del JWT.
// Aquí se usa para configurar la FIRMA de tokens del JwtModule. Debe coincidir
// con la clave que usa la estrategia para VERIFICARLOS.
// ─────────────────────────────────────────────────────────────────────────────
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // En producción, sin clave, no arrancamos (riesgo de seguridad).
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // En desarrollo, advertimos y usamos una clave por defecto insegura.
    Logger.warn(
      'JWT_SECRET not set — using insecure default. Set JWT_SECRET for production.',
      'ClientPortalModule',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

// El decorador @Module recibe un objeto de configuración que describe el módulo.
@Module({
  // "imports": otros módulos cuyos servicios queremos poder usar aquí.
  imports: [
    // Registramos Passport indicando que la estrategia por defecto es 'client-jwt'.
    PassportModule.register({ defaultStrategy: 'client-jwt' }),
    // registerAsync permite configurar el JwtModule con una "fábrica" (función
    // que devuelve la configuración). Lo usamos para leer la clave y la
    // expiración desde variables de entorno en tiempo de ejecución.
    JwtModule.registerAsync({
      useFactory: () => ({
        // Clave secreta para firmar los access tokens.
        secret: getJwtSecret(),
        signOptions: {
          // Expiración del access token. "||" => si la variable de entorno no
          // está definida, usamos '15m' (15 minutos) por defecto.
          expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
        },
      }),
    }),
    // Módulos de negocio que reutilizamos.
    TenantsModule,
    AppointmentsModule,
    AvailabilityModule,
  ],
  // "controllers": las clases que exponen los endpoints HTTP de este módulo.
  controllers: [ClientPortalController],
  // "providers": las clases inyectables (lógica + estrategia) que NestJS debe crear.
  providers: [ClientPortalService, ClientJwtStrategy],
  // "exports": lo que dejamos disponible para OTROS módulos que importen este.
  // Aquí exponemos el servicio por si otro módulo necesita su lógica.
  exports: [ClientPortalService],
})
export class ClientPortalModule {}
