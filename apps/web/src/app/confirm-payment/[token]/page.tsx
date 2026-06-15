'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DualReviewModal } from '@/components/ui/dual-review-modal';
import { ConfettiCelebration } from '@/components/ui/confetti-celebration';

const TEAL = '#008080';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AppointmentData {
  id: string;
  status: string;
  startTime: string;
  confirmedAt: string | null;
  discountAmount?: string | number | null;
  client?: { firstName: string; lastName: string; avatarUrl: string | null } | null;
  employee?: { id: string; firstName: string; lastName: string; avatarUrl: string | null; color: string | null } | null;
  items?: Array<{
    serviceNameSnapshot: string;
    priceSnapshot: string | number;
    durationSnapshot: number;
    serviceId: string;
  }>;
  productReservations?: Array<{
    id: string;
    quantity: number;
    unitPrice: string | number;
    product: { id: string; name: string; imageUrl: string | null };
  }>;
  redemption?: {
    id: string;
    code: string;
    reward: {
      name: string;
      type: 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE';
      discountAmount: string | number | null;
      discountMode: 'FLAT' | 'PERCENTAGE' | null;
    };
  } | null;
  payments?: Array<{ paymentMethod: string; totalAmount: string | number; status: string; createdAt: string }>;
  photos?: Array<{ id: string; imageUrl: string; serviceId: string }>;
  tenant?: {
    name: string;
    slug: string;
    logoUrl: string | null;
    coverImageUrl: string | null;
    tenantType: 'FREELANCER' | 'BUSINESS';
    confettiEnabled: boolean | null;
    confettiStyle: string | null;
    confettiStyles: string[] | null;
    confettiColors: string[] | null;
  } | null;
  review?: { id: string; rating: number; businessRating: number | null } | null;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  STRIPE: 'Tarjeta',
  OTHER: 'Otro',
};

function formatCurrency(n: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(n);
}

export default function ConfirmPaymentPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/public/confirm-payment/${token}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Este enlace no es válido o expiró.' : 'No se pudo cargar la cita.');
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json.data);
          // Si ya está confirmada y aún no dejó reseña, abrir directamente el wizard.
          if (json.data?.confirmedAt && !json.data?.review) {
            setShowReview(true);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Error desconocido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch(`${API_URL}/api/public/confirm-payment/${token}/confirm`, { method: 'POST' });
      if (!res.ok) throw new Error('No se pudo confirmar el cobro');
      const json = await res.json();
      setData((prev) => prev ? { ...prev, confirmedAt: json.data.confirmedAt } : prev);
      setShowReview(true);
    } catch (e: any) {
      setError(e?.message || 'Error al confirmar');
    } finally {
      setConfirming(false);
    }
  }

  async function handleSubmitReview(payload: {
    rating: number;
    comment?: string;
    businessRating?: number;
    businessComment?: string;
  }) {
    setSubmittingReview(true);
    try {
      const res = await fetch(`${API_URL}/api/public/confirm-payment/${token}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'No se pudo enviar la reseña');
      }
      setReviewSubmitted(true);
      setShowReview(false);
    } catch (e: any) {
      alert(e?.message || 'Error al enviar reseña');
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-gray-200 animate-spin" style={{ borderTopColor: TEAL }} />
          <p className="text-sm text-gray-500 mt-3">Cargando tu cita...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-900 mb-1">No se pudo cargar</p>
          <p className="text-sm text-gray-500">{error || 'Enlace no válido'}</p>
        </div>
      </div>
    );
  }

  const items = data.items ?? [];
  const products = data.productReservations ?? [];
  const photos = data.photos ?? [];
  const payments = data.payments ?? [];
  const subtotal = items.reduce((s, i) => s + Number(i.priceSnapshot ?? 0), 0)
    + products.reduce((s, p) => s + Number(p.unitPrice ?? 0) * Number(p.quantity ?? 1), 0);
  const discount = Number(data.discountAmount ?? 0);
  const total = Math.max(0, subtotal - discount);
  const payment = payments[0];
  const isConfirmed = !!data.confirmedAt;
  const hasReview = !!data.review || reviewSubmitted;
  const tenant = data.tenant;
  const employee = data.employee;
  const redemption = data.redemption;
  const tenantName = tenant?.name || 'Negocio';
  const tenantSlug = tenant?.slug || '';
  const employeeFirst = employee?.firstName || '';
  const employeeLast = employee?.lastName || '';
  const employeeInitials = (employeeFirst[0] || '') + (employeeLast[0] || '');
  const coverUrl = tenant?.coverImageUrl
    ? (tenant.coverImageUrl.startsWith('http') ? tenant.coverImageUrl : `${API_URL}${tenant.coverImageUrl}`)
    : null;

  // Pantalla full de "¡Gracias!" con confetti cuando ya esta confirmada
  // y calificada (igual al AppointmentSuccessSheet de la reserva).
  if (isConfirmed && hasReview) {
    return (
      <ThanksScreen
        tenantName={tenantName}
        tenantSlug={tenantSlug}
        confettiEnabled={tenant?.confettiEnabled !== false}
        confettiShapes={tenant?.confettiStyles ?? null}
        confettiShape={tenant?.confettiStyle ?? null}
        confettiColors={tenant?.confettiColors ?? null}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header con portada (si existe) o color teal fijo */}
      <div className="relative text-white px-4 pt-8 pb-6 text-center overflow-hidden" style={{ backgroundColor: TEAL }}>
        {coverUrl && (
          <>
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Overlay para que el texto blanco siga siendo legible */}
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}
        <div className="relative">
          {tenant?.logoUrl ? (
            <img
              src={tenant.logoUrl.startsWith('http') ? tenant.logoUrl : `${API_URL}${tenant.logoUrl}`}
              alt={tenantName}
              className="w-16 h-16 mx-auto rounded-full object-cover mb-3 bg-white ring-2 ring-white/60"
            />
          ) : (
            <div className="w-16 h-16 mx-auto rounded-full bg-white/15 flex items-center justify-center text-xl font-bold mb-3 ring-2 ring-white/60">
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="text-xs uppercase tracking-wider opacity-80">Tu cita en</p>
          <h1 className="text-lg font-bold mt-0.5">{tenantName}</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-3 space-y-3">
        {/* Card cita */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            {employee?.avatarUrl ? (
              <img
                src={employee.avatarUrl.startsWith('http') ? employee.avatarUrl : `${API_URL}${employee.avatarUrl}`}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{ backgroundColor: `${employee?.color || TEAL}20`, color: employee?.color || TEAL }}
              >
                {employeeInitials || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400">Atendido por</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {employeeFirst} {employeeLast}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 flex-1 min-w-0 truncate pr-2">{item.serviceNameSnapshot}</span>
                <span className="font-medium text-gray-900 tabular-nums flex-shrink-0">{formatCurrency(Number(item.priceSnapshot))}</span>
              </div>
            ))}
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 flex-1 min-w-0 truncate pr-2">
                  {p.product.name} <span className="text-gray-400">× {p.quantity}</span>
                </span>
                <span className="font-medium text-gray-900 tabular-nums flex-shrink-0">
                  {formatCurrency(Number(p.unitPrice) * Number(p.quantity))}
                </span>
              </div>
            ))}
          </div>

          {/* Cupón aplicado — mini-ticket teal con stub a la izquierda */}
          {redemption && discount > 0 && (
            <div className="border-t border-gray-100 mt-3 pt-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cupón aplicado</p>
              <div className="relative bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm flex" style={{ minHeight: 56 }}>
                <div
                  className="w-16 flex-shrink-0 flex flex-col items-center justify-center relative"
                  style={{ backgroundColor: TEAL }}
                >
                  <span className="text-white font-black text-sm leading-tight">
                    -{formatCurrency(discount)}
                  </span>
                  <span className="text-white/70 text-[9px] uppercase tracking-wider">cupón</span>
                  <div className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-white" />
                  <div className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-white" />
                </div>
                <div className="flex flex-col items-center justify-center w-3 flex-shrink-0 gap-[2px] py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[2px] h-[2px] rounded-full bg-gray-300" />
                  ))}
                </div>
                <div className="flex-1 py-2 pr-3 flex items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{redemption.reward.name}</p>
                    <p className="font-mono text-[10px] font-semibold text-gray-500 mt-0.5">{redemption.code}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            {discount > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-700 tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Descuento</span>
                  <span className="text-gray-700 tabular-nums">-{formatCurrency(discount)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-bold text-gray-900">Total</span>
              <span className="text-xl font-black tabular-nums" style={{ color: TEAL }}>{formatCurrency(total)}</span>
            </div>
          </div>

          {payment && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-gray-50 text-xs text-gray-600 flex items-center justify-between">
              <span>Método de pago</span>
              <span className="font-semibold text-gray-900">{PAYMENT_METHOD_LABEL[payment.paymentMethod] || payment.paymentMethod}</span>
            </div>
          )}
        </div>

        {/* Fotos del resultado */}
        {photos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Fotos del resultado</p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={p.imageUrl.startsWith('http') ? p.imageUrl : `${API_URL}${p.imageUrl}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado / CTA */}
        {!isConfirmed && (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: TEAL }}
          >
            {confirming ? 'Confirmando...' : 'Confirmar cobro y calificar'}
          </button>
        )}

        {isConfirmed && !hasReview && !showReview && (
          <button
            onClick={() => setShowReview(true)}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: TEAL }}
          >
            Dejar mi calificación
          </button>
        )}

        <p className="text-[11px] text-center text-gray-400 px-4">
          Esta página es solo para confirmar el cobro de esta cita.
        </p>
      </div>

      <DualReviewModal
        show={showReview && !hasReview}
        employeeName={`${employeeFirst} ${employeeLast}`.trim()}
        businessName={tenantName}
        mode={tenant?.tenantType === 'FREELANCER' ? 'freelancer' : 'business'}
        onSubmit={handleSubmitReview}
        onSkip={() => setShowReview(false)}
        isLoading={submittingReview}
      />
    </div>
  );
}

/**
 * Pantalla completa de "Gracias" con confeti. Se muestra cuando la cita
 * ya está confirmada y calificada. Mismo estilo que el sheet de
 * "Reserva confirmada" del flujo de booking.
 */
function ThanksScreen({
  tenantName,
  tenantSlug,
  confettiEnabled,
  confettiShapes,
  confettiShape,
  confettiColors,
}: {
  tenantName: string;
  tenantSlug: string;
  confettiEnabled: boolean;
  confettiShapes: string[] | null;
  confettiShape: string | null;
  confettiColors: string[] | null;
}) {
  const [confettiDone, setConfettiDone] = useState(false);
  // Color fijo teal — la confirmacion NO es personalizable por tenant.
  // Solo el confeti respeta los colores configurados (parte de la marca
  // del cliente, no de la confirmacion).
  return (
    <>
      {confettiEnabled && (
        <ConfettiCelebration
          show={!confettiDone}
          duration={5000}
          particlesPerBurst={20}
          shapes={confettiShapes}
          shape={confettiShape}
          colors={confettiColors}
          onComplete={() => setConfettiDone(true)}
        />
      )}
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-10">
        <div
          className="w-full max-w-sm bg-white rounded-2xl border-2 overflow-hidden text-center"
          style={{ borderColor: TEAL }}
        >
          <div className="px-6 pt-8 pb-2">
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: '#e0f2f1' }}
            >
              <svg className="w-10 h-10" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">¡Gracias!</h1>
            <p className="text-sm text-gray-500">
              Tu calificación fue enviada. Esperamos verte pronto en{' '}
              <span className="font-semibold text-gray-700">{tenantName}</span>.
            </p>
          </div>
          {tenantSlug && (
            <div className="border-t border-gray-100 p-4">
              <Link
                href={`/marketplace/${tenantSlug}`}
                className="block w-full py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: TEAL }}
              >
                Ver perfil del negocio
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
