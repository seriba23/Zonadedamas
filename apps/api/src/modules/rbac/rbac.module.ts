// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos tres herramientas para construir un "módulo":
//   - Module: decorador que agrupa controladores, servicios, etc. en una unidad.
//     NestJS organiza la app en módulos (piezas que encajan entre sí).
//   - Global: decorador que hace que lo que este módulo EXPORTA quede disponible
//     en TODA la aplicación sin tener que importar el módulo en cada sitio.
//   - forwardRef: ayuda a resolver "dependencias circulares" (cuando el módulo A
//     necesita al B y el B necesita al A al mismo tiempo). Envuelve la referencia
//     para que NestJS pueda construir ambos sin quedarse atascado.
import { Global, Module, forwardRef } from '@nestjs/common';

// El controlador: la clase con los endpoints HTTP de RBAC (roles, permisos...).
import { RbacController } from './rbac.controller';

// El servicio: la clase con la lógica de negocio de RBAC (leer/crear roles,
// calcular los permisos de un usuario, asignar/quitar roles, etc.).
import { RbacService } from './rbac.service';

// El módulo de autenticación. Lo importamos porque RBAC y Auth se necesitan
// mutuamente (de ahí el forwardRef de abajo, que rompe el círculo).
import { AuthModule } from '../auth/auth.module';

// @Global() => convierte este módulo en global: su "export" (RbacService) podrá
// inyectarse en cualquier otro módulo sin volver a importar RbacModule.
@Global()
// @Module({...}) => declara la configuración del módulo:
@Module({
  // imports: otros módulos cuyos servicios necesitamos aquí dentro.
  // forwardRef(() => AuthModule) => importa AuthModule de forma "diferida" para
  // evitar el error de dependencia circular entre RbacModule y AuthModule.
  imports: [forwardRef(() => AuthModule)],
  // controllers: las clases que exponen endpoints HTTP de este módulo.
  controllers: [RbacController],
  // providers: las clases "inyectables" (servicios) que viven dentro del módulo.
  providers: [RbacService],
  // exports: lo que este módulo comparte hacia afuera. Al exportar RbacService
  // (y siendo @Global), otros módulos pueden usarlo para comprobar permisos.
  exports: [RbacService],
})
// La clase del módulo en sí va vacía: toda la configuración está en los
// decoradores de arriba. Es solo el "contenedor" que NestJS reconoce.
export class RbacModule {}
