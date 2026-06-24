// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Module: decorador (etiqueta "@") de NestJS que convierte una clase en un
// "módulo" (la unidad que agrupa controladores y servicios).
import { Module } from '@nestjs/common';

// El controlador que expone el endpoint de chequeo de salud (/api/health).
import { HealthController } from './health.controller';

// @Module({...}) describe de qué se compone este módulo:
@Module({
  // controllers: las clases que reciben peticiones HTTP. Aquí solo el de salud.
  // No hay providers ni exports porque este módulo no tiene lógica que prestar:
  // su único trabajo es responder "estoy vivo".
  controllers: [HealthController],
})
// Clase del módulo, vacía a propósito: la configuración vive en el decorador.
export class HealthModule {}
