'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { loadStripe, StripePaymentElementOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/hooks/use-auth';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = loadStripe(STRIPE_PK);

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: 'Activa',         color: 'text-green-700',  bg: 'bg-green-50' },
  PAST_DUE:  { label: 'Pago pendiente', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  SUSPENDED: { label: 'Suspendida',     color: 'text-red-700',    bg: 'bg-red-50' },
  CANCELLED: { label: 'Cancelada',      color: 'text-gray-600',   bg: 'bg-gray-100' },
};

interface SubscriptionData {
  id: string;
  status: string;
  planInterval: string;
  monthlyAmountUsd: number;
  annualAmountUsd: number | null;
  annualPeriodEnd: string | null;
  billedEmployeeCount: number;
  availableLicenses: number;
  nextBillingDate: string;
  lastPaymentDate: string | null;
  stripeSubscriptionId: string | null;
  advancePaid: boolean;
  cancelledAt: string | null;
}

interface PreviewData {
  activeEmployeeCount: number;
  baseAmount: number;
  employeeAmount: number;
  totalMonthly: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amountUsd: number;
  employeeCount: number | null;
  status: string;
  periodStart: string;
  paidAt: string | null;
}

type ModalType =
  | null
  | 'cancel-confirm'
  | 'cancel-success'
  | 'payment-success'
  | 'domiciliar'
  | 'advance-payment'
  | 'switch-annual';

function daysUntil(date: string) {
  return Math.max(0, dayjs(date).diff(dayjs(), 'day'));
}

function monthsUntil(date: string) {
  return Math.max(1, Math.ceil(dayjs(date).diff(dayjs(), 'month', true)));
}

// ─── Inline Payment Form ──────────────────────────────────────────────────────

interface InlinePaymentProps {
  title: string;
  subtitle?: string;
  amountUsd: number;
  breakdown?: { label: string; amount: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}

function InlinePaymentForm({ title, subtitle, amountUsd, breakdown, onSuccess, onCancel }: InlinePaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true); setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/settings/subscription` },
      redirect: 'if_required',
    });
    if (result.error) { setError(result.error.message || 'Error al procesar el pago.'); setLoading(false); }
    else onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <PaymentElement options={{ layout: 'tabs' } as StripePaymentElementOptions} />
      {breakdown && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5">
          {breakdown.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{row.label}</span>
              <span className="font-medium">{row.amount}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
            <span className="text-sm font-bold">Total</span>
            <span className="text-base font-black" style={{ color: TEAL }}>${amountUsd.toFixed(2)} MXN</span>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !stripe}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: TEAL }}>
          {loading ? 'Procesando...' : `Pagar $${amountUsd.toFixed(2)} MXN`}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Setup Form (domiciliar) ──────────────────────────────────────────────────

function SetupForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true); setError(null);
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/settings/subscription` },
      redirect: 'if_required',
    });
    if (result.error) { setError(result.error.message || 'Error.'); setLoading(false); }
    else onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' } as StripePaymentElementOptions} />
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !stripe}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: TEAL }}>
          {loading ? 'Guardando...' : 'Confirmar domiciliación'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        {onClose && (
          <div className="flex justify-end p-4 pb-0">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [modal, setModal] = useState<ModalType>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: subData, isLoading, refetch } = useQuery({
    queryKey: ['subscription-info'],
    queryFn: () => api.get<{ data: SubscriptionData }>('/api/subscription'),
  });
  const { data: previewData } = useQuery({
    queryKey: ['subscription-preview'],
    queryFn: () => api.get<{ data: PreviewData }>('/api/stripe/subscription/preview'),
  });
  const { data: invoicesData } = useQuery({
    queryKey: ['subscription-invoices'],
    queryFn: () => api.get<{ data: Invoice[] }>('/api/subscription/invoices'),
  });
  const { data: employeesData, refetch: refetchEmployees } = useQuery({
    queryKey: ['subscription-employees'],
    queryFn: () => api.get<{ data: any[]; meta: any }>('/api/employees?perPage=100&includeInactive=true'),
  });

  const sub: SubscriptionData | null = (subData as any)?.data || null;
  const preview: PreviewData | null = (previewData as any)?.data || null;
  const invoices: Invoice[] = (invoicesData as any)?.data || [];
  const allEmployees: any[] = (employeesData as any)?.data || [];
  const activeEmployees = allEmployees.filter((e) => e.isActive);

  function closeModal() { setModal(null); setClientSecret(null); setModalData(null); }

  // ── Activar / crear suscripción mensual
  const activateMutation = useMutation({
    mutationFn: () => api.post('/api/stripe/subscription/create', {}),
    onSuccess: (res: any) => {
      setError(null);
      const d = res?.data;
      if (d?.reactivated) {
        refetch();
      } else if (d?.clientSecret) {
        setModal(null);
        setClientSecret(d.clientSecret);
        setModalData({ type: 'activate' });
      } else {
        setError('No se pudo iniciar el pago. Intenta de nuevo.');
      }
    },
    onError: (e: any) => {
      // Mensaje claro cuando Stripe no esta configurado (tipico en local
      // o entornos demo). En vez del "Bad Request" generico.
      const msg = e?.message || '';
      if (msg.includes('STRIPE_PLATFORM_PRICE_ID')) {
        setError(
          'Los pagos no estan habilitados en este ambiente (Stripe no configurado). Contacta al administrador para activar tu suscripcion.',
        );
      } else {
        setError(msg || 'Error al activar.');
      }
    },
  });

  // ── Reactivar suscripción cancelada
  const reactivateMutation = useMutation({
    mutationFn: () => api.post('/api/stripe/subscription/reactivate', {}),
    onSuccess: (res: any) => {
      const d = res?.data;
      if (d?.reactivated) {
        closeModal();
        refetch();
      } else if (d?.clientSecret) {
        // Need to complete payment — show payment form
        setModal(null);
        setClientSecret(d.clientSecret);
        setModalData({ type: 'reactivate' });
      } else {
        setError('No se pudo reactivar. Intenta de nuevo o contacta soporte.');
      }
    },
    onError: (e: any) => setError(e?.message || 'Error al reactivar.'),
  });

  // ── Cancelar suscripción
  const cancelMutation = useMutation({
    mutationFn: () => api.post('/api/stripe/subscription/cancel', {}),
    onSuccess: (res: any) => {
      const accessUntil = res?.data?.accessUntil || sub?.nextBillingDate;
      setModal('cancel-success');
      setModalData({ accessUntil });
      refetch();
    },
  });

  // ── Pago anticipado
  const advanceMutation = useMutation({
    mutationFn: () => api.post('/api/stripe/subscription/advance-payment', {}),
    onSuccess: (res: any) => {
      const secret = res?.data?.clientSecret;
      if (secret) { setClientSecret(secret); setModal('advance-payment'); setModalData(res?.data); }
    },
  });

  // ── Confirmar pago anticipado (post-Stripe)
  const confirmAdvanceMutation = useMutation({
    mutationFn: () => api.post('/api/stripe/subscription/advance-payment/confirm', {}),
    onSuccess: () => { closeModal(); refetch(); },
  });

  // ── Cambiar a plan anual
  const switchAnnualMutation = useMutation({
    mutationFn: () => api.post('/api/stripe/subscription/switch-annual', {}),
    onSuccess: (res: any) => {
      const secret = res?.data?.clientSecret;
      if (secret) { setClientSecret(secret); setModal('switch-annual'); setModalData(res?.data); }
    },
  });

  // ── Setup intent (domiciliar)
  const setupMutation = useMutation({
    mutationFn: () => api.post('/api/stripe/subscription/setup-intent', {}),
    onSuccess: (res: any) => {
      const secret = res?.data?.clientSecret;
      if (secret) { setClientSecret(secret); setModal('domiciliar'); }
    },
  });

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: TEAL }} />
    </div>
  );

  const isActive = sub?.status === 'ACTIVE';
  const isCancelled = sub?.status === 'CANCELLED';
  const isMonthly = sub?.planInterval !== 'ANNUAL';
  const isAnnual = sub?.planInterval === 'ANNUAL';
  const statusCfg = sub ? (STATUS_CONFIG[sub.status] || STATUS_CONFIG.ACTIVE) : null;
  const daysLeft = sub?.nextBillingDate ? daysUntil(sub.nextBillingDate) : 0;
  const annualDaysLeft = sub?.annualPeriodEnd ? daysUntil(sub.annualPeriodEnd) : 0;
  const annualTotal = preview ? preview.totalMonthly * 12 * 0.85 : 0;

  const stripeOptions = clientSecret
    ? { clientSecret, appearance: { theme: 'stripe' as const, variables: { colorPrimary: TEAL } } }
    : undefined;

  // ─── Cancel confirm modal ────────────────────────────────────────────────
  function renderCancelConfirm() {
    const [typed, setTyped] = useState('');
    return (
      <Modal onClose={closeModal}>
        <div className="bg-red-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold">¿Cancelar tu suscripción?</h2>
          </div>
          <p className="text-sm text-red-100">Esta acción tiene consecuencias importantes.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-800">Al cancelar perderás acceso a:</p>
            {['Panel de administración y todas sus funciones', 'Tu perfil público en el marketplace', 'Sistema de reservas en línea para tus clientes', 'Historial de citas, clientes y reportes', 'Notificaciones y comunicaciones automáticas'].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-red-500 mt-0.5 flex-shrink-0">✕</span>{item}
              </div>
            ))}
          </div>
          <div className="rounded-xl px-4 py-3" style={{ backgroundColor: TEAL_LIGHT, border: `1px solid ${TEAL}` }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: TEAL }}>Acceso garantizado hasta</p>
            <p className="text-base font-bold text-gray-900">{dayjs(sub?.nextBillingDate).format('D [de] MMMM [de] YYYY')}</p>
            <p className="text-xs mt-0.5" style={{ color: '#006666' }}>{daysLeft} día{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''} del período ya pagado.</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Escribe <strong>cancelar</strong> para confirmar:</p>
            <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="cancelar"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          </div>
          <div className="flex gap-2">
            <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">Volver</button>
            <button onClick={() => cancelMutation.mutate()} disabled={typed.trim().toLowerCase() !== 'cancelar' || cancelMutation.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">
              {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Suscripción</h1>

      {/* ─── Modales ─────────────────────────────── */}

      {modal === 'cancel-confirm' && renderCancelConfirm()}

      {modal === 'cancel-success' && modalData && (
        <Modal onClose={() => { closeModal(); refetch(); }}>
          <div className="px-6 pt-6 pb-5 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📭</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Suscripción cancelada</h2>
              <p className="text-sm text-gray-500 mt-1">Tu suscripción fue cancelada correctamente.</p>
            </div>
            <div className="rounded-xl px-4 py-3 text-center" style={{ backgroundColor: TEAL_LIGHT, border: `1px solid ${TEAL}` }}>
              <p className="text-xs mb-1" style={{ color: '#006666' }}>Acceso activo hasta</p>
              <p className="text-base font-bold text-gray-900">{dayjs(modalData.accessUntil).format('D [de] MMMM [de] YYYY')}</p>
              <p className="text-sm font-semibold mt-1" style={{ color: TEAL }}>{daysUntil(modalData.accessUntil)} días restantes</p>
            </div>
            <ul className="text-xs text-gray-500 space-y-1">
              {['Panel de administración', 'Perfil público en el marketplace', 'Sistema de reservas en línea', 'Historial y reportes'].map((item) => (
                <li key={item} className="flex items-center gap-1.5"><span className="text-red-400">✕</span>{item}</li>
              ))}
            </ul>
            <p className="text-xs text-center text-gray-400">Si te resuscribes ahora, los días restantes se aplican al próximo ciclo.</p>
            <button onClick={() => { closeModal(); }} className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cerrar</button>
          </div>
        </Modal>
      )}

      {/* Pago inicial / activar */}
      {(modal === 'payment-success' || modal === null) && clientSecret && stripeOptions && (
        <Modal onClose={() => setClientSecret(null)}>
          <div className="px-6 py-5">
            <Elements stripe={stripePromise} options={stripeOptions}>
              <InlinePaymentForm
                title={isAnnual ? 'Activar plan anual' : 'Activar suscripción mensual'}
                subtitle={`$${preview?.totalMonthly.toFixed(2) || '—'} MXN/mes · pago seguro vía Stripe`}
                amountUsd={preview?.totalMonthly || 0}
                breakdown={preview ? [
                  { label: 'Licencia base (incluye todos los empleados)', amount: '$500.00 MXN' },
                ] : undefined}
                onSuccess={() => {
                  setClientSecret(null);
                  setModal(null);
                  setModalData({ nextBillingDate: dayjs().add(1, 'month').toISOString(), paid: true });
                  refetch();
                }}
                onCancel={() => setClientSecret(null)}
              />
            </Elements>
          </div>
        </Modal>
      )}

      {/* Plan anual - pago */}
      {modal === 'switch-annual' && clientSecret && stripeOptions && (
        <Modal onClose={closeModal}>
          <div className="px-6 py-5">
            <Elements stripe={stripePromise} options={stripeOptions}>
              <InlinePaymentForm
                title="Cambiar a plan anual"
                subtitle="15% de descuento · un solo pago por año"
                amountUsd={modalData?.annualTotal || annualTotal}
                breakdown={preview ? [
                  { label: 'Plan anual (12 meses × $500 MXN)', amount: `$${modalData?.annualTotal?.toFixed(2)} MXN` },
                  { label: 'Descuento anual (15%)', amount: '-$' + ((preview.totalMonthly * 12 * 0.15).toFixed(2)) + ' MXN' },
                ] : undefined}
                onSuccess={() => { closeModal(); refetch(); }}
                onCancel={closeModal}
              />
            </Elements>
          </div>
        </Modal>
      )}

      {/* Pago anticipado */}
      {modal === 'advance-payment' && clientSecret && stripeOptions && (
        <Modal onClose={closeModal}>
          <div className="px-6 py-5">
            <Elements stripe={stripePromise} options={stripeOptions}>
              <InlinePaymentForm
                title="Adelantar mensualidad"
                subtitle={`Extiende tu acceso hasta ${dayjs(sub?.nextBillingDate).add(1, 'month').format('D [de] MMMM [de] YYYY')}`}
                amountUsd={modalData?.amount || sub?.monthlyAmountUsd || 0}
                onSuccess={() => {
                  confirmAdvanceMutation.mutate();
                }}
                onCancel={closeModal}
              />
            </Elements>
          </div>
        </Modal>
      )}

      {/* Domiciliar tarjeta */}
      {modal === 'domiciliar' && clientSecret && stripeOptions && (
        <Modal onClose={closeModal}>
          <div className="px-6 py-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Domiciliar tarjeta</h2>
            <p className="text-sm text-gray-500 mb-5">Cobro automático mensual sin interrupciones.</p>
            <Elements stripe={stripePromise} options={stripeOptions}>
              <SetupForm onSuccess={() => { closeModal(); refetch(); }} onCancel={closeModal} />
            </Elements>
          </div>
        </Modal>
      )}

      {/* ─── Error global ────────────────────────── */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
        </div>
      )}

      {/* ─── Grid 2 columnas ─────────────────────── */}
      <div className="mt-6 flex flex-col xl:flex-row gap-6 items-start">

      {/* ── Columna izquierda (estado + licencias + historial) ── */}
      <div className="w-full xl:w-[55%] min-w-0 space-y-6">

      {/* ─── Card estado ─────────────────────────── */}
      {sub && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">Estado de la suscripción</h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ backgroundColor: isAnnual ? '#fef3c7' : TEAL_LIGHT, color: isAnnual ? '#92400e' : TEAL }}>
                {isAnnual ? '⭐ Anual' : '📅 Mensual'}
              </span>
            </div>
            {statusCfg && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            )}
          </div>

          {/* Métricas */}
          <div className="px-6 py-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">{isAnnual ? 'Total anual' : 'Costo mensual'}</p>
              <p className="text-xl font-black text-gray-900">
                ${isAnnual ? Number(sub.annualAmountUsd || 0).toFixed(0) : Number(sub.monthlyAmountUsd).toFixed(0)}
                <span className="text-sm font-medium text-gray-400"> MXN</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{isCancelled ? 'Acceso hasta' : isAnnual ? 'Renovación anual' : 'Próximo cobro'}</p>
              <p className="text-sm font-semibold text-gray-900">
                {dayjs(isAnnual ? sub.annualPeriodEnd || sub.nextBillingDate : sub.nextBillingDate).format('D MMM YYYY')}
              </p>
              {isCancelled && <p className="text-xs font-medium" style={{ color: TEAL }}>{daysLeft} días restantes</p>}
              {isAnnual && !isCancelled && <p className="text-xs text-gray-400">{annualDaysLeft} días restantes</p>}
            </div>
            {isAnnual && sub.availableLicenses > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Licencias disponibles</p>
                <p className="text-xl font-black" style={{ color: TEAL }}>{sub.availableLicenses}</p>
                <p className="text-xs text-gray-400">listas para asignar</p>
              </div>
            )}
            {sub.lastPaymentDate && !isAnnual && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Último pago</p>
                <p className="text-sm font-semibold text-gray-900">{dayjs(sub.lastPaymentDate).format('D MMM YYYY')}</p>
              </div>
            )}
          </div>

          {/* Pago anticipado activo */}
          {sub.advancePaid && isMonthly && (
            <div className="mx-6 mb-4 p-3 rounded-xl text-sm text-green-800 flex items-center gap-2" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              ✅ Tienes un mes adelantado. Tu acceso está extendido hasta {dayjs(sub.nextBillingDate).format('D [de] MMMM')}.
            </div>
          )}

          {/* Banners de estado */}
          {isCancelled && daysLeft > 0 && (
            <div className="mx-6 mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: TEAL_LIGHT, border: `1px solid ${TEAL}`, color: '#005555' }}>
              📅 Suscripción cancelada. Acceso activo hasta el <strong>{dayjs(sub.nextBillingDate).format('D [de] MMMM')}</strong>.
            </div>
          )}
          {sub.status === 'PAST_DUE' && (
            <div className="mx-6 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
              ⚠️ Hay un pago pendiente. Realiza tu pago para evitar la suspensión.
            </div>
          )}
          {sub.status === 'SUSPENDED' && (
            <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              🔒 Cuenta suspendida por falta de pago. Regulariza tu suscripción para recuperar el acceso.
            </div>
          )}

          {/* Botones */}
          <div className="px-6 pb-5 flex gap-2 flex-wrap">
            {/* Cancelada → reactivar */}
            {isCancelled && (
              <button onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: TEAL }}>
                {reactivateMutation.isPending ? 'Procesando...' : '↩ Reactivar suscripción'}
              </button>
            )}

            {/* Sin stripe o suspendida → activar */}
            {!sub.stripeSubscriptionId && !isCancelled && (
              <button onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: TEAL }}>
                {activateMutation.isPending ? 'Preparando...' : 'Activar suscripción'}
              </button>
            )}

            {/* Pago pendiente */}
            {(sub.status === 'PAST_DUE' || sub.status === 'SUSPENDED') && (
              <button onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: TEAL }}>
                {activateMutation.isPending ? 'Preparando...' : 'Realizar pago'}
              </button>
            )}

            {/* Activo mensual: adelantar */}
            {isActive && isMonthly && !sub.advancePaid && (
              <button onClick={() => advanceMutation.mutate()} disabled={advanceMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-medium border disabled:opacity-50"
                style={{ borderColor: TEAL, color: TEAL }}>
                {advanceMutation.isPending ? 'Preparando...' : '📅 Adelantar un mes'}
              </button>
            )}

            {/* Activo: domiciliar */}
            {isActive && (
              <button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-medium border disabled:opacity-50"
                style={{ borderColor: TEAL, color: TEAL }}>
                {setupMutation.isPending ? 'Preparando...' : '💳 Domiciliar tarjeta'}
              </button>
            )}

            {/* Activo con stripe ID: cancelar */}
            {sub.stripeSubscriptionId && isActive && (
              <button onClick={() => setModal('cancel-confirm')}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50">
                Cancelar suscripción
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Plan + costo (modelo flat) ─────────── */}
      {sub && isActive && preview && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* ── Cabecera ── */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Tu plan</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {(user as any)?.tenantType === 'FREELANCER'
                  ? 'Plan individual sin equipo'
                  : `${activeEmployees.length} empleado${activeEmployees.length !== 1 ? 's' : ''} activo${activeEmployees.length !== 1 ? 's' : ''} · incluidos sin cargo adicional`}
              </p>
            </div>
            {(user as any)?.tenantType !== 'FREELANCER' && (
              <Link
                href="/staff"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Gestionar personal
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>

          {/* ── Card del plan unico ── */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: TEAL_LIGHT, border: `1px solid ${TEAL}` }}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: TEAL }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold" style={{ color: TEAL }}>
                    Siliba {(user as any)?.tenantType === 'FREELANCER' ? 'Pro' : 'Plus'}
                  </p>
                  <p className="text-xs" style={{ color: '#005555' }}>
                    {(user as any)?.tenantType === 'FREELANCER'
                      ? 'Plan PRO, para profesionales independientes'
                      : 'Equipo ilimitado, todas las funciones'}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-black" style={{ color: TEAL }}>
                  ${preview.totalMonthly.toFixed(0)}
                  <span className="text-sm font-medium" style={{ color: '#005555' }}> MXN/mes</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Totales ── */}
          <div className="px-6 py-4 border-t border-gray-100 space-y-2">
            {isAnnual && (
              <div className="flex items-center justify-between text-xs" style={{ color: TEAL }}>
                <span>Descuento anual aplicado (15%)</span>
                <span className="font-semibold">-${(preview.totalMonthly * 0.15 * 12).toFixed(2)} MXN/año</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">{isAnnual ? 'Total anual' : 'Total mensual'}</span>
              <span className="text-lg font-black" style={{ color: TEAL }}>
                ${isAnnual ? annualTotal.toFixed(0) : preview.totalMonthly.toFixed(2)} MXN
              </span>
            </div>
          </div>

        </div>
      )}

      {/* ─── Personal afiliado (solo BUSINESS, sin costo por licencia) ─── */}
      {sub && isActive && (user as any)?.tenantType !== 'FREELANCER' && activeEmployees.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Personal afiliado</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeEmployees.length} {activeEmployees.length === 1 ? 'persona con acceso' : 'personas con acceso'} a Siliba · sin cargo adicional
              </p>
            </div>
            <Link
              href="/staff"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Gestionar
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="divide-y divide-gray-50 px-2 py-2">
            {activeEmployees.map((emp) => (
              <Link
                key={emp.id}
                href={`/staff/${emp.id}`}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: emp.color || TEAL }}
                  >
                    {emp.avatarUrl
                      ? <img src={emp.avatarUrl.startsWith('http') ? emp.avatarUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${emp.avatarUrl}`} alt={`${emp.firstName} ${emp.lastName}`} className="w-full h-full object-cover" />
                      : <span>{emp.firstName?.[0]}{emp.lastName?.[0]}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:underline">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-gray-400 truncate">{emp.email || 'Sin correo'}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
                  Activa
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ─── Historial ───────────────────────────── */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Historial de pagos</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <div key={inv.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{dayjs(inv.periodStart).format('MMM YYYY')}</p>
                  <p className="text-xs text-gray-400">{inv.invoiceNumber}{inv.employeeCount != null && ` · ${inv.employeeCount} empleado${inv.employeeCount !== 1 ? 's' : ''}`}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${Number(inv.amountUsd).toFixed(2)} MXN</p>
                  <span className={`text-xs font-medium ${inv.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {inv.status === 'PAID' ? 'Pagado' : 'Pendiente'}{inv.paidAt && ` · ${dayjs(inv.paidAt).format('D MMM YYYY')}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>{/* fin columna izquierda */}

      {/* ── Columna derecha (CTA anual + info) ── */}
      <div className="w-full xl:w-[45%] xl:flex-shrink-0 space-y-6">

      {/* ─── Upgrade a PLUS — CTA principal para freelancer ──────────── */}
      {preview && isActive && (user as any)?.tenantType === 'FREELANCER' && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-md" style={{ border: `2px solid ${TEAL}` }}>
          {/* Header con gradiente teal — accion principal */}
          <div className="px-6 py-5" style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #006666 100%)` }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
                  </svg>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white tracking-wide uppercase">
                    Plan PLUS
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">Mejora a PLUS</h2>
                <p className="text-sm text-white/80 mt-0.5">Equipo, roles, asistencias y tienda online</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white">$500</p>
                <p className="text-xs text-white/70">MXN/mes</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div className="space-y-2">
              {[
                'Gestiona un equipo completo de empleados',
                'Roles y permisos personalizados',
                'Codigos de invitacion para tu equipo',
                'Control de asistencias',
                'Tienda online: vende productos a tus clientes',
              ].map((txt) => (
                <div key={txt} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: TEAL }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {txt}
                </div>
              ))}
            </div>
            <button
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: TEAL }}
              onClick={() => setError('La migracion a Plus aun no esta implementada en este ambiente. Pronto disponible.')}
            >
              Mejorar a PLUS ahora · $500 MXN/mes
            </button>
            <Link
              href="/employee/upgrade-to-plus"
              className="block text-center text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Ver comparativa completa →
            </Link>
          </div>
        </div>
      )}

      {/* ─── Plan anual CTA — secundario ─────────── */}
      {preview && isActive && isMonthly && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Header neutro (no se ve "ya seleccionado") */}
          <div className="px-6 py-5 bg-gray-50 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white tracking-wide uppercase" style={{ backgroundColor: TEAL }}>
                    Ahorra 15%
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-2">Cambiar a Plan Anual</h2>
                <p className="text-sm text-gray-500 mt-0.5">Un solo pago al año · sin cobros mensuales</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-gray-900">${(annualTotal / 12).toFixed(0)}</p>
                <p className="text-xs text-gray-500">MXN/mes equiv.</p>
                <p className="text-xs text-gray-400 mt-0.5">${annualTotal.toFixed(0)} MXN/año</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Comparativa */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1 font-medium">Tu plan actual</p>
                <p className="text-lg font-black text-gray-900">
                  ${preview.totalMonthly.toFixed(0)}
                  <span className="text-xs font-normal text-gray-400">/mes</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">${(preview.totalMonthly * 12).toFixed(0)} MXN/año</p>
              </div>
              <div className="rounded-xl px-4 py-3 relative overflow-hidden" style={{ backgroundColor: TEAL_LIGHT, border: `1.5px solid ${TEAL}` }}>
                <p className="text-xs font-semibold mb-1" style={{ color: TEAL }}>Plan anual</p>
                <p className="text-lg font-black" style={{ color: TEAL }}>
                  ${(annualTotal / 12).toFixed(0)}
                  <span className="text-xs font-normal" style={{ color: '#006666' }}>/mes equiv.</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#006666' }}>
                  Ahorras ${(preview.totalMonthly * 12 * 0.15).toFixed(0)} MXN/año
                </p>
              </div>
            </div>

            {/* Beneficios */}
            <div className="space-y-2">
              {[
                'Un solo cobro al año, sin cobros mensuales recurrentes',
                'Equivalente a 1.8 meses gratis al año vs. pago mensual',
                'Sin riesgo de suspension por pago atrasado',
              ].map((txt) => (
                <div key={txt} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: TEAL }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {txt}
                </div>
              ))}
            </div>

            <button
              onClick={() => switchAnnualMutation.mutate()}
              disabled={switchAnnualMutation.isPending}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-white transition-all hover:bg-gray-50 disabled:opacity-50"
              style={{ border: `1.5px solid ${TEAL}`, color: TEAL }}
            >
              {switchAnnualMutation.isPending ? 'Preparando...' : `Cambiar a plan anual · $${annualTotal.toFixed(0)} MXN/año`}
            </button>
          </div>
        </div>
      )}

      {/* ─── Info ────────────────────────────────── */}
      <div className="rounded-2xl p-5 border border-dashed border-gray-200 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700 mb-2">¿Cómo funciona la facturación?</p>
        <ul className="text-xs text-gray-500 space-y-1.5 list-disc list-inside">
          {(user as any)?.tenantType === 'FREELANCER' ? (
            <li>$300 MXN/mes plan Pro — uso individual, sin equipo</li>
          ) : (
            <li>$500 MXN/mes plan Plus — incluye a todos tus empleados sin cobro adicional</li>
          )}
          <li>Plan anual: 15% de descuento, un solo pago por todos los meses del año</li>
          <li>Si cancelas, mantienes acceso hasta el final del período ya pagado</li>
          <li>Puedes adelantar un mes de mensualidad para extender tu acceso</li>
        </ul>
      </div>

      </div>{/* fin columna derecha */}
      </div>{/* fin grid */}
    </div>
  );
}
