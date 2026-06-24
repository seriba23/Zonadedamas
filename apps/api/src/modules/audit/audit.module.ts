// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las "piezas" que necesita este módulo para existir.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS (el framework del backend) importamos dos decoradores:
//   - Global: etiqueta que convierte este módulo en "global". Un módulo global
//     deja sus exports disponibles para TODA la aplicación sin que cada otro
//     módulo tenga que importarlo (ver explicación detallada más abajo).
//   - Module: decorador que declara una clase como "módulo" de NestJS. Un módulo
//     es una caja que agrupa controladores, servicios y dependencias relacionadas.
import { Global, Module } from '@nestjs/common';

// Importamos el controlador: la clase que recibe las peticiones HTTP del endpoint
// /api/audit (consultar la bitácora de auditoría).
import { AuditController } from './audit.controller';

// Importamos el servicio: la clase con la lógica de verdad (escribir entradas en
// la bitácora y consultarlas en la base de datos).
import { AuditService } from './audit.service';

// @Global() => MUY IMPORTANTE. Marca este módulo como "global".
// Normalmente, para que un módulo B pueda usar el AuditService, el módulo B
// tendría que importar AuditModule en su lista de "imports". Al ser @Global(),
// eso ya NO hace falta: cualquier otro módulo de la app puede inyectar
// AuditService directamente (en su constructor) sin re-importar AuditModule.
// Esto es ideal para la auditoría, porque CASI TODOS los módulos necesitan
// registrar operaciones de escritura en la bitácora.
@Global()
// @Module({...}) => describe de qué se compone este módulo:
@Module({
  // controllers: lista de controladores (endpoints HTTP) que pertenecen aquí.
  controllers: [AuditController],
  // providers: lista de servicios "proveedores" que NestJS creará y podrá
  // inyectar. Aquí registramos AuditService para que exista una instancia única.
  providers: [AuditService],
  // exports: qué de lo anterior queda "público" para otros módulos. Exportamos
  // AuditService para que (combinado con @Global) lo pueda usar toda la app.
  exports: [AuditService],
})
// La clase queda vacía a propósito: toda la configuración vive en los decoradores
// de arriba. Esta clase es solo el "contenedor" del módulo de auditoría.
export class AuditModule {}
