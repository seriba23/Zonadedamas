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

  // Citas de hoy para contar por empleado.
  const todayStart = dayjs().startOf('day').toISOString();
  const todayEnd = dayjs().endOf('day').toISOString();
  const { data: aptsData } = useQuery({
    queryKey: ['employees-today-appointments', todayStart, todayEnd],
    queryFn: () => api.get<{ data: Array<{ employeeId: string }> }>(
      `/api/appointments?startDate=${todayStart}&endDate=${todayEnd}&perPage=200`,
    ),
    staleTime: 60 * 1000,
  });

  const countsByEmployee = (aptsData?.data || []).reduce<Record<string, number>>((acc, a) => {
    acc[a.employeeId] = (acc[a.employeeId] || 0) + 1;
    return acc;
  }, {});

  const todayDow = dayjs().day();
  const employees = (data?.data || []).filter((e: any) => {
    if (!e.isActive) return false;
    if (!e.schedules || e.schedules.length === 0) return false;
    return e.schedules.some((s: any) => s.isWorking && DAY_MAP[s.dayOfWeek] === todayDow);
  });

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
        Trabajan hoy <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({employees.length})</span>
      </h2>

      {employees.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
          No hay empleados programados hoy
        </p>
      ) : (
        <ul className="space-y-2">
          {employees.map((emp: any) => {
            const count = countsByEmployee[emp.id] || 0;
            return (
              <li key={emp.id}>
                <Link href={`/staff/${emp.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
                  <div
                    className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                    style={{ backgroundColor: emp.color || '#008080' }}
                  >
                    {emp.avatarUrl ? (
                      <img src={emp.avatarUrl.startsWith('http') ? emp.avatarUrl : `${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(emp.firstName, emp.lastName)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {emp.jobTitle || 'Empleado'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold" style={{ color: count > 0 ? '#008080' : 'var(--text-muted)' }}>
                      {count}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      {count === 1 ? 'cita' : 'citas'}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
