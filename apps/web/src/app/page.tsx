'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { SocialLoginButtons } from '@/components/ui/social-login-buttons';
import { api } from '@/lib/api';
import type { AuthUser } from '@/lib/auth';

type Step = 'login' | 'choose-profile';

interface SocialProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  provider: string;
}

export default function HomePage() {
  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [roleChoice, setRoleChoice] = useState<AuthUser | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.email) e.email = 'El correo es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Correo no válido';
    if (!form.password) e.password = 'La contraseña es requerida';
    else if (form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;
    setIsLoading(true);
    try {
      const result = await login(form.email, form.password);
      const profiles = result.profiles || [];
      const businessUser = result.business?.user || result.user;

      // Multiple profiles → show selector
      if (profiles.length > 1) {
        if (businessUser) {
          setAvailableProfiles(profiles);
          setRoleChoice(businessUser);
        } else {
          router.push('/marketplace');
        }
        setIsLoading(false);
        return;
      }

      // Client-only
      if (profiles.includes('client') && !businessUser) {
        router.push('/marketplace');
        return;
      }

      if (businessUser) {
        const perms = businessUser.permissions ?? [];
        const isAdmin = (businessUser as any).isAdmin === true || perms.includes('employees.create');
        router.push(isAdmin ? '/home' : '/employee');
        return;
      }

      router.push('/');
    } catch (err: any) {
      setApiError(err?.message || 'Credenciales incorrectas');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSocialLogin(provider: 'google' | 'facebook', token: string) {
    setApiError(null);
    setIsLoading(true);
    try {
      // Try staff social login first
      const res = await api.post<{ data: any }>('/api/auth/social', { provider, token });
      const result = res.data;

      if (result.needsProfile) {
        // New user — show profile type selector
        setSocialProfile(result.socialProfile);
        setStep('choose-profile');
        return;
      }

      if (result.accessToken && result.user) {
        api.setAccessToken(result.accessToken);
        localStorage.setItem('refreshToken', result.refreshToken);
        localStorage.setItem('user', JSON.stringify(result.user));
        const isEmployee = !result.user.permissions?.includes('employees.create');
        router.push(isEmployee ? '/employee' : '/home');
      }
    } catch {
      // If staff social fails, try marketplace social
      try {
        const res = await api.post<{ data: any }>('/api/marketplace/auth/social', { provider, token });
        const result = res.data;
        if (result.accessToken) {
          // Existing marketplace user
          localStorage.setItem('marketplace_access_token', result.accessToken);
          localStorage.setItem('marketplace_refresh_token', result.refreshToken);
          router.push('/marketplace');
          return;
        }
      } catch {
        // Neither exists — new user
      }
      // Show profile selector for new user
      setStep('choose-profile');
    } finally {
      setIsLoading(false);
    }
  }

  // ─── STEP 2: Choose profile type (only for new users) ───
  // Role choice screen — admin that is also employee
  if (roleChoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#008080]">Siliba</h1>
            <p className="mt-2 text-gray-500 text-sm">Hola, {roleChoice.firstName}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">¿Como deseas ingresar?</h2>
            <p className="text-sm text-gray-500 mb-6">Selecciona el modo en el que quieres trabajar hoy</p>

            <div className="space-y-3">
              {availableProfiles.includes('admin') && (
              <button
                onClick={() => router.push('/home')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Administrador</p>
                    <p className="text-xs text-gray-500">Gestionar {roleChoice.tenantName || 'mi negocio'}</p>
                  </div>
                </div>
              </button>
              )}

              {availableProfiles.includes('professional') && (
              <button
                onClick={() => router.push('/employee')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{roleChoice.jobTitle || 'Empleado'}</p>
                    <p className="text-xs text-gray-500">Mi agenda, perfil y citas</p>
                  </div>
                </div>
              </button>
              )}

              {availableProfiles.includes('client') && (
              <button
                onClick={() => router.push('/marketplace')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Cliente</p>
                    <p className="text-xs text-gray-500">Explorar, reservar y comprar</p>
                  </div>
                </div>
              </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'choose-profile') {
    const profiles = [
      {
        title: 'Soy cliente',
        description: 'Descubre negocios, reserva citas y acumula puntos',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ),
        iconBg: 'bg-teal-50 text-teal-600',
        onClick: () => {
          if (socialProfile) {
            // Register as marketplace user with social profile
            router.push(`/marketplace/register?social=true&email=${encodeURIComponent(socialProfile.email)}&firstName=${encodeURIComponent(socialProfile.firstName)}&lastName=${encodeURIComponent(socialProfile.lastName)}`);
          } else {
            router.push('/marketplace/register');
          }
        },
      },
      {
        title: 'Soy profesional',
        description: 'Únete a un negocio con tu código de invitación',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        iconBg: 'bg-amber-50 text-amber-600',
        onClick: () => router.push('/register?type=business'),
      },
      {
        title: 'Gestionar mi negocio',
        description: 'Crea tu negocio y empieza a recibir reservas',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
        iconBg: 'bg-indigo-50 text-indigo-600',
        onClick: () => router.push('/register?type=individual'),
      },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold" style={{ color: '#008080' }}>Siliba</h1>
            <p className="mt-2 text-gray-500 text-sm">Tu confianza, en manos de profesionales</p>
          </div>

          {/* Social profile preview */}
          {socialProfile && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-center gap-4">
              {socialProfile.avatarUrl ? (
                <img src={socialProfile.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-lg font-bold">
                  {socialProfile.firstName[0]}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{socialProfile.firstName} {socialProfile.lastName}</p>
                <p className="text-sm text-gray-500">{socialProfile.email}</p>
              </div>
            </div>
          )}

          <p className="text-center text-sm font-medium text-gray-700 mb-4">
            {socialProfile ? '¿Cómo quieres usar Siliba?' : 'Elige tu perfil para crear tu cuenta'}
          </p>

          <div className="space-y-4">
            {profiles.map((profile) => (
              <button
                key={profile.title}
                onClick={profile.onClick}
                className="w-full bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-5 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200 text-left group"
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${profile.iconBg} group-hover:scale-110 transition-transform`}>
                  {profile.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900">{profile.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{profile.description}</p>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>

          <button
            onClick={() => { setStep('login'); setSocialProfile(null); setApiError(null); }}
            className="w-full mt-6 text-sm text-gray-500 hover:text-gray-700 text-center"
          >
            Volver al inicio de sesión
          </button>

          <p className="text-center mt-6 text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Siliba. Todos los derechos reservados.
          </p>
        </div>
      </div>
    );
  }

  // ─── STEP 1: Login (default) ───
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold" style={{ color: '#008080' }}>Siliba</h1>
          <p className="mt-1 text-gray-500 text-sm">Tu confianza, en manos de profesionales</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Iniciar sesión</h2>

          <SocialLoginButtons onSocialLogin={handleSocialLogin} disabled={isLoading} />

          {apiError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
              <input
                id="email" type="email" autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={`input-field ${errors.email ? 'border-red-400' : ''}`}
                placeholder="correo@ejemplo.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input
                id="password" type="password" autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={`input-field ${errors.password ? 'border-red-400' : ''}`}
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button type="submit" disabled={isLoading} className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
              {isLoading && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isLoading ? 'Entrando...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          ¿No tienes cuenta?{' '}
          <button onClick={() => setStep('choose-profile')} className="text-primary-600 hover:text-primary-700 font-medium">
            Crear cuenta
          </button>
        </p>

        <p className="text-center mt-4 text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Siliba. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
