// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como servicio
//     inyectable.
//   - Logger: utilidad para escribir mensajes en la consola del servidor.
import { Injectable, Logger } from '@nestjs/common';

// ─────────────────────────────────────────────────────────────────────────────
// CONTRATO DE DATOS: forma del "caché" donde guardamos los tipos de cambio.
// Una interface describe qué campos debe tener un objeto (no genera código).
// ─────────────────────────────────────────────────────────────────────────────
export interface ExchangeRateCache {
  base: string;                    // moneda base de las tasas, aquí siempre "USD"
  // rates = un objeto tipo { "MXN": 17.5, "EUR": 0.92, ... }: cada clave es el
  // código de una moneda y su valor es cuántas unidades equivalen a 1 USD.
  rates: Record<string, number>;
  date: string;                    // fecha de la última actualización (texto)
  fetchedAt: number;               // momento en que se obtuvo, en milisegundos
}

@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class ExchangeRatesService {
  // logger: para escribir en consola, etiquetado con el nombre de esta clase.
  private readonly logger = new Logger(ExchangeRatesService.name);

  // cache: aquí guardamos en memoria la última respuesta de la API para no
  // pedirla cada vez. Empieza en null porque todavía no tenemos datos.
  // El tipo "ExchangeRateCache | null" significa "o un caché, o nada (null)".
  private cache: ExchangeRateCache | null = null;

  // TTL ("time to live") = cuánto tiempo consideramos el caché como válido.
  // 24 * 60 * 60 * 1000 = 24 horas expresadas en milisegundos.
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours

  // API_URL = dirección del servicio externo que nos da las tasas (base USD).
  private readonly API_URL = 'https://open.er-api.com/v6/latest/USD';

  // ───────────────────────────────────────────────────────────────────────────
  // getRates(): devuelve los tipos de cambio. Primero intenta usar el caché; si
  // está viejo o vacío, los pide a la API externa; si la API falla, usa valores
  // de respaldo. Devuelve una Promise con el objeto ExchangeRateCache.
  // ───────────────────────────────────────────────────────────────────────────
  async getRates(): Promise<ExchangeRateCache> {
    // ¿Tenemos caché Y todavía es fresco?
    //   - "this.cache &&" => primero comprueba que el caché exista (no sea null).
    //   - "Date.now() - this.cache.fetchedAt" => cuánto tiempo (ms) pasó desde
    //     que lo guardamos. Si ese tiempo es MENOR que el TTL, sigue vigente.
    // Si ambas cosas se cumplen, devolvemos el caché y evitamos llamar a la API.
    if (this.cache && Date.now() - this.cache.fetchedAt < this.TTL) {
      return this.cache;
    }

    // try/catch: si la llamada a la red falla, no rompemos la app; saltamos al
    // catch y luego devolveremos un respaldo.
    try {
      // fetch() hace una petición HTTP a la API. "await" espera la respuesta.
      const res = await fetch(this.API_URL);
      // res.json() convierte el cuerpo de la respuesta (texto JSON) en objeto JS.
      const data = await res.json();

      // La API marca éxito con un campo result === 'success'. Si es así, usamos
      // sus datos para reconstruir el caché.
      if (data.result === 'success') {
        this.cache = {
          base: 'USD',
          rates: data.rates, // el objeto de tasas que vino de la API
          // date: tomamos el texto de fecha de la API y lo recortamos.
          //   - "?." (optional chaining): si time_last_update_utc no existiera,
          //     no rompe; devuelve undefined y entra el respaldo del "||".
          //   - .split(' 00:')[0]: corta el texto en el primer " 00:" y toma la
          //     parte izquierda (la fecha sin la hora).
          //   - "|| ...": si lo anterior salió vacío/undefined, usamos la fecha
          //     de hoy: new Date().toISOString() da algo como "2026-06-24T..."
          //     y split('T')[0] se queda con "2026-06-24".
          date: data.time_last_update_utc?.split(' 00:')[0] || new Date().toISOString().split('T')[0],
          fetchedAt: Date.now(), // marcamos AHORA como momento de obtención
        };
        // Mensaje informativo: Object.keys(data.rates) da la lista de códigos de
        // moneda y .length cuántas hay. Útil para confirmar que se actualizó.
        this.logger.log(`Exchange rates updated: ${Object.keys(data.rates).length} currencies`);
        return this.cache;
      }

      // Si la API respondió pero NO con 'success', dejamos una advertencia.
      this.logger.warn('Exchange rate API returned non-success result');
    } catch (err) {
      // Si hubo un error de red u otro fallo, lo registramos como error.
      this.logger.error('Failed to fetch exchange rates', err);
    }

    // RESPALDO si la API falló:
    // Si todavía tenemos un caché viejo, es mejor devolver datos viejos que nada.
    if (this.cache) return this.cache;

    // Si ni siquiera hay caché previo, devolvemos tasas fijas "de emergencia"
    // (valores aproximados) para que la app siga funcionando sin internet.
    return {
      base: 'USD',
      rates: { USD: 1, MXN: 17.5, DOP: 58.5, EUR: 0.92, COP: 4200, ARS: 900, CLP: 950, PEN: 3.75, BRL: 5.1 },
      date: new Date().toISOString().split('T')[0], // fecha de hoy "YYYY-MM-DD"
      fetchedAt: Date.now(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // convert(): convierte una cantidad de una moneda a otra.
  // Recibe: amount (cantidad), from (moneda origen), to (moneda destino).
  // Devuelve: la cantidad equivalente en la moneda destino (redondeada).
  // ───────────────────────────────────────────────────────────────────────────
  async convert(amount: number, from: string, to: string): Promise<number> {
    // Si origen y destino son la misma moneda, no hay que convertir nada.
    if (from === to) return amount;

    // Obtenemos las tasas. La sintaxis "{ rates }" es desestructuración: saca
    // solo la propiedad "rates" del objeto que devuelve getRates().
    const { rates } = await this.getRates();

    // Tasa de la moneda origen respecto a USD.
    //   - "rates[from]" busca la tasa por su código (ej. rates["MXN"]).
    //   - "|| 1": si esa moneda no existe en la tabla, usamos 1 (equivale a USD)
    //     para no dividir por undefined y romper el cálculo.
    const fromRate = rates[from] || 1;
    // Tasa de la moneda destino respecto a USD (mismo razonamiento).
    const toRate = rates[to] || 1;

    // Conversión en dos pasos: pasamos de 'from' a USD (dividiendo por fromRate)
    // y de USD a 'to' (multiplicando por toRate).
    // El "* 100 ... / 100" con Math.round redondea a 2 decimales:
    // multiplicamos por 100, redondeamos al entero más cercano y dividimos entre
    // 100 (ej. 12.3456 -> 1234.56 -> 1235 -> 12.35).
    return Math.round((amount / fromRate) * toRate * 100) / 100;
  }
}
