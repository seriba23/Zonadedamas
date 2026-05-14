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
      className={`rounded-xl p-5 flex items-center gap-4 overflow-hidden ${interactive ? 'cursor-pointer transition-colors hover:bg-[var(--bg-muted)]' : ''}`}
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: 'var(--primary-tint)', color: 'var(--primary-tint-fg)' }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        <p className="text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {trend && (
          <p
            className={`text-xs font-semibold truncate ${trendPositive ? 'text-success-700' : trendNegative ? 'text-danger-700' : ''}`}
            style={!trendPositive && !trendNegative ? { color: 'var(--text-muted)' } : undefined}
          >
            {trend}
          </p>
        )}
        {!trend && subtitle && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}
