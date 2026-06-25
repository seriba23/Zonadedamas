// ============================================================
// ARCHIVO: use-currency.ts
// PROPÓSITO: Convierte y formatea cantidades de dinero entre diferentes
//            monedas usando tasas de cambio reales obtenidas del backend.
//
//            Exporta DOS hooks:
//            1. useCurrency()         → Para el dashboard del negocio.
//                                       Usa la moneda configurada del tenant.
//            2. useMarketplaceCurrency() → Para el marketplace público.
//                                          Recibe moneda origen y destino
//                                          como parámetros explícitos.
//
// ¿QUÉ ES REACT-QUERY (useQuery)?
//   Es una librería para gestionar peticiones HTTP (llamadas al servidor).
//   Maneja automáticamente: loading states, caché, re-intentos, y
//   revalidación automática. Es mucho más poderoso que useEffect + fetch.
//
//   useQuery({ queryKey, queryFn, staleTime, refetchOnWindowFocus })
//     - queryKey: identificador único de esta consulta. Si el mismo key
//                 ya fue consultado recientemente, usa el caché (no vuelve
//                 a llamar al servidor).
//     - queryFn: la función async que hace la petición real.
//     - staleTime: tiempo en ms que los datos se consideran "frescos".
//                  Antes de que pase ese tiempo, no vuelve a consultar.
//     - refetchOnWindowFocus: si re-consulta cuando el usuario vuelve
//                             a la ventana del navegador.
//
// ¿QUÉ SON async/await?
//   Son palabras clave para manejar operaciones asíncronas (que toman tiempo,
//   como llamadas a servidores). "await" pausa la ejecución hasta que la
//   operación termine, sin bloquear el navegador.
//   async function foo() { const result = await fetch(url); return result; }
// ============================================================

'use client';
// Este archivo solo corre en el navegador (tiene acceso a window, fetch, etc.)

import { useQuery } from '@tanstack/react-query';
// useQuery: hook de react-query para hacer consultas al servidor con caché
import { useAuth } from './use-auth';
// useAuth: obtenemos el usuario logueado para saber su moneda configurada
import { formatCurrency as rawFormat } from '../utils';
// rawFormat: función de utilidad que formatea un número como moneda
// Ej: rawFormat(100, 'MXN') → "MX$100.00"

// URL base del backend, configurada como variable de entorno.
// Si no está definida, usa localhost:3001 (desarrollo local).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================
// INTERFAZ: ExchangeRates
// Describe la forma de la respuesta del endpoint de tasas de cambio.
// ============================================================
interface ExchangeRates {
  base: string;                   // Moneda base de las tasas (normalmente 'USD')
  rates: Record<string, number>;  // Objeto con pares moneda → tasa de cambio
                                  // Ej: { "USD": 1, "MXN": 17.5, "EUR": 0.92 }
                                  // Record<string, number> = objeto cuyas claves son
                                  // strings y valores son números
  date: string;                   // Fecha de las tasas (YYYY-MM-DD)
}

// ============================================================
// FALLBACK_RATES: Tasas de cambio predefinidas (de respaldo)
//
// Se usan mientras la consulta al backend todavía no terminó,
// o si el backend falla. Así el frontend siempre puede mostrar
// un valor convertido razonablemente correcto desde el primer momento.
//
// Record<string, number>: tipo TypeScript para un objeto { clave: número }
// ============================================================

// Fallback usado mientras se cargan las tasas reales del backend. Evita que el
// frontend muestre valores sin convertir (p.ej. "MXN 40" cuando el dato esta
// en USD). Se sincroniza con el fallback en exchange-rates.service.ts.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,       // Dólar estadounidense (base = 1)
  MXN: 17.5,    // Peso mexicano: 1 USD = 17.5 MXN
  DOP: 58.5,    // Peso dominicano
  EUR: 0.92,    // Euro: 1 USD = 0.92 EUR
  COP: 4200,    // Peso colombiano
  ARS: 900,     // Peso argentino
  CLP: 950,     // Peso chileno
  PEN: 3.75,    // Sol peruano
  BRL: 5.1,     // Real brasileño
};

// ============================================================
// HOOK: useCurrency
// Para usar en el DASHBOARD del negocio.
// Lee la moneda del tenant del usuario logueado y permite convertir
// y formatear cantidades a esa moneda.
//
// No recibe parámetros.
// Devuelve: { currency, rates, rateDate, convert, format }
// ============================================================
export function useCurrency() {
  const { user } = useAuth();
  // user?.tenantCurrency: el operador ?. (optional chaining) es un atajo seguro.
  // Si user es null, en vez de lanzar error "Cannot read property 'tenantCurrency' of null",
  // simplemente devuelve undefined. Luego || 'MXN' usa MXN como valor por defecto.
  // (user as any): le decimos a TypeScript "confía en mí, este campo existe"
  // aunque no esté declarado en el tipo estricto.
  const tenantCurrency = (user as any)?.tenantCurrency || 'MXN';

  // Consulta las tasas de cambio al backend con caché de 24 horas.
  // Si ya se consultaron hace menos de 24 horas, usa el caché y no llama al servidor.
  const { data } = useQuery({
    queryKey: ['exchange-rates'], // Clave de caché: cualquier otro componente que use
                                  // esta misma key compartirá los resultados (no duplica peticiones)
    queryFn: async () => {
      // Hacemos la petición HTTP al backend
      const res = await fetch(`${API_URL}/api/exchange-rates`);
      // res.json() convierte la respuesta (texto) a objeto JavaScript
      const json = await res.json();
      return json.data as ExchangeRates; // Decimos a TypeScript qué forma tiene el dato
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 horas en milisegundos (no re-consulta tan seguido)
    refetchOnWindowFocus: false,     // No re-consultar cuando el usuario vuelve a la ventana
  });

  // Si la query todavia no termino, usa el fallback hardcoded para que
  // formatCurrency(40, 'USD') siempre devuelva un valor convertido decente
  // en lugar de mostrar 40 como si estuviera en la moneda del tenant.
  // data?.rates: si data es undefined (carga en progreso), usa FALLBACK_RATES
  // ?? es el operador "nullish coalescing": devuelve el lado derecho solo si
  // el lado izquierdo es null o undefined (no si es 0 o "")
  const rates = data?.rates ?? FALLBACK_RATES;
  const rateDate = data?.date || ''; // Fecha de las tasas (o string vacío si no hay)

  // ============================================================
  // FUNCIÓN: convert
  // Convierte una cantidad de una moneda a la moneda del tenant.
  //
  // Recibe:
  //   amount: número a convertir
  //   fromCurrency: moneda origen (por defecto 'MXN')
  //
  // Devuelve: el monto convertido como número
  //
  // Lógica de conversión:
  //   Todas las tasas están en relación a USD (la base).
  //   Para convertir de MXN a EUR:
  //     1. Primero convertimos MXN → USD: amount / rates['MXN']
  //     2. Luego convertimos USD → EUR: * rates['EUR']
  // ============================================================
  function convert(amount: number, fromCurrency = 'MXN'): number {
    // Si ya estamos en la moneda correcta, no hace falta convertir
    if (fromCurrency === tenantCurrency) return amount;
    const fromRate = rates[fromCurrency] || 1; // Tasa de la moneda origen (|| 1 = si no existe, asume paridad)
    const toRate = rates[tenantCurrency] || 1;  // Tasa de la moneda destino
    // Conversión: amount / fromRate = monto en USD; * toRate = monto en moneda destino
    // Math.round(...* 100) / 100: redondea a 2 decimales
    // Ej: 100 MXN → 100/17.5 * 0.92 = 5.26 EUR
    return Math.round((amount / fromRate) * toRate * 100) / 100;
  }

  // ============================================================
  // FUNCIÓN: format
  // Convierte y formatea una cantidad como string de moneda.
  //
  // Recibe:
  //   amount: número a formatear
  //   fromCurrency: moneda origen (opcional; si no se pasa, usa la del tenant)
  //
  // Devuelve: string formateado, ej: "MX$100.00" o "€5.26"
  // ============================================================
  function format(amount: number, fromCurrency?: string): string {
    // Si no se especifica fromCurrency, asumimos que el amount ya está
    // en la moneda del tenant (no necesita conversión).
    const from = fromCurrency || tenantCurrency;
    const converted = convert(amount, from); // Convertimos primero
    return rawFormat(converted, tenantCurrency); // Luego formateamos como string
  }

  // Lo que devuelve el hook a quien lo use
  return {
    currency: tenantCurrency, // Código de moneda del tenant (ej: 'MXN', 'USD')
    rates,                    // Objeto completo de tasas de cambio
    rateDate,                 // Fecha de las tasas (para mostrar al usuario si quiere)
    convert,                  // Función para convertir número
    format,                   // Función para convertir y formatear como string
  };
}

// ============================================================
// HOOK: useMarketplaceCurrency
// Versión del hook para el MARKETPLACE (portal público de compras).
// No depende del usuario logueado: recibe moneda origen y destino
// directamente como parámetros de la función format().
//
// No recibe parámetros.
// Devuelve: { rates, format }
// ============================================================

// Marketplace version - reads from marketplace user preference
export function useMarketplaceCurrency() {
  // Misma consulta de tasas de cambio que useCurrency.
  // Comparte el caché porque usa la misma queryKey ['exchange-rates'].
  const { data } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/exchange-rates`);
      const json = await res.json();
      return json.data as ExchangeRates;
    },
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Mismo fallback que en useCurrency
  const rates = data?.rates ?? FALLBACK_RATES;

  // ============================================================
  // FUNCIÓN: format (versión marketplace)
  // A diferencia de la versión del dashboard, aquí la moneda origen
  // y destino se pasan como parámetros, no se leen del estado global.
  //
  // Recibe:
  //   amount: número a formatear
  //   fromCurrency: moneda origen (por defecto 'MXN')
  //   toCurrency: moneda destino (por defecto 'MXN')
  //
  // Devuelve: string formateado, ej: "US$5.71"
  // ============================================================

  // Default a MXN, paginas marketplace pueden overridear con preferencia del user.
  function format(amount: number, fromCurrency = 'MXN', toCurrency = 'MXN'): string {
    // Si ya estamos en la misma moneda, solo formateamos sin convertir
    if (fromCurrency === toCurrency) return rawFormat(amount, toCurrency);
    const fromRate = rates[fromCurrency] || 1; // Tasa de la moneda origen
    const toRate = rates[toCurrency] || 1;     // Tasa de la moneda destino
    // Misma lógica de conversión via USD como moneda base intermedia
    const converted = Math.round((amount / fromRate) * toRate * 100) / 100;
    return rawFormat(converted, toCurrency); // Formateamos el resultado como string
  }

  return { rates, format }; // Solo expone rates y format (no necesita currency fija)
}
