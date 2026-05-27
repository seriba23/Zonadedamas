'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { loadStripe, StripePaymentElementOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '@/lib/api';
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
  | 'switch-annual'
  | 'add-licenses';

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
            <span className="text-base font-black" style={{ color: TEAL }}>${amountUsd.toFixed(2)} USD</span>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !stripe}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: TEAL }}>
          {loading ? 'Procesando...' : `Pagar $${amountUsd.toFixed(2)} USD`}
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

  const releaseLicenseMutation = useMutation({
    mutationFn: (employeeId: string) => api.put(`/api/employees/${employeeId}`, { isActive: false }),
    onSuccess: () => { refetch(); refetchEmployees(); },
  });

  const sub: SubscriptionData | null = (subData as any)?.data || null;
  const preview: PreviewData | null = (previewData as any)?.data || null;
  const invoices: Invoice[] = (invoicesData as any)?.data || [];
  const allEmployees: any[] = (employeesData as any)?.data || [];
  const activeEmployees = allEmployees.filter((e) => e.isActive);
  const inactiveEmployees = allEmployees.filter((e) => !e.isActive);

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
    onError: (e: any) => setError(e?.message || 'Error al activar.'),
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

  // ── Agregar licencias (plan anual)
  const addLicensesMutation = useMutation({
    mutationFn: (count: number) => api.post('/api/stripe/subscription/add-licenses', { count }),
    onSuccess: (res: any) => {
      const d = res?.data;
      if (!d?.charged) { closeModal(); refetch(); }
      else { setClientSecret(d.clientSecret); setModal('add-licenses'); setModalData(d); }
    },
  });

  const confirmLicensesMutation = useMutation({
    mutationFn: (d: { toCharge: number; freeFromPool: number }) =>
      api.post('/api/stripe/subscription/add-licenses/confirm', d),
    onSuccess: () => { closeModal(); refetch(); },
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

      {/* Agregar licencias */}
      {modal === 'add-licenses' && clientSecret && stripeOptions && (
        <Modal onClose={closeModal}>
          <div className="px-6 py-5">
            <Elements stripe={stripePromise} options={stripeOptions}>
              <InlinePaymentForm
                title="Agregar licencia"
                subtitle={`${modalData?.monthsLeft} mes(es) restantes en tu plan anual · 15% desc.`}
                amountUsd={modalData?.amountUsd || 0}
                breakdown={[
                  { label: `${modalData?.toCharge} licencia(s) nueva(s) × $8.50 × ${modalData?.monthsLeft} meses`, amount: `$${modalData?.amountUsd?.toFixed(2)} USD` },
                  ...(modalData?.freeFromPool > 0 ? [{ label: `${modalData.freeFromPool} del pool disponible`, amount: 'Gratis' }] : []),
                ]}
                onSuccess={() => {
                  confirmLicensesMutation.mutate({ toCharge: modalData.toCharge, freeFromPool: modalData.freeFromPool });
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
                <span className="text-sm font-medium text-gray-400"> USD</span>
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

      {/* ─── Licencias y costos (fusionado) ─────── */}
      {sub && isActive && preview && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* ── Cabecera ── */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Licencias y costos</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isAnnual
                  ? `${activeEmployees.length + 1} de ${sub.billedEmployeeCount + 1} licencias en uso · las liberadas quedan en tu pool`
                  : `${activeEmployees.length + 1} licencia${activeEmployees.length + 1 !== 1 ? 's' : ''} activa${activeEmployees.length + 1 !== 1 ? 's' : ''} · se ajusta con tus empleados`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAnnual && (
                <button
                  onClick={() => addLicensesMutation.mutate(1)}
                  disabled={addLicensesMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: TEAL }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  {addLicensesMutation.isPending ? 'Calculando...' : 'Solicitar licencia'}
                </button>
              )}
              <Link
                href="/staff"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Gestionar personal
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* ── Barra de uso (plan anual) ── */}
          {isAnnual && (
            <div className="px-6 pt-4 pb-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400">{activeEmployees.length + 1} de {sub.billedEmployeeCount + 1} licencias en uso</span>
                {sub.availableLicenses > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
                    {sub.availableLicenses} libre{sub.availableLicenses !== 1 ? 's' : ''} en pool
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    backgroundColor: TEAL,
                    width: `${Math.min(100, ((activeEmployees.length + 1) / Math.max(1, sub.billedEmployeeCount + 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Tabla de licencias ── */}
          <div className="divide-y divide-gray-50 px-2 pt-2">

            {/* Fila: Siliba Business (licencia base) */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: TEAL }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">Siliba Business</p>
                  <p className="text-xs text-gray-400">Licencia única — incluye todos los empleados</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-gray-700">$500.00<span className="text-xs font-normal text-gray-400">/mes</span></span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
                  Activa
                </span>
              </div>
            </div>

            {/* Filas: empleados activos */}
            {activeEmployees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <Link href={`/staff/${emp.id}`} className="flex items-center gap-3 min-w-0 flex-1">
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
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-700">Incluido</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
                    Activa
                  </span>
                  {isAnnual && (
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Liberar la licencia de ${emp.firstName} ${emp.lastName}?\n\nEl empleado quedará inactivo y la licencia volverá a tu pool para asignarla a otra persona.`)) {
                          releaseLicenseMutation.mutate(emp.id);
                        }
                      }}
                      disabled={releaseLicenseMutation.isPending}
                      className="hidden group-hover:flex text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      Liberar
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Fila: pool disponible (anual) */}
            {isAnnual && sub.availableLicenses > 0 && Array.from({ length: sub.availableLicenses }).map((_, i) => (
              <div key={`pool-${i}`} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center flex-shrink-0" style={{ borderColor: TEAL }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: TEAL }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-400">Licencia disponible</p>
                    <p className="text-xs text-gray-300">Sin asignar · en pool</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-300">$10.00<span className="text-xs font-normal">/mes</span></span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-400">
                    En pool
                  </span>
                  <Link
                    href="/staff"
                    className="hidden group-hover:flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg text-white transition-colors"
                    style={{ backgroundColor: TEAL }}
                  >
                    Asignar
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* ── Empleados inactivos (anual + pool) ── */}
          {isAnnual && sub.availableLicenses > 0 && inactiveEmployees.length > 0 && (
            <div className="mx-4 mb-3 mt-1 px-4 py-3 rounded-xl" style={{ backgroundColor: TEAL_LIGHT }}>
              <p className="text-xs font-semibold mb-2" style={{ color: TEAL }}>Empleados inactivos que puedes reactivar con tu pool:</p>
              <div className="space-y-1.5">
                {inactiveEmployees.slice(0, 3).map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                    <Link href={`/staff/${emp.id}`} className="flex items-center gap-2 hover:underline">
                      <div
                        className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: emp.color || '#9ca3af' }}
                      >
                        {emp.avatarUrl
                          ? <img src={emp.avatarUrl.startsWith('http') ? emp.avatarUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${emp.avatarUrl}`} alt={`${emp.firstName} ${emp.lastName}`} className="w-full h-full object-cover" />
                          : <span>{emp.firstName?.[0]}{emp.lastName?.[0]}</span>
                        }
                      </div>
                      <span className="text-xs text-gray-700">{emp.firstName} {emp.lastName}</span>
                    </Link>
                    <Link
                      href="/staff"
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white transition-colors hover:opacity-90"
                      style={{ backgroundColor: TEAL }}
                    >
                      Reactivar →
                    </Link>
                  </div>
                ))}
                {inactiveEmployees.length > 3 && (
                  <Link href="/staff" className="block text-center text-xs font-medium py-1" style={{ color: TEAL }}>
                    Ver {inactiveEmployees.length - 3} más en Personal →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ── Totales ── */}
          <div className="px-6 py-4 border-t border-gray-100 space-y-2">
            {isAnnual && (
              <div className="flex items-center justify-between text-xs" style={{ color: TEAL }}>
                <span>Descuento anual aplicado (15%)</span>
                <span className="font-semibold">-${(preview.totalMonthly * 0.15 * 12).toFixed(2)} USD/año</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">{isAnnual ? 'Total anual' : 'Total mensual'}</span>
              <span className="text-lg font-black" style={{ color: TEAL }}>
                ${isAnnual ? annualTotal.toFixed(0) : preview.totalMonthly.toFixed(2)} USD
              </span>
            </div>
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
                  <p className="text-sm font-bold">${Number(inv.amountUsd).toFixed(2)} USD</p>
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

      {/* ─── Plan anual CTA ──────────────────────── */}
      {preview && isActive && isMonthly && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Header con gradiente teal */}
          <div className="px-6 py-5" style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #006666 100%)` }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white tracking-wide uppercase">
                    Ahorra 15%
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-2">Plan Anual</h2>
                <p className="text-sm text-white/80 mt-0.5">Un solo pago al año · sin cobros mensuales</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white">${(annualTotal / 12).toFixed(0)}</p>
                <p className="text-xs text-white/70">MXN/mes equiv.</p>
                <p className="text-xs text-white/60 mt-0.5">${annualTotal.toFixed(0)} MXN/año</p>
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
                <p className="text-xs text-gray-400 mt-0.5">${(preview.totalMonthly * 12).toFixed(0)} USD/año</p>
              </div>
              <div className="rounded-xl px-4 py-3 relative overflow-hidden" style={{ backgroundColor: TEAL_LIGHT, border: `1.5px solid ${TEAL}` }}>
                <p className="text-xs font-semibold mb-1" style={{ color: TEAL }}>Plan anual</p>
                <p className="text-lg font-black" style={{ color: TEAL }}>
                  ${(annualTotal / 12).toFixed(0)}
                  <span className="text-xs font-normal" style={{ color: '#006666' }}>/mes equiv.</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#006666' }}>
                  Ahorras ${(preview.totalMonthly * 12 * 0.15).toFixed(0)} USD/año
                </p>
              </div>
            </div>

            {/* Beneficios */}
            <div className="space-y-2">
              {[
                'Licencias liberadas al despedir un empleado quedan disponibles sin costo',
                'Agrega nuevas licencias pagando solo los meses restantes con 15% de descuento',
                'Un solo cobro al año, sin interrupciones ni cobros sorpresa',
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
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: TEAL }}
            >
              {switchAnnualMutation.isPending ? 'Preparando...' : `Cambiar a plan anual · $${annualTotal.toFixed(0)} USD/año`}
            </button>
          </div>
        </div>
      )}

      {/* ─── Info ────────────────────────────────── */}
      <div className="rounded-2xl p-5 border border-dashed border-gray-200 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700 mb-2">¿Cómo funciona la facturación?</p>
        <ul className="text-xs text-gray-500 space-y-1.5 list-disc list-inside">
          <li>$500 MXN/mes plan único — incluye a todos tus empleados sin cobro adicional</li>
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
