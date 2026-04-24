'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import dayjs from 'dayjs';

interface AppointmentItem {
  serviceNameSnapshot: string;
  priceSnapshot: string | number;
  durationSnapshot: number;
  commissionSnapshot: string | number | null;
}

interface Appointment {
  id: string;
  startTime: string;
  status: string;
  client: { id: string; firstName: string; lastName: string };
  items: AppointmentItem[];
}

type PeriodType = 'this_month' | 'last_month' | 'custom';

export default function EmployeeCommissionsPage() {
  const { user } = useAuth();
  const currency = useCurrency();
  const formatCurrency = currency.format || ((v: number) => `$${Number(v).toFixed(2)}`);
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { startDate, endDate } = useMemo(() => {
    if (period === 'this_month') {
      return {
        startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
        endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
      };
    }
    if (period === 'last_month') {
      return {
        startDate: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        endDate: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
      };
    }
    return { startDate: customStart, endDate: customEnd };
  }, [period, customStart, customEnd]);

  const canFetch = !!user?.employeeId && !!startDate && !!endDate;

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['employee-commissions', user?.employeeId, startDate, endDate],
    queryFn: async () => {
      const res = await api.get<{ data: Appointment[]; meta?: any }>(
        `/api/appointments?employeeId=${user!.employeeId}&startDate=${startDate}&endDate=${endDate}&status=COMPLETED&perPage=100`,
      );
      return res.data;
    },
    enabled: canFetch,
  });

  const rows = useMemo(() => {
    if (!appointments) return [];
    const result: {
      appointmentId: string;
      date: string;
      clientName: string;
      serviceName: string;
      price: number;
      commission: number;
    }[] = [];

    for (const apt of appointments) {
      for (const item of apt.items) {
        const commission = item.commissionSnapshot ? Number(item.commissionSnapshot) : 0;
        result.push({
          appointmentId: apt.id,
          date: apt.startTime,
          clientName: `${apt.client.firstName} ${apt.client.lastName}`,
          serviceName: item.serviceNameSnapshot,
          price: Number(item.priceSnapshot),
          commission,
        });
      }
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments]);

  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalServices = rows.length;
  const avgPerService = totalServices > 0 ? totalCommission / totalServices : 0;

  if (!user?.employeeId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
          Tu cuenta no esta vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  const periodLabel =
    period === 'this_month'
      ? dayjs().format('MMMM YYYY')
      : period === 'last_month'
        ? dayjs().subtract(1, 'month').format('MMMM YYYY')
        : startDate && endDate
          ? `${dayjs(startDate).format('D MMM')} - ${dayjs(endDate).format('D MMM YYYY')}`
          : '';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis Comisiones</h1>

      {/* Period selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPeriod('this_month')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === 'this_month'
                ? 'bg-[#008080] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Este mes
          </button>
          <button
            onClick={() => setPeriod('last_month')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === 'last_month'
                ? 'bg-[#008080] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Mes anterior
          </button>
          <button
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === 'custom'
                ? 'bg-[#008080] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Personalizado
          </button>

          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-gray-400 text-sm">a</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
        </div>
        {periodLabel && (
          <p className="text-xs text-gray-400 mt-2 capitalize">{periodLabel}</p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total comisiones</p>
          <p className="text-2xl font-bold text-primary-700">
            {isLoading ? '...' : formatCurrency(totalCommission)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Servicios realizados</p>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '...' : totalServices}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Promedio por servicio</p>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '...' : formatCurrency(avgPerService)}
          </p>
        </div>
      </div>

      {/* Commissions table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Detalle de comisiones</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl mb-3 block">💰</span>
            <p className="text-gray-500">No hay comisiones en este período</p>
            <p className="text-sm text-gray-400 mt-1">
              Las comisiones aparecen cuando se completan citas con servicios que tienen comisión configurada
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase">Servicio</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase text-right">Precio</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase text-right">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, idx) => (
                    <tr key={`${row.appointmentId}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-600">
                        {dayjs(row.date).format('D MMM YYYY')}
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">{row.clientName}</td>
                      <td className="px-5 py-3 text-gray-600">{row.serviceName}</td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {formatCurrency(row.price)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-primary-700">
                        {formatCurrency(row.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-gray-900 text-right">
                      Total
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-primary-700">
                      {formatCurrency(totalCommission)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="sm:hidden divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <li key={`${row.appointmentId}-${idx}`} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 text-sm">{row.clientName}</p>
                    <p className="font-medium text-primary-700 text-sm">
                      {formatCurrency(row.commission)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">{row.serviceName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400">
                      {dayjs(row.date).format('D MMM YYYY')}
                    </p>
                    <p className="text-xs text-gray-400">
                      Precio: {formatCurrency(row.price)}
                    </p>
                  </div>
                </li>
              ))}
              <li className="px-5 py-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Total</p>
                  <p className="text-sm font-bold text-primary-700">
                    {formatCurrency(totalCommission)}
                  </p>
                </div>
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
