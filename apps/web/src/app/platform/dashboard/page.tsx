'use client';

import { useState, useEffect } from 'react';
import { platformApi } from '@/lib/platform-auth';

interface DashboardData {
  kpis: {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    pastDueTenants: number;
    newTenantsThisMonth: number;
    totalRevenue: number;
    revenueThisMonth: number;
  };
  subscriptionsByPlan: Array<{ plan: string; count: number }>;
  recentRegistrations: Array<{
    id: string;
    name: string;
    slug: string;
    email: string;
    businessType: string | null;
    createdAt: string;
    subscription: { plan: string; status: string } | null;
  }>;
}

const PLAN_LABELS: Record<string, string> = {
  BASICO: 'Básico',
  PLUS: 'Plus',
  PRO: 'Pro',
};

const STATUS_BADGES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

export default function PlatformDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformApi
      .get<{ data: DashboardData }>('/api/platform/dashboard')
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total negocios', value: data.kpis.totalTenants, color: 'text-gray-900' },
    { label: 'Activos', value: data.kpis.activeTenants, color: 'text-green-600' },
    { label: 'Pago pendiente', value: data.kpis.pastDueTenants, color: 'text-amber-600' },
    { label: 'Suspendidos', value: data.kpis.suspendedTenants, color: 'text-red-600' },
    { label: 'Nuevos este mes', value: data.kpis.newTenantsThisMonth, color: 'text-blue-600' },
    { label: 'Ingresos totales', value: `$${data.kpis.totalRevenue.toFixed(2)}`, color: 'text-gray-900' },
    { label: 'Ingresos este mes', value: `$${data.kpis.revenueThisMonth.toFixed(2)}`, color: 'text-green-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Plan distribution + Recent registrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribución por plan</h2>
          <div className="space-y-3">
            {data.subscriptionsByPlan.map((s) => (
              <div key={s.plan} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{PLAN_LABELS[s.plan] || s.plan}</span>
                <span className="text-sm font-semibold text-gray-900">{s.count} negocios</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Registros recientes</h2>
          <div className="space-y-3">
            {data.recentRegistrations.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.email}</p>
                </div>
                {t.subscription && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGES[t.subscription.status] || 'bg-gray-100 text-gray-700'}`}>
                    {PLAN_LABELS[t.subscription.plan] || t.subscription.plan}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
