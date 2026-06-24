// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador (etiqueta "@") de NestJS que sirve para agrupar y
// declarar las piezas que forman un módulo: sus controladores (endpoints) y sus
// servicios (lógica). Un módulo es como una "caja" que junta cosas relacionadas.
import { Module } from '@nestjs/common';

// El controlador: la clase que define las rutas/endpoints HTTP de los paquetes
// de servicios (GET, POST, PUT, DELETE).
import { ServiceBundlesController } from './service-bundles.controller';

// El servicio: la clase que contiene la lógica de verdad (consultar la base de
// datos, calcular precios, validar, etc.).
import { ServiceBundlesService } from './service-bundles.service';

// @Module({...}) describe a NestJS de qué se compone este módulo:
//   - controllers: lista de controladores que reciben las peticiones HTTP.
//   - providers: lista de servicios que NestJS puede crear e inyectar.
//   - exports: lo que este módulo "presta" a otros módulos que lo importen.
//     Aquí exportamos el servicio para que otros módulos puedan reutilizarlo.
@Module({
  controllers: [ServiceBundlesController],
  providers: [ServiceBundlesService],
  exports: [ServiceBundlesService],
})
// La clase del módulo va vacía: toda la configuración vive en el decorador de
// arriba. NestJS solo necesita esta clase como "punto de entrada" del módulo.
export class ServiceBundlesModule {}
