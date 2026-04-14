import { Injectable, Logger } from '@nestjs/common';

export interface ExchangeRateCache {
  base: string;
  rates: Record<string, number>;
  date: string;
  fetchedAt: number;
}

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private cache: ExchangeRateCache | null = null;
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly API_URL = 'https://open.er-api.com/v6/latest/USD';

  async getRates(): Promise<ExchangeRateCache> {
    if (this.cache && Date.now() - this.cache.fetchedAt < this.TTL) {
      return this.cache;
    }

    try {
      const res = await fetch(this.API_URL);
      const data = await res.json();

      if (data.result === 'success') {
        this.cache = {
          base: 'USD',
          rates: data.rates,
          date: data.time_last_update_utc?.split(' 00:')[0] || new Date().toISOString().split('T')[0],
          fetchedAt: Date.now(),
        };
        this.logger.log(`Exchange rates updated: ${Object.keys(data.rates).length} currencies`);
        return this.cache;
      }

      this.logger.warn('Exchange rate API returned non-success result');
    } catch (err) {
      this.logger.error('Failed to fetch exchange rates', err);
    }

    // Return fallback if API fails
    if (this.cache) return this.cache;

    return {
      base: 'USD',
      rates: { USD: 1, MXN: 17.5, DOP: 58.5, EUR: 0.92, COP: 4200, ARS: 900, CLP: 950, PEN: 3.75, BRL: 5.1 },
      date: new Date().toISOString().split('T')[0],
      fetchedAt: Date.now(),
    };
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    const { rates } = await this.getRates();
    const fromRate = rates[from] || 1;
    const toRate = rates[to] || 1;
    // Convert: amount in 'from' → USD → 'to'
    return Math.round((amount / fromRate) * toRate * 100) / 100;
  }
}
