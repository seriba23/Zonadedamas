'use client';

import { useState } from 'react';
import { EmployeePersonalInfo } from './employee-personal-info';
import { EmployeeServicesEditor } from './employee-services-editor';
import { EmployeePermissions } from './employee-permissions';

interface InitialData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  color?: string;
  bio?: string | null;
  bloodType?: string | null;
  emergencyContactName?: string | null;
  emergencyContactLastName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  allergies?: string | null;
}

interface EmployeeEditDrawerProps {
  employeeId: string;
  initialData: InitialData;
  canEdit: boolean;
  canManagePermissions: boolean;
  onClose: () => void;
}

type SubTab = 'info' | 'servicios' | 'permisos';

// EmployeePersonalInfo declara los campos como `string | undefined`.
// Nuestro InitialData los pasa como `string | null | undefined` porque
// vienen directo del backend. Convierto null -> undefined para que TS no
// proteste y el componente no reciba un null inesperado.
function nullsToUndefined(data: InitialData): {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  color?: string;
  bio?: string;
  bloodType?: string;
  emergencyContactName?: string;
  emergencyContactLastName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  allergies?: string;
} {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    color: data.color,
    bio: data.bio ?? undefined,
    bloodType: data.bloodType ?? undefined,
    emergencyContactName: data.emergencyContactName ?? undefined,
    emergencyContactLastName: data.emergencyContactLastName ?? undefined,
    emergencyContactPhone: data.emergencyContactPhone ?? undefined,
    emergencyContactRelation: data.emergencyContactRelation ?? undefined,
    allergies: data.allergies ?? undefined,
  };
}

export function EmployeeEditDrawer({
  employeeId,
  initialData,
  canEdit,
  canManagePermissions,
  onClose,
}: EmployeeEditDrawerProps) {
  const [tab, setTab] = useState<SubTab>('info');

  const tabs: { key: SubTab; label: string; visible: boolean }[] = [
    { key: 'info', label: 'Información', visible: true },
    { key: 'servicios', label: 'Servicios', visible: canEdit },
    { key: 'permisos', label: 'Permisos', visible: canManagePermissions },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-3xl md:rounded-2xl md:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Editar perfil</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-tabs (solo si hay mas de uno) */}
        {visibleTabs.length > 1 && (
          <div className="px-4 pt-3 flex-shrink-0">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {visibleTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-[#008080] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'info' && (
            <EmployeePersonalInfo
              employeeId={employeeId}
              initialData={nullsToUndefined(initialData)}
              canEdit={canEdit}
            />
          )}
          {tab === 'servicios' && canEdit && (
            <EmployeeServicesEditor employeeId={employeeId} />
          )}
          {tab === 'permisos' && canManagePermissions && (
            <EmployeePermissions
              employeeId={employeeId}
              canManage={canManagePermissions}
            />
          )}
        </div>
      </div>
    </div>
  );
}
