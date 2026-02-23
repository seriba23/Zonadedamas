'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { EmployeePersonalInfo } from '@/components/staff/employee-personal-info';
import { PortfolioGallery } from '@/components/staff/portfolio-gallery';

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

type Tab = 'info' | 'portfolio';

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('info');

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi Perfil</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {([
            { key: 'info' as Tab, label: 'Info Personal' },
            { key: 'portfolio' as Tab, label: 'Portfolio' },
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
            avatarUrl: employee.avatarUrl,
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
    </div>
  );
}
