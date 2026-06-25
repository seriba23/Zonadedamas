// ─── commissions/page.tsx — Comisiones del Empleado ─────────────────────
//
// Esta página está en /employee/commissions y muestra las comisiones ganadas
// por el empleado en un período seleccionable.
//
// ¿QUÉ SON LAS COMISIONES?
// Cuando un servicio tiene configurado un porcentaje de comisión, cada vez que
// el empleado realiza ese servicio gana una parte del precio como comisión.
// El porcentaje se guarda como "commissionSnapshot" en el ítem de la cita
// (igual que el precio, se toma una copia al momento de crear la cita).
//
// PERÍODOS DISPONIBLES:
//   - Este mes (por defecto)
//   - Mes anterior
//   - Personalizado (el usuario elige fechas)
//
// La página muestra:
//   1. Selector de período.
//   2. Tres tarjetas de resumen (total, servicios realizados, promedio).
//   3. Tabla detallada (en escritorio) o lista (en móvil) de cada servicio.

'use client';

import { useState, useMemo } from 'react';
// useState → para el período seleccionado y las fechas personalizadas.
// useMemo  → para calcular las filas y los totales de forma eficiente.

import { useAuth } from '@/lib/hooks/use-auth';
// useAuth → para obtener el employeeId del usuario autenticado.

import { useQuery } from '@tanstack/react-query';
// useQuery → para pedir las citas completadas al backend.

import { api } from '@/lib/api';
// api → cliente HTTP con JWT.

import { formatCurrency as rawFormatCurrency } from '@/lib/utils';
// rawFormatCurrency → formatea montos (fallback).

import { useCurrency } from '@/lib/hooks/use-currency';
// useCurrency → moneda preferida del usuario.

import dayjs from 'dayjs';
// dayjs → para calcular rangos de fechas (inicio/fin de mes, etc.)

// AppointmentItem extendido con el campo de comisión.
// commissionSnapshot → monto de comisión calculado al momento de crear la cita.
// null si ese servicio no tiene comisión configurada.
interface AppointmentItem {
  serviceNameSnapshot: string;
  priceSnapshot: string | number;
  durationSnapshot: number;
  commissionSnapshot: string | number | null; // puede ser null si no hay comisión
}

// Appointment: cita completada con sus ítems (solo necesitamos los datos básicos).
interface Appointment {
  id: string;
  startTime: string;
  status: string;
  client: { id: string; firstName: string; lastName: string };
  items: AppointmentItem[];
}

// PeriodType: tipo de unión para los 3 tipos de período.
type PeriodType = 'this_month' | 'last_month' | 'custom';

export default function EmployeeCommissionsPage() {
  const { user } = useAuth();
  const currencyHook = useCurrency();
  const formatCurrency = currencyHook?.format ?? rawFormatCurrency;

  // period: período actualmente seleccionado. Empieza en 'this_month'.
  const [period, setPeriod] = useState<PeriodType>('this_month');

  // customStart y customEnd: fechas del período personalizado.
  // Solo se usan cuando period === 'custom'.
  // Formato esperado: 'YYYY-MM-DD' (que es lo que devuelve <input type="date">).
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Calculamos startDate y endDate según el período seleccionado.
  // useMemo: solo recalcula cuando cambian period, customStart o customEnd.
  const { startDate, endDate } = useMemo(() => {
    if (period === 'this_month') {
      return {
        // .startOf('month') → primer día del mes actual (ej: 2026-06-01)
        startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
        // .endOf('month') → último día del mes actual (ej: 2026-06-30)
        endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
      };
    }
    if (period === 'last_month') {
      return {
        // .subtract(1, 'month') → un mes atrás
        startDate: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        endDate: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
      };
    }
    // Para 'custom', usamos directamente los valores de los inputs de fecha.
    return { startDate: customStart, endDate: customEnd };
  }, [period, customStart, customEnd]);

  // canFetch: condición para que useQuery ejecute la petición.
  // Necesitamos employeeId y ambas fechas definidas.
  // !! convierte valores a booleano ('' o undefined → false).
  const canFetch = !!user?.employeeId && !!startDate && !!endDate;

  // Pedimos las citas COMPLETADAS del empleado en el período seleccionado.
  // status=COMPLETED → solo citas cerradas (las comisiones no aplican a canceladas).
  // perPage=100 → traemos hasta 100 citas (suficiente para mostrar en tabla).
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['employee-commissions', user?.employeeId, startDate, endDate],
    queryFn: async () => {
      const res = await api.get<{ data: Appointment[]; meta?: any }>(
        `/api/appointments?employeeId=${user!.employeeId}&startDate=${startDate}&endDate=${endDate}&status=COMPLETED&perPage=100`,
      );
      return res.data;
    },
    enabled: canFetch, // solo ejecuta si canFetch es true
  });

  // rows: arreglo APLANADO de filas para la tabla.
  // Una cita puede tener MÚLTIPLES servicios, cada uno con su comisión.
  // Convertimos [{cita con 2 ítems}, {cita con 1 ítem}] → [fila1, fila2, fila3]
  // useMemo: solo recalcula cuando cambian appointments.
  const rows = useMemo(() => {
    if (!appointments) return []; // si aún no cargaron, devolvemos vacío

    // Definimos el tipo del arreglo de resultado (TypeScript inferencia explícita).
    const result: {
      appointmentId: string;
      date: string;
      clientName: string;
      serviceName: string;
      price: number;
      commission: number;
    }[] = [];

    // Doble bucle: por cada cita, por cada ítem (servicio) de la cita.
    // for...of es más legible que forEach cuando hay lógica compleja dentro.
    for (const apt of appointments) {
      for (const item of apt.items) {
        // Si no hay commissionSnapshot, la comisión es 0.
        const commission = item.commissionSnapshot ? Number(item.commissionSnapshot) : 0;
        result.push({
          appointmentId: apt.id,
          date: apt.startTime,
          // Template literal para combinar nombre y apellido.
          clientName: `${apt.client.firstName} ${apt.client.lastName}`,
          serviceName: item.serviceNameSnapshot,
          price: Number(item.priceSnapshot),
          commission,
        });
      }
    }

    // Ordenamos por fecha DESCENDENTE (las más recientes primero).
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments]);

  // Calculamos los totales a partir del arreglo de filas ya calculado.
  // .reduce() acumula la suma de todas las comisiones.
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);

  // rows.length → número total de servicios realizados en el período.
  const totalServices = rows.length;

  // Promedio por servicio: evitamos división por cero con el ternario.
  // Si no hay servicios, el promedio es 0.
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
