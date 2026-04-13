'use client';

import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function formatExpiry(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function MarketplaceCouponsPage() {
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-rewards'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-rewards'),
    enabled: isAuthenticated,
  });

  const redemptions: any[] = (data as any)?.data || [];
  const active = redemptions.filter((r) => r.status === 'ACTIVE');
  const used = redemptions.filter((r) => r.status !== 'ACTIVE');

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="bg-white border-b border-gray-100 px-4 pb-3 safe-top">
          <div className="max-w-2xl mx-auto pt-2">
            <h1 className="text-lg font-bold text-gray-900">Mis cupones</h1>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
          </svg>
          <p className="text-gray-500 text-sm">Inicia sesión para ver tus cupones</p>
          <Link href="/marketplace/login" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: '#008080' }}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pb-3 safe-top">
        <div className="max-w-2xl mx-auto pt-2">
          <h1 className="text-lg font-bold text-gray-900">Mis cupones</h1>
          <p className="text-xs text-gray-400 mt-0.5">Canjeados por tus puntos de recompensa</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: '#008080' }} />
          </div>
        ) : redemptions.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
            <p className="text-gray-500">No tienes cupones todavía</p>
            <p className="text-xs text-gray-400 max-w-xs">Acumula puntos al reservar citas y canjéalos por descuentos o servicios gratis</p>
            <Link href="/marketplace" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: '#008080' }}>
              Explorar negocios
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Disponibles · {active.length}</h2>
                <div className="space-y-4">
                  {active.map((r) => <CouponCard key={r.id} redemption={r} />)}
                </div>
              </section>
            )}
            {used.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Historial · {used.length}</h2>
                <div className="space-y-4">
                  {used.map((r) => <CouponCard key={r.id} redemption={r} disabled />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CouponCard({ redemption, disabled = false }: { redemption: any; disabled?: boolean }) {
  const router = useRouter();
  const reward = redemption.reward;
  const tenant = redemption.tenant;
  const isDiscount = reward?.type === 'DESCUENTO';
  const expiry = formatExpiry(redemption.expiresAt);
  const days = daysLeft(redemption.expiresAt);
  const isUrgent = days !== null && days <= 7 && !disabled;

  const valueLabel = isDiscount
    ? (reward?.discountMode === 'PERCENT'
      ? `-${Number(reward.discountAmount)}%`
      : `$${reward?.discountAmount ?? ''}`)
    : 'GRATIS';

  const statusLabel = redemption.status === 'USED' ? 'USADO' : 'VENCIDO';
  const displayLabel = disabled ? statusLabel : valueLabel;
  const stubFontSize = displayLabel.length <= 4 ? '1.125rem' : displayLabel.length <= 6 ? '0.875rem' : '0.75rem';

  return (
    <div
      className="relative"
      style={{ filter: disabled ? 'grayscale(0.5)' : undefined, opacity: disabled ? 0.65 : 1 }}
    >
      {/* Card */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>

        {/* ── Stub izquierdo ── */}
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: disabled ? '#9ca3af' : '#008080' }}
        >
          <span
            className="text-white font-black leading-tight text-center break-all w-full px-2"
            style={{ fontSize: stubFontSize, wordBreak: 'break-all' }}
          >
            {displayLabel}
          </span>
          {!disabled && (
            <span className="text-white/70 text-[9px] uppercase tracking-wider">
              {isDiscount ? 'descuento' : 'servicio'}
            </span>
          )}

          {/* Perforación superior */}
          <div
            className="absolute -right-3 -top-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#f3f4f6' }}
          />
          {/* Perforación inferior */}
          <div
            className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#f3f4f6' }}
          />
        </div>

        {/* ── Separador perforado ── */}
        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        {/* ── Contenido principal ── */}
        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">{reward?.name || 'Cupón'}</p>
              {tenant && (
                <span className="text-[10px] font-medium text-[#008080] bg-teal-50 px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[120px]">
                  {tenant.name}
                </span>
              )}
            </div>
            {reward && (
              <p className="text-xs text-gray-500 mt-0.5">
                {isDiscount
                  ? (reward.discountMode === 'PERCENT'
                    ? `${Number(reward.discountAmount)}% de descuento`
                    : `$${reward.discountAmount} de descuento`)
                  : (reward.service?.name ? `${reward.service.name} gratis` : 'Servicio gratis')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2 gap-2">
            {/* Fecha de vencimiento */}
            {expiry && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0"
                style={isUrgent
                  ? { backgroundColor: '#fef2f2', color: '#dc2626' }
                  : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                }
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-semibold whitespace-nowrap">
                  {isUrgent ? `¡Vence en ${days}d!` : `Vence ${expiry}`}
                </span>
              </div>
            )}

            {/* Botón CANJEAR → va directo al negocio del cupón */}
            {!disabled ? (
              <button
                onClick={() => router.push(tenant?.slug ? `/marketplace/${tenant.slug}` : '/marketplace')}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white transition-transform active:scale-95"
                style={{ backgroundColor: '#008080', letterSpacing: '0.05em' }}
              >
                CANJEAR
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {statusLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
