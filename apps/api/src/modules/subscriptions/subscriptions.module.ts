// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Module: decorador que define un "módulo" (un bloque que agrupa
//     controladores, servicios y dependencias relacionadas).
//   - Global: decorador que hace el módulo GLOBAL, es decir, sus servicios
//     exportados quedan disponibles en TODA la app sin tener que importar este
//     módulo en cada lugar que los use.
import { Module, Global } from '@nestjs/common';

// Las piezas de este módulo:
//   - SubscriptionsService: lógica para leer suscripción y facturas.
//   - SubscriptionsController: endpoints HTTP de suscripción.
//   - PlanLimitsService: lógica de validación de límites del plan.
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlanLimitsService } from './plan-limits.service';

@Global() // <- Hace que los servicios exportados estén disponibles globalmente.
@Module({
  // controllers: las clases que exponen endpoints HTTP de este módulo.
  controllers: [SubscriptionsController],
  // providers: los servicios que este módulo crea y puede inyectar.
  providers: [SubscriptionsService, PlanLimitsService],
  // exports: los servicios que OTROS módulos pueden usar. Como el módulo es
  // @Global(), estos quedan disponibles en toda la app (p. ej. PlanLimitsService
  // se usa al crear empleados/citas/ubicaciones en otros módulos).
  exports: [SubscriptionsService, PlanLimitsService],
})
// La clase del módulo va vacía: toda su configuración vive en los decoradores.
export class SubscriptionsModule {}
