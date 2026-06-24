// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador de NestJS que sirve para declarar un "módulo": una
// caja que agrupa controladores y servicios relacionados (aquí, todo lo que
// tiene que ver con calcular disponibilidad de horarios).
import { Module } from '@nestjs/common';
// El controlador: la clase que define los endpoints HTTP (recibe las peticiones).
import { AvailabilityController } from './availability.controller';
// El servicio: la clase con la lógica real (consultar la BD, calcular slots…).
import { AvailabilityService } from './availability.service';

// @Module(...) recibe un objeto de configuración que le dice a NestJS qué
// contiene este módulo:
@Module({
  // controllers: las clases que atienden peticiones HTTP de este módulo.
  controllers: [AvailabilityController],
  // providers: las clases "inyectables" (servicios) que NestJS creará y podrá
  // inyectar dentro de los controladores u otros servicios de este módulo.
  providers: [AvailabilityService],
  // exports: lo que este módulo "presta" a otros módulos. Al exportar el
  // AvailabilityService, otros módulos (ej. el de citas) que importen
  // AvailabilityModule podrán inyectar y usar AvailabilityService.
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
