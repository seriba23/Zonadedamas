'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/lib/hooks/use-auth';
import { formatCurrency } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const CURRENCIES = [
  { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', flag: '🇺🇸' },
  { code: 'MXN', name: 'Peso mexicano', symbol: 'MX$', flag: '🇲🇽' },
  { code: 'DOP', name: 'Peso dominicano', symbol: 'RD$', flag: '🇩🇴' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'COP', name: 'Peso colombiano', symbol: 'CO$', flag: '🇨🇴' },
  { code: 'ARS', name: 'Peso argentino', symbol: 'AR$', flag: '🇦🇷' },
  { code: 'CLP', name: 'Peso chileno', symbol: 'CL$', flag: '🇨🇱' },
  { code: 'PEN', name: 'Sol peruano', symbol: 'S/', flag: '🇵🇪' },
  { code: 'BRL', name: 'Real brasileño', symbol: 'R$', flag: '🇧🇷' },
];

export default function CurrencySettingsPage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentCurrency = selected || (user as any)?.tenantCurrency || 'USD';

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/exchange-rates`);
      const json = await res.json();
      return json.data;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const rates = ratesData?.rates || {};
  const rateDate = ratesData?.date || '';

  const saveMutation = useMutation({
    mutationFn: () => api.put('/api/tenants/profile', { currency: selected }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-current'] });
      if (refreshUser) refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const hasChanges = selected !== null && selected !== ((user as any)?.tenantCurrency || 'USD');

  return (
    <div className="flex flex-col h-full">
      <Header title="Moneda" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900">Moneda del negocio</h2>
            <p className="text-sm text-gray-500 mt-1">
              Todos los precios, reportes y comisiones se mostrarán en esta moneda.
              Si un servicio o producto tiene un precio en otra moneda, se convertirá automáticamente al tipo de cambio del día.
            </p>
          </div>

          {/* Currency grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {CURRENCIES.map((c) => {
              const isSelected = currentCurrency === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => setSelected(c.code)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-[#008080] bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{c.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isSelected ? 'text-[#008080]' : 'text-gray-900'}`}>
                      {c.code}
                    </p>
                    <p className="text-xs text-gray-500">{c.name}</p>
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-[#008080]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Exchange rates preview */}
          {Object.keys(rates).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Tipo de cambio del día</h3>
                {rateDate && <p className="text-xs text-gray-400">{rateDate}</p>}
              </div>
              <div className="divide-y divide-gray-50">
                {CURRENCIES.filter((c) => c.code !== currentCurrency).map((c) => {
                  const fromRate = rates[c.code] || 1;
                  const toRate = rates[currentCurrency] || 1;
                  const converted = Math.round((100 / fromRate) * toRate * 100) / 100;
                  return (
                    <div key={c.code} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-sm text-gray-600">
                        {c.flag} 100 {c.code}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        = {formatCurrency(converted, currentCurrency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save bar */}
          {hasChanges && (
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="text-sm font-medium text-white px-5 py-2.5 rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#008080' }}
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          )}

          {saved && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 font-medium text-center">
              Moneda actualizada. Los precios ahora se mostrarán en {CURRENCIES.find((c) => c.code === currentCurrency)?.name}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
