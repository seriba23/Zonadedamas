'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import Link from 'next/link';

function formatExpiry(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MarketplaceCouponsPage() {
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-rewards'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-rewards'),
    enabled: isAuthenticated,
  });

  const redemptions: any[] = (data as any)?.data || [];
  const active = redemptions.filter((r) => r.status === 'ACTIVE');
  const used = redemptions.filter((r) => r.status !== 'ACTIVE');

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

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
          <Link
            href="/marketplace/login"
            className="px-6 py-2.5 text-white rounded-full text-sm font-medium"
            style={{ backgroundColor: '#008080' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
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
            <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
            <p className="text-gray-500">No tienes cupones todavía</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Acumula puntos al reservar citas y canjéalos por descuentos o servicios gratis
            </p>
            <Link
              href="/marketplace"
              className="px-6 py-2.5 text-white rounded-full text-sm font-medium"
              style={{ backgroundColor: '#008080' }}
            >
              Explorar negocios
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Disponibles</h2>
                <div className="space-y-3">
                  {active.map((r) => (
                    <CouponCard key={r.id} redemption={r} onCopy={handleCopy} copied={copied} />
                  ))}
                </div>
              </section>
            )}

            {used.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Usados / Vencidos</h2>
                <div className="space-y-3 opacity-60">
                  {used.map((r) => (
                    <CouponCard key={r.id} redemption={r} onCopy={handleCopy} copied={copied} disabled />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CouponCard({
  redemption,
  onCopy,
  copied,
  disabled = false,
}: {
  redemption: any;
  onCopy: (code: string) => void;
  copied: string | null;
  disabled?: boolean;
}) {
  const reward = redemption.reward;
  const isDiscount = reward?.type === 'DESCUENTO';
  const expiry = formatExpiry(redemption.expiresAt);
  const isCopied = copied === redemption.couponCode;

  return (
    <div
      className="bg-white rounded-xl border overflow-hidden"
      style={{ borderColor: disabled ? '#e5e7eb' : '#008080', borderWidth: disabled ? 1 : 1.5 }}
    >
      {/* Dashed separator ticket style */}
      <div className="flex">
        {/* Left accent */}
        <div
          className="w-1.5 flex-shrink-0"
          style={{ backgroundColor: disabled ? '#d1d5db' : '#008080' }}
        />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{reward?.name || 'Cupón'}</p>
              {reward && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {isDiscount
                    ? `${reward.discountPercent ?? reward.discountAmount ?? '?'}${reward.discountPercent ? '% de descuento' : ' de descuento'}`
                    : 'Servicio gratis'}
                </p>
              )}
              {expiry && (
                <p className="text-xs text-gray-400 mt-1">Válido hasta {expiry}</p>
              )}
            </div>
            <div
              className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
              style={disabled
                ? { backgroundColor: '#f3f4f6', color: '#9ca3af' }
                : { backgroundColor: '#e0f2f1', color: '#008080' }
              }
            >
              {redemption.status === 'USED' ? 'Usado' : redemption.status === 'EXPIRED' ? 'Vencido' : isDiscount ? (reward.discountPercent ? `-${reward.discountPercent}%` : 'OFF') : 'GRATIS'}
            </div>
          </div>

          {/* Coupon code */}
          {!disabled && (
            <div className="mt-3 flex items-center gap-2">
              <div
                className="flex-1 flex items-center justify-center py-2 rounded-lg"
                style={{ backgroundColor: '#f0fdfa', border: '1.5px dashed #99f6e4' }}
              >
                <span className="font-mono font-bold text-base tracking-widest" style={{ color: '#008080' }}>
                  {redemption.couponCode}
                </span>
              </div>
              <button
                onClick={() => onCopy(redemption.couponCode)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={isCopied
                  ? { backgroundColor: '#d1fae5', color: '#059669' }
                  : { backgroundColor: '#e0f2f1', color: '#008080' }
                }
              >
                {isCopied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                    Copiar
                  </>
                )}
              </button>
            </div>
          )}
          {disabled && (
            <p className="mt-2 font-mono text-xs text-gray-400 tracking-widest">{redemption.couponCode}</p>
          )}
        </div>
      </div>
    </div>
  );
}
