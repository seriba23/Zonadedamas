// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador (etiqueta "@") de NestJS que sirve para declarar un
// "módulo": una cajita que agrupa controladores y servicios relacionados. Aquí
// agrupamos todo lo relacionado con pagos.
import { Module } from '@nestjs/common';
// El controlador de pagos: la clase que recibe las peticiones HTTP (GET/POST).
import { PaymentsController } from './payments.controller';
// El servicio de pagos: la clase con la lógica de verdad (calcular totales,
// guardar en la base de datos, etc.).
import { PaymentsService } from './payments.service';

// @Module({...}) describe a NestJS de qué se compone este módulo:
@Module({
  // controllers => las clases que atienden rutas HTTP de este módulo.
  controllers: [PaymentsController],
  // providers => las clases "inyectables" (servicios) que viven dentro de este
  // módulo y que NestJS puede crear e inyectar donde se necesiten.
  providers: [PaymentsService],
  // exports => qué de lo anterior queda DISPONIBLE para otros módulos que
  // importen PaymentsModule. Exportamos el servicio para que otros módulos
  // (por ejemplo, el de citas) puedan reutilizar su lógica de pagos.
  exports: [PaymentsService],
})
// La clase del módulo en sí queda vacía: toda su "configuración" está en el
// decorador @Module de arriba. NestJS solo necesita la clase como contenedor.
export class PaymentsModule {}
