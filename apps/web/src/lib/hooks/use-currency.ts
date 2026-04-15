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

export function useCurrency() {
  const { user } = useAuth();
  const tenantCurrency = (user as any)?.tenantCurrency || 'USD';

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

  const rates = data?.rates || {};
  const rateDate = data?.date || '';

  function convert(amount: number, fromCurrency = 'USD'): number {
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

  const rates = data?.rates || {};

  // Default to USD, marketplace pages can override with user preference
  function format(amount: number, fromCurrency = 'USD', toCurrency = 'USD'): string {
    if (fromCurrency === toCurrency) return rawFormat(amount, toCurrency);
    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[toCurrency] || 1;
    const converted = Math.round((amount / fromRate) * toRate * 100) / 100;
    return rawFormat(converted, toCurrency);
  }

  return { rates, format };
}
