// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Module: decorador de NestJS que declara este "paquete" de funcionalidad.
import { Module } from '@nestjs/common';

// El controlador (endpoints) y el servicio (lógica) propios de este módulo.
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';

// PlatformAuthModule: lo importamos para reutilizar su guard/estrategia JWT y así
// proteger las rutas del super-admin con autenticación.
import { PlatformAuthModule } from '../platform-auth/platform-auth.module';

// EmployeesModule: lo importamos para poder usar EmployeesService (necesario para
// desactivar empleados de un negocio desde la consola del super-admin).
import { EmployeesModule } from '../employees/employees.module';

// @Module({...}) ensambla el módulo.
@Module({
  // imports: otros módulos cuyos "exports" necesitamos aquí (auth y empleados).
  imports: [PlatformAuthModule, EmployeesModule],
  // controllers: las clases que reciben las peticiones HTTP de este módulo.
  controllers: [PlatformAdminController],
  // providers: las clases inyectables (la lógica) que viven en este módulo.
  providers: [PlatformAdminService],
})
// Clase vacía: toda la configuración vive en el decorador @Module de arriba.
export class PlatformAdminModule {}
