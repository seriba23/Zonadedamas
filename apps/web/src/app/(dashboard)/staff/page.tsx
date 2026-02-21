'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { getInitials } from '@/lib/utils';
import { EmployeeScheduleEditor } from '@/components/staff/employee-schedule-editor';
import { EmployeeTimeOffEditor } from '@/components/staff/employee-time-off-editor';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  color?: string;
  locationId?: string;
  location?: { name: string };
  services?: Array<{ id: string; name: string }>;
  isActive: boolean;
}

interface EmployeeForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  color: string;
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
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'datos' | 'horario' | 'ausencias'>('datos');

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<{ data: Employee[] }>('/api/employees'),
  });

  const employees = data?.data || [];

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Employee>) => {
      if (editingEmployee) {
        return api.put(`/api/employees/${editingEmployee.id}`, payload);
      }
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
    setEditingEmployee(null);
    setForm(defaultForm);
    setFormError(null);
    setActiveTab('datos');
    setIsModalOpen(true);
  }

  function openEdit(employee: Employee) {
    setEditingEmployee(employee);
    setForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email || '',
      phone: employee.phone || '',
      color: employee.color || '#008080',
    });
    setFormError(null);
    setActiveTab('datos');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setForm(defaultForm);
    setFormError(null);
    setActiveTab('datos');
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
          <p className="text-sm text-gray-500">
            {employees.length} empleado{employees.length !== 1 ? 's' : ''}
          </p>
          {hasPermission('employees.create') && (
            <button onClick={openCreate} className="btn-primary">
              + Nuevo Empleado
            </button>
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

              return (
                <div
                  key={employee.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                        style={bgStyle}
                      >
                        {getInitials(employee.firstName, employee.lastName)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </h3>
                        {employee.email && (
                          <p className="text-sm text-gray-500">{employee.email}</p>
                        )}
                        {employee.location && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {employee.location.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {hasPermission('employees.update') && (
                      <button
                        onClick={() => openEdit(employee)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {employee.services && employee.services.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">
                        {employee.services.length} servicio
                        {employee.services.length !== 1 ? 's' : ''}
                      </p>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <Modal
          title={editingEmployee ? `${editingEmployee.firstName} ${editingEmployee.lastName}` : 'Nuevo Empleado'}
          onClose={closeModal}
          size={editingEmployee ? 'lg' : 'md'}
        >
          {/* Tabs — only show when editing */}
          {editingEmployee && (
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setActiveTab('datos')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'datos'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Datos
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('horario')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'horario'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Horario
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ausencias')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'ausencias'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Ausencias
              </button>
            </div>
          )}

          {/* Tab: Datos */}
          {activeTab === 'datos' && (
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
          )}

          {/* Tab: Horario */}
          {activeTab === 'horario' && editingEmployee && (
            <EmployeeScheduleEditor employeeId={editingEmployee.id} />
          )}

          {/* Tab: Ausencias */}
          {activeTab === 'ausencias' && editingEmployee && (
            <EmployeeTimeOffEditor employeeId={editingEmployee.id} />
          )}
        </Modal>
      )}
    </div>
  );
}
