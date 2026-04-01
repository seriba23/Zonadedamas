'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { getInitials } from '@/lib/utils';
import { StarRating } from '@/components/staff/star-rating';
import Link from 'next/link';

interface EmployeeService {
  employeeId: string;
  serviceId: string;
  service: { id: string; name: string };
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  color?: string;
  bio?: string;
  avatarUrl?: string | null;
  locationId?: string;
  location?: { name: string };
  employeeServices?: EmployeeService[];
  services?: Array<{ id: string; name: string }>;
  _count?: { appointments: number };
  averageRating?: number | null;
  totalReviews?: number;
  isActive: boolean;
}

interface EmployeeForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  color: string;
  bio: string;
}

const COLOR_PALETTE = [
  '#008080', // Teal (default)
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#14b8a6', // Teal light
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

const defaultForm: EmployeeForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  color: '#008080',
  bio: '',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

export default function StaffPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', showInactive],
    queryFn: () =>
      api.get<{ data: Employee[] }>(
        `/api/employees?perPage=100${showInactive ? '&includeInactive=true' : ''}`,
      ),
  });

  // Map employeeServices → services for display
  const employees = useMemo(() => {
    const raw = data?.data || [];
    return raw.map((emp) => ({
      ...emp,
      services: emp.employeeServices
        ? emp.employeeServices.map((es) => es.service)
        : emp.services || [],
    }));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<EmployeeForm>) => {
      return api.post('/api/employees', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-calendar'] });
      closeModal();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al guardar el empleado');
    },
  });

  function openCreate() {
    setForm(defaultForm);
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setForm(defaultForm);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Nombre y apellido son requeridos');
      return;
    }
    saveMutation.mutate(form);
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Personal" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-500">
              {employees.length} empleado{employees.length !== 1 ? 's' : ''}
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setShowInactive((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                  showInactive ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    showInactive ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-500">Mostrar inactivos</span>
            </label>
          </div>
          {hasPermission('employees.create') && (
            <Link href="/settings/invite-codes" className="btn-primary">
              + Nuevo Empleado
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gray-200" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-3 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No hay empleados registrados</p>
            {hasPermission('employees.create') && (
              <button onClick={openCreate} className="btn-primary">
                Agregar primer empleado
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => {
              const empColor = employee.color || '#008080';
              const rgb = hexToRgb(empColor);
              const bgStyle = rgb
                ? { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`, color: empColor }
                : { backgroundColor: 'rgba(0, 128, 128, 0.15)', color: '#008080' };
              const appointmentCount = employee._count?.appointments ?? 0;

              return (
                <Link
                  key={employee.id}
                  href={`/staff/${employee.id}`}
                  className={`block rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow border-l-4 cursor-pointer ${
                    employee.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
                  }`}
                  style={{ borderLeftColor: employee.isActive ? empColor : '#9ca3af' }}
                >
                  <div className="flex items-start">
                    <div className="flex items-center gap-4">
                      {employee.avatarUrl ? (
                        <img
                          src={
                            employee.avatarUrl.startsWith('http')
                              ? employee.avatarUrl
                              : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${employee.avatarUrl}`
                          }
                          alt={`${employee.firstName} ${employee.lastName}`}
                          className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                          style={bgStyle}
                        >
                          {getInitials(employee.firstName, employee.lastName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-900 hover:text-primary-600 transition-colors">
                          {employee.firstName} {employee.lastName}
                        </span>
                        {employee.email && (
                          <p className="text-sm text-gray-500 truncate">{employee.email}</p>
                        )}
                        {employee.phone && (
                          <p className="text-xs text-gray-400 mt-0.5">{employee.phone}</p>
                        )}
                        {employee.location && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {employee.location.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {appointmentCount} cita{appointmentCount !== 1 ? 's' : ''}
                    </span>
                    {employee.services && employee.services.length > 0 && (
                      <span>{employee.services.length} servicio{employee.services.length !== 1 ? 's' : ''}</span>
                    )}
                    {employee.averageRating != null && (
                      <span className="flex items-center gap-1">
                        <StarRating rating={employee.averageRating} size="sm" />
                        <span className="font-medium text-gray-700">{employee.averageRating}</span>
                      </span>
                    )}
                  </div>

                  {/* Bio preview */}
                  {employee.bio && (
                    <p className="mt-2 text-xs text-gray-500 line-clamp-2">
                      {employee.bio}
                    </p>
                  )}

                  {employee.services && employee.services.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex flex-wrap gap-1">
                        {employee.services.slice(0, 3).map((s) => (
                          <span
                            key={s.id}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                          >
                            {s.name}
                          </span>
                        ))}
                        {employee.services.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{employee.services.length - 3} más
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {!employee.isActive && (
                    <div className="mt-3">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Inactivo
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Employee Modal */}
      {isModalOpen && (
        <Modal title="Nuevo Empleado" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido *
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      form.color === color
                        ? 'border-gray-900 scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setForm((f) => ({ ...f, bio: e.target.value }));
                  }
                }}
                className="input-field min-h-[80px] resize-y"
                rows={3}
                placeholder="Descripción breve del empleado..."
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {form.bio.length}/500
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="btn-primary"
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
