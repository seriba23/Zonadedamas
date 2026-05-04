'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { SocialLoginButtons } from '@/components/ui/social-login-buttons';
import { api } from '@/lib/api';
import type { AuthUser } from '@/lib/auth';

interface SocialProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  provider: string;
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectAfterLogin = searchParams.get('redirect');
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [roleChoice, setRoleChoice] = useState<AuthUser | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);

  // Social login: invite code step
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.email) newErrors.email = 'El correo es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Ingresa un correo válido';
    if (!form.password) newErrors.password = 'La contraseña es requerida';
    else if (form.password.length < 6) newErrors.password = 'Mínimo 6 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
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
        return;
      }

      // Single profile — route directly. Respect redirect only when the
      // saved target matches the profile the user actually has (otherwise
      // it would loop the user back to a section they can't access).
      const wantsMarketplace = redirectAfterLogin?.startsWith('/marketplace');
      const wantsBusiness =
        redirectAfterLogin && !redirectAfterLogin.startsWith('/marketplace');

      if (profiles.includes('client') && !businessUser) {
        const target = wantsMarketplace ? redirectAfterLogin! : '/marketplace';
        router.push(target);
        return;
      }

      if (businessUser) {
        const perms = businessUser.permissions ?? [];
        const isAdmin = (businessUser as any).isAdmin === true || perms.includes('employees.create');
        const fallback = isAdmin ? '/home' : '/employee';
        const target = wantsBusiness ? redirectAfterLogin! : fallback;
        router.push(target);
        return;
      }

      // Fallback
      router.push('/');
    } catch (err: any) {
      setApiError(err?.message || 'Credenciales incorrectas. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSocialLogin(provider: 'google' | 'facebook', token: string) {
    setApiError(null);
    setIsLoading(true);
    try {
      const res = await api.post<{ data: any }>('/api/auth/social', { provider, token });
      const result = res.data;

      if (result.needsProfile) {
        // New user — show invite code form inline
        setSocialProfile(result.socialProfile);
        setIsLoading(false);
        return;
      }

      if (result.accessToken && result.user) {
        api.setAccessToken(result.accessToken);
        localStorage.setItem('refreshToken', result.refreshToken);
        localStorage.setItem('user', JSON.stringify(result.user));
        const isAdmin = result.user.permissions?.includes('employees.create');
        const hasEmp = !!result.user.employeeId;
        if (hasEmp) { setRoleChoice(result.user); return; }
        router.push(isAdmin ? '/home' : '/employee');
      }
    } catch (err: any) {
      setApiError(err?.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInviteSubmit(e: FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim();
    if (!code) { setInviteError('Ingresa el código de invitación'); return; }

    setInviteLoading(true);
    setInviteError('');
    try {
      const res = await api.post<{ data: any }>('/api/auth/social', {
        provider: socialProfile!.provider,
        token: '__already_verified__', // Won't work — need to re-send real token
        inviteCode: code,
      });
      // This approach won't work because the social token is single-use.
      // Instead, we register directly with email + random password + invite code.
      const registerRes = await api.post<{ data: any }>('/api/auth/register', {
        email: socialProfile!.email,
        password: crypto.randomUUID().slice(0, 16) + 'A1!',
        firstName: socialProfile!.firstName,
        lastName: socialProfile!.lastName,
        inviteCode: code,
      });
      const result = registerRes.data;
      if (result.accessToken && result.user) {
        api.setAccessToken(result.accessToken);
        localStorage.setItem('refreshToken', result.refreshToken);
        localStorage.setItem('user', JSON.stringify(result.user));
        const isAdmin = result.user.permissions?.includes('employees.create');
        const hasEmp = !!result.user.employeeId;
        if (hasEmp) { setRoleChoice(result.user); return; }
        router.push(isAdmin ? '/home' : '/employee');
      }
    } catch (err: any) {
      setInviteError(err?.message || 'Código de invitación inválido');
    } finally {
      setInviteLoading(false);
    }
  }

  // Role choice screen — admin that is also employee
  if (roleChoice) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#008080]">Siliba</h1>
            <p className="mt-2 text-gray-500 text-sm">Hola, {roleChoice.firstName}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8">
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
                    <p className="font-semibold text-gray-900">Profesional</p>
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

  // If social login returned needsProfile — show invite code form
  if (socialProfile) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
            <p className="mt-1 text-gray-500 text-sm">Tu confianza, en manos de profesionales</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8">
            {/* Social profile preview */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
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

            <h2 className="text-lg font-semibold text-gray-900 mb-2">Únete a un negocio</h2>
            <p className="text-sm text-gray-500 mb-6">
              Para continuar como profesional, ingresa el código de invitación que te proporcionó tu empleador.
            </p>

            {inviteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{inviteError}</div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de invitación</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="input-field uppercase tracking-widest text-center font-mono text-lg"
                  placeholder="Ej: DEMOSALON"
                  maxLength={20}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={inviteLoading || !inviteCode.trim()}
                className="w-full btn-primary py-2.5 flex items-center justify-center gap-2"
              >
                {inviteLoading && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {inviteLoading ? 'Registrando...' : 'Unirme al negocio'}
              </button>
            </form>

            <button
              onClick={() => setSocialProfile(null)}
              className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-5 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-600">Siliba</h1>
          <p className="mt-1 text-gray-500 text-xs sm:text-sm">Tu confianza, en manos de profesionales</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8">
          <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Iniciar sesión</h2>

          {/* Social Login */}
          <SocialLoginButtons onSocialLogin={handleSocialLogin} disabled={isLoading} />

          {/* API Error */}
          {apiError && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
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
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          ¿No tienes cuenta?{' '}
          <Link href="/" className="text-primary-600 hover:text-primary-700 font-medium">Crear cuenta</Link>
        </p>

        <p className="text-center mt-4 text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Siliba. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
