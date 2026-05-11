'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { QuickActions } from '@/components/dashboard/quick-actions';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col h-full">
      <Header title="Inicio" />

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Hola, {user?.firstName || 'Usuario'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.tenantName && <span className="font-medium text-[#008080]">{user.tenantName}</span>}
            {user?.tenantName && ' · '}
            {dayjs().format('dddd, D [de] MMMM [de] YYYY')}
          </p>
        </div>

        <QuickActions />
      </div>
    </div>
  );
}
