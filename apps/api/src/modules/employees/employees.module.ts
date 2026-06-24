// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador (etiqueta "@") de NestJS que sirve para declarar un
// "módulo": una caja que agrupa controladores, servicios y dependencias que
// trabajan juntos (en este caso, todo lo relacionado con "empleados").
import { Module } from '@nestjs/common';
// El controlador: la clase que recibe las peticiones HTTP de /api/employees.
import { EmployeesController } from './employees.controller';
// El servicio: la clase con toda la lógica de negocio (consultas a la BD, etc.).
import { EmployeesService } from './employees.service';
// Módulo de "disponibilidad": lo importamos porque el servicio de empleados lo
// usa para saber si un empleado está libre a cierta hora (al reasignar citas).
import { AvailabilityModule } from '../availability/availability.module';
// Módulo de Stripe (pagos/suscripciones): se usa para ajustar el número de
// empleados facturados en la suscripción del negocio.
import { StripeModule } from '../stripe/stripe.module';

// @Module({...}) configura este módulo declarando sus piezas:
@Module({
  // imports: otros módulos cuyos servicios necesitamos aquí dentro. Al
  // importarlos, NestJS puede inyectar AvailabilityService y StripeService en
  // EmployeesService.
  imports: [AvailabilityModule, StripeModule],
  // controllers: las clases que exponen los endpoints HTTP de este módulo.
  controllers: [EmployeesController],
  // providers: las clases "inyectables" (servicios) que viven en este módulo.
  providers: [EmployeesService],
  // exports: lo que este módulo deja disponible para OTROS módulos que lo
  // importen. Aquí exportamos EmployeesService para que otros módulos puedan
  // reutilizar su lógica.
  exports: [EmployeesService],
})
// La clase del módulo en sí queda vacía: toda la configuración va en el
// decorador @Module de arriba.
export class EmployeesModule {}
