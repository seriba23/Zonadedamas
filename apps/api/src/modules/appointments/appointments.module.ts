// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador (etiqueta "@") con el que NestJS arma una pieza de la
// aplicación. Cada módulo agrupa controladores + servicios relacionados y declara
// qué necesita de fuera (imports) y qué ofrece a otros (exports).
import { Module } from '@nestjs/common';
// El controlador: la clase que recibe las peticiones HTTP de "citas".
import { AppointmentsController } from './appointments.controller';
// El servicio: la clase con la lógica de negocio (crear, reagendar, cobrar...).
import { AppointmentsService } from './appointments.service';
// Otro módulo del que dependemos: AvailabilityModule expone AvailabilityService,
// que usamos para invalidar la caché de horarios libres cuando una cita cambia.
import { AvailabilityModule } from '../availability/availability.module';

// @Module describe cómo se ensambla este módulo de "citas".
@Module({
  // imports: módulos externos que necesitamos. Al importar AvailabilityModule,
  // NestJS nos deja inyectar el AvailabilityService que ese módulo "exporta".
  imports: [AvailabilityModule],
  // controllers: las clases que atienden rutas HTTP de este módulo.
  controllers: [AppointmentsController],
  // providers: las clases inyectables (servicios) que viven dentro de este módulo.
  providers: [AppointmentsService],
  // exports: lo que dejamos disponible para OTROS módulos que importen este.
  // Aquí exportamos AppointmentsService para que, por ejemplo, el POS o pagos
  // puedan reutilizar su lógica sin duplicarla.
  exports: [AppointmentsService],
})
// La clase queda vacía a propósito: toda la configuración va en el decorador.
export class AppointmentsModule {}
