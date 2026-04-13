'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ServiceDetail {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  currency: string;
  category?: string;
  subcategory?: string;
  pointsReward?: number | null;
  redeemableWithPoints?: boolean;
  pointsRequired?: number | null;
  isActive: boolean;
  employeeServices?: {
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      color: string;
      jobTitle: string | null;
      isActive: boolean;
    };
    customPrice: number | null;
    customDuration: number | null;
    commission: number | null;
  }[];
}

type ViewTab = 'por-servicio' | 'por-empleado';

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const serviceId = params.id as string;
  const [viewTab, setViewTab] = useState<ViewTab>('por-servicio');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [editingCommissions, setEditingCommissions] = useState<Map<string, { commission: string; customPrice: string }>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['service-detail', serviceId],
    queryFn: async () => {
      const res = await api.get<{ data: ServiceDetail }>(`/api/services/${serviceId}`);
      return res.data;
    },
    enabled: !!serviceId,
  });

  // All employees for "por empleado" view
  const { data: allEmployeesData } = useQuery({
    queryKey: ['employees-commissions'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
    enabled: viewTab === 'por-empleado',
  });

  // All services for "por empleado" view
  const { data: allServicesData } = useQuery({
    queryKey: ['all-services-commissions'],
    queryFn: () => api.get<{ data: any[] }>('/api/services?perPage=100'),
    enabled: viewTab === 'por-empleado',
  });

  const saveMutation = useMutation({
    mutationFn: async ({ employeeId, services }: { employeeId: string; services: any[] }) =>
      api.put(`/api/employees/${employeeId}/services`, { services }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-detail', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['employees-commissions'] });
      setHasChanges(false);
    },
  });

  const service = data;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Servicio" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-[#008080] rounded-full" />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Servicio" />
        <div className="flex-1 flex items-center justify-center text-gray-400">Servicio no encontrado</div>
      </div>
    );
  }

  const employees = (service.employeeServices || []).filter((es) => es.employee.isActive);

  function handleCommissionChange(empId: string, field: 'commission' | 'customPrice', value: string) {
    setEditingCommissions((prev) => {
      const next = new Map(prev);
      const current = next.get(empId) || { commission: '', customPrice: '' };
      next.set(empId, { ...current, [field]: value });
      return next;
    });
    setHasChanges(true);
  }

  function getEditValue(empId: string, field: 'commission' | 'customPrice', original: number | null) {
    const editing = editingCommissions.get(empId);
    if (editing && editing[field] !== '') return editing[field];
    if (editing && editing[field] === '' && original != null) return String(original);
    return original != null ? String(original) : '';
  }

  async function saveCommission(empId: string) {
    const editing = editingCommissions.get(empId);
    if (!editing) return;

    // Get employee's current services first
    const res = await api.get<{ data: any[] }>(`/api/employees/${empId}/services`);
    const currentServices = res.data || [];

    const services = currentServices.map((es: any) => {
      if (es.serviceId === serviceId) {
        return {
          serviceId: es.serviceId,
          commission: editing.commission ? Number(editing.commission) : null,
          customPrice: editing.customPrice ? Number(editing.customPrice) : null,
        };
      }
      return {
        serviceId: es.serviceId,
        commission: es.commission != null ? Number(es.commission) : null,
        customPrice: es.customPrice != null ? Number(es.customPrice) : null,
      };
    });

    saveMutation.mutate({ employeeId: empId, services });
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Detalle del servicio" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {/* Back */}
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>

          {/* Service info card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{service.name}</h1>
                {service.subcategory && (
                  <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-medium rounded-full text-white" style={{ backgroundColor: '#008080' }}>
                    {service.subcategory}
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(service.price)}</p>
                <p className="text-xs text-gray-400">{service.durationMinutes} min</p>
              </div>
            </div>
            {service.description && <p className="text-sm text-gray-500">{service.description}</p>}
          </div>

          {/* View tabs */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewTab('por-servicio')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-300 ${
                  viewTab === 'por-servicio' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Por servicio
              </button>
              <button
                onClick={() => setViewTab('por-empleado')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewTab === 'por-empleado' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Por empleado
              </button>
            </div>
            {viewTab === 'por-empleado' && (
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:border-[#008080]"
              >
                <option value="">Todos los empleados</option>
                {(allEmployeesData?.data || []).filter((e: any) => e.isActive).map((e: any) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
            )}
          </div>

          {/* ─── Vista: Por servicio ─── */}
          {viewTab === 'por-servicio' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Comisiones por empleado</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{employees.length} empleado{employees.length !== 1 ? 's' : ''} asignados</p>
                </div>
              </div>

              {employees.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-gray-400">Ningún empleado tiene asignado este servicio</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Precio base</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Precio cliente</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Comisión</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Ganancia negocio</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees.map((es) => {
                      const emp = es.employee;
                      const editValues = editingCommissions.get(emp.id);
                      const clientPrice = editValues?.customPrice ? Number(editValues.customPrice) : (es.customPrice != null ? Number(es.customPrice) : Number(service.price));
                      const commission = editValues?.commission ? Number(editValues.commission) : (es.commission != null ? Number(es.commission) : 0);
                      const profit = clientPrice - commission;

                      return (
                        <tr key={emp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link href={`/staff/${emp.id}`} className="flex items-center gap-3 hover:underline">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                                style={{ backgroundColor: emp.color || '#008080' }}
                              >
                                {emp.avatarUrl ? (
                                  <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <>{emp.firstName[0]}{emp.lastName[0]}</>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                                {emp.jobTitle && <p className="text-[10px] text-gray-400">{emp.jobTitle}</p>}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-500">{formatCurrency(service.price)}</td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getEditValue(emp.id, 'customPrice', es.customPrice)}
                              onChange={(e) => handleCommissionChange(emp.id, 'customPrice', e.target.value)}
                              placeholder={String(service.price)}
                              className="w-24 text-center text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getEditValue(emp.id, 'commission', es.commission)}
                              onChange={(e) => handleCommissionChange(emp.id, 'commission', e.target.value)}
                              placeholder="0"
                              className="w-24 text-center text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {formatCurrency(profit)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {editingCommissions.has(emp.id) && (
                              <button
                                onClick={() => saveCommission(emp.id)}
                                disabled={saveMutation.isPending}
                                className="text-xs font-medium text-[#008080] hover:text-[#006666]"
                              >
                                {saveMutation.isPending ? '...' : 'Guardar'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ─── Vista: Por empleado ─── */}
          {viewTab === 'por-empleado' && (() => {
            const allEmps = (allEmployeesData?.data || []).filter((e: any) => e.isActive);
            const allSvcs = allServicesData?.data || [];
            const filteredEmps = filterEmployee ? allEmps.filter((e: any) => e.id === filterEmployee) : allEmps;

            return (
              <div className="space-y-4">
                {filteredEmps.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
                    No hay empleados
                  </div>
                ) : (
                  filteredEmps.map((emp: any) => {
                    const empServices = (emp.employeeServices || []) as any[];
                    const empServiceMap = new Map(empServices.map((es: any) => [es.service?.id || es.serviceId, es]));

                    return (
                      <div key={emp.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                            style={{ backgroundColor: emp.color || '#008080' }}
                          >
                            {emp.avatarUrl ? (
                              <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <>{emp.firstName[0]}{emp.lastName[0]}</>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-gray-400">{empServices.length} servicio{empServices.length !== 1 ? 's' : ''} asignados</p>
                          </div>
                        </div>

                        {empServices.length === 0 ? (
                          <div className="px-6 py-4 text-sm text-gray-400">Sin servicios asignados</div>
                        ) : (
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Servicio</th>
                                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Precio base</th>
                                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Precio cliente</th>
                                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Comisión</th>
                                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Ganancia negocio</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {empServices.map((es: any) => {
                                const svc = es.service || allSvcs.find((s: any) => s.id === es.serviceId);
                                if (!svc) return null;
                                const basePrice = Number(svc.price);
                                const clientPrice = es.customPrice != null ? Number(es.customPrice) : basePrice;
                                const commission = es.commission != null ? Number(es.commission) : 0;
                                const profit = clientPrice - commission;

                                return (
                                  <tr key={svc.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{svc.name}</td>
                                    <td className="px-4 py-2.5 text-center text-sm text-gray-500">{formatCurrency(basePrice)}</td>
                                    <td className="px-4 py-2.5 text-center">
                                      <span className={`text-sm ${es.customPrice != null ? 'text-[#008080] font-medium' : 'text-gray-600'}`}>
                                        {formatCurrency(clientPrice)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center text-sm font-medium text-green-600">
                                      {commission > 0 ? formatCurrency(commission) : <span className="text-gray-400 font-normal">—</span>}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      <span className={`text-sm font-medium ${profit >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                                        {formatCurrency(profit)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-50 border-t border-gray-200">
                                <td className="px-4 py-2.5 text-sm font-semibold text-gray-700">Total</td>
                                <td className="px-4 py-2.5"></td>
                                <td className="px-4 py-2.5 text-center text-sm font-semibold text-gray-900">
                                  {formatCurrency(empServices.reduce((s: number, es: any) => {
                                    const svc = es.service || allSvcs.find((sv: any) => sv.id === es.serviceId);
                                    return s + (es.customPrice != null ? Number(es.customPrice) : Number(svc?.price || 0));
                                  }, 0))}
                                </td>
                                <td className="px-4 py-2.5 text-center text-sm font-semibold text-green-600">
                                  {formatCurrency(empServices.reduce((s: number, es: any) => s + Number(es.commission || 0), 0))}
                                </td>
                                <td className="px-4 py-2.5 text-center text-sm font-semibold text-gray-900">
                                  {formatCurrency(empServices.reduce((s: number, es: any) => {
                                    const svc = es.service || allSvcs.find((sv: any) => sv.id === es.serviceId);
                                    const cp = es.customPrice != null ? Number(es.customPrice) : Number(svc?.price || 0);
                                    return s + cp - Number(es.commission || 0);
                                  }, 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
