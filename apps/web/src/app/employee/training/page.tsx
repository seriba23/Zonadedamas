'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { EmployeeTraining } from '@/components/staff/employee-training';

export default function EmployeeTrainingPage() {
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Formación</h1>
      <EmployeeTraining employeeId={user.employeeId} canEdit={true} />
    </div>
  );
}
