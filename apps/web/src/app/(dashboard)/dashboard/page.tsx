'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useSetupStatus } from '@/lib/hooks/use-setup-status';
import { SetupWizard } from '@/components/dashboard/setup-wizard';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export default function DashboardPage() {
  const { user } = useAuth();
  const { isSetupComplete, isLoading } = useSetupStatus();

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-64 bg-gray-100 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 h-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 h-64" />
          <div className="rounded-xl border border-gray-200 bg-white p-5 h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user?.firstName || 'Usuario'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {dayjs().format('dddd, D [de] MMMM [de] YYYY')}
        </p>
      </div>

      {isSetupComplete ? <DashboardView /> : <SetupWizard />}
    </div>
  );
}
