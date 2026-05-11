'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Step = 'email' | 'code' | 'password' | 'done';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresa un correo válido');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setStep('code');
    } catch (err: any) {
      setError(err?.message || 'No se pudo enviar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('El código debe tener 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ data: { resetToken: string } }>(
        '/api/auth/verify-reset-code',
        { email, code },
      );
      setResetToken(res.data.resetToken);
      setStep('password');
    } catch (err: any) {
      setError(err?.message || 'Código inválido o expirado');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { resetToken, newPassword });
      setStep('done');
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
          <p className="mt-1 text-gray-500 text-sm">
            Tu confianza, en manos de profesionales
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {step === 'done' ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#e0f2f1] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#008080]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Contraseña actualizada
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Te llevaremos al inicio de sesión.
              </p>
              <Link href="/login" className="btn-primary inline-block px-6 py-2.5">
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {step === 'email' && 'Recuperar contraseña'}
                {step === 'code' && 'Verifica tu correo'}
                {step === 'password' && 'Nueva contraseña'}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {step === 'email' &&
                  'Te enviaremos un código de 6 dígitos a tu correo.'}
                {step === 'code' && (
                  <>
                    Ingresa el código que enviamos a{' '}
                    <span className="font-medium text-gray-700">{email}</span>.
                  </>
                )}
                {step === 'password' &&
                  'Elige una contraseña nueva de al menos 8 caracteres.'}
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {step === 'email' && (
                <form onSubmit={handleSendCode} className="space-y-5">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Correo electrónico
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field"
                      placeholder="correo@ejemplo.com"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full btn-primary py-2.5 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Enviando…' : 'Enviar código'}
                  </button>
                </form>
              )}

              {step === 'code' && (
                <form onSubmit={handleVerifyCode} className="space-y-5">
                  <div>
                    <label
                      htmlFor="code"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Código de verificación
                    </label>
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      className="input-field text-center tracking-[0.5em] text-lg"
                      placeholder="••••••"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full btn-primary py-2.5 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Verificando…' : 'Verificar código'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCode('');
                      setError('');
                      setStep('email');
                    }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cambiar correo
                  </button>
                </form>
              )}

              {step === 'password' && (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label
                      htmlFor="newPassword"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Nueva contraseña
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field"
                      placeholder="Mínimo 8 caracteres"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Confirmar contraseña
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                      placeholder="Repite la contraseña"
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full btn-primary py-2.5 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Guardando…' : 'Cambiar contraseña'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          <Link
            href="/login"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
