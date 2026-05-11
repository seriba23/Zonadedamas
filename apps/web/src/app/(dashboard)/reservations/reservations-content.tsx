'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { useCurrency } from '@/lib/hooks/use-currency';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Apartado',
  CONFIRMED: 'Confirmado',
  READY: 'Listo para entrega',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-teal-700 bg-teal-50',
  CONFIRMED: 'text-blue-700 bg-blue-50',
  READY: 'text-green-700 bg-green-50',
  DELIVERED: 'text-green-700 bg-green-50',
  CANCELLED: 'text-red-600 bg-red-50',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  PICKUP: 'Recoger en tienda',
  SHIPPING: 'Envío a domicilio',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  SPEI: 'SPEI',
  CARD: 'Tarjeta',
};

const TABS = ['ALL', 'PENDING', 'CONFIRMED', 'READY', 'DELIVERED', 'CANCELLED'];
const TAB_LABELS: Record<string, string> = {
  ALL: 'Todos',
  PENDING: 'Apartados',
  CONFIRMED: 'Confirmados',
  READY: 'Listos',
  DELIVERED: 'Entregados',
  CANCELLED: 'Cancelados',
};

const NEXT_ACTIONS: Record<string, { label: string; status: string; style: 'primary' | 'danger' }[]> = {
  PENDING: [
    { label: 'Confirmar', status: 'CONFIRMED', style: 'primary' },
    { label: 'Cancelar', status: 'CANCELLED', style: 'danger' },
  ],
  CONFIRMED: [
    { label: 'Listo para entrega', status: 'READY', style: 'primary' },
    { label: 'Cancelar', status: 'CANCELLED', style: 'danger' },
  ],
  READY: [
    { label: 'Marcar entregado', status: 'DELIVERED', style: 'primary' },
    { label: 'Cancelar', status: 'CANCELLED', style: 'danger' },
  ],
};

export function ReservationsContent({ embedded }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState('ALL');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { format: formatCurrency } = useCurrency();

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', tab, page],
    queryFn: () =>
      api.get<{ data: any[]; meta: any }>(
        `/api/products/reservations?page=${page}&perPage=20${tab !== 'ALL' ? `&status=${tab}` : ''}`
      ),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/api/products/reservations/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reservations'] }),
  });

  const reservations = data?.data || [];
  const meta = data?.meta;

  return (
    <div className={embedded ? '' : 'flex flex-col h-full'}>
      {!embedded && <Header title="Apartados" />}

      <div className={embedded ? 'p-6' : 'flex-1 overflow-y-auto p-3 md:p-6'}>
        <p className="text-sm text-gray-500 mb-4">
          Gestiona los productos que tus clientes han apartado.
        </p>

        {/* Status Tabs — pill style */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-[#008080] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-40 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-64" />
              </div>
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No hay apartados {tab !== 'ALL' ? TAB_LABELS[tab].toLowerCase() : ''}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((r: any) => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4">
                  {/* Header: product + status + price */}
                  <div className="flex items-start gap-3 mb-3">
                    {/* Product image */}
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {r.product?.imageUrl ? (
                        <img src={`${API_URL}${r.product.imageUrl}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.product?.name || 'Producto'}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${STATUS_COLORS[r.status] || 'text-gray-600 bg-gray-100'}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {r.customerName}{r.customerPhone ? ` · ${r.customerPhone}` : ''}{r.customerEmail ? ` · ${r.customerEmail}` : ''}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(Number(r.unitPrice) * r.quantity + (Number(r.shippingCost) || 0))}
                      </p>
                      <p className="text-xs font-medium text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Details row */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
                      </svg>
                      {FULFILLMENT_LABELS[r.fulfillmentType] || r.fulfillmentType}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                      </svg>
                      {PAYMENT_LABELS[r.preferredPaymentMethod] || r.preferredPaymentMethod}
                    </span>
                    <span>{r.quantity} × {formatCurrency(Number(r.unitPrice))}</span>
                  </div>

                  {/* Linked appointment */}
                  {r.appointment && (
                    <Link
                      href={`/calendar?appointmentId=${r.appointment.id}`}
                      className="flex items-center gap-2 text-xs text-[#008080] hover:text-[#006666] mb-3 group"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      <span className="group-hover:underline">
                        Cita del {new Date(r.appointment.startTime).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </Link>
                  )}

                  {r.shippingAddress && (
                    <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium">Dirección:</span> {r.shippingAddress}
                    </p>
                  )}

                  {r.notes && (
                    <p className="text-xs text-gray-400 mb-3 italic">"{r.notes}"</p>
                  )}
                </div>

                {/* Actions bar */}
                {NEXT_ACTIONS[r.status] && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                    {NEXT_ACTIONS[r.status].map((action) => (
                      <button
                        key={action.status}
                        onClick={() => statusMutation.mutate({ id: r.id, status: action.status })}
                        disabled={statusMutation.isPending}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          action.style === 'primary'
                            ? 'text-white bg-[#008080] hover:bg-[#006666]'
                            : 'text-red-600 bg-white border border-red-200 hover:bg-red-50'
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-xs text-gray-500">{page} de {meta.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
