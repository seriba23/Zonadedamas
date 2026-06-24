// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las piezas que este "módulo" necesita para armarse.
// ─────────────────────────────────────────────────────────────────────────────

// Module = decorador de NestJS que convierte una clase en un "módulo".
// Un módulo es como una caja que agrupa controladores y servicios relacionados,
// para que NestJS sepa cómo crearlos y conectarlos entre sí.
import { Module } from '@nestjs/common';

// Importamos el controlador (recibe las peticiones HTTP) y el servicio (tiene la
// lógica real). El módulo los registra para que funcionen juntos.
import { ConfirmPaymentController } from './confirm-payment.controller';
import { ConfirmPaymentService } from './confirm-payment.service';

// @Module({...}) define la configuración de este módulo:
//   - controllers: lista de controladores que expondrán endpoints HTTP.
//     Aquí solo está ConfirmPaymentController.
//   - providers: lista de clases "inyectables" (servicios). NestJS las crea
//     una sola vez y las inyecta donde se pidan. Aquí solo ConfirmPaymentService.
// (Nota: este módulo NO importa PrismaModule ni EventEmitter aquí porque suelen
//  estar registrados de forma global en el AppModule, disponibles para todos.)
@Module({
  controllers: [ConfirmPaymentController],
  providers: [ConfirmPaymentService],
})
// La clase queda vacía: solo sirve como "etiqueta" que agrupa lo de arriba.
export class ConfirmPaymentModule {}
