'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';

export default function SuspendedPage() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const isTrialExpired = !user?.trialEndsAt
    ? false
    : new Date(user.trialEndsAt) < new Date();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#008080]">Siliba</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">Cuenta suspendida</h2>

          {isTrialExpired ? (
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              Tu período de prueba gratuito de <span className="font-semibold">Siliba Business</span> ha expirado.
              Para reactivar tu cuenta, recibir citas y aparecer en el marketplace, adquiere una suscripción.
            </p>
          ) : (
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              Tu cuenta ha sido suspendida por falta de pago.
              Para reactivar el acceso a tu consola, recibir citas y aparecer en el marketplace, regulariza tu suscripción.
            </p>
          )}

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sin suscripción activa:</p>
            {[
              'No podrás acceder a tu consola de administración',
              'No aparecerás en el marketplace de Siliba',
              'No recibirás nuevas citas',
              'Tus clientes no podrán reservar contigo',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-gray-600">{item}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push('/dashboard/settings/subscription')}
            className="w-full py-3 rounded-xl font-semibold text-white mb-3 transition-colors"
            style={{ backgroundColor: '#008080' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006666')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008080')}
          >
            Adquirir suscripción
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 text-sm transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
