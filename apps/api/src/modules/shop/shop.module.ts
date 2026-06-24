// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las piezas necesarias para definir este "módulo" de NestJS.
// Un módulo es como una "caja" que agrupa controladores y servicios relacionados.
// Aquí la caja es la "tienda" (shop): apartar/reservar productos y POS.
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador (etiqueta "@") que convierte una clase normal en un
// módulo de NestJS. Sin él, NestJS no sabría que esta clase agrupa cosas.
import { Module } from '@nestjs/common';
// El controlador de la tienda: la clase que recibe las peticiones HTTP
// (las URLs que llama el navegador del cliente) y responde a ellas.
import { ShopController } from './shop.controller';
// El servicio de la tienda: la clase con la lógica de verdad (consultar la base
// de datos, validar stock, crear reservas, etc.).
import { ShopService } from './shop.service';
// Importamos OTRO módulo completo (el del marketplace). Lo necesitamos porque
// este módulo reutiliza cosas que viven allí (por ejemplo, los "guards" que
// identifican al usuario del marketplace y el servicio de subida de archivos).
import { MarketplaceModule } from '../marketplace/marketplace.module';

// @Module({...}) recibe un objeto de configuración que describe el módulo:
@Module({
  // "imports" = otros módulos cuyos servicios necesitamos usar aquí. Al importar
  // MarketplaceModule, ganamos acceso a lo que ese módulo "exporta" (los guards
  // del marketplace y el UploadsService que usa el controlador/servicio).
  imports: [MarketplaceModule],
  // "controllers" = la lista de controladores (puertas de entrada HTTP) que
  // pertenecen a este módulo. Aquí solo hay uno: el de la tienda.
  controllers: [ShopController],
  // "providers" = las clases inyectables (servicios) que este módulo crea y pone
  // a disposición. NestJS se encarga de construir el ShopService y entregárselo
  // al controlador cuando lo pida en su constructor.
  providers: [ShopService],
})
// La clase queda vacía a propósito: toda la "magia" está en el decorador de
// arriba. NestJS lee esa configuración para armar el módulo. "export" permite
// que el módulo raíz de la app (AppModule) lo importe y lo registre.
export class ShopModule {}
