// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: en NestJS, un "módulo" es una caja que agrupa piezas relacionadas
// (controladores, servicios, dependencias) y declara cómo se conectan. Este
// módulo arma todo el sistema de códigos de creador/influencer.
// ─────────────────────────────────────────────────────────────────────────────

// Decorador @Module que NestJS usa para declarar un módulo.
import { Module } from '@nestjs/common';
// El controlador: recibe las peticiones HTTP del super-admin.
import { CreatorCodesController } from './creator-codes.controller';
// Servicio principal: alta/edición/aprobación de influencers y sus códigos.
import { CreatorCodesService } from './creator-codes.service';
// Servicio de pagos: calcula y transfiere las comisiones mensuales.
import { CreatorPayoutsService } from './creator-payouts.service';
// Módulo de autenticación de la plataforma (super-admin). Lo importamos para
// poder usar su guard (PlatformJwtAuthGuard) que protege estos endpoints.
import { PlatformAuthModule } from '../platform-auth/platform-auth.module';
// Módulo de Stripe: provee StripeService para crear cuentas Connect y Transfers.
import { StripeModule } from '../stripe/stripe.module';

// @Module recibe un objeto de configuración que describe el módulo:
@Module({
  // imports: otros módulos cuyos servicios/guards necesitamos aquí dentro.
  imports: [PlatformAuthModule, StripeModule],
  // controllers: las clases que exponen los endpoints HTTP de este módulo.
  controllers: [CreatorCodesController],
  // providers: los servicios que NestJS creará y podrá inyectar en este módulo.
  providers: [CreatorCodesService, CreatorPayoutsService],
  // exports: servicios que dejamos "públicos" para que OTROS módulos que
  // importen este módulo también puedan inyectarlos.
  exports: [CreatorCodesService, CreatorPayoutsService],
})
// La clase del módulo va vacía: toda la configuración vive en el decorador.
export class CreatorCodesModule {}
