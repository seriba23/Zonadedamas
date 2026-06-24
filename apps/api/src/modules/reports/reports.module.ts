// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es un decorador (etiqueta "@") de NestJS. Sirve para declarar un
// "módulo": una caja que agrupa controladores y servicios relacionados. En este
// caso, todo lo que tiene que ver con REPORTES (estadísticas del negocio).
import { Module } from '@nestjs/common';

// El "servicio": la clase con TODA la lógica de los reportes (ir a la base de
// datos, sumar ingresos, calcular top clientes, comisiones, etc.).
import { ReportsService } from './reports.service';

// El "controlador": la clase que define los endpoints HTTP (las URLs) y, cuando
// llega una petición, le pide el trabajo al servicio de arriba.
import { ReportsController } from './reports.controller';

// @Module({...}) describe de qué se compone este módulo:
@Module({
  // controllers: la lista de controladores que expone este módulo. Aquí solo
  // hay uno: ReportsController (los endpoints GET /api/reports/...).
  controllers: [ReportsController],
  // providers: la lista de "proveedores" (servicios) que NestJS debe crear y
  // poder inyectar. Aquí ReportsService, que el controlador recibe por inyección.
  providers: [ReportsService],
})
// La clase queda vacía (sin métodos): solo sirve como "etiqueta" para que NestJS
// sepa cómo está armado este módulo. "export" la hace visible para que el módulo
// raíz de la app la pueda importar y registrar.
export class ReportsModule {}
