// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Global: hace que este módulo sea "global", es decir, que su servicio quede
//     disponible en toda la app importándolo UNA sola vez (en app.module.ts).
//   - Module: decorador que declara la clase como módulo de NestJS.
import { Global, Module } from '@nestjs/common';

// Importamos el servicio de caché en memoria que este módulo va a ofrecer.
import { RedisService } from './redis.service';

// @Global() => el RedisService exportado estará disponible en cualquier módulo
// sin tener que importar RedisModule cada vez.
@Global()
// @Module({...}) => configuración del módulo:
@Module({
  // providers: servicios que este módulo crea y administra (una sola instancia
  // compartida de RedisService).
  providers: [RedisService],
  // exports: lo que este módulo presta a los demás. Exportamos RedisService para
  // que otras clases puedan inyectarlo y usar la caché.
  exports: [RedisService],
})
// Clase vacía a propósito: solo sirve como contenedor/etiqueta del módulo.
export class RedisModule {}
