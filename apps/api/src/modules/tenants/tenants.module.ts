// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las piezas necesarias para declarar este "módulo".
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador (etiqueta "@") de NestJS que convierte una clase
// normal en un MÓDULO. Un módulo es como una "caja" que agrupa cosas
// relacionadas (controladores, servicios) para que NestJS sepa cómo armarlas.
import { Module } from '@nestjs/common';
// El controlador: la clase que recibe las peticiones HTTP de "tenants"
// (negocios) y decide qué método del servicio llamar.
import { TenantsController } from './tenants.controller';
// El servicio: la clase con la lógica de verdad (consultar la base de datos,
// crear negocios, sucursales, horarios, etc.).
import { TenantsService } from './tenants.service';

// @Module({...}) describe a NestJS de qué se compone este módulo:
@Module({
  // "controllers": la lista de controladores que pertenecen a este módulo.
  // Aquí solo hay uno: TenantsController.
  controllers: [TenantsController],
  // "providers": las clases "inyectables" (servicios) que este módulo crea y
  // puede usar internamente. Aquí está TenantsService.
  providers: [TenantsService],
  // "exports": lo que este módulo deja DISPONIBLE para OTROS módulos que lo
  // importen. Exportamos TenantsService para que otros módulos puedan usarlo.
  exports: [TenantsService],
})
// La clase queda vacía a propósito: toda la "configuración" va en el decorador
// @Module de arriba. Esta clase solo existe para que NestJS la registre.
export class TenantsModule {}
