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
      className="rounded-xl p-5 flex items-center gap-4"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-primary-50 text-primary-600">
        {icon}
      </div>
      <div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {subtitle && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}
