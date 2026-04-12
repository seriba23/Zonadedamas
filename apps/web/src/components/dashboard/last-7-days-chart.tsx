import dayjs from 'dayjs';
import { formatCurrency } from '@/lib/utils';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function Last7DaysChart({ days }: { days: { date: string; revenue: number }[] }) {
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">
        Ingresos - Últimos 7 días
      </h2>
      <div className="flex items-end justify-between gap-2 h-44">
        {days.map((day) => {
          const pct = (day.revenue / maxRevenue) * 100;
          const dayLabel = DAY_LABELS[dayjs(day.date).day()];
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
              <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {formatCurrency(day.revenue)}
              </span>
              <div className="w-full flex items-end" style={{ height: '130px' }}>
                <div
                  className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    backgroundColor: day.revenue > 0 ? '#008080' : '#e5e7eb',
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 font-medium">{dayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
