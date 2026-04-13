'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const serviceId = params.id as string;
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [priceValue, setPriceValue] = useState('');
  const [durationValue, setDurationValue] = useState('');
  const [editingCommissions, setEditingCommissions] = useState<Map<string, { commission: string; customPrice: string }>>(new Map());

  const { data, isLoading } = useQuery({
    queryKey: ['service-detail', serviceId],
    queryFn: async () => {
      const res = await api.get<{ data: any }>(`/api/services/${serviceId}`);
      return res.data;
    },
    enabled: !!serviceId,
  });

  const updateServiceMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/api/services/${serviceId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-detail', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditingPrice(false);
      setEditingDuration(false);
    },
  });

  const saveCommissionMutation = useMutation({
    mutationFn: async ({ employeeId, commission, customPrice }: { employeeId: string; commission: string; customPrice: string }) => {
      const res = await api.get<{ data: any[] }>(`/api/employees/${employeeId}/services`);
      const currentServices = res.data || [];
      const services = currentServices.map((es: any) => {
        if (es.serviceId === serviceId) {
          return {
            serviceId: es.serviceId,
            commission: commission ? Number(commission) : null,
            customPrice: customPrice ? Number(customPrice) : null,
          };
        }
        return {
          serviceId: es.serviceId,
          commission: es.commission != null ? Number(es.commission) : null,
          customPrice: es.customPrice != null ? Number(es.customPrice) : null,
        };
      });
      return api.put(`/api/employees/${employeeId}/services`, { services });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-detail', serviceId] });
      setEditingCommissions(new Map());
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

  const employees = (service.employeeServices || []).filter((es: any) => es.employee.isActive);

  function getEditValue(empId: string, field: 'commission' | 'customPrice', original: number | null) {
    const editing = editingCommissions.get(empId);
    if (editing) return editing[field];
    return original != null ? String(original) : '';
  }

  function handleCommChange(empId: string, field: 'commission' | 'customPrice', value: string) {
    setEditingCommissions((prev) => {
      const next = new Map(prev);
      const es = employees.find((e: any) => e.employee.id === empId);
      const current = next.get(empId) || {
        commission: es?.commission != null ? String(es.commission) : '',
        customPrice: es?.customPrice != null ? String(es.customPrice) : '',
      };
      next.set(empId, { ...current, [field]: value });
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Detalle del servicio" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Back */}
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>

          {/* Service info - editable */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{service.name}</h1>
                {service.subcategory && (
                  <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-medium rounded-full text-white" style={{ backgroundColor: '#008080' }}>
                    {service.subcategory}
                  </span>
                )}
                {service.description && <p className="text-sm text-gray-500 mt-2">{service.description}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Price - editable */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Precio</p>
                {editingPrice ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                      className="w-28 text-lg font-bold border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-[#008080]"
                      autoFocus
                    />
                    <button
                      onClick={() => updateServiceMutation.mutate({ price: Number(priceValue) })}
                      className="text-xs font-medium text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#008080' }}
                    >
                      Guardar
                    </button>
                    <button onClick={() => setEditingPrice(false)} className="text-xs text-gray-400">Cancelar</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setPriceValue(String(service.price)); setEditingPrice(true); }}
                    className="text-2xl font-bold text-gray-900 hover:text-[#008080] transition-colors"
                  >
                    {formatCurrency(service.price)}
                    <svg className="w-3.5 h-3.5 inline ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Duration - editable */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Duración</p>
                {editingDuration ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={durationValue}
                      onChange={(e) => setDurationValue(e.target.value)}
                      className="w-20 text-lg font-bold border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-[#008080]"
                      autoFocus
                    />
                    <span className="text-sm text-gray-500">min</span>
                    <button
                      onClick={() => updateServiceMutation.mutate({ durationMinutes: Number(durationValue) })}
                      className="text-xs font-medium text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#008080' }}
                    >
                      Guardar
                    </button>
                    <button onClick={() => setEditingDuration(false)} className="text-xs text-gray-400">Cancelar</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setDurationValue(String(service.durationMinutes)); setEditingDuration(true); }}
                    className="text-2xl font-bold text-gray-900 hover:text-[#008080] transition-colors"
                  >
                    {service.durationMinutes} min
                    <svg className="w-3.5 h-3.5 inline ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Employees & Commissions */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Empleados y comisiones</h2>
              <p className="text-xs text-gray-400 mt-0.5">{employees.length} empleado{employees.length !== 1 ? 's' : ''} asignados a este servicio</p>
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
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((es: any) => {
                    const emp = es.employee;
                    const editValues = editingCommissions.get(emp.id);
                    const clientPrice = editValues?.customPrice ? Number(editValues.customPrice) : (es.customPrice != null ? Number(es.customPrice) : Number(service.price));
                    const commission = editValues?.commission ? Number(editValues.commission) : (es.commission != null ? Number(es.commission) : 0);
                    const profit = clientPrice - commission;

                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/staff/${emp.id}`} className="flex items-center gap-3">
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
                            <span className="text-sm font-medium text-gray-900 hover:underline">{emp.firstName} {emp.lastName}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-500">{formatCurrency(service.price)}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={getEditValue(emp.id, 'customPrice', es.customPrice)}
                            onChange={(e) => handleCommChange(emp.id, 'customPrice', e.target.value)}
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
                            onChange={(e) => handleCommChange(emp.id, 'commission', e.target.value)}
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
                              onClick={() => {
                                const vals = editingCommissions.get(emp.id)!;
                                saveCommissionMutation.mutate({ employeeId: emp.id, commission: vals.commission, customPrice: vals.customPrice });
                              }}
                              disabled={saveCommissionMutation.isPending}
                              className="text-xs font-medium text-[#008080] hover:text-[#006666]"
                            >
                              {saveCommissionMutation.isPending ? '...' : 'Guardar'}
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
        </div>
      </div>
    </div>
  );
}
