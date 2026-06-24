// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos "Module": el decorador (etiqueta "@") que sirve para
// declarar un "módulo". Un módulo es una caja que agrupa controladores y
// servicios relacionados (aquí, todo lo de "clientes") para que NestJS sepa
// cómo construirlos y conectarlos entre sí.
import { Module } from '@nestjs/common';

// El controlador: la clase que define los endpoints HTTP (/api/clients/...).
// Recibe las peticiones del navegador y delega el trabajo al servicio.
import { ClientsController } from './clients.controller';

// El servicio: la clase con la lógica de verdad (consultar la base de datos,
// crear/editar/borrar clientes, etiquetas, resumen, etc.).
import { ClientsService } from './clients.service';

/**
 * Módulo de Clientes.
 *
 * Agrupa el controlador y el servicio de clientes. NestJS usa esta
 * configuración para crear las instancias y resolver sus dependencias.
 */
@Module({
  // controllers: lista de controladores que pertenecen a este módulo. NestJS
  // registrará sus rutas (GET/POST/PUT/DELETE de /api/clients).
  controllers: [ClientsController],
  // providers: las clases "inyectables" (servicios) que este módulo crea y que
  // pueden inyectarse en sus controladores u otros servicios.
  providers: [ClientsService],
  // exports: lo que este módulo deja DISPONIBLE para otros módulos que lo
  // importen. Aquí exportamos ClientsService para que otros módulos (que
  // importen ClientsModule) puedan reutilizar su lógica de clientes.
  exports: [ClientsService],
})
export class ClientsModule {}
