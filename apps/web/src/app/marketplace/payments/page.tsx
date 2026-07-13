// ============================================================
// PÁGINA: Historial de pagos del cliente marketplace
// RUTA:   /marketplace/payments
//
// ¿Qué muestra?
//   - Tarjetas de resumen: total pagado, pagos pendientes, reembolsos.
//   - Lista de pagos con filtros por estado (Todos/Completados/Pendientes/Reembolsados).
//   - Cada pago muestra: negocio, método de pago, fecha, monto y badge de estado.
//   - Paginación para cargar más registros.
//   - Si no está autenticado, muestra pantalla de login.
// ============================================================
'use client';

// useState: para filtro activo, página actual, etc.
// useEffect: para sincronizar el filtro cuando cambia.
import { useState, useEffect } from 'react';
// useRouter: para navegar al detalle de cita al tocar un pago.
import { useRouter } from 'next/navigation';
// Link: para el botón "Iniciar sesión".
import Link from 'next/link';
// useQuery: para cargar el historial de pagos paginado.
import { useQuery } from '@tanstack/react-query';
// dayjs: formateo de fechas.
import dayjs from 'dayjs';
import 'dayjs/locale/es';
// Estado de autenticación del cliente.
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
// Cliente HTTP del marketplace.
import { marketplaceApi } from '@/lib/marketplace-api';
// Utilidades de formato.
import { formatCurrency, resolveImageUrl } from '@/lib/utils';

import { SectionHelp } from '@/components/ui/section-help';

// Configurar dayjs para nombres de días/meses en español.
dayjs.locale('es');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

// Tipo unión para los posibles estados de filtro. TypeScript detecta errores si
// se usa un string que no está en esta lista.
type PaymentFilter = 'ALL' | 'COMPLETED' | 'PENDING' | 'REFUNDED';

// Pestañas de filtro con su clave interna y etiqueta visible.
const FILTER_TABS: { key: PaymentFilter; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'COMPLETED', label: 'Completados' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'REFUNDED', label: 'Reembolsados' },
];

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  COMPLETED: { label: 'Completado', bg: 'bg-green-50', text: 'text-green-700' },
  PENDING: { label: 'Pendiente', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  REFUNDED: { label: 'Reembolsado', bg: 'bg-red-50', text: 'text-red-700' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: 'Tarjeta',
  CASH: 'Efectivo',
  STRIPE: 'Stripe',
  TRANSFER: 'Transferencia',
};

// ── Interfaces TypeScript ──────────────────────────────────
// PaymentRecord: un registro de pago del cliente.
interface PaymentRecord {
  id: string;
  amount: string;
  totalAmount: string;
  currency: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  tenant: {
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  appointment: {
    startTime: string;
    items: { serviceNameSnapshot: string }[];
  } | null;
}

interface PaymentsMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface PaymentsResponse {
  data: PaymentRecord[];
  meta: PaymentsMeta;
}

// ── Sub-componente PaymentCard ─────────────────────────────
// Componente auxiliar que renderiza la tarjeta de UN pago.
// Recibe un solo prop `payment` con los datos del pago.
// El tipo `{ payment: PaymentRecord }` es la interfaz de props inline.
function PaymentCard({ payment }: { payment: PaymentRecord }) {
  const statusCfg = PAYMENT_STATUS_CONFIG[payment.status] || {
    label: payment.status,
    bg: 'bg-gray-50',
    text: 'text-gray-600',
  };
  const methodLabel =
    PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod || 'N/A';

  const displayDate = payment.appointment?.startTime || payment.createdAt;
  const services = payment.appointment?.items.map((i) => i.serviceNameSnapshot) || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header: Business + Status */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <Link
          href={`/marketplace/${payment.tenant.slug}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
        >
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {payment.tenant.logoUrl ? (
              <img
                src={`${API_URL}${payment.tenant.logoUrl}`}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-gray-400">
                {payment.tenant.name[0]}
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700 truncate">
            {payment.tenant.name}
          </span>
        </Link>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusCfg.bg} ${statusCfg.text}`}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Date */}
      <p className="text-sm font-semibold text-gray-900 mb-1">
        {dayjs(displayDate).format('ddd, D [de] MMM YYYY')}
      </p>
      <p className="text-xs text-gray-500 mb-3">
        {dayjs(displayDate).format('h:mm A')}
      </p>

      {/* Services */}
      {services.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Servicios</p>
          <p className="text-sm text-gray-700">
            {services.join(', ')}
          </p>
        </div>
      )}

      {/* Amount + Method */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          {/* Card/payment icon */}
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
            />
          </svg>
          {methodLabel}
        </span>
        <span className="text-base font-bold text-gray-900">
          {formatCurrency(Number(payment.totalAmount), payment.currency || 'MXN')}
        </span>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: TEAL_LIGHT }}
      >
        <svg
          className="w-8 h-8"
          style={{ color: TEAL }}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700">
        {filtered
          ? 'No hay pagos con este filtro'
          : 'No tienes pagos registrados'}
      </p>
      <p className="text-xs text-gray-400 mt-1 text-center">
        {filtered
          ? 'Prueba con otro filtro'
          : 'Tus pagos apareceran aqui cuando realices una reserva'}
      </p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────

export default function MarketplacePaymentsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();
  const router = useRouter();

  // Filtro activo (pestaña seleccionada). Default: 'ALL' = todos los pagos.
  const [activeFilter, setActiveFilter] = useState<PaymentFilter>('ALL');

  // Página actual para la paginación del historial de pagos.
  const [page, setPage] = useState(1);

  // Redirige al login si no hay sesión activa.
  // Este useEffect actúa como un "guard": si el usuario intenta acceder directamente
  // a /marketplace/payments sin estar autenticado, lo manda al login.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/marketplace/login?redirect=/marketplace/payments');
    }
  }, [authLoading, isAuthenticated, router]);

  // Al cambiar el filtro, volvemos a la página 1 para no quedarnos en una
  // página que ya no existe (ej: filtrado tiene menos resultados que la página 3).
  useEffect(() => {
    setPage(1);
  }, [activeFilter]);

  // `URLSearchParams`: construye el query string de forma segura.
  // Equivalente a escribir manualmente `?page=1&perPage=20&status=COMPLETED`.
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('perPage', '20');
  if (activeFilter !== 'ALL') {
    queryParams.set('status', activeFilter);
  }

  const { data: paymentsResponse, isLoading } = useQuery({
    queryKey: ['marketplace-my-payments', activeFilter, page],
    queryFn: () =>
      marketplaceApi.get<PaymentsResponse>(
        `/my-payments?${queryParams.toString()}`,
      ),
    enabled: isAuthenticated,
  });

  const payments: PaymentRecord[] = (paymentsResponse as any)?.data || [];
  const meta: PaymentsMeta | null = (paymentsResponse as any)?.meta || null;

  // Fetch totals from the ALL query (no status filter) to show summary cards
  const { data: allPaymentsResponse } = useQuery({
    queryKey: ['marketplace-my-payments', 'ALL-summary'],
    queryFn: () =>
      marketplaceApi.get<PaymentsResponse>(
        '/my-payments?perPage=100',
      ),
    enabled: isAuthenticated,
  });

  const allPaymentsData: PaymentRecord[] = (allPaymentsResponse as any)?.data || [];

  const totals = (() => {
    let completed = 0;
    let pending = 0;
    let refunded = 0;
    for (const p of allPaymentsData) {
      const amount = Number(p.totalAmount || 0);
      if (p.status === 'COMPLETED') completed += amount;
      else if (p.status === 'PENDING') pending += amount;
      else if (p.status === 'REFUNDED') refunded += amount;
    }
    return { completed, pending, refunded, total: completed + pending };
  })();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: TEAL }}
        />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50 safe-top">


      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* ─── Header ──────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/marketplace/profile')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          {/* Ícono ⓘ de ayuda contextual — lado izquierdo, junto al botón de volver. */}
          <SectionHelp className="p-1.5 rounded-lg text-gray-400 hover:text-[#008080] hover:bg-gray-100 transition-colors flex-shrink-0" />
          <h1 className="text-lg font-bold text-gray-900">
            Historial de Pagos
          </h1>
        </div>

        {/* ─── Summary Cards ───────────────────────── */}
        {!isLoading && allPaymentsData.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Total pagado</p>
              <p className="text-sm font-bold text-gray-900">
                {formatCurrency(totals.completed, 'MXN')}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Pendiente</p>
              <p className="text-sm font-bold text-yellow-600">
                {formatCurrency(totals.pending, 'MXN')}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Reembolsado</p>
              <p className="text-sm font-bold text-red-600">
                {formatCurrency(totals.refunded, 'MXN')}
              </p>
            </div>
          </div>
        )}

        {/* ─── Filter Tabs ─────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === tab.key
                  ? 'bg-[#008080] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.key !== 'ALL' && (
                <span className="ml-1 opacity-75">
                  {allPaymentsData.filter((p) => p.status === tab.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Payment List ────────────────────────── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"
              >
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-lg bg-gray-200" />
                  <div className="h-4 bg-gray-200 rounded w-28" />
                  <div className="ml-auto h-5 bg-gray-200 rounded-full w-20" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-48 mb-3" />
                <div className="flex justify-between pt-2 border-t border-gray-100">
                  <div className="h-3 bg-gray-200 rounded w-16" />
                  <div className="h-5 bg-gray-200 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState filtered={activeFilter !== 'ALL'} />
        ) : (
          <div className="space-y-3 pb-6">
            {payments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-full px-4 py-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Anterior
                </button>
                <span className="text-xs text-gray-500">
                  Pagina {meta.page} de {meta.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= meta.totalPages}
                  className="rounded-full px-4 py-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
