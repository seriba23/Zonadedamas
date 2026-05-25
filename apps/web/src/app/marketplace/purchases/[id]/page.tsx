'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { formatBookingDate } from '@/lib/booking-time';
import { formatCurrency } from '@/lib/utils';
import { WhatsAppButton } from '@/components/ui/whatsapp-button';
import { buildPurchaseMessage } from '@/lib/whatsapp';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  PENDING:   { text: 'Apartado',   bg: '#fef3c7', color: '#d97706' },
  CONFIRMED: { text: 'Confirmado', bg: '#ccfbf1', color: '#0d9488' },
  READY:     { text: 'Listo',      bg: '#dbeafe', color: '#2563eb' },
  DELIVERED: { text: 'Entregado',  bg: '#d1fae5', color: '#059669' },
  CANCELLED: { text: 'Cancelado',  bg: '#fee2e2', color: '#dc2626' },
};

const FULFILLMENT_LABELS: Record<string, string> = {
  PICKUP: 'Recoger en tienda',
  SHIPPING: 'Envío a domicilio',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  SPEI: 'SPEI / Transferencia',
  CARD: 'Tarjeta',
};

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-purchases'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-purchases'),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const purchases: any[] = (data as any)?.data || [];
  const purchase = purchases.find((p) => p.id === id);

  useEffect(() => {
    if (!isLoading && !authLoading && !purchase && purchases.length > 0) {
      router.replace('/marketplace/appointments');
    }
  }, [isLoading, authLoading, purchase, purchases.length]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: '#008080' }} />
      </div>
    );
  }

  if (!purchase) return null;

  const style = STATUS_LABEL[purchase.status] || { text: purchase.status, bg: '#f3f4f6', color: '#6b7280' };
  const total = Number(purchase.unitPrice) * purchase.quantity + (Number(purchase.shippingCost) || 0);
  const currency = purchase.product?.currency || 'MXN';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pb-3 safe-top">
        <div className="max-w-2xl mx-auto pt-2 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Detalle de compra</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Business card + WhatsApp */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {purchase.tenant?.logoUrl ? (
              <img src={`${API_URL}${purchase.tenant.logoUrl}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-gray-400">{purchase.tenant?.name?.[0]}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{purchase.tenant?.name}</p>
            <button
              onClick={() => router.push(`/marketplace/${purchase.tenant?.slug}`)}
              className="text-xs mt-0.5"
              style={{ color: '#008080' }}
            >
              Ver negocio →
            </button>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: style.bg, color: style.color }}
            >
              {style.text}
            </span>
            <WhatsAppButton
              phone={purchase.tenant?.businessPhone}
              message={buildPurchaseMessage({
                tenantName: purchase.tenant?.name || 'el negocio',
                productName: purchase.product?.name,
                code: purchase.code,
                reservationId: purchase.id,
              })}
              label="WhatsApp"
            />
          </div>
        </div>

        {/* Producto */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Producto</h2>
          <div className="flex gap-3">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-gray-300 flex-shrink-0">
              {purchase.product?.imageUrl ? (
                <img src={`${API_URL}${purchase.product.imageUrl}`} alt={purchase.product.name} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{purchase.product?.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {purchase.quantity}× {formatCurrency(Number(purchase.unitPrice), currency)}
              </p>
              {purchase.code && (
                <p className="text-[10px] font-mono text-gray-400 mt-1">Ref: #{purchase.code}</p>
              )}
            </div>
            <p className="text-base font-bold text-gray-900 tabular-nums">
              {formatCurrency(Number(purchase.unitPrice) * purchase.quantity, currency)}
            </p>
          </div>
          {Number(purchase.shippingCost) > 0 && (
            <div className="flex justify-between mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Envío</p>
              <p className="text-xs text-gray-700">{formatCurrency(Number(purchase.shippingCost), currency)}</p>
            </div>
          )}
          <div className="flex justify-between mt-3 pt-3 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Total</p>
            <p className="text-sm font-semibold text-gray-900">{formatCurrency(total, currency)}</p>
          </div>
        </div>

        {/* Entrega y pago */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Entrega y pago</h2>
          <div className="flex justify-between">
            <p className="text-xs text-gray-500">Forma de entrega</p>
            <p className="text-xs text-gray-900">{FULFILLMENT_LABELS[purchase.fulfillmentType] || purchase.fulfillmentType}</p>
          </div>
          <div className="flex justify-between">
            <p className="text-xs text-gray-500">Forma de pago</p>
            <p className="text-xs text-gray-900">{PAYMENT_LABELS[purchase.preferredPaymentMethod] || purchase.preferredPaymentMethod}</p>
          </div>
          {purchase.shippingAddress && (
            <div className="pt-2 mt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Dirección</p>
              <p className="text-xs text-gray-700">{purchase.shippingAddress}</p>
            </div>
          )}
          <div className="flex justify-between pt-2 mt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">Fecha de apartado</p>
            <p className="text-xs text-gray-700">{formatBookingDate(purchase.createdAt, 'long')}</p>
          </div>
        </div>

        {/* Cita asociada (si tiene) */}
        {purchase.appointmentId && purchase.appointment?.startTime && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[11px] text-gray-500">
              Este producto debe ser pagado el día de tu cita:{' '}
              <span className="font-semibold text-gray-700">
                {formatBookingDate(purchase.appointment.startTime, 'long')}
              </span>
            </p>
          </div>
        )}

        {/* Comprobante de pago — estilo plano */}
        {purchase.status !== 'CANCELLED' && purchase.status !== 'DELIVERED' && (
          <PurchaseProofRow purchase={purchase} />
        )}

        {/* Notas */}
        {purchase.notes && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Notas</h2>
            <p className="text-sm text-gray-600">{purchase.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PurchaseProofRow({ purchase }: { purchase: any }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = marketplaceApi.getAccessToken();
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(
        `${API_URL}/api/public/${purchase.tenant.slug}/shop/reservations/${purchase.id}/payment-proof`,
        { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo subir el comprobante');
      }
      return r.json();
    },
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-purchases'] });
    },
    onError: (err: any) => setError(err?.message || 'Error al subir el comprobante'),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Comprobante de pago</h2>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: purchase.paymentProofUrl ? '#059669' : '#d1d5db' }}
          />
          {purchase.paymentProofUrl ? 'Pagado' : 'Pago pendiente'}
        </span>
      </div>
      {purchase.paymentProofUrl ? (
        <>
          <a
            href={`${API_URL}${purchase.paymentProofUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg overflow-hidden border border-gray-200 hover:border-[#008080] transition-colors"
          >
            <img src={`${API_URL}${purchase.paymentProofUrl}`} alt="Comprobante" className="max-h-40 object-contain mx-auto" />
          </a>
          <label className="block mt-3 text-xs text-[#008080] cursor-pointer hover:underline">
            Reemplazar comprobante
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 5 * 1024 * 1024) { setError('La imagen no puede pesar más de 5MB'); return; }
                  uploadMutation.mutate(f);
                }
              }}
            />
          </label>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Sube la captura de tu pago (transferencia, depósito o cargo) para que el negocio confirme tu apartado.
          </p>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-medium cursor-pointer transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {uploadMutation.isPending ? 'Subiendo...' : 'Subir comprobante'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploadMutation.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 5 * 1024 * 1024) { setError('La imagen no puede pesar más de 5MB'); return; }
                  uploadMutation.mutate(f);
                }
              }}
            />
          </label>
        </>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
