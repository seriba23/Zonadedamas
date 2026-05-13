'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Welcome */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Hola, {user?.firstName || 'Usuario'}
          </h1>
          <p className="text-xs md:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {user?.tenantName && <span className="font-medium text-primary-600">{user.tenantName}</span>}
            {user?.tenantName && ' · '}
            {dayjs().format('dddd, D [de] MMMM [de] YYYY')}
          </p>
        </div>

        <DashboardView />
      </div>
    </div>
  );
}
