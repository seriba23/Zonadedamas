'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { api } from '@/lib/api';

const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

export default function PaymentsSettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<{ connected: boolean; stripeAccountId: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showCallback, setShowCallback] = useState(false);

  // Check if returning from Stripe onboarding
  useEffect(() => {
    if (searchParams.get('stripe') === 'callback') {
      setShowCallback(true);
    }
  }, [searchParams]);

  // Load Stripe Connect status
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await api.get<{ data: { connected: boolean; stripeAccountId: string | null } }>('/api/stripe/connect/status');
        setStatus(res.data);
      } catch {
        setStatus({ connected: false, stripeAccountId: null });
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, [showCallback]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.post<{ data: { url: string } }>('/api/stripe/connect/onboard');
      window.location.href = res.data.url;
    } catch (err: any) {
      alert(err.message || 'Error al conectar con Stripe');
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: TEAL }} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Pagos Online</h1>
      <p className="text-sm text-gray-500 mb-6">
        Conecta tu cuenta de Stripe para recibir pagos de tus clientes cuando reserven citas.
      </p>

      {/* Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          {/* Stripe Logo */}
          <div className="w-12 h-12 rounded-xl bg-[#635BFF] flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-4" viewBox="0 0 60 25" fill="white">
              <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a13.97 13.97 0 0 1-4.56.75c-4.36 0-6.96-2.62-6.96-6.87 0-3.83 2.24-6.91 6.34-6.91 3.96 0 6.06 2.83 6.06 6.71 0 .45-.05 1.08-.07 1.4zm-8.06-2.59h4.38c0-1.73-.89-2.73-2.15-2.73-1.21 0-2.12 1.01-2.23 2.73zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V6.57h3.64l.22 1.1c.64-.82 1.68-1.37 3.18-1.37 3.08 0 5.36 2.98 5.36 6.82 0 4.41-2.35 7.18-5.36 7.18zm-.79-10.4c-1.01 0-1.62.38-2.04.87l.03 5.58c.38.44.97.85 2.01.85 1.55 0 2.62-1.72 2.62-3.67 0-1.89-1.08-3.63-2.62-3.63zM28.24 5.57c-1.42 0-2.57-1.16-2.57-2.57 0-1.41 1.15-2.56 2.57-2.56 1.41 0 2.56 1.15 2.56 2.56 0 1.41-1.15 2.57-2.56 2.57zm-2.06 14.38V6.57h4.12v13.38h-4.12zM21.74 6.57l.26 1.27c.79-1.1 2.07-1.55 3.15-1.55.43 0 .84.07 1.18.18l-.72 3.76a4.3 4.3 0 0 0-1.1-.14c-1.3 0-2.29.6-2.63 1.86l-.02.14v7.86h-4.12V6.57h4zM11.79 17.25c1.08 0 2.22-.23 3.34-.69v3.31c-1.14.54-2.58.82-4.12.82C7.46 20.69 5.5 19 5.5 15.27V9.6H3.42V6.57H5.5V3.3l4.12-.87v4.14h3.35V9.6h-3.35v5.37c0 1.63.86 2.28 2.17 2.28zM0 14.33c0-4.03 2.82-8.06 7.68-8.06.67 0 1.3.09 1.88.24v3.85a3.89 3.89 0 0 0-1.55-.32c-2.32 0-3.73 1.68-3.73 4.22 0 2.26 1.24 3.53 3.01 3.53.67 0 1.35-.14 2-.43v3.3c-.75.36-1.7.57-2.78.57C2.3 21.23 0 18.42 0 14.33z"/>
            </svg>
          </div>

          <div className="flex-1">
            {status?.connected ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-gray-900">Stripe conectado</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Activo
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Tu cuenta de Stripe está conectada y lista para recibir pagos.
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-mono">
                    {status.stripeAccountId}
                  </span>
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium hover:underline"
                    style={{ color: TEAL }}
                  >
                    Abrir Dashboard Stripe →
                  </a>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Conecta Stripe</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Conecta tu cuenta de Stripe para empezar a recibir pagos online cuando tus clientes reserven citas.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="px-5 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#635BFF' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5046E4')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#635BFF')}
                >
                  {connecting ? 'Redirigiendo...' : 'Conectar con Stripe'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="space-y-4">
        {/* How it works */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
            ¿Cómo funciona?
          </h3>
          <div className="space-y-2.5 text-sm text-gray-600">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: TEAL }}>1</span>
              <p>Un cliente reserva una cita desde el marketplace</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: TEAL }}>2</span>
              <p>Es redirigido a Stripe para pagar de forma segura</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: TEAL }}>3</span>
              <p>El pago llega directo a tu cuenta de Stripe</p>
            </div>
          </div>
        </div>

        {/* Commission info */}
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Comisión de plataforma</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Siliba cobra una comisión del {process.env.NEXT_PUBLIC_STRIPE_FEE_PERCENT || '5'}% por cada pago online procesado. Adicionalmente, Stripe cobra sus tarifas estándar por procesamiento.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Callback success message */}
      {showCallback && status?.connected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full text-center">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: TEAL_LIGHT }}>
              <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Stripe conectado</h3>
            <p className="text-sm text-gray-500 mb-5">
              Tu cuenta de Stripe se ha conectado correctamente. Ya puedes recibir pagos online.
            </p>
            <button
              onClick={() => setShowCallback(false)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: TEAL }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
