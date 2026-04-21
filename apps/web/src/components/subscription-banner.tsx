'use client';

import { useRouter } from 'next/navigation';

interface SubscriptionBannerProps {
  status: string;
  trialEndsAt?: string | null;
}

export function SubscriptionBanner({ status, trialEndsAt }: SubscriptionBannerProps) {
  const router = useRouter();

  if (status === 'TRIAL') {
    const daysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0;

    const urgency = daysLeft <= 3;

    return (
      <div className={`border-b px-4 py-2.5 ${urgency ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'}`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg className={`w-4 h-4 flex-shrink-0 ${urgency ? 'text-red-500' : 'text-teal-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className={`text-sm ${urgency ? 'text-red-800' : 'text-teal-800'}`}>
              <span className="font-semibold">Período de prueba de Siliba Business</span>
              {' — '}
              {daysLeft > 0
                ? <>Te quedan <span className="font-bold">{daysLeft} {daysLeft === 1 ? 'día' : 'días'}</span>.</>
                : <span className="font-semibold text-red-700">Tu período de prueba ha vencido.</span>
              }
            </p>
          </div>
          <button
            onClick={() => router.push('/settings/subscription')}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              urgency
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-[#008080] text-white hover:bg-[#006666]'
            }`}
          >
            Ver suscripciones
          </button>
        </div>
      </div>
    );
  }

  if (status === 'PAST_DUE') {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Pago pendiente</span> — Tienes 24 horas para regularizar tu cuenta.
            Mientras tanto, no podrás crear o modificar citas.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
