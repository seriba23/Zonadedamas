'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { EmployeeSidebar } from '@/components/layout/employee-sidebar';
import { api } from '@/lib/api';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { StripePaymentElementOptions } from '@stripe/stripe-js';

const TEAL = '#008080';
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// ─── Panel de pago independiente (Stripe) ─────────────────────
function IndiePaymentForm({ clientSecret, amount, onSuccess, onCancel }: {
  clientSecret: string; amount: number; onSuccess: () => void; onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true); setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/employee` },
      redirect: 'if_required',
    });
    if (result.error) { setError(result.error.message || 'Error al procesar.'); setLoading(false); }
    else onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' } as StripePaymentElementOptions} />
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !stripe}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: '#7c3aed' }}>
          {loading ? 'Procesando...' : `Pagar $${amount.toFixed(2)} USD/mes`}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Pantalla de desvinculación ────────────────────────────────
type Flow = null | 'invite' | 'indie' | 'business';

function DeactivatedScreen({ user, onLogout, onSuccess }: {
  user: any; tenantName: string; onLogout: () => void; onSuccess: () => void;
}) {
  const tenantName = user?.tenantName || 'la empresa';
  const [flow, setFlow] = useState<Flow>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite code flow
  const [inviteCode, setInviteCode] = useState('');

  // Business creation flow
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('SALON');

  // Indie flow
  const [indieClientSecret, setIndieClientSecret] = useState<string | null>(null);

  async function handleAcceptInvite() {
    if (!inviteCode.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await api.post<{ data: { accessToken: string; refreshToken: string } }>(
        '/api/auth/accept-invite', { inviteCode: inviteCode.trim().toUpperCase() }
      );
      api.setAccessToken(res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Código inválido o expirado.');
    } finally { setLoading(false); }
  }

  async function handleGoIndie() {
    setLoading(true); setError(null);
    try {
      const res = await api.post<{ data: { clientSecret: string } }>('/api/auth/go-independent', {});
      setIndieClientSecret(res.data.clientSecret);
    } catch (e: any) {
      setError(e?.message || 'Error al iniciar el proceso.');
    } finally { setLoading(false); }
  }

  async function handleCreateBusiness() {
    if (!businessName.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await api.post<{ data: { accessToken: string; refreshToken: string } }>(
        '/api/auth/create-business',
        { businessName: businessName.trim(), businessType }
      );
      api.setAccessToken(res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Error al crear la empresa.');
    } finally { setLoading(false); }
  }

  const businessTypes = [
    { value: 'SALON', label: 'Salón de belleza' },
    { value: 'BARBERSHOP', label: 'Barbería' },
    { value: 'SPA', label: 'Spa / Bienestar' },
    { value: 'CLINIC', label: 'Clínica / Salud' },
    { value: 'STUDIO', label: 'Estudio / Academia' },
    { value: 'OTHER', label: 'Otro' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-xl font-bold text-primary-600">Siliba</span>
      </div>

      {/* ── Modal flujo activo ─── */}
      {flow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

            {/* ── Vincular a otra empresa ── */}
            {flow === 'invite' && (
              <div>
                <div className="px-6 py-5" style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #006666 100%)` }}>
                  <h2 className="text-lg font-bold" style={{ color: '#fff' }}>Vincular a otra empresa</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    Ingresa el código de invitación que te compartió la empresa.
                  </p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                    La empresa debe tener licencias disponibles para poder invitarte. Solicita el código de invitación al administrador del negocio.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código de invitación</label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="Ej: ABC12345"
                      maxLength={12}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:border-transparent uppercase"
                      style={{ '--tw-ring-color': TEAL } as any}
                    />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠️ {error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptInvite}
                      disabled={loading || inviteCode.trim().length < 4}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: TEAL }}
                    >
                      {loading ? 'Verificando...' : 'Unirme a la empresa'}
                    </button>
                    <button onClick={() => { setFlow(null); setError(null); setInviteCode(''); }}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Continuar como independiente ── */}
            {flow === 'indie' && (
              <div>
                <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}>
                  <h2 className="text-lg font-bold" style={{ color: '#fff' }}>Profesionista independiente</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    Tu propio perfil · sin depender de nadie
                  </p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {!indieClientSecret ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ backgroundColor: '#7c3aed' }}>✓</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Perfil público en el marketplace</p>
                            <p className="text-xs text-gray-500">Los clientes pueden encontrarte y reservar contigo directamente.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ backgroundColor: '#7c3aed' }}>✓</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Gestión de citas y clientes</p>
                            <p className="text-xs text-gray-500">Calendario, historial y recordatorios automáticos.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ backgroundColor: '#7c3aed' }}>✓</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Dashboard de ingresos y comisiones</p>
                            <p className="text-xs text-gray-500">Control total de tus finanzas como profesionista.</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border-2 px-4 py-3 text-center" style={{ borderColor: '#7c3aed', backgroundColor: '#f5f3ff' }}>
                        <p className="text-2xl font-black" style={{ color: '#7c3aed' }}>$15 <span className="text-base font-medium text-gray-500">USD/mes</span></p>
                        <p className="text-xs text-gray-500 mt-0.5">$10 plataforma + $5 perfil de profesionista</p>
                      </div>
                      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠️ {error}</p>}
                      <div className="flex gap-2">
                        <button onClick={handleGoIndie} disabled={loading}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: '#7c3aed' }}>
                          {loading ? 'Preparando...' : 'Continuar y pagar'}
                        </button>
                        <button onClick={() => { setFlow(null); setError(null); }}
                          className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <Elements stripe={stripePromise} options={{ clientSecret: indieClientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#7c3aed' } } }}>
                      <IndiePaymentForm
                        clientSecret={indieClientSecret}
                        amount={15}
                        onSuccess={() => { setIndieClientSecret(null); onSuccess(); }}
                        onCancel={() => { setIndieClientSecret(null); setFlow(null); }}
                      />
                    </Elements>
                  )}
                </div>
              </div>
            )}

            {/* ── Registrar nueva empresa ── */}
            {flow === 'business' && (
              <div>
                <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)' }}>
                  <h2 className="text-lg font-bold" style={{ color: '#fff' }}>Registrar nueva empresa</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    Usaremos tu cuenta actual · no tienes que volver a registrarte.
                  </p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                    Tu nombre, correo y contraseña se conservan. Solo necesitamos los datos del nuevo negocio.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Ej: Salón Bella Vista"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de negocio</label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                    >
                      {businessTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠️ {error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateBusiness}
                      disabled={loading || !businessName.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: '#0369a1' }}
                    >
                      {loading ? 'Creando...' : 'Crear empresa'}
                    </button>
                    <button onClick={() => { setFlow(null); setError(null); setBusinessName(''); }}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Card principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg overflow-hidden">

        {/* Banner rojo */}
        <div className="px-6 py-5 text-center" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <svg className="w-7 h-7" style={{ color: '#ffffff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffffff' }}>Tu cuenta ha sido desactivada</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
            <span className="font-semibold" style={{ color: '#ffffff' }}>{tenantName}</span> ha decidido desvincular tu perfil.
          </p>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-500 text-center mb-5">
            Tu historial, citas y datos están seguros. Elige cómo quieres continuar:
          </p>

          <div className="space-y-3">
            {/* Vincular */}
            <button
              onClick={() => { setFlow('invite'); setError(null); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:shadow-sm transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#e0f2f1', color: TEAL }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Vincular a otra empresa</p>
                <p className="text-xs text-gray-400 mt-0.5">Ingresa el código de invitación del negocio que te contrató.</p>
              </div>
              <span className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: TEAL }}>
                Tengo un código
              </span>
            </button>

            {/* Independiente */}
            <button
              onClick={() => { setFlow('indie'); setError(null); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:shadow-sm transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Continuar como independiente</p>
                <p className="text-xs text-gray-400 mt-0.5">Perfil de profesionista · $15 USD/mes · apareces en el marketplace.</p>
              </div>
              <span className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#7c3aed' }}>
                Ver plan
              </span>
            </button>

            {/* Nueva empresa */}
            <button
              onClick={() => { setFlow('business'); setError(null); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:shadow-sm transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f0f9ff', color: '#0369a1' }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Registrar nueva empresa</p>
                <p className="text-xs text-gray-400 mt-0.5">Crea tu propio negocio. Tu cuenta actual se convierte en dueño.</p>
              </div>
              <span className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#0369a1' }}>
                Crear empresa
              </span>
            </button>
          </div>
        </div>

        <div className="px-6 pb-5 text-center">
          <button onClick={onLogout} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Cerrar sesión
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        ¿Necesitas ayuda?{' '}
        <a href="/marketplace/help" className="underline hover:text-gray-600">Contacta soporte</a>
      </p>
    </div>
  );
}

// ─── Layout principal ─────────────────────────────────────────
export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  const { data: empData } = useQuery({
    queryKey: ['employee-profile-check', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: any }>(`/api/employees/${user!.employeeId}`);
      return res.data;
    },
    enabled: !!user?.employeeId && isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Empleado desvinculado → pantalla de opciones sin sidebar
  if (user?.employeeId && user.isEmployeeActive === false) {
    return (
      <DeactivatedScreen
        user={user}
        tenantName={user.tenantName || 'la empresa'}
        onLogout={async () => { await logout(); router.replace('/login'); }}
        onSuccess={() => { window.location.href = '/employee'; }}
      />
    );
  }

  const profileIncomplete = empData && (!empData.avatarUrl || !empData.bio);
  const missingItems: string[] = [];
  if (empData && !empData.avatarUrl) missingItems.push('foto de perfil');
  if (empData && !empData.bio) missingItems.push('descripción profesional');

  return (
    <div className="flex h-screen bg-gray-50">
      <EmployeeSidebar />
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
        {profileIncomplete && (
          <div className="bg-teal-50 border-b border-teal-200 px-4 py-2.5">
            <div className="flex items-center justify-between max-w-7xl mx-auto gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <svg className="w-4 h-4 flex-shrink-0 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-teal-800">
                  <span className="font-semibold">Completa tu perfil profesional</span>
                  {' — '}Agrega tu {missingItems.join(' y ')} para que los clientes puedan conocerte.
                </p>
              </div>
              <Link
                href="/employee/settings"
                className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Completar perfil
              </Link>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
