// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos dos decoradores:
//   - Global: convierte este módulo en "global". Normalmente, para usar un
//     servicio de otro módulo, tendrías que importar ese módulo cada vez. Con
//     @Global(), basta importar PrismaModule UNA vez (en app.module.ts) y el
//     PrismaService queda disponible en TODA la app sin volver a importarlo.
//   - Module: decorador que declara una clase como "módulo" de NestJS (una caja
//     que agrupa servicios, controladores, etc.).
import { Global, Module } from '@nestjs/common';

// Importamos el servicio que este módulo va a ofrecer al resto de la aplicación.
import { PrismaService } from './prisma.service';

// @Global() => hace que lo que exporte este módulo esté disponible en todos lados.
@Global()
// @Module({...}) => configura el módulo con un objeto de opciones:
@Module({
  // "providers" = lista de servicios que este módulo CREA y administra. NestJS
  // se encargará de instanciar el PrismaService (una sola instancia compartida).
  providers: [PrismaService],
  // "exports" = lista de lo que este módulo PRESTA a otros módulos. Aquí
  // exportamos PrismaService para que cualquier otra clase pueda inyectarlo.
  exports: [PrismaService],
})
// La clase queda vacía a propósito: toda su "magia" está en los decoradores.
// Su único fin es servir de contenedor/etiqueta del módulo Prisma.
export class PrismaModule {}
