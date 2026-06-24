// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las "piezas" que este módulo necesita para funcionar.
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador (etiqueta "@") de NestJS que convierte una clase
// normal en un "módulo": una caja que agrupa controladores, servicios y otras
// dependencias relacionadas. NestJS arranca leyendo módulos como este.
import { Module } from '@nestjs/common';

// El controlador: la clase que recibe las peticiones HTTP públicas (GET/POST)
// y las reparte hacia el servicio. Lo registramos más abajo en "controllers".
import { PublicBookingController } from './public-booking.controller';

// El servicio: la clase con la lógica real (buscar negocio por slug, listar
// servicios/empleados, calcular disponibilidad, reservar). Lo registramos en
// "providers" para que NestJS sepa crearlo e inyectarlo donde haga falta.
import { PublicBookingService } from './public-booking.service';

// TenantsModule expone TenantsService (resolver el negocio a partir de su slug).
// Lo importamos para poder reutilizar esa lógica sin duplicarla aquí.
import { TenantsModule } from '../tenants/tenants.module';

// AvailabilityModule expone AvailabilityService (calcular huecos/slots libres).
// Reservar y mostrar disponibilidad depende de él.
import { AvailabilityModule } from '../availability/availability.module';

// AppointmentsModule expone AppointmentsService (crear la cita real con su
// transacción anti-doble-reserva). El flujo público delega en él la reserva.
import { AppointmentsModule } from '../appointments/appointments.module';

// @Module() declara cómo se compone este módulo. Recibe un objeto de configuración:
//   - imports: otros módulos cuyos servicios EXPORTADOS queremos poder inyectar
//     aquí (Tenants, Availability, Appointments).
//   - controllers: las clases que atienden rutas HTTP de este módulo.
//   - providers: las clases "inyectables" (servicios) que vivirán dentro de
//     este módulo y podrán ser inyectadas en sus controladores/servicios.
@Module({
  imports: [TenantsModule, AvailabilityModule, AppointmentsModule],
  controllers: [PublicBookingController],
  providers: [PublicBookingService],
})
// La clase queda vacía a propósito: toda la "configuración" vive en el
// decorador @Module() de arriba. Solo sirve como contenedor con nombre.
export class PublicBookingModule {}
