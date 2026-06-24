// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las "piezas" que este módulo necesita para armarse.
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es el decorador (etiqueta "@") de NestJS que convierte una clase
// normal en un MÓDULO. Un módulo es como una "caja" que agrupa cosas
// relacionadas (controladores, servicios, etc.) que trabajan juntas. Aquí la
// caja agrupa todo lo del manejo de "recursos" (equipo/inventario del negocio).
import { Module } from '@nestjs/common';

// El CONTROLADOR: la clase que recibe las peticiones HTTP (las llamadas que
// llegan desde el navegador/app) y decide qué hacer con ellas.
import { ResourcesController } from './resources.controller';

// El SERVICIO: la clase que tiene la lógica de verdad (leer/escribir en la base
// de datos, calcular cantidades, etc.). El controlador le delega el trabajo.
import { ResourcesService } from './resources.service';

// Otro módulo del proyecto: el de "uploads" (subida de archivos). Lo importamos
// porque al subir la foto de un recurso usamos su servicio (UploadsService) para
// guardar/borrar el archivo en el servidor.
import { UploadsModule } from '../uploads/uploads.module';

// @Module({...}) define la configuración del módulo mediante un objeto:
@Module({
  // "imports": otros módulos cuyas herramientas necesitamos aquí dentro.
  // Al importar UploadsModule podemos inyectar su UploadsService en el
  // controlador (para subir/borrar imágenes de los recursos).
  imports: [UploadsModule],
  // "controllers": la lista de controladores que pertenecen a este módulo.
  controllers: [ResourcesController],
  // "providers": las clases inyectables (servicios) que vivirán dentro de este
  // módulo y podrán ser inyectadas en sus controladores/otros servicios.
  providers: [ResourcesService],
  // "exports": lo que este módulo deja DISPONIBLE para otros módulos que lo
  // importen. Exportamos ResourcesService por si otra parte del sistema necesita
  // usar la lógica de recursos.
  exports: [ResourcesService],
})
// La clase queda vacía a propósito: toda la "configuración" está en el decorador
// de arriba. Solo necesita existir y exportarse para que NestJS la registre.
export class ResourcesModule {}
