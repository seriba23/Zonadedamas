export function KpiCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-4 overflow-hidden"
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
        {subtitle && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}
