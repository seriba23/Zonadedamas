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
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-[#e0f2f1] text-[#008080]">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}
