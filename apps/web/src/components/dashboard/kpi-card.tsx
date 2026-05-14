export function KpiCard({
  icon,
  label,
  value,
  subtitle,
  trend,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  /** Texto pequeño tipo "+18% vs mes anterior". Positivo si empieza con "+", negativo con "-". */
  trend?: string;
  onClick?: () => void;
}) {
  const trendPositive = trend?.trim().startsWith('+');
  const trendNegative = trend?.trim().startsWith('-');
  const interactive = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-3 md:p-5 flex items-start gap-2.5 md:gap-3 overflow-hidden ${interactive ? 'cursor-pointer transition-colors hover:bg-[var(--bg-muted)]' : ''}`}
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: 'var(--primary-tint)', color: 'var(--primary-tint-fg)' }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[10px] md:text-[11px] uppercase tracking-wide font-semibold truncate"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </p>
        <p
          className="text-base md:text-xl font-extrabold leading-tight mt-0.5 tabular-nums break-words"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}
        >
          {value}
        </p>
        {trend && (
          <p
            className={`text-[11px] font-semibold mt-1 truncate ${trendPositive ? 'text-success-700' : trendNegative ? 'text-danger-700' : ''}`}
            style={!trendPositive && !trendNegative ? { color: 'var(--text-muted)' } : undefined}
          >
            {trend}
          </p>
        )}
        {!trend && subtitle && (
          <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
