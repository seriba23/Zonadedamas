'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import { SubscriptionBanner } from '@/components/subscription-banner';
import { useWebSocket, EmployeeJoinedEvent } from '@/lib/hooks/use-websocket';

function EmployeeJoinedNotification({
  employee,
  onDismiss,
}: {
  employee: EmployeeJoinedEvent;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right w-96 max-w-[calc(100vw-2rem)]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-[#008080] px-5 py-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <span className="text-white font-semibold text-sm">Nuevo empleado se ha unido</span>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-full bg-[#e0f2f1] flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-[#008080]">
                {employee.firstName[0]}{employee.lastName[0]}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{employee.firstName} {employee.lastName}</p>
              <p className="text-xs text-gray-500">{employee.email}</p>
            </div>
          </div>
          {employee.jobTitle && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">Puesto:</span>
              <span className="text-xs font-semibold text-[#008080] bg-teal-50 border border-teal-100 rounded-full px-2.5 py-0.5">{employee.jobTitle}</span>
            </div>
          )}
          <button
            onClick={onDismiss}
            className="w-full mt-3 py-2 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#008080' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006666')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008080')}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { notifications, dismissNotification } = useWebSocket();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Redirect to suspended page if subscription is suspended
  useEffect(() => {
    if (
      user?.subscriptionStatus === 'SUSPENDED' &&
      pathname !== '/suspended'
    ) {
      router.replace('/suspended');
    }
  }, [user?.subscriptionStatus, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 min-w-0">
        <SubscriptionBanner status={user?.subscriptionStatus || 'ACTIVE'} trialEndsAt={user?.trialEndsAt} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Real-time notifications */}
      {notifications.length > 0 && (
        <EmployeeJoinedNotification
          employee={notifications[0]}
          onDismiss={() => dismissNotification(notifications[0].id)}
        />
      )}
    </div>
  );
}
