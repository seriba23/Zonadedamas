'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  READY: 'Listo',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  READY: 'bg-teal-50 text-teal-700',
  DELIVERED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  PICKUP: 'Recoger en tienda',
  SHIPPING: 'Envio',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  SPEI: 'SPEI',
  CARD: 'Tarjeta',
};

const TABS = ['ALL', 'PENDING', 'CONFIRMED', 'READY', 'DELIVERED', 'CANCELLED'];
const TAB_LABELS: Record<string, string> = {
  ALL: 'Todos',
  PENDING: 'Pendientes',
  CONFIRMED: 'Confirmados',
  READY: 'Listos',
  DELIVERED: 'Entregados',
  CANCELLED: 'Cancelados',
};

const NEXT_ACTIONS: Record<string, { label: string; status: string; color: string }[]> = {
  PENDING: [
    { label: 'Confirmar', status: 'CONFIRMED', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Cancelar', status: 'CANCELLED', color: 'bg-red-500 hover:bg-red-600' },
  ],
  CONFIRMED: [
    { label: 'Listo para entrega', status: 'READY', color: 'bg-teal-600 hover:bg-teal-700' },
    { label: 'Cancelar', status: 'CANCELLED', color: 'bg-red-500 hover:bg-red-600' },
  ],
  READY: [
    { label: 'Entregado', status: 'DELIVERED', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Cancelar', status: 'CANCELLED', color: 'bg-red-500 hover:bg-red-600' },
  ],
};

export default function ReservationsPage() {
  const [tab, setTab] = useState('ALL');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const reservations = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Apartados</h1>
      <p className="text-sm text-gray-500 mb-6">
        Gestiona los productos que tus clientes han apartado.
      </p>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t
                ? 'text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            style={tab === t ? { backgroundColor: TEAL } : undefined}
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
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: TEAL_LIGHT }}>
            <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No hay apartados {tab !== 'ALL' ? TAB_LABELS[tab].toLowerCase() : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {r.product?.name || 'Producto'}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[r.status] || ''}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {r.customerName} &middot; {r.customerPhone}
                    {r.customerEmail && ` · ${r.customerEmail}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(Number(r.unitPrice) * r.quantity + (Number(r.shippingCost) || 0))}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {r.quantity} x {formatCurrency(Number(r.unitPrice))}
                    {Number(r.shippingCost) > 0 && ` + envio ${formatCurrency(Number(r.shippingCost))}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125v0c0-.621.504-1.125 1.125-1.125H20.25M3.75 18V7.5A2.25 2.25 0 0 1 6 5.25h12A2.25 2.25 0 0 1 20.25 7.5V18" />
                  </svg>
                  {FULFILLMENT_LABELS[r.fulfillmentType] || r.fulfillmentType}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                  </svg>
                  {PAYMENT_LABELS[r.preferredPaymentMethod] || r.preferredPaymentMethod}
                </span>
                <span>
                  {new Date(r.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {r.shippingAddress && (
                <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium">Dirección:</span> {r.shippingAddress}
                </p>
              )}

              {r.notes && (
                <p className="text-xs text-gray-500 mb-3 italic">
                  "{r.notes.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, (match) =>
                    new Date(match).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  )}"
                </p>
              )}

              {/* Actions */}
              {NEXT_ACTIONS[r.status] && (
                <div className="flex gap-2">
                  {NEXT_ACTIONS[r.status].map((action) => (
                    <button
                      key={action.status}
                      onClick={() => statusMutation.mutate({ id: r.id, status: action.status })}
                      disabled={statusMutation.isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ${action.color} disabled:opacity-50`}
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
          <span className="text-xs text-gray-500">
            {page} de {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}

      {statusMutation.isError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm shadow-lg">
          {(statusMutation.error as any)?.message || 'Error al actualizar estado'}
        </div>
      )}
    </div>
  );
}
