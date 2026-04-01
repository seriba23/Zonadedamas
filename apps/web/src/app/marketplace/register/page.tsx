'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { SocialLoginButtons } from '@/components/ui/social-login-buttons';
import Link from 'next/link';

const COUNTRY_CODES = [
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+1', flag: '🇺🇸', name: 'EE.UU.' },
  { code: '+1', flag: '🇨🇦', name: 'Canadá' },
  { code: '+34', flag: '🇪🇸', name: 'España' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+51', flag: '🇵🇪', name: 'Perú' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+507', flag: '🇵🇦', name: 'Panamá' },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+55', flag: '🇧🇷', name: 'Brasil' },
];

function PhoneInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (full: string) => void;
}) {
  const [countryCode, setCountryCode] = useState('+52');
  const [local, setLocal] = useState('');

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^\d\s\-()]/g, '');
    setLocal(digits);
    onChange(`${countryCode} ${digits}`.trim());
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCountryCode(e.target.value);
    onChange(`${e.target.value} ${local}`.trim());
  }

  return (
    <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden focus-within:ring-2 focus-within:border-[#008080]" style={{ '--tw-ring-color': 'rgba(0,128,128,0.3)' } as React.CSSProperties}>
      <select
        value={countryCode}
        onChange={handleCodeChange}
        className="border-r border-gray-200 bg-gray-50 text-sm text-gray-700 px-2 py-2.5 focus:outline-none cursor-pointer"
        style={{ minWidth: 72 }}
      >
        {COUNTRY_CODES.map((c, i) => (
          <option key={i} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
      <input
        type="tel"
        value={local}
        onChange={handleLocalChange}
        className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-transparent"
        placeholder="55 1234 5678"
      />
    </div>
  );
}

export default function MarketplaceRegisterPage() {
  const { register, socialLogin } = useMarketplaceAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!/[0-9]/.test(form.password)) {
      setError('La contraseña debe contener al menos un número');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/.test(form.password)) {
      setError('La contraseña debe contener al menos un símbolo');
      return;
    }

    setLoading(true);

    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      router.push(redirect || '/marketplace');
    } catch (err: any) {
      setError(err.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 safe-top">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#008080' }}>Siliba</h1>
          <p className="text-sm text-gray-500 mt-1">Crea tu cuenta gratuita</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SocialLoginButtons
            onSocialLogin={async (provider, token) => {
              setError('');
              try {
                await socialLogin(provider, token);
                router.push(redirect || '/marketplace');
              } catch (err: any) {
                setError(err.message || 'Error al registrarse');
              }
            }}
            disabled={loading}
          />

          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Apellido</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Teléfono <span className="text-gray-400">(opcional)</span>
            </label>
            <PhoneInput
              value={form.phone}
              onChange={(v) => updateField('phone', v)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
              placeholder="Mín. 8 caracteres, 1 número, 1 símbolo"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Al crear tu cuenta, aceptas nuestros{' '}
            <Link href="/marketplace/legal/terms" className="underline" style={{ color: '#008080' }}>
              Términos y Condiciones
            </Link>{' '}
            y{' '}
            <Link href="/marketplace/legal/privacy" className="underline" style={{ color: '#008080' }}>
              Aviso de Privacidad
            </Link>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#008080' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#006666'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#008080'; }}
          >
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link
            href={`/marketplace/login${redirect ? `?redirect=${redirect}` : ''}`}
            className="font-medium"
            style={{ color: '#008080' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#006666')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#008080')}
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
