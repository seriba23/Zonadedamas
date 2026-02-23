'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';

type RegisterMode = 'select' | 'business' | 'individual';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  inviteCode: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  inviteCode?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [mode, setMode] = useState<RegisterMode>('select');
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    inviteCode: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'El nombre es requerido';
    if (!form.lastName.trim()) newErrors.lastName = 'El apellido es requerido';
    if (!form.email) {
      newErrors.email = 'El correo es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Ingresa un correo válido';
    }
    if (!form.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (form.password.length < 6) {
      newErrors.password = 'Mínimo 6 caracteres';
    }
    if (mode === 'business' && !form.inviteCode.trim()) {
      newErrors.inviteCode = 'El código de invitación es requerido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        inviteCode: mode === 'business' ? form.inviteCode.trim() : undefined,
        type: mode === 'individual' ? 'individual' : undefined,
      });
      router.push('/employee');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setApiError(error?.message || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">Zona de Damas</h1>
            <p className="mt-2 text-gray-500 text-sm">Crea tu cuenta</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              ¿Cómo deseas registrarte?
            </h2>

            <div className="space-y-4">
              <button
                onClick={() => setMode('business')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏢</span>
                  <div>
                    <p className="font-semibold text-gray-900">Unirme a un negocio</p>
                    <p className="text-sm text-gray-500">
                      Tengo un código de invitación de mi empresa
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode('individual')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👤</span>
                  <div>
                    <p className="font-semibold text-gray-900">Soy particular</p>
                    <p className="text-sm text-gray-500">
                      Quiero crear mi perfil profesional independiente
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <p className="text-center mt-6 text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link
              href="/login"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">Zona de Damas</h1>
          <p className="mt-2 text-gray-500 text-sm">
            {mode === 'business'
              ? 'Únete a tu equipo de trabajo'
              : 'Crea tu perfil profesional'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setMode('select')}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'business' ? 'Unirme a un negocio' : 'Registro particular'}
            </h2>
          </div>

          {apiError && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'business' && (
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Código de invitación
                </label>
                <input
                  id="inviteCode"
                  type="text"
                  value={form.inviteCode}
                  onChange={(e) => setForm((f) => ({ ...f, inviteCode: e.target.value.toUpperCase() }))}
                  className={`input-field uppercase tracking-widest text-center font-mono ${errors.inviteCode ? 'border-red-400' : ''}`}
                  placeholder="XXXXXXXX"
                  maxLength={8}
                />
                {errors.inviteCode && (
                  <p className="mt-1 text-xs text-red-600">{errors.inviteCode}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className={`input-field ${errors.firstName ? 'border-red-400' : ''}`}
                  placeholder="Tu nombre"
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
                )}
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Apellido
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className={`input-field ${errors.lastName ? 'border-red-400' : ''}`}
                  placeholder="Tu apellido"
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={`input-field ${errors.email ? 'border-red-400' : ''}`}
                placeholder="correo@ejemplo.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Teléfono <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="input-field"
                placeholder="+1-555-0000"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={`input-field ${errors.password ? 'border-red-400' : ''}`}
                placeholder="Mínimo 6 caracteres"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/login"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
