'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { EmployeePersonalInfo } from '@/components/staff/employee-personal-info';
import { PortfolioGallery } from '@/components/staff/portfolio-gallery';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  color: string;
  bio: string;
  avatarUrl: string | null;
  bloodType: string | null;
  emergencyContactName: string | null;
  emergencyContactLastName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  allergies: string | null;
}

interface Stats {
  completedAllTime: number;
  completedThisMonth: number;
  cancellationRate: number;
  totalRevenue: number;
  averageRating: number | null;
  totalReviews: number;
  topServices: { serviceName: string; count: number }[];
}

type Tab = 'info' | 'portfolio' | 'stats';

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [avatarSuccess, setAvatarSuccess] = useState('');

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee-profile', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: Employee }>(
        `/api/employees/${user!.employeeId}`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  const { data: stats } = useQuery({
    queryKey: ['employee-profile-stats', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: Stats }>(
        `/api/employees/${user!.employeeId}/stats`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId && activeTab === 'stats',
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<{ data: { avatarUrl: string } }>(
        `/api/employees/${user!.employeeId}/avatar`,
        formData,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
      setAvatarSuccess('Foto actualizada');
      setTimeout(() => setAvatarSuccess(''), 3000);
    },
  });

  if (!user?.employeeId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
          Tu cuenta no está vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    );
  }

  const avatarBg = employee?.color
    ? { backgroundColor: employee.color + '22', color: employee.color }
    : { backgroundColor: '#00808022', color: '#008080' };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Profile hero */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-5">
          {/* Avatar with upload */}
          <label className="relative group cursor-pointer flex-shrink-0">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden"
              style={avatarBg}
            >
              {employee?.avatarUrl ? (
                <img
                  src={`${API_URL}${employee.avatarUrl}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <>{employee?.firstName?.[0]}{employee?.lastName?.[0]}</>
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarMutation.isPending ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
              )}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) avatarMutation.mutate(file);
                e.target.value = '';
              }}
            />
          </label>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {employee?.firstName} {employee?.lastName}
            </h1>
            {employee?.bio && (
              <p className="text-sm text-gray-500 mt-1">{employee.bio}</p>
            )}
            {avatarSuccess && (
              <p className="text-xs text-green-600 mt-1">{avatarSuccess}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {([
            { key: 'info' as Tab, label: 'Info Personal' },
            { key: 'portfolio' as Tab, label: 'Portfolio' },
            { key: 'stats' as Tab, label: 'Estadísticas' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'info' && (
        <EmployeePersonalInfo
          employeeId={user.employeeId}
          initialData={employee ? {
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email || '',
            phone: employee.phone || '',
            color: employee.color,
            bio: employee.bio || '',
            bloodType: employee.bloodType,
            emergencyContactName: employee.emergencyContactName,
            emergencyContactLastName: employee.emergencyContactLastName,
            emergencyContactPhone: employee.emergencyContactPhone,
            emergencyContactRelation: employee.emergencyContactRelation,
            allergies: employee.allergies,
          } : undefined}
          canEdit={true}
        />
      )}

      {activeTab === 'portfolio' && (
        <PortfolioGallery
          employeeId={user.employeeId}
          canEdit={true}
        />
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          {!stats ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
            </div>
          ) : (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Total completadas</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.completedAllTime}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Este mes</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.completedThisMonth}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Ingresos generados</p>
                  <p className="text-2xl font-bold text-primary-700">
                    {formatCurrency(stats.totalRevenue)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Valoración</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold text-amber-500">
                      {stats.averageRating ?? '-'}
                    </p>
                    {stats.averageRating && (
                      <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{stats.totalReviews} reseñas</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Tasa de cancelación</p>
                  <p className={`text-3xl font-bold ${stats.cancellationRate > 20 ? 'text-red-500' : stats.cancellationRate > 10 ? 'text-amber-500' : 'text-green-600'}`}>
                    {stats.cancellationRate}%
                  </p>
                </div>
              </div>

              {/* Top services */}
              {stats.topServices.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Servicios más realizados</h3>
                  <div className="space-y-3">
                    {stats.topServices.map((s, i) => {
                      const maxCount = stats.topServices[0].count;
                      const pct = Math.round((s.count / maxCount) * 100);
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-700">{s.serviceName}</span>
                            <span className="font-medium text-gray-900">{s.count}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-primary-500 h-2 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
