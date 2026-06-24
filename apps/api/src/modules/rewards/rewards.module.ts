// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las piezas que necesita este "módulo" de recompensas.
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es un decorador de NestJS. Un decorador es una etiqueta que empieza
// con "@" y se pone arriba de una clase para darle un comportamiento especial.
// "@Module(...)" agrupa controladores y servicios relacionados en una unidad.
import { Module } from '@nestjs/common';

// El "controlador": la clase que define los endpoints HTTP (las URLs) de las
// recompensas. Recibe las peticiones del navegador/app y las delega al servicio.
import { RewardsController } from './rewards.controller';

// El "servicio": la clase con la lógica de verdad (consultar la base de datos,
// crear recompensas, canjear cupones, etc.).
import { RewardsService } from './rewards.service';

// @Module agrupa todo lo relacionado con "recompensas" en una sola unidad que
// NestJS sabe cómo construir y conectar con el resto de la aplicación.
@Module({
  // controllers: la lista de controladores (endpoints) que viven en este módulo.
  controllers: [RewardsController],
  // providers: las clases "inyectables" (servicios) que este módulo crea y usa.
  providers: [RewardsService],
  // exports: lo que este módulo deja DISPONIBLE para OTROS módulos que lo
  // importen. Al exportar RewardsService, otros módulos pueden reutilizar su
  // lógica (por ejemplo, para canjear cupones desde el flujo de reservas).
  exports: [RewardsService],
})
// La clase queda vacía a propósito: toda la configuración va en el @Module de
// arriba. NestJS solo necesita la clase como "contenedor" del decorador.
export class RewardsModule {}
