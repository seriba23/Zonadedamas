'use client';

import { useState } from 'react';
import Link from 'next/link';

type Method = 'sms' | 'email';

export default function ForgotPasswordPage() {
  const [method, setMethod] = useState<Method>('sms');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (method === 'sms') {
      const clean = phone.replace(/\D/g, '');
      if (!clean || clean.length !== 10) {
        setError('Ingresa un número de 10 dígitos');
        return;
      }
    } else {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Ingresa un correo válido');
        return;
      }
    }

    // TODO: integrate with backend password reset endpoint
    setSent(true);
  }

  const sentValue = method === 'sms' ? phone : email;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
          <p className="mt-1 text-gray-500 text-sm">Tu confianza, en manos de profesionales</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                {method === 'sms' ? (
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {method === 'sms' ? 'Revisa tu teléfono' : 'Revisa tu correo'}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {method === 'sms'
                  ? <>Enviamos un código de verificación al número <span className="font-medium text-gray-700">{sentValue}</span> para restablecer tu contraseña.</>
                  : <>Si existe una cuenta con <span className="font-medium text-gray-700">{sentValue}</span>, recibirás un enlace para restablecer tu contraseña.</>
                }
              </p>
              <Link href="/login" className="btn-primary inline-block px-6 py-2.5">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Recuperar contraseña</h2>
              <p className="text-sm text-gray-500 mb-6">
                Elige cómo quieres recuperar tu contraseña.
              </p>

              {/* Method toggle */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-6">
                <button
                  type="button"
                  onClick={() => { setMethod('sms'); setError(''); }}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    method === 'sms' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Mensaje de texto
                </button>
                <button
                  type="button"
                  onClick={() => { setMethod('email'); setError(''); }}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-l border-gray-300 flex items-center justify-center gap-2 ${
                    method === 'email' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Correo electrónico
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {method === 'sms' ? (
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Número de celular
                    </label>
                    <input
                      id="phone"
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="input-field"
                      placeholder="10 dígitos, ej: 5512345678"
                      autoFocus
                    />
                    {phone && phone.length !== 10 && (
                      <p className="text-xs text-amber-600 mt-1">{phone.length}/10 dígitos</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    />
                  </div>
                )}

                <button type="submit" className="w-full btn-primary py-2.5">
                  {method === 'sms' ? 'Enviar código por SMS' : 'Enviar enlace por correo'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
