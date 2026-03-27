'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMarketplaceAuth, genderSuffix } from '@/lib/hooks/use-marketplace-auth';
import { SuccessPopup } from '@/components/ui/success-popup';
import { SocialLoginButtons } from '@/components/ui/social-login-buttons';
import Link from 'next/link';

export default function MarketplaceLoginPage() {
  const { login, socialLogin } = useMarketplaceAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');
  const [welcomeGender, setWelcomeGender] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.reactivated) {
        setWelcomeName(result.firstName);
        setWelcomeGender(result.gender || null);
        setShowWelcomeBack(true);
      } else {
        router.push(redirect || '/marketplace');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#008080' }}>Siliba</h1>
          <p className="text-sm text-gray-500 mt-1">Tu confianza, en manos de profesionales</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SocialLoginButtons
            onSocialLogin={async (provider, token) => {
              setError('');
              try {
                const result = await socialLogin(provider, token);
                router.push(redirect || '/marketplace');
              } catch (err: any) {
                setError(err.message || 'Error al iniciar sesión');
              }
            }}
            disabled={loading}
          />

          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="text-center">
            <Link
              href="/marketplace/forgot-password"
              className="text-sm font-medium"
              style={{ color: '#008080' }}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#008080' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#006666'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#008080'; }}
          >
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿No tienes cuenta?{' '}
          <Link
            href={`/marketplace/register${redirect ? `?redirect=${redirect}` : ''}`}
            className="font-medium"
            style={{ color: '#008080' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#006666')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#008080')}
          >
            Regístrate
          </Link>
        </p>

        <p className="text-center mt-4">
          <Link href="/marketplace" className="text-sm text-gray-400 hover:text-gray-600">
            Volver al marketplace
          </Link>
        </p>
      </div>

      <SuccessPopup
        show={showWelcomeBack}
        title={`¡Bienvenid${genderSuffix(welcomeGender)} de vuelta, ${welcomeName}!`}
        message="Tu cuenta ha sido reactivada. Te echábamos de menos."
        onClose={() => {
          setShowWelcomeBack(false);
          router.push(redirect || '/marketplace');
        }}
      />
    </div>
  );
}
