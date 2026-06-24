// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías para poder usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos dos decoradores (etiquetas que empiezan con "@"):
//   - Global: marca este módulo como "global". Normalmente, para usar un
//     servicio de otro módulo tienes que importar ese módulo en cada sitio.
//     Con @Global() basta importarlo UNA vez (en el módulo raíz) y su servicio
//     queda disponible en TODA la aplicación sin volver a importarlo.
//   - Module: convierte una clase en un "módulo" de NestJS, que es la unidad
//     que agrupa controladores, servicios (providers) y otros módulos.
import { Global, Module } from '@nestjs/common';

// EventEmitterModule es el módulo oficial de NestJS para manejar "eventos en
// memoria" (publicar/escuchar eventos dentro del mismo proceso). En este
// proyecto reemplaza a una cola externa tipo BullMQ/Redis.
import { EventEmitterModule } from '@nestjs/event-emitter';

// Importamos nuestro propio servicio de eventos, que tiene la lógica para
// guardar los eventos en la base de datos y dispararlos en memoria.
import { EventsService } from './events.service';

// @Global() => como se explicó arriba, hace que EventsService esté disponible
// en toda la app sin tener que importar EventsModule en cada módulo.
@Global()
// @Module({...}) describe de qué se compone este módulo:
@Module({
  // imports: otros módulos que este necesita. forRoot() inicializa el sistema
  // de eventos con su configuración por defecto (debe llamarse una sola vez).
  imports: [EventEmitterModule.forRoot()],
  // providers: las clases (servicios) que este módulo crea y gestiona.
  providers: [EventsService],
  // exports: lo que este módulo "presta" a otros módulos. Al exportar
  // EventsService, otras partes de la app pueden inyectarlo y usarlo.
  exports: [EventsService],
})
// Clase del módulo. Va vacía a propósito: toda la configuración vive en los
// decoradores de arriba. "export" permite que otros archivos la importen.
export class EventsModule {}
