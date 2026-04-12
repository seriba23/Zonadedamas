'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import dayjs from 'dayjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DAY_MAP: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 0,
};

export function EmployeesToday() {
  const { data } = useQuery({
    queryKey: ['employees-count'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
    staleTime: 5 * 60 * 1000,
  });

  const todayDow = dayjs().day();
  const employees = (data?.data || []).filter((e: any) => {
    if (!e.isActive) return false;
    if (!e.schedules || e.schedules.length === 0) return false;
    return e.schedules.some((s: any) => s.isWorking && DAY_MAP[s.dayOfWeek] === todayDow);
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">
        Trabajan hoy <span className="text-gray-400 font-normal">({employees.length})</span>
      </h2>

      {employees.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No hay empleados programados hoy</p>
      ) : (
        <ul className="space-y-2">
          {employees.map((emp: any) => (
            <li key={emp.id}>
              <Link href={`/staff/${emp.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                  style={{ backgroundColor: emp.color || '#008080' }}
                >
                  {emp.avatarUrl ? (
                    <img src={emp.avatarUrl.startsWith('http') ? emp.avatarUrl : `${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(emp.firstName, emp.lastName)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{emp.jobTitle || 'Empleado'}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
