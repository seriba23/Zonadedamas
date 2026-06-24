// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Module: decorador (etiqueta "@") de NestJS que sirve para agrupar piezas
// relacionadas (controladores, servicios, etc.) en una "caja" reutilizable.
// Cada módulo declara qué endpoints expone y qué lógica provee.
import { Module } from '@nestjs/common';

// ServicesController: la clase que define los endpoints HTTP de este módulo
// (GET /services, POST /services, etc.). Recibe las peticiones del cliente.
import { ServicesController } from './services.controller';

// ServicesService: la clase con la lógica de negocio de verdad (consultas a la
// base de datos, validaciones). El controlador la usa para hacer el trabajo.
import { ServicesService } from './services.service';

/**
 * Módulo de "Servicios" (los servicios que ofrece un negocio: corte, masaje,
 * manicura, etc.). Junta su controlador y su servicio en una sola unidad que
 * el módulo raíz de la app puede importar.
 */
@Module({
  // controllers: lista de controladores que NestJS debe instanciar y conectar
  // a las rutas HTTP. Aquí solo hay uno: ServicesController.
  controllers: [ServicesController],
  // providers: lista de clases "inyectables" (servicios) que viven dentro de
  // este módulo. NestJS las crea una sola vez y las inyecta donde se pidan.
  providers: [ServicesService],
  // exports: lo que este módulo deja DISPONIBLE para otros módulos que lo
  // importen. Al exportar ServicesService, otros módulos pueden inyectarlo y
  // reutilizar su lógica sin redefinirla.
  exports: [ServicesService],
})
export class ServicesModule {}
