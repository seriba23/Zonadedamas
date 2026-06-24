// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Module: decorador de NestJS que agrupa piezas relacionadas (controladores,
// servicios, etc.) en una "unidad" que el framework sabe construir y conectar.
import { Module } from '@nestjs/common';
// El controlador (endpoints HTTP) y el servicio (lógica) de proveedores.
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

// @Module describe cómo se arma este módulo:
@Module({
  // controllers: las clases que reciben peticiones HTTP de este módulo.
  controllers: [SuppliersController],
  // providers: las clases "inyectables" (servicios) que NestJS creará y podrá
  // inyectar donde se necesiten (aquí, en el controlador).
  providers: [SuppliersService],
  // exports: lo que este módulo "presta" a otros módulos que lo importen. Al
  // exportar SuppliersService, otro módulo (p. ej. inventario) puede reutilizarlo.
  exports: [SuppliersService],
})
export class SuppliersModule {}
