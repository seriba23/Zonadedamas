'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';

interface SalesBreakdown {
  total: number;
  services: number;
  bundles: number;
  products: number;
}

/**
 * Grid "Venta Total" — 4 cards: Total | Servicios | Paquetes | Productos.
 *
 * Usado en /reports, /home y /pos history. El rango lo controla el padre y
 * se pasa por props para reutilizar el mismo endpoint con el período activo
 * en cada vista (selector de Reports, mes en Home, filtro POS).
 */
export function SalesBreakdownGrid({
  startDate,
  endDate,
  periodLabel,
}: {
  startDate: string;
  endDate: string;
  /** Texto pequeño en el card Total (ej: "Este mes", "Hoy"). */
  periodLabel?: string;
}) {
  const { format: formatCurrency } = useCurrency();

  const { data, isLoading } = useQuery({
    queryKey: ['sales-breakdown', startDate, endDate],
    queryFn: () =>
      api.get<{ data: SalesBreakdown }>(
        `/api/reports/sales-breakdown?startDate=${startDate}&endDate=${endDate}`,
      ),
  });

  const breakdown = data?.data ?? { total: 0, services: 0, bundles: 0, products: 0 };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* Card destacado — Venta Total */}
      <div
        className="rounded-xl p-3 md:p-5 overflow-hidden text-white"
        style={{ backgroundColor: '#008080' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 md:w-4.5 md:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[10px] md:text-[11px] uppercase tracking-wide font-semibold opacity-90 truncate">
            Venta Total
          </p>
        </div>
        <p className="text-lg md:text-2xl font-extrabold leading-tight tabular-nums break-words" style={{ letterSpacing: '-0.015em' }}>
          {isLoading ? <span className="inline-block h-6 w-24 bg-white/20 rounded animate-pulse" /> : formatCurrency(breakdown.total)}
        </p>
        {periodLabel && (
          <p className="text-[10px] md:text-[11px] mt-1 opacity-80 truncate">{periodLabel}</p>
        )}
      </div>

      <BreakdownCell
        label="Servicios"
        value={breakdown.services}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
        iconPath="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
        iconExtra="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <BreakdownCell
        label="Paquetes"
        value={breakdown.bundles}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
        iconPath="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
      <BreakdownCell
        label="Productos"
        value={breakdown.products}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
        iconPath="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </div>
  );
}

function BreakdownCell({
  label,
  value,
  isLoading,
  formatCurrency,
  iconPath,
  iconExtra,
}: {
  label: string;
  value: number;
  isLoading: boolean;
  formatCurrency: (n: number) => string;
  iconPath: string;
  iconExtra?: string;
}) {
  return (
    <div
      className="rounded-xl p-3 md:p-5 overflow-hidden"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--primary-tint)', color: 'var(--primary-tint-fg)' }}
        >
          <svg className="w-4 h-4 md:w-4.5 md:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
            {iconExtra && <path strokeLinecap="round" strokeLinejoin="round" d={iconExtra} />}
          </svg>
        </div>
        <p className="text-[10px] md:text-[11px] uppercase tracking-wide font-semibold truncate" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>
      <p className="text-base md:text-xl font-extrabold leading-tight tabular-nums break-words" style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>
        {isLoading ? <span className="inline-block h-6 w-20 bg-[var(--border)] rounded animate-pulse" /> : formatCurrency(value)}
      </p>
    </div>
  );
}
