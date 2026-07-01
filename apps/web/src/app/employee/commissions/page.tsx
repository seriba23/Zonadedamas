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

import { useState, useMemo, useEffect } from 'react';
// useState → para el período seleccionado y las fechas personalizadas.
// useMemo  → para calcular las filas y los totales de forma eficiente.

import { useSearchParams } from 'next/navigation';
// useSearchParams → para leer ?period= del deep-link desde el inicio del empleado.

import { useAuth } from '@/lib/hooks/use-auth';
// useAuth → para obtener el employeeId del usuario autenticado.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

  // period: período actualmente seleccionado. Empieza en 'this_month', salvo
  // que llegue ?period= en la URL (deep-link desde la tarjeta de ingresos).
  const searchParams = useSearchParams();
  const urlPeriod = searchParams.get('period');
  const [period, setPeriod] = useState<PeriodType>(
    urlPeriod === 'last_month' || urlPeriod === 'custom' ? urlPeriod : 'this_month',
  );

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

  // ── Resumen de comisiones (devengado, cobrado, por cobrar) + pagos pendientes ──
  const queryClient = useQueryClient();
  const { data: summaryData } = useQuery({
    queryKey: ['employee-commission-summary'],
    queryFn: () => api.get<{ data: { earned: number; collected: number; pending: number; pendingPayments: any[]; recentPayments: any[] } }>('/api/employees/me/commission-summary'),
    enabled: !!user?.employeeId,
  });
  const summary = summaryData?.data;
  const pendingPayments: any[] = summary?.pendingPayments || [];

  // Filtros (bottom-sheet) para el período.
  const [showFilters, setShowFilters] = useState(false);

  // Modal de confirmación del pago recibido (aparece si hay un pago PENDING).
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  useEffect(() => {
    if (pendingPayments.length > 0) setShowPaymentModal(true);
  }, [pendingPayments.length]);
  const currentPayment = pendingPayments[0];

  const confirmPayment = useMutation({
    mutationFn: (id: string) => api.post(`/api/employees/me/commission-payments/${id}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-commission-summary'] });
      setShowPaymentModal(false);
    },
    onError: (e: any) => alert(e?.message || 'No se pudo confirmar'),
  });
  const disputePayment = useMutation({
    mutationFn: (id: string) => api.post(`/api/employees/me/commission-payments/${id}/dispute`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-commission-summary'] });
      setShowPaymentModal(false);
    },
    onError: (e: any) => alert(e?.message || 'No se pudo registrar'),
  });

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
      {/* Título + icono de filtros (período) */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Mis Comisiones</h1>
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          title="Período"
          aria-label="Período"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
          style={period !== 'this_month'
            ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
            : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
          }
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          {period !== 'this_month' && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>
      </div>
      {periodLabel && <p className="text-xs text-gray-400 mb-5 capitalize">{periodLabel}</p>}

      {/* Dos tarjetas: por cobrar (histórico) + cobradas (pagos confirmados) */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
          <p className="text-xs font-medium text-teal-700 mb-1">Por cobrar</p>
          <p className="text-2xl font-bold text-teal-800">{summary ? formatCurrency(summary.pending) : '...'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Cobradas</p>
          <p className="text-2xl font-bold text-gray-900">{summary ? formatCurrency(summary.collected) : '...'}</p>
        </div>
      </div>

      {/* Commissions table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Comisiones del período</h2>
            <span className="text-sm font-bold text-[#008080]">{isLoading ? '...' : formatCurrency(totalCommission)}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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

      {/* Panel de filtros (bottom-sheet): período */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Período</h3>
              <button onClick={() => setShowFilters(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'this_month', label: 'Este mes' },
                  { value: 'last_month', label: 'Mes anterior' },
                  { value: 'custom', label: 'Personalizado' },
                ] as { value: PeriodType; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriod(opt.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={period === opt.value
                      ? { backgroundColor: '#008080', color: 'white', borderColor: '#008080' }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Desde</label>
                    <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Hasta</label>
                    <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]" />
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowFilters(false)} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors">Listo</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal centrado: confirmación de pago de comisión recibido.
          Aparece automáticamente si el negocio registró un pago pendiente. */}
      {showPaymentModal && currentPayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="relative w-full sm:max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#e0f2f1' }}>
                <svg className="w-8 h-8" style={{ color: '#008080' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">¿Recibiste tu pago de comisiones?</h2>
              <p className="text-sm text-gray-500 mt-1">El negocio registró un pago por</p>
              <p className="text-3xl font-extrabold text-[#008080] mt-1">{formatCurrency(Number(currentPayment.amount))}</p>
              {currentPayment.note && <p className="text-xs text-gray-500 mt-2">{currentPayment.note}</p>}
              <p className="text-[11px] text-gray-400 mt-2">{dayjs(currentPayment.createdAt).format('D [de] MMMM YYYY')}</p>
            </div>
            <div className="px-6 pb-6 space-y-2">
              <button
                onClick={() => confirmPayment.mutate(currentPayment.id)}
                disabled={confirmPayment.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors disabled:opacity-50"
              >
                {confirmPayment.isPending ? 'Confirmando…' : 'Sí, lo recibí'}
              </button>
              <button
                onClick={() => disputePayment.mutate(currentPayment.id)}
                disabled={disputePayment.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disputePayment.isPending ? 'Enviando…' : 'No lo he recibido'}
              </button>
              <button onClick={() => setShowPaymentModal(false)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">Ahora no</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
