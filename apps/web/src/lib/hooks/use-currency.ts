'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { formatCurrency as rawFormat } from '../utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  date: string;
}

// Fallback usado mientras se cargan las tasas reales del backend. Evita que el
// frontend muestre valores sin convertir (p.ej. "MXN 40" cuando el dato esta
// en USD). Se sincroniza con el fallback en exchange-rates.service.ts.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  MXN: 17.5,
  DOP: 58.5,
  EUR: 0.92,
  COP: 4200,
  ARS: 900,
  CLP: 950,
  PEN: 3.75,
  BRL: 5.1,
};

export function useCurrency() {
  const { user } = useAuth();
  const tenantCurrency = (user as any)?.tenantCurrency || 'MXN';

  const { data } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/exchange-rates`);
      const json = await res.json();
      return json.data as ExchangeRates;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
  });

  // Si la query todavia no termino, usa el fallback hardcoded para que
  // formatCurrency(40, 'USD') siempre devuelva un valor convertido decente
  // en lugar de mostrar 40 como si estuviera en la moneda del tenant.
  const rates = data?.rates ?? FALLBACK_RATES;
  const rateDate = data?.date || '';

  function convert(amount: number, fromCurrency = 'MXN'): number {
    if (fromCurrency === tenantCurrency) return amount;
    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[tenantCurrency] || 1;
    return Math.round((amount / fromRate) * toRate * 100) / 100;
  }

  function format(amount: number, fromCurrency?: string): string {
    const from = fromCurrency || tenantCurrency;
    const converted = convert(amount, from);
    return rawFormat(converted, tenantCurrency);
  }

  return {
    currency: tenantCurrency,
    rates,
    rateDate,
    convert,
    format,
  };
}

// Marketplace version - reads from marketplace user preference
export function useMarketplaceCurrency() {
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

  const rates = data?.rates ?? FALLBACK_RATES;

  // Default a MXN, paginas marketplace pueden overridear con preferencia del user.
  function format(amount: number, fromCurrency = 'MXN', toCurrency = 'MXN'): string {
    if (fromCurrency === toCurrency) return rawFormat(amount, toCurrency);
    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[toCurrency] || 1;
    const converted = Math.round((amount / fromRate) * toRate * 100) / 100;
    return rawFormat(converted, toCurrency);
  }

  return { rates, format };
}
