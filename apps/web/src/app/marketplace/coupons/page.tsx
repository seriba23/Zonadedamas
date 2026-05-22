'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

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
  const [tab, setTab] = useState<'cupones' | 'puntos'>('cupones');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-rewards'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-rewards'),
    enabled: isAuthenticated,
  });

  const { data: referralsData } = useQuery({
    queryKey: ['marketplace-my-referrals'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-referrals'),
    enabled: isAuthenticated,
  });
  const referrals: any[] = (referralsData as any)?.data || [];
  const activeReferrals = referrals.filter((r) => r.status === 'ACTIVE');
  const usedReferrals = referrals.filter((r) => r.status !== 'ACTIVE');

  // Received referral codes (from localStorage)
  const [receivedReferrals, setReceivedReferrals] = useState<any[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const codes: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ref_')) {
        const val = localStorage.getItem(key);
        if (val) codes.push(val);
      }
    }
    if (codes.length > 0) {
      Promise.all(
        codes.map((code) =>
          fetch(`${API_URL}/api/marketplace/referral/${code}`)
            .then((r) => r.json())
            .then((res) => res?.data)
            .catch(() => null)
        )
      ).then((results) => {
        setReceivedReferrals(results.filter((r) => r && r.status === 'ACTIVE'));
      });
    }
  }, []);

  const { data: statsData } = useQuery({
    queryKey: ['marketplace-my-stats'],
    queryFn: () => marketplaceApi.get<{ data: any }>('/my-stats'),
    enabled: isAuthenticated && tab === 'puntos',
  });
  const pointsByTenant: any[] = (statsData as any)?.data?.pointsByTenant || [];

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

      {/* Tabs Cupones | Mis puntos — estilo segmentado estandar del proyecto */}
      <div className="px-4 py-3">
        <div className="max-w-2xl mx-auto flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            onClick={() => setTab('cupones')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'cupones' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Cupones
          </button>
          <button
            onClick={() => setTab('puntos')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
              tab === 'puntos' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Mis puntos
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Puntos tab */}
        {tab === 'puntos' && (
          <div>
            {pointsByTenant.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                <p className="text-gray-500">Aún no tienes puntos</p>
                <p className="text-xs text-gray-400 max-w-xs">Acumula puntos al completar citas en los negocios que visitas</p>
                <Link href="/marketplace" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: '#008080' }}>
                  Explorar negocios
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {pointsByTenant.map((t: any) => (
                  <Link
                    key={t.tenantId}
                    href={`/marketplace/${t.tenantSlug}`}
                    className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
                        {t.tenantLogo ? (
                          <img src={`${API_URL}${t.tenantLogo}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          t.tenantName[0]
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t.tenantName}</p>
                        <p className="text-xs text-gray-400">Ver recompensas disponibles</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-lg font-bold" style={{ color: TEAL }}>{t.points.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">pts</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cupones tab */}
        {tab === 'cupones' && (isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: '#008080' }} />
          </div>
        ) : (redemptions.length === 0 && activeReferrals.length === 0 && receivedReferrals.length === 0) ? (
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
            {/* Received referral codes (from friends) */}
            {receivedReferrals.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Regalos recibidos · {receivedReferrals.length}</h2>
                <div className="space-y-4">
                  {receivedReferrals.map((ref) => <ReceivedReferralCard key={ref.code} referral={ref} />)}
                </div>
              </section>
            )}

            {/* Referral codes to share */}
            {activeReferrals.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Códigos para compartir · {activeReferrals.length}</h2>
                <div className="space-y-4">
                  {activeReferrals.map((ref) => <ReferralCard key={ref.id} referral={ref} />)}
                </div>
              </section>
            )}
            {active.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Disponibles · {active.length}</h2>
                <div className="space-y-4">
                  {active.map((r) => <CouponCard key={r.id} redemption={r} />)}
                </div>
              </section>
            )}
            {(used.length > 0 || usedReferrals.length > 0) && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Historial · {used.length + usedReferrals.length}</h2>
                <div className="space-y-4">
                  {used.map((r) => <CouponCard key={r.id} redemption={r} disabled />)}
                  {usedReferrals.map((ref) => <ReferralCard key={ref.id} referral={ref} disabled />)}
                </div>
              </section>
            )}
          </div>
        ))}
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

function ReferralCard({ referral, disabled = false }: { referral: any; disabled?: boolean }) {
  const tenant = referral.tenant;
  const promo = referral.promotion;
  const serviceNames: string[] = referral.serviceNames || [];
  const expiry = referral.expiresAt ? formatExpiry(referral.expiresAt) : null;
  const statusLabel = referral.status === 'USED' ? 'CANJEADO' : 'EXPIRADO';

  return (
    <div
      className="relative"
      style={{ filter: disabled ? 'grayscale(0.5)' : undefined, opacity: disabled ? 0.65 : 1 }}
    >
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>
        {/* Stub izquierdo morado */}
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: disabled ? '#9ca3af' : '#7c3aed' }}
        >
          <span className="text-white font-black text-lg leading-tight text-center">
            {disabled ? statusLabel : '2×1'}
          </span>
          {!disabled && (
            <span className="text-white/70 text-[9px] uppercase tracking-wider">regalo</span>
          )}
          <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
          <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
        </div>

        {/* Separador perforado */}
        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        {/* Contenido principal */}
        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                {promo?.name || 'Código 2×1'}
              </p>
              {tenant && (
                <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[120px]">
                  {tenant.name}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {serviceNames.length > 0
                ? `Servicio gratis: ${serviceNames.join(', ')}`
                : 'Servicio gratis para un amigo'}
            </p>
            {!disabled && (
              <div
                className="mt-1.5 bg-gray-50 rounded-md py-1.5 px-2.5 font-mono text-sm font-black tracking-[0.12em] select-all cursor-pointer text-center"
                style={{ color: '#7c3aed' }}
                onClick={() => navigator.clipboard.writeText(referral.code)}
                title="Click para copiar"
              >
                {referral.code}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-2 gap-2">
            {expiry && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-semibold whitespace-nowrap">Vence {expiry}</span>
              </div>
            )}

            {!disabled ? (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/marketplace/${tenant?.slug}?ref=${referral.code}`;
                  if (navigator.share) {
                    navigator.share({
                      title: `Código 2x1 en ${tenant?.name}`,
                      text: `Usa mi código ${referral.code} para obtener un servicio gratis en ${tenant?.name}. Reserva en:`,
                      url,
                    }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(
                      `Usa mi código ${referral.code} para un servicio gratis en ${tenant?.name}. Reserva aquí: ${url}`
                    );
                  }
                }}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white transition-transform active:scale-95 flex items-center gap-1.5"
                style={{ backgroundColor: '#7c3aed', letterSpacing: '0.05em' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                COMPARTIR
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

function ReceivedReferralCard({ referral }: { referral: any }) {
  const router = useRouter();
  const expiry = referral.expiresAt ? formatExpiry(referral.expiresAt) : null;
  const serviceNames: string[] = referral.serviceNames || [];

  return (
    <div className="relative">
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: '#7c3aed' }}
        >
          <span className="text-white font-black text-base leading-tight text-center">GRATIS</span>
          <span className="text-white/70 text-[9px] uppercase tracking-wider">regalo</span>
          <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
          <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
        </div>

        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                {referral.promotionName || 'Servicio gratis'}
              </p>
              {referral.tenantName && (
                <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[120px]">
                  {referral.tenantName}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {referral.generatedBy
                ? `Regalo de ${referral.generatedBy}`
                : 'Servicio gratis para ti'}
              {serviceNames.length > 0 && ` · ${serviceNames.join(', ')}`}
            </p>
            <div
              className="mt-1.5 bg-gray-50 rounded-md py-1.5 px-2.5 font-mono text-sm font-black tracking-[0.12em] select-all cursor-pointer text-center"
              style={{ color: '#7c3aed' }}
              onClick={() => navigator.clipboard.writeText(referral.code)}
              title="Click para copiar"
            >
              {referral.code}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 gap-2">
            {expiry && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-semibold whitespace-nowrap">Vence {expiry}</span>
              </div>
            )}

            <button
              onClick={() => router.push(`/marketplace/${referral.tenantSlug}`)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white transition-transform active:scale-95"
              style={{ backgroundColor: '#7c3aed', letterSpacing: '0.05em' }}
            >
              RESERVAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
