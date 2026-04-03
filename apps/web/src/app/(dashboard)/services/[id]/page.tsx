'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['service-detail', serviceId],
    queryFn: async () => {
      const res = await api.get<{ data: ServiceDetail }>(`/api/services/${serviceId}`);
      return res.data;
    },
    enabled: !!serviceId,
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

  const employees = service.employeeServices || [];
  const activeEmployees = employees.filter((es) => es.employee.isActive);

  return (
    <div className="flex flex-col h-full">
      <Header title="Detalle del servicio" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
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
                <p className="text-xs text-gray-400">{service.currency || 'MXN'}</p>
              </div>
            </div>

            {service.description && (
              <p className="text-sm text-gray-500 mb-4">{service.description}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {service.durationMinutes} minutos
              </div>
              {service.pointsReward && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Otorga {service.pointsReward} pts
                </div>
              )}
              {service.redeemableWithPoints && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" />
                  </svg>
                  Canjeable por {service.pointsRequired} pts
                </div>
              )}
            </div>
          </div>

          {/* Employees section */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Empleados que realizan este servicio</h2>
              <p className="text-xs text-gray-400 mt-0.5">{activeEmployees.length} empleado{activeEmployees.length !== 1 ? 's' : ''}</p>
            </div>

            {activeEmployees.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-400">Ningun empleado tiene asignado este servicio</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {/* Header */}
                <div className="grid grid-cols-12 px-6 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-4">Empleado</div>
                  <div className="col-span-2 text-center">Puesto</div>
                  <div className="col-span-2 text-center">Precio</div>
                  <div className="col-span-2 text-center">Duración</div>
                  <div className="col-span-2 text-center">Comisión</div>
                </div>

                {activeEmployees.map((es) => {
                  const emp = es.employee;
                  const price = es.customPrice != null ? es.customPrice : service.price;
                  const duration = es.customDuration != null ? es.customDuration : service.durationMinutes;
                  const commission = es.commission;

                  return (
                    <Link
                      key={emp.id}
                      href={`/staff/${emp.id}`}
                      className="grid grid-cols-12 px-6 py-3 items-center hover:bg-gray-50 transition-colors"
                    >
                      {/* Employee */}
                      <div className="col-span-4 flex items-center gap-3">
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
                        <span className="text-sm font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</span>
                      </div>

                      {/* Job title */}
                      <div className="col-span-2 text-center">
                        <span className="text-xs text-gray-500">{emp.jobTitle || '—'}</span>
                      </div>

                      {/* Price */}
                      <div className="col-span-2 text-center">
                        <span className={`text-sm font-medium ${es.customPrice != null ? 'text-[#008080]' : 'text-gray-600'}`}>
                          {formatCurrency(price)}
                        </span>
                        {es.customPrice != null && (
                          <p className="text-[9px] text-gray-400">personalizado</p>
                        )}
                      </div>

                      {/* Duration */}
                      <div className="col-span-2 text-center">
                        <span className={`text-sm ${es.customDuration != null ? 'text-[#008080] font-medium' : 'text-gray-600'}`}>
                          {duration} min
                        </span>
                      </div>

                      {/* Commission */}
                      <div className="col-span-2 text-center">
                        {commission != null ? (
                          <span className="text-sm font-semibold text-green-600">
                            {formatCurrency(commission)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Sin comisión</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
