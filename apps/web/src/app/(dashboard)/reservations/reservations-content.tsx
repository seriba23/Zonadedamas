'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';
import { Modal } from '@/components/ui/modal';
import Link from 'next/link';
import { formatBookingDateTime } from '@/lib/booking-time';

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

// Próximo paso por estado. Orden visual: [Cancelar | Avanzar].
// (Cancelar a la izquierda, acción primaria a la derecha.)
const NEXT_ACTIONS: Record<string, { advance?: { label: string; status: string }; cancel?: { label: string; status: string } }> = {
  PENDING: {
    advance: { label: 'Confirmar', status: 'CONFIRMED' },
    cancel: { label: 'Cancelar', status: 'CANCELLED' },
  },
  CONFIRMED: {
    advance: { label: 'Listo para entrega', status: 'READY' },
    cancel: { label: 'Cancelar', status: 'CANCELLED' },
  },
  READY: {
    advance: { label: 'Marcar entregado', status: 'DELIVERED' },
    cancel: { label: 'Cancelar', status: 'CANCELLED' },
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function ReservationDetailModal({
  reservation,
  onClose,
  formatCurrency,
  onStatusChange,
  busy,
}: {
  reservation: any;
  onClose: () => void;
  formatCurrency: (n: number) => string;
  onStatusChange: (id: string, status: string) => void;
  busy: boolean;
}) {
  const r = reservation;
  const total = Number(r.unitPrice) * r.quantity + (Number(r.shippingCost) || 0);
  const actions = NEXT_ACTIONS[r.status];
  const avatarUrl = r.user?.avatarUrl ? `${API_URL}${r.user.avatarUrl}` : null;
  // Para wa.me solo digitos del telefono (sin +, espacios, parentesis).
  const waPhone = (r.customerPhone || '').replace(/[^\d]/g, '');

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header sticky */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">Detalle del apartado</p>
            {r.code && (
              <p className="font-mono text-[11px] font-semibold text-gray-500 mt-0.5">#{r.code}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Producto */}
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
              {r.product?.imageUrl ? (
                <img src={`${API_URL}${r.product.imageUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900">{r.product?.name || 'Producto'}</p>
              <p className="text-sm text-gray-500 mt-0.5">{r.quantity} × {formatCurrency(Number(r.unitPrice))}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[r.status] || 'text-gray-600 bg-gray-100'}`}>
                {STATUS_LABELS[r.status] || r.status}
              </span>
            </div>
          </div>

          {/* Cliente */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cliente</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-teal-50 text-[#008080] flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  getInitials(r.customerName || '?')
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{r.customerName}</p>
                {/* Iconos de contacto */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  {r.customerPhone && (
                    <a
                      href={`tel:${r.customerPhone}`}
                      title={`Llamar a ${r.customerPhone}`}
                      className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 text-[#008080] flex items-center justify-center hover:bg-teal-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                      </svg>
                    </a>
                  )}
                  {waPhone && (
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`WhatsApp a ${r.customerPhone}`}
                      className="w-9 h-9 rounded-full bg-green-50 border border-green-200 text-green-700 flex items-center justify-center hover:bg-green-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </a>
                  )}
                  {r.customerEmail && (
                    <a
                      href={`mailto:${r.customerEmail}`}
                      title={`Enviar correo a ${r.customerEmail}`}
                      className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Entrega + pago */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Entrega</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{FULFILLMENT_LABELS[r.fulfillmentType] || r.fulfillmentType}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pago</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{PAYMENT_LABELS[r.preferredPaymentMethod] || r.preferredPaymentMethod}</p>
            </div>
          </div>

          {/* Dirección si envío */}
          {r.shippingAddress && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Dirección</p>
              <p className="text-sm text-gray-700">{r.shippingAddress}</p>
            </div>
          )}

          {/* Cita vinculada */}
          {r.appointment && (
            <Link
              href={`/calendar?appointmentId=${r.appointment.id}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-sm font-medium text-[#008080] hover:bg-teal-100 transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span>Cita del {formatBookingDateTime(r.appointment.startTime)}</span>
            </Link>
          )}

          {/* Notas */}
          {r.notes && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notas</p>
              <p className="text-sm text-gray-700 italic">"{r.notes}"</p>
            </div>
          )}

          {/* Comprobante de pago */}
          {r.paymentProofUrl && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Comprobante de pago</p>
              <a
                href={`${API_URL}${r.paymentProofUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg border border-gray-200 overflow-hidden hover:border-[#008080] transition-colors"
              >
                <img src={`${API_URL}${r.paymentProofUrl}`} alt="Comprobante" className="max-h-48 object-contain" />
              </a>
              <p className="text-[11px] text-gray-400 mt-1">Toca la imagen para abrirla en grande.</p>
            </div>
          )}
          {!r.paymentProofUrl && r.preferredPaymentMethod === 'SPEI' && r.status === 'PENDING' && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2.5 text-xs text-teal-800">
              El cliente aún no ha subido el comprobante de transferencia.
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-500">Total</span>
            <span className="text-xl font-bold text-gray-900">{formatCurrency(total)}</span>
          </div>

          {/* Fecha */}
          <p className="text-xs text-gray-400 text-center">
            Creado el {new Date(r.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Acciones (Cancelar / Avanzar) — sticky abajo */}
        {actions && (actions.cancel || actions.advance) && (
          <div className="sticky bottom-0 px-5 py-3 bg-white border-t border-gray-100 flex gap-2">
            {actions.cancel && (
              <button
                onClick={() => onStatusChange(r.id, actions.cancel!.status)}
                disabled={busy}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 text-red-600 bg-white border border-red-200 hover:bg-red-50"
              >
                {actions.cancel.label}
              </button>
            )}
            {actions.advance && (
              <button
                onClick={() => onStatusChange(r.id, actions.advance!.status)}
                disabled={busy}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 text-white bg-[#008080] hover:bg-[#006666]"
              >
                {actions.advance.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReservationsContent({ embedded }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState('ALL');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [draftTab, setDraftTab] = useState('ALL');
  const queryClient = useQueryClient();
  const { format: formatCurrency } = useCurrency();

  const hasActiveFilters = tab !== 'ALL';

  function openFilters() {
    setDraftTab(tab);
    setShowFilters(true);
  }

  function applyFilters() {
    setTab(draftTab);
    setPage(1);
    setShowFilters(false);
  }

  function clearDraftFilters() {
    setDraftTab('ALL');
  }

  // Registrar el icono de filtros en el topbar (a la izquierda del bell).
  // El boton solo aparece si NO esta embedded (cuando es la pagina propia).
  useRegisterTopbarAction(
    embedded ? null : (
      <button
        onClick={openFilters}
        aria-label="Filtros"
        title="Filtros"
        className={`flex-shrink-0 p-2 rounded-lg border transition-colors ${
          hasActiveFilters
            ? 'bg-[#008080] border-[#008080] text-white'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>
    ),
    [embedded, hasActiveFilters, tab],
  );

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

      <div className={embedded ? 'p-6' : 'flex-1 overflow-y-auto p-3 md:p-6'}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            Gestiona los productos que tus clientes han apartado.
          </p>
          {hasActiveFilters && (
            <span className="text-xs font-medium text-[#008080] bg-teal-50 border border-teal-200 rounded-full px-2.5 py-1">
              {TAB_LABELS[tab]}
            </span>
          )}
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
            {reservations.map((r: any) => {
              const total = Number(r.unitPrice) * r.quantity + (Number(r.shippingCost) || 0);
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Header clickeable → abre modal de detalle */}
                  <button
                    type="button"
                    onClick={() => setDetail(r)}
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    {/* Imagen producto */}
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {r.product?.imageUrl ? (
                        <img src={`${API_URL}${r.product.imageUrl}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      )}
                    </div>

                    {/* Producto + cliente */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.product?.name || 'Producto'}</p>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${STATUS_COLORS[r.status] || 'text-gray-600 bg-gray-100'}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{r.customerName}</p>
                    </div>

                    {/* Total */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(total)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(r.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
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

      {detail && (
        <ReservationDetailModal
          reservation={detail}
          onClose={() => setDetail(null)}
          formatCurrency={formatCurrency}
          onStatusChange={(id, status) => {
            statusMutation.mutate(
              { id, status },
              {
                onSuccess: () => setDetail(null),
              },
            );
          }}
          busy={statusMutation.isPending}
        />
      )}

      {/* Filtros */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="md">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Estado
              </label>
              <div className="space-y-1.5">
                {TABS.map((t) => {
                  const active = draftTab === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraftTab(t)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-between ${
                        active
                          ? 'bg-teal-50 border-teal-200 text-[#008080]'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{TAB_LABELS[t]}</span>
                      {active && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={clearDraftFilters}
                disabled={draftTab === 'ALL'}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  draftTab !== 'ALL'
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Limpiar
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
