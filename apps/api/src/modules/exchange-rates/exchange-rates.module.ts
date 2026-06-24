// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos dos decoradores (etiquetas "@"):
//   - Module: convierte una clase en un "módulo" (la unidad que agrupa
//     controladores y servicios).
//   - Global: hace que el servicio de este módulo esté disponible en TODA la
//     app sin tener que importar este módulo en cada sitio.
import { Module, Global } from '@nestjs/common';

// El servicio con la lógica: consultar/convertir tipos de cambio de monedas.
import { ExchangeRatesService } from './exchange-rates.service';

// El controlador: expone el endpoint HTTP que devuelve los tipos de cambio.
import { ExchangeRatesController } from './exchange-rates.controller';

// @Global() => ExchangeRatesService podrá inyectarse en cualquier parte de la
// app (ej. para convertir precios) sin reimportar este módulo.
@Global()
// @Module({...}) describe de qué se compone este módulo:
@Module({
  // controllers: las clases que reciben peticiones HTTP de este módulo.
  controllers: [ExchangeRatesController],
  // providers: los servicios (lógica) que este módulo crea y gestiona.
  providers: [ExchangeRatesService],
  // exports: lo que este módulo "presta" a otros. Al exportar el servicio,
  // otros módulos pueden inyectarlo para convertir monedas.
  exports: [ExchangeRatesService],
})
// Clase del módulo, vacía a propósito: la configuración vive en los decoradores.
export class ExchangeRatesModule {}
