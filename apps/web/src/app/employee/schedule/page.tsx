'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { EmployeeScheduleEditor } from '@/components/staff/employee-schedule-editor';

export default function EmployeeSchedulePage() {
  const { user } = useAuth();

  if (!user?.employeeId) {
    return (
      <div className="p-6">
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-teal-800 text-sm">
          Tu cuenta no está vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24 lg:pb-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Mi Horario</h1>
      <EmployeeScheduleEditor employeeId={user.employeeId} />
    </div>
  );
}
