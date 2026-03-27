'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { EmployeeScheduleEditor } from '@/components/staff/employee-schedule-editor';
import { EmployeeTimeOffEditor } from '@/components/staff/employee-time-off-editor';

export default function EmployeeSchedulePage() {
  const { user } = useAuth();

  if (!user?.employeeId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
          Tu cuenta no está vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi Horario</h1>

      <div className="space-y-8">
        <EmployeeScheduleEditor employeeId={user.employeeId} />
        <EmployeeTimeOffEditor employeeId={user.employeeId} isEmployeePortal={true} />
      </div>
    </div>
  );
}
