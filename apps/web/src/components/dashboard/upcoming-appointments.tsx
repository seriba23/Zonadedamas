import Link from 'next/link';
import dayjs from 'dayjs';
import { formatCurrency } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UpcomingAppointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  client: { firstName: string; lastName: string };
  employee: { id: string; firstName: string; lastName: string; color: string; avatarUrl: string | null };
  items: { serviceNameSnapshot: string; priceSnapshot: number }[];
}

function statusLabel(status: string) {
  const map: Record<string, { text: string; className: string }> = {
    CONFIRMED: { text: 'Confirmada', className: 'bg-green-100 text-green-700' },
    PENDING: { text: 'Pendiente', className: 'bg-yellow-100 text-yellow-700' },
    IN_PROGRESS: { text: 'En curso', className: 'bg-blue-100 text-blue-700' },
    COMPLETED: { text: 'Completada', className: 'bg-gray-100 text-gray-600' },
    CANCELLED: { text: 'Cancelada', className: 'bg-red-100 text-red-600' },
    NO_SHOW: { text: 'Ausente', className: 'bg-red-100 text-red-600' },
  };
  return map[status] || { text: status, className: 'bg-gray-100 text-gray-600' };
}

export function UpcomingAppointments({ appointments }: { appointments: UpcomingAppointment[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Próximas citas</h2>
        <Link href="/calendar" className="text-xs text-[#008080] hover:text-[#006666] font-medium">
          Ver todas
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No hay citas próximas</p>
        </div>
      ) : (
        <ul className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
          {appointments.map((apt) => {
            const totalPrice = apt.items.reduce((sum, i) => sum + i.priceSnapshot, 0);
            const services = apt.items.map((i) => i.serviceNameSnapshot).join(', ');
            const status = statusLabel(apt.status);

            return (
              <li key={apt.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex-shrink-0 text-center min-w-[52px]">
                  <p className="text-sm font-semibold text-[#008080]">{dayjs(apt.startTime).format('h:mm A')}</p>
                  <p className="text-[10px] text-gray-400">{dayjs(apt.endTime).format('h:mm A')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{apt.client.firstName} {apt.client.lastName}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.className}`}>{status.text}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{services}</p>
                  <Link href={`/staff/${apt.employee.id}`} className="flex items-center gap-1.5 mt-1 group w-fit">
                    <div
                      className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: apt.employee.color || '#008080' }}
                    >
                      {apt.employee.avatarUrl
                        ? <img src={apt.employee.avatarUrl.startsWith('http') ? apt.employee.avatarUrl : `${API_URL}${apt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                        : <span>{apt.employee.firstName[0]}{apt.employee.lastName[0]}</span>
                      }
                    </div>
                    <span className="text-xs text-gray-500 group-hover:underline">{apt.employee.firstName} {apt.employee.lastName}</span>
                  </Link>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(totalPrice)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
