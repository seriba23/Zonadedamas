'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { EmployeeScheduleEditor } from '@/components/staff/employee-schedule-editor';
import { getInitials } from '@/lib/utils';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  color?: string;
  avatarUrl?: string | null;
  isActive: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function EmployeeHoursPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<{ data: Employee[] }>('/api/employees'),
  });

  const employees = (data?.data || []).filter((e) => e.isActive);

  return (
    <div className="flex flex-col h-full">
      <Header title="Horarios de Empleados" />

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <p className="text-sm text-gray-500 mb-6">
          Configura el horario laboral de cada empleado.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No hay empleados activos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((employee) => {
              const empColor = employee.color || '#008080';
              const rgb = hexToRgb(empColor);
              const bgStyle = rgb
                ? { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`, color: empColor }
                : { backgroundColor: 'rgba(0, 128, 128, 0.15)', color: '#008080' };
              const isExpanded = expandedId === employee.id;

              return (
                <div
                  key={employee.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : employee.id)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                  >
                    {employee.avatarUrl ? (
                      <img
                        src={
                          employee.avatarUrl.startsWith('http')
                            ? employee.avatarUrl
                            : `${API_URL}${employee.avatarUrl}`
                        }
                        alt={`${employee.firstName} ${employee.lastName}`}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={bgStyle}
                      >
                        {getInitials(employee.firstName, employee.lastName)}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </p>
                    </div>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: empColor }}
                    />
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4">
                      <EmployeeScheduleEditor employeeId={employee.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
