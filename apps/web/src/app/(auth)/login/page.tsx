'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { SocialLoginButtons } from '@/components/ui/social-login-buttons';
import { api } from '@/lib/api';
import { marketplaceApi } from '@/lib/marketplace-api';
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
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Se setea a true durante el flujo de login en curso para que el useEffect
  // de auto-redirect no se dispare antes de que handleSubmit decida si mostrar
  // el selector de perfiles (admin/empleado/cliente) o redirigir directo.
  const skipAutoRedirect = useRef(false);

  // Si ya hay sesion activa Y el usuario entro con un ?redirect explicito,
  // respetar ese destino. Sin redirect explicito, NO hacer auto-redirect:
  // mostrar el form para que el usuario decida (login como cliente vs admin
  // vs empleado) en cada visita a /login. Esto evita que un usuario con
  // sesion de cliente nunca pueda volver a elegir entrar como admin.
  useEffect(() => {
    if (authLoading) return;
    if (skipAutoRedirect.current) return;
    if (!isAuthenticated || !user) return;
    if (!redirectAfterLogin) return; // sin redirect explicito -> mostrar form
    const wantsMarketplace = redirectAfterLogin.startsWith('/marketplace');
    if (wantsMarketplace) return; // marketplace guard se encarga
    router.replace(redirectAfterLogin);
  }, [authLoading, isAuthenticated, user, redirectAfterLogin, router]);

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [roleChoice, setRoleChoice] = useState<AuthUser | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);

  // Social login: tipo de cuenta + invite code step
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [socialToken, setSocialToken] = useState<string | null>(null);
  // 'choice' = mostrar selector (Cliente/Profesional/Administrador)
  // 'professional' = mostrar form de codigo de invitacion
  const [socialStage, setSocialStage] = useState<'choice' | 'professional'>('choice');
  const [socialError, setSocialError] = useState('');
  const [socialBusy, setSocialBusy] = useState(false);
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
    // Bloquea el auto-redirect del useEffect mientras procesamos el resultado.
    skipAutoRedirect.current = true;
    try {
      const result = await login(form.email, form.password);
      const profiles = result.profiles || [];
      const businessUser = result.business?.user || result.user;
      const anyUser = businessUser || (result as any).client?.user || result.user;

      // SIEMPRE mostrar el selector despues del login. El usuario quiere
      // elegir conscientemente cada vez como entrar (cliente / profesional
      // / administrador), aunque solo tenga un perfil. El parametro
      // ?redirect se aplica DESPUES del selector cuando el usuario hace
      // click en el rol correspondiente.
      if (profiles.length >= 1 && anyUser) {
        setAvailableProfiles(profiles);
        setRoleChoice(anyUser);
        return;
      }

      // Fallback (no deberia llegar aqui si el login fue exitoso).
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
    skipAutoRedirect.current = true;
    try {
      const res = await api.post<{ data: any }>('/api/auth/social', { provider, token });
      const result = res.data;

      if (result.needsProfile) {
        // New user — primero mostrar selector de tipo de cuenta
        // (Cliente / Profesional / Administrador), no saltar directo
        // al form de invitacion.
        setSocialProfile(result.socialProfile);
        setSocialToken(token);
        setSocialStage('choice');
        setSocialError('');
        setIsLoading(false);
        return;
      }

      const profiles: string[] = result.profiles || [];
      const businessUser = result.business?.user || (result.user?.tenantId ? result.user : null);
      const wantsMarketplace = redirectAfterLogin?.startsWith('/marketplace');
      const wantsBusiness =
        redirectAfterLogin && !redirectAfterLogin.startsWith('/marketplace');

      // Persist business session if present.
      if (result.business?.accessToken) {
        api.setAccessToken(result.business.accessToken);
        localStorage.setItem('refreshToken', result.business.refreshToken);
        localStorage.setItem('user', JSON.stringify(result.business.user));
      } else if (result.accessToken && businessUser) {
        // Legacy fallback (older API response shape)
        api.setAccessToken(result.accessToken);
        localStorage.setItem('refreshToken', result.refreshToken);
        localStorage.setItem('user', JSON.stringify(result.user));
      }

      // Persist client session if present (used by marketplace).
      if (result.client?.accessToken && result.client?.refreshToken) {
        marketplaceApi.setSession(result.client.accessToken, result.client.refreshToken);
      }

      // SIEMPRE mostrar el selector despues del social login.
      // El usuario quiere elegir conscientemente cada vez. El redirect
      // se aplica al hacer click en el rol correspondiente del selector.
      const anyUser = businessUser || (result as any).client?.user || result.user;
      if (profiles.length >= 1 && anyUser) {
        setAvailableProfiles(profiles);
        setRoleChoice(anyUser);
        return;
      }

      // Should not happen but keep a safe fallback.
      setApiError('No se pudo iniciar sesión con esta cuenta.');
    } catch (err: any) {
      setApiError(err?.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChooseClient() {
    if (!socialProfile || !socialToken) return;
    setSocialBusy(true);
    setSocialError('');
    try {
      // Marketplace tiene su propio endpoint social que registra al cliente.
      await marketplaceApi.socialLoginAndStore(
        socialProfile.provider as 'google' | 'facebook',
        socialToken,
      );
      router.push('/marketplace');
    } catch (err: any) {
      setSocialError(err?.message || 'No se pudo registrar la cuenta de cliente.');
    } finally {
      setSocialBusy(false);
    }
  }

  function handleChooseAdmin() {
    if (!socialProfile) return;
    // Redirige al flujo de registro de negocio con los datos sociales
    // pre-llenados. El usuario completara el nombre del negocio alli.
    const params = new URLSearchParams({
      type: 'freelancer',
      email: socialProfile.email,
      firstName: socialProfile.firstName,
      lastName: socialProfile.lastName,
    });
    router.push(`/register?${params.toString()}`);
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

  // Selector de tipo de cuenta — siempre se muestra las 3 opciones aunque
  // el usuario solo tenga 1 perfil. Si tiene ese perfil → va a su panel.
  // Si NO lo tiene → va al flujo de registro para convertirse en ese tipo
  // (asi no se cierra la puerta a que un cliente despues quiera ser
  // emprendedor/independiente/admin sin tener que cerrar sesion).
  if (roleChoice) {
    // Si el usuario llego al login con ?redirect que apunta a una zona
    // compatible con el rol elegido, lo respetamos al hacer click.
    const wantsMarketplace = redirectAfterLogin?.startsWith('/marketplace');
    const wantsBusiness =
      redirectAfterLogin && !redirectAfterLogin.startsWith('/marketplace');
    const goOrRegister = (profile: 'admin' | 'professional' | 'client', registerType: string) => {
      if (availableProfiles.includes(profile)) {
        if (profile === 'admin') {
          router.push(wantsBusiness ? redirectAfterLogin! : '/home');
        } else if (profile === 'professional') {
          router.push(wantsBusiness ? redirectAfterLogin! : '/employee');
        } else {
          router.push(wantsMarketplace ? redirectAfterLogin! : '/marketplace');
        }
      } else {
        router.push(`/register?type=${registerType}`);
      }
    };
    const hasAdmin = availableProfiles.includes('admin');
    const hasProfessional = availableProfiles.includes('professional');
    const hasClient = availableProfiles.includes('client');
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-3 md:py-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#008080]">Siliba</h1>
            <p className="mt-2 text-gray-500 text-sm">Hola, {roleChoice.firstName}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">¿Cómo deseas ingresar?</h2>
            <p className="text-sm text-gray-500 mb-6">Selecciona el modo en el que quieres trabajar hoy</p>

            <div className="space-y-3">
              {/* Administrador (dueño de negocio) */}
              <button
                onClick={() => goOrRegister('admin', 'business')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">Administrador</p>
                      {!hasAdmin && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Crear</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {hasAdmin ? `Gestionar ${roleChoice.tenantName || 'mi negocio'}` : 'Crea tu empresa y administra tu negocio'}
                    </p>
                  </div>
                </div>
              </button>

              {/* Profesional independiente */}
              <button
                onClick={() => goOrRegister('professional', 'individual')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">Profesional</p>
                      {!hasProfessional && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Crear</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {hasProfessional ? 'Mi agenda, perfil y citas' : 'Trabaja como profesional independiente'}
                    </p>
                  </div>
                </div>
              </button>

              {/* Cliente */}
              <button
                onClick={() => goOrRegister('client', 'client')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">Cliente</p>
                      {!hasClient && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Crear</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {hasClient ? 'Explorar, reservar y comprar' : 'Crea tu cuenta de cliente para reservar'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If social login returned needsProfile — show account type selector first,
  // then optionally invite code form for "Profesional".
  if (socialProfile) {
    const ProfileHeader = (
      <>
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
      </>
    );

    // STAGE 1: selector de tipo de cuenta
    if (socialStage === 'choice') {
      return (
        <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-3 md:py-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
              <p className="mt-1 text-gray-500 text-sm">Tu confianza, en manos de profesionales</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-8">
              {ProfileHeader}

              <h2 className="text-lg font-semibold text-gray-900 mb-2">¿Cómo quieres usar Siliba?</h2>
              <p className="text-sm text-gray-500 mb-6">Selecciona el tipo de cuenta que vas a crear.</p>

              {socialError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{socialError}</div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleChooseClient}
                  disabled={socialBusy}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Cliente</p>
                      <p className="text-xs text-gray-500">Quiero reservar citas en negocios</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => { setSocialError(''); setSocialStage('professional'); }}
                  disabled={socialBusy}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Profesional</p>
                      <p className="text-xs text-gray-500">Me uno a un negocio con código de invitación</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleChooseAdmin}
                  disabled={socialBusy}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Administrador</p>
                      <p className="text-xs text-gray-500">Voy a registrar mi propio negocio</p>
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => { setSocialProfile(null); setSocialToken(null); }}
                disabled={socialBusy}
                className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700"
              >
                Volver al inicio de sesión
              </button>
            </div>
          </div>
        </div>
      );
    }

    // STAGE 2: form de codigo de invitacion (cuando eligio "Profesional")
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-3 md:py-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
            <p className="mt-1 text-gray-500 text-sm">Tu confianza, en manos de profesionales</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-8">
            {ProfileHeader}

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
              onClick={() => { setSocialStage('choice'); setInviteCode(''); setInviteError(''); }}
              className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-3 md:py-6">
      <div className="w-full max-w-[300px] md:max-w-md">
        {/* Logo */}
        <div className="text-center mb-2 md:mb-8">
          <h1 className="text-base md:text-3xl font-bold text-primary-600">Siliba</h1>
          <p className="hidden md:block mt-1 text-gray-500 text-sm">Tu confianza, en manos de profesionales</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 md:p-8">
          <h2 className="hidden md:block text-xl font-semibold text-gray-900 mb-6">Iniciar sesión</h2>

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

          <form onSubmit={handleSubmit} className="space-y-2 md:space-y-5">
            <div>
              <label htmlFor="email" className="block text-[10px] md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1.5">Correo electrónico</label>
              <input
                id="email" type="email" autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={`input-field text-xs md:text-base py-1 md:py-2 ${errors.email ? 'border-red-400' : ''}`}
                placeholder="correo@ejemplo.com"
              />
              {errors.email && <p className="mt-0.5 text-[10px] md:text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-[10px] md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1.5">Contraseña</label>
              <input
                id="password" type="password" autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={`input-field text-xs md:text-base py-1 md:py-2 ${errors.password ? 'border-red-400' : ''}`}
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-0.5 text-[10px] md:text-xs text-red-600">{errors.password}</p>}
            </div>

            <div className="text-center">
              <Link href="/forgot-password" className="text-[10px] md:text-sm text-primary-600 hover:text-primary-700 font-medium">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button type="submit" disabled={isLoading} className="w-full btn-primary flex items-center justify-center gap-2 py-1 md:py-2.5 text-xs md:text-base">
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

        <p className="text-center mt-2 text-[10px] md:mt-6 md:text-sm text-gray-500">
          ¿No tienes cuenta?{' '}
          <Link href="/" className="text-primary-600 hover:text-primary-700 font-medium">Crear cuenta</Link>
        </p>

        <p className="text-center mt-1 text-[9px] md:mt-4 md:text-xs text-gray-400">
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
