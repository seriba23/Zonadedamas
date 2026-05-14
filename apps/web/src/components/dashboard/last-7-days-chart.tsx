'use client';

import dayjs from 'dayjs';
import { useCurrency } from '@/lib/hooks/use-currency';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function Last7DaysChart({ days }: { days: { date: string; revenue: number }[] }) {
  const { format: formatCurrency } = useCurrency();
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  const total = days.reduce((s, d) => s + d.revenue, 0);

  // Compara primera mitad vs segunda mitad para sacar tendencia.
  const half = Math.floor(days.length / 2);
  const firstHalf = days.slice(0, half).reduce((s, d) => s + d.revenue, 0);
  const secondHalf = days.slice(half).reduce((s, d) => s + d.revenue, 0);
  const trend = firstHalf === 0
    ? (secondHalf > 0 ? 100 : 0)
    : Math.round(((secondHalf - firstHalf) / firstHalf) * 100);

  // SVG sparkline con gradiente teal.
  const pad = 8;
  const W = 100;
  const H = 30;
  const xs = days.map((_, i) => pad + (i * (W - pad * 2)) / Math.max(days.length - 1, 1));
  const ys = days.map((d) => H - pad - ((d.revenue / maxRevenue) * (H - pad * 2)));
  const pathD = days.length > 0
    ? `M ${xs[0]} ${ys[0]} ` + days.slice(1).map((_, i) => `L ${xs[i + 1]} ${ys[i + 1]}`).join(' ')
    : '';
  const areaD = pathD ? `${pathD} L ${xs[xs.length - 1]} ${H} L ${xs[0]} ${H} Z` : '';

  return (
    <div
      className="rounded-xl p-5 overflow-hidden min-w-0"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between mb-3 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
            Ingresos · últimos 7 días
          </p>
          <p className="text-2xl font-extrabold mt-1 truncate" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(total)}
          </p>
          {trend !== 0 && (
            <p className={`text-xs font-semibold mt-0.5 truncate ${trend > 0 ? 'text-success-700' : 'text-danger-700'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs inicio de semana
            </p>
          )}
        </div>
      </div>

      {/* Sparkline */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 -mb-2" preserveAspectRatio="none">
        <defs>
          <linearGradient id="last7-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#008080" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#008080" stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaD && <path d={areaD} fill="url(#last7-gradient)" />}
        {pathD && <path d={pathD} fill="none" stroke="#008080" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>

      {/* Barras compactas con tooltip on hover */}
      <div className="flex items-end justify-between gap-1 h-28 mt-2">
        {days.map((day) => {
          const pct = (day.revenue / maxRevenue) * 100;
          const dayLabel = DAY_LABELS[dayjs(day.date).day()];
          return (
            <div key={day.date} className="flex-1 min-w-0 flex flex-col items-center group relative">
              {/* Tooltip absolute: no afecta el ancho de la columna */}
              <span
                className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none px-1.5 py-0.5 rounded shadow-sm z-10 border"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                {formatCurrency(day.revenue)}
              </span>
              <div className="w-full flex items-end" style={{ height: '76px' }}>
                <div
                  className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    backgroundColor: day.revenue > 0 ? '#008080' : 'var(--border)',
                    opacity: day.revenue > 0 ? 0.85 : 1,
                  }}
                />
              </div>
              <span className="text-[11px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>{dayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
