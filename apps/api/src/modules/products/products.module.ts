// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las "piezas" que este módulo necesita.
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador (etiqueta "@") de NestJS que convierte una clase en un
// "módulo": una caja que agrupa controladores, servicios y dependencias relacionadas.
import { Module } from '@nestjs/common';

// El controlador: la clase que define los endpoints HTTP (GET/POST/PUT/DELETE)
// de productos. Recibe las peticiones y se las pasa al servicio.
import { ProductsController } from './products.controller';

// El servicio: la clase con la lógica de verdad (consultar/escribir la base de
// datos, calcular comisiones, etc.).
import { ProductsService } from './products.service';

// UploadsModule: otro módulo que sabe guardar/borrar archivos (imágenes). Lo
// importamos porque el servicio de productos necesita su UploadsService para
// subir y eliminar fotos de los productos.
import { UploadsModule } from '../uploads/uploads.module';

// @Module(...) describe cómo se arma este módulo:
//   - imports: otros módulos cuyos servicios queremos usar aquí. Al importar
//     UploadsModule, su UploadsService queda disponible para inyectarlo.
//   - controllers: las clases que exponen endpoints HTTP de este módulo.
//   - providers: las clases "inyectables" (servicios) que NestJS creará y podrá
//     pasar a quien las pida en su constructor.
//   - exports: lo que este módulo deja disponible para OTROS módulos que lo
//     importen. Exportamos ProductsService para que otras partes del sistema
//     (por ejemplo, el POS) puedan reutilizar su lógica.
@Module({
  imports: [UploadsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
// Clase vacía: el decorador @Module de arriba hace todo el trabajo. La clase solo
// sirve como "nombre" del módulo para que NestJS lo reconozca y lo registre.
export class ProductsModule {}
