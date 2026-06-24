// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los decoradores (etiquetas "@") para declarar endpoints:
//   - Controller: marca la clase como "controlador" (un grupo de endpoints).
//   - Get: marca un método como endpoint que responde a peticiones HTTP GET.
import { Controller, Get } from '@nestjs/common';

// El servicio con la lógica real (consultar/cachear los tipos de cambio).
import { ExchangeRatesService } from './exchange-rates.service';

// @Public() es un decorador propio del proyecto que marca un endpoint como
// "público": le dice al guard de autenticación que NO exija token aquí.
import { Public } from '../../common/decorators/public.decorator';

// @Controller('exchange-rates') => todas las rutas de esta clase empiezan con
// "/api/exchange-rates". (El prefijo "/api" se agrega globalmente aparte.)
@Controller('exchange-rates')
export class ExchangeRatesController {
  // CONSTRUCTOR + INYECCIÓN: NestJS crea e inyecta el servicio automáticamente.
  // "private readonly" lo guarda como propiedad de solo lectura (this....).
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  // @Public() => este endpoint NO requiere estar autenticado (cualquiera puede
  // consultar los tipos de cambio).
  @Public()
  // @Get() sin ruta => responde a GET /api/exchange-rates (la raíz del grupo).
  @Get()
  // Devuelve una Promise con un objeto { data: ... }. El tipo del valor es "any"
  // (cualquier cosa), porque el contenido lo arma el servicio.
  async getRates(): Promise<{ data: any }> {
    // Pedimos las tasas al servicio. "await" espera a que termine (puede ir a
    // la red). El resultado se guarda en "data".
    const data = await this.exchangeRatesService.getRates();
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data };
  }
}
