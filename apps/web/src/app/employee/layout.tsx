// ─── layout.tsx — Portal del Empleado ─────────────────────────────────────
//
// CONCEPTO: App Router de Next.js 14
// En Next.js 14 (App Router) cada carpeta puede tener un archivo especial
// llamado layout.tsx. Este archivo define el "envoltorio" que RODEA a todas
// las páginas dentro de esa carpeta y sus subcarpetas.
//
// Por ejemplo, todas las páginas dentro de /employee/ (citas, comisiones,
// perfil, etc.) están DENTRO de este layout. El layout se renderiza UNA SOLA
// VEZ y las páginas van apareciendo dentro de la zona {children}.
//
// ¿QUÉ HACE ESTE LAYOUT?
// 1. Verifica que el usuario esté autenticado → si no, lo manda al login.
// 2. Detecta si el empleado fue desvinculado del negocio → muestra una
//    pantalla especial con opciones (unirse a otra empresa, ser independiente,
//    o crear su propio negocio).
// 3. Muestra la barra lateral (sidebar) de navegación.
// 4. Muestra una barra superior (topbar) con el botón de menú en móvil.
// 5. Muestra un banner recordatorio si el empleado tiene el perfil incompleto.
// 6. Dentro de <main> se renderizan todas las páginas hijas ({children}).

'use client';
// 'use client' → esta directiva le dice a Next.js que este componente
// se ejecuta en el NAVEGADOR (lado del cliente), no en el servidor.
// Es OBLIGATORIO cuando usas hooks de React como useState, useEffect,
// o cuando accedes a cosas del navegador como window o localStorage.

import { useEffect, useRef, useState } from 'react';
// useEffect → hook que ejecuta código cuando el componente se monta o
//             cuando cambian ciertas variables (efectos secundarios).
// useState  → hook que crea variables de estado. Cuando cambian, React
//             vuelve a dibujar (re-renderizar) el componente.

import { useRouter, usePathname } from 'next/navigation';
// useRouter → hook de Next.js para navegar entre páginas programáticamente
// (sin que el usuario haga clic en un enlace). Se usa para redirigir.

import { useAuth } from '@/lib/hooks/use-auth';
// Permite que las páginas del empleado pongan un botón en el header (topbar),
// igual que en la consola de administrador.
import { TopbarActionProvider, useTopbarAction } from '@/lib/hooks/use-topbar-action';
// Banner de suscripción (prueba / pago pendiente). Solo aplica al freelancer
// dueño de la cuenta (no a empleados afiliados, que no pagan la suscripción).
import { SubscriptionBanner } from '@/components/subscription-banner';
// useAuth → hook personalizado del proyecto que da acceso a:
//   - user: objeto con los datos del usuario autenticado (nombre, id, etc.)
//   - isAuthenticated: booleano (true/false) que indica si hay sesión activa
//   - isLoading: booleano que indica si aún se está verificando la sesión
//   - logout: función para cerrar sesión

import { useQuery } from '@tanstack/react-query';
// useQuery → hook de React Query (librería de gestión de datos del servidor).
// Hace una petición HTTP, guarda el resultado en caché y lo comparte
// entre componentes. Evita hacer la misma petición varias veces.

import { EmployeeSidebar } from '@/components/layout/employee-sidebar';
// EmployeeSidebar → componente de la barra lateral de navegación del empleado.
// Muestra los enlaces a Citas, Asistencia, Comisiones, etc.

import { api } from '@/lib/api';
// api → cliente HTTP del proyecto. Tiene métodos como api.get(), api.post(),
// api.put(). Se encarga de añadir el token JWT a las peticiones automáticamente.

import { ForceLightTheme } from '@/components/ui/force-light-theme';
// ForceLightTheme → componente que fuerza el tema claro (light mode)
// en el portal del empleado, ignorando la preferencia del sistema operativo.

import { NotificationBell } from '@/components/notifications/notification-bell';
import { SectionHelp } from '@/components/ui/section-help';
import { SectionHelpProvider } from '@/lib/section-help-context';
// NotificationBell → componente del ícono de campana que muestra el contador
// de notificaciones no leídas y abre el panel de notificaciones.

import { useEnsurePushSubscription } from '@/lib/hooks/use-staff-notifications';
// useEnsurePushSubscription → hook que registra el service worker del navegador
// y suscribe al empleado para recibir notificaciones push (alertas en el
// teléfono/PC aunque la app no esté abierta).

import Link from 'next/link';
// Link → componente de Next.js para navegación entre páginas del sitio.
// Es como un <a> pero sin recargar la página completa.

import { loadStripe } from '@stripe/stripe-js';
// loadStripe → función que carga el SDK de Stripe (pasarela de pagos)
// de forma asíncrona. Se llama una sola vez fuera del componente para
// evitar recargar la librería en cada render.

import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
// Elements       → componente proveedor de Stripe. Envuelve el formulario
//                  de pago y provee el contexto de Stripe a sus hijos.
// PaymentElement → componente de Stripe que renderiza el formulario de
//                  tarjeta/OXXO/transferencia de forma segura y certificada.
// useStripe      → hook que da acceso al objeto Stripe (para confirmar pagos).
// useElements    → hook que da acceso a los elementos del formulario de pago.

import type { StripePaymentElementOptions } from '@stripe/stripe-js';
// Tipo TypeScript para las opciones de configuración del PaymentElement.

// CONSTANTE: color teal/verde agua, color principal del proyecto.
// Se define fuera del componente para no recrearla en cada render.
const TEAL = '#008080';

// loadStripe se llama UNA SOLA VEZ al cargar el módulo (fuera del componente).
// Devuelve una promesa que resuelve con el objeto Stripe.
// Si la publishable key NO está embebida en el build, NO inicializamos Stripe:
// loadStripe('') lanza un IntegrationError ("You used an empty string") que
// contamina la consola en toda pantalla del empleado. En ese caso dejamos null;
// <Elements stripe={null}> lo acepta sin romper y el pago con tarjeta queda
// deshabilitado hasta que la clave (pk_...) esté presente en el build.
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_PK.startsWith('pk_') ? loadStripe(STRIPE_PK) : null;

// ─── Panel de pago independiente (Stripe) ─────────────────────
// Este componente sólo se usa cuando el empleado desvinculado elige
// la opción "Continuar como independiente" y quiere pagar la suscripción
// mensual directamente desde esta pantalla usando Stripe.
//
// PROPS (propiedades que recibe el componente desde su padre):
//   clientSecret → string secreto que Stripe genera en el backend para
//                  identificar esta intención de pago específica.
//   amount       → monto a cobrar (en pesos MXN), solo para mostrarlo.
//   onSuccess    → función callback que el padre nos pasa; la llamamos
//                  cuando el pago se completa exitosamente.
//   onCancel     → función callback para cuando el usuario cancela.
function IndiePaymentForm({ clientSecret, amount, onSuccess, onCancel }: {
  clientSecret: string; amount: number; onSuccess: () => void; onCancel: () => void;
}) {
  // useStripe() da acceso al SDK de Stripe. Puede ser null si el contexto
  // <Elements> aún no está listo (por eso verificamos antes de usarlo).
  const stripe = useStripe();

  // useElements() da acceso a los elementos del formulario (tarjeta, etc.)
  const elements = useElements();

  // Estado local: true mientras se procesa el pago (muestra "Procesando...").
  const [loading, setLoading] = useState(false);

  // Estado local: mensaje de error si el pago falla. null = sin error.
  const [error, setError] = useState<string | null>(null);

  // handleSubmit: se ejecuta cuando el usuario hace clic en "Pagar $X MXN/mes".
  // Es async porque espera la respuesta de la API de Stripe.
  async function handleSubmit(e: React.FormEvent) {
    // e.preventDefault() evita que el formulario HTML recargue la página
    // (comportamiento predeterminado de los formularios).
    e.preventDefault();

    // Guardamos que evitamos si Stripe aún no cargó (puede ser null al inicio).
    if (!stripe || !elements) return;

    setLoading(true); setError(null);

    // stripe.confirmPayment() envía los datos de la tarjeta a Stripe de forma
    // segura y confirma el pago. Nunca los datos de la tarjeta pasan por
    // nuestro servidor.
    const result = await stripe.confirmPayment({
      elements,
      // return_url: URL a la que Stripe redirige si necesita autenticación 3D
      // Secure (por ejemplo, código SMS del banco).
      confirmParams: { return_url: `${window.location.origin}/employee` },
      // redirect: 'if_required' → solo redirige si es NECESARIO (3DS).
      // Si no, devuelve el resultado directamente sin redirigir.
      redirect: 'if_required',
    });

    // Si result.error existe, el pago falló. Mostramos el mensaje de error.
    if (result.error) { setError(result.error.message || 'Error al procesar.'); setLoading(false); }
    // Si no hay error, el pago fue exitoso → llamamos al callback del padre.
    else onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* PaymentElement → formulario seguro de Stripe con opciones de pago */}
      <PaymentElement options={{ layout: 'tabs' } as StripePaymentElementOptions} />

      {/* Renderizado condicional: el error solo se muestra si existe (no es null) */}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        {/* disabled={loading || !stripe} → desactiva el botón si está cargando
            o si Stripe aún no se ha inicializado */}
        <button type="submit" disabled={loading || !stripe}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: '#7c3aed' }}>
          {/* Ternario: si loading es true muestra texto de espera, si no
              muestra el monto formateado con dos decimales */}
          {loading ? 'Procesando...' : `Pagar $${amount.toFixed(2)} MXN/mes`}
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
// Se muestra cuando el negocio desactiva al empleado (isEmployeeActive=false).
// En lugar de mostrar la pantalla normal, ofrecemos tres opciones de salida:
//   'invite'   → Unirse a otra empresa con código de invitación
//   'indie'    → Convertirse en profesionista independiente (pago mensual)
//   'business' → Crear su propio negocio (se convierte en dueño)
//    null      → Sin flujo activo (pantalla principal de opciones)
//
// Flow es un tipo TypeScript de "unión de literales": solo puede tener
// exactamente uno de estos cuatro valores posibles.
type Flow = null | 'invite' | 'indie' | 'business';

// PROPS del componente DeactivatedScreen:
//   user       → objeto del usuario (contiene tenantName, etc.)
//   tenantName → nombre del negocio que desvinculó al empleado
//   onLogout   → función para cerrar sesión
//   onSuccess  → función a llamar cuando el empleado se vuelve a vincular
function DeactivatedScreen({ user, onLogout, onSuccess }: {
  user: any; tenantName: string; onLogout: () => void; onSuccess: () => void;
}) {
  // Obtenemos el nombre del negocio del objeto user, o usamos "la empresa"
  // como texto de respaldo (fallback con el operador ||).
  const tenantName = user?.tenantName || 'la empresa';

  // flow: cuál de los tres flujos está activo ahora mismo. Empieza en null
  // (ninguno). Cuando el usuario hace clic en una opción, se actualiza.
  const [flow, setFlow] = useState<Flow>(null);

  // loading: true mientras se espera respuesta del servidor (p. ej. al
  // enviar el código de invitación o crear la empresa).
  const [loading, setLoading] = useState(false);

  // error: mensaje de error a mostrar. null significa "sin error".
  const [error, setError] = useState<string | null>(null);

  // Flujo "Invite code": el empleado escribe aquí el código que le dio
  // el nuevo negocio.
  const [inviteCode, setInviteCode] = useState('');

  // Flujo "Business creation": nombre y tipo del nuevo negocio.
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('SALON');

  // Flujo "Indie": guarda el clientSecret de Stripe para el formulario de
  // pago. null significa que aún no se ha iniciado el proceso de pago.
  const [indieClientSecret, setIndieClientSecret] = useState<string | null>(null);

  // handleAcceptInvite: envía el código al backend. Si es válido, el backend
  // devuelve nuevos tokens JWT que vinculan al empleado con el nuevo negocio.
  async function handleAcceptInvite() {
    // .trim() elimina espacios en blanco al inicio y al final.
    // Si el código está vacío, no hacemos nada.
    if (!inviteCode.trim()) return;
    setLoading(true); setError(null);
    try {
      // api.post envía un POST al backend con el código de invitación.
      // .toUpperCase() convierte el código a mayúsculas (los códigos son
      // siempre en mayúsculas en el sistema).
      // El tipo genérico <{ data: { accessToken: string; refreshToken: string } }>
      // le dice a TypeScript qué estructura esperamos en la respuesta.
      const res = await api.post<{ data: { accessToken: string; refreshToken: string } }>(
        '/api/auth/accept-invite', { inviteCode: inviteCode.trim().toUpperCase() }
      );
      // Guardamos el nuevo accessToken en el cliente API para que las
      // próximas peticiones lo usen automáticamente.
      api.setAccessToken(res.data.accessToken);
      // El refreshToken se guarda en localStorage del navegador para
      // poder renovar el accessToken cuando expire (en 15 minutos).
      localStorage.setItem('refreshToken', res.data.refreshToken);
      // Notificamos al padre que el proceso fue exitoso.
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Código inválido o expirado.');
    } finally { setLoading(false); }
    // finally siempre se ejecuta, tanto si hubo éxito como si hubo error.
    // Aquí apagamos el indicador de carga.
  }

  // handleGoIndie: inicia el proceso para convertirse en independiente.
  // El backend crea una intención de pago en Stripe y devuelve el clientSecret.
  async function handleGoIndie() {
    setLoading(true); setError(null);
    try {
      const res = await api.post<{ data: { clientSecret: string } }>('/api/auth/go-independent', {});
      // Guardamos el clientSecret en el estado local para mostrarlo en el
      // formulario de Stripe (<Elements> + <PaymentElement>).
      setIndieClientSecret(res.data.clientSecret);
    } catch (e: any) {
      setError(e?.message || 'Error al iniciar el proceso.');
    } finally { setLoading(false); }
  }

  // handleCreateBusiness: registra un nuevo negocio con los datos del formulario.
  // Al completarse, el empleado se convierte en dueño de ese nuevo negocio.
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

  // businessTypes: arreglo de objetos con las opciones del selector de tipo
  // de negocio. Cada objeto tiene un value (lo que se envía al servidor) y
  // un label (lo que ve el usuario).
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
                        <p className="text-2xl font-black" style={{ color: '#7c3aed' }}>$300 <span className="text-base font-medium text-gray-500">MXN/mes</span></p>
                        <p className="text-xs text-gray-500 mt-0.5">Plan único — tu perfil de profesional independiente</p>
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
                <p className="text-xs text-gray-400 mt-0.5">Perfil de profesionista · $300 MXN/mes · apareces en el marketplace.</p>
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
// export default → exporta este componente como el PRINCIPAL del archivo.
// En Next.js App Router, el layout.tsx DEBE exportar un componente por defecto.
//
// PROP children: React.ReactNode → representa todo el contenido que va
// DENTRO del layout. En la práctica son las páginas hijas (page.tsx de
// /employee/appointments, /employee/profile, etc.).
// Renderiza la acción registrada por la página actual en el header del empleado.
// Debe estar DENTRO del TopbarActionProvider para leer el contexto.
function EmployeeTopbarSlot() {
  const action = useTopbarAction();
  return action ? <>{action}</> : null;
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  // Obtenemos los datos de autenticación del contexto global.
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // router nos permite navegar programáticamente (sin <Link>).
  const router = useRouter();
  // pathname + mainRef: al cambiar de sección, llevamos el contenido al tope.
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // isSidebarOpen: controla si la barra lateral está abierta en móvil.
  // En escritorio siempre es visible; en móvil empieza cerrada (false).
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Registra el service worker y suscribe al push si ya hay permiso.
  // No devuelve nada visible, pero hace trabajo en segundo plano al montarse.
  useEnsurePushSubscription();

  // Obtiene el perfil del empleado para verificar si está completo.
  // queryKey: clave única para esta consulta en la caché de React Query.
  //   Si employeeId cambia, React Query vuelve a hacer la petición.
  // queryFn: función que hace la petición real al servidor.
  // enabled: la consulta solo se ejecuta si hay employeeId y está autenticado.
  const { data: empData } = useQuery({
    queryKey: ['employee-profile-check', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: any }>(`/api/employees/me`);
      return res.data;
    },
    enabled: !!user?.employeeId && isAuthenticated,
    // !! convierte el valor a booleano: !!undefined = false, !!'abc' = true
  });

  // useEffect: se ejecuta cada vez que cambian isAuthenticated, isLoading o router.
  // Si la carga ya terminó (isLoading=false) y no hay sesión (isAuthenticated=false),
  // redirigimos a la página raíz (login).
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // router.replace() navega sin agregar entrada al historial del navegador.
      // El usuario no podrá volver atrás con el botón "Atrás" del navegador.
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);
  // El arreglo [isAuthenticated, isLoading, router] son las "dependencias":
  // el efecto se vuelve a ejecutar cada vez que alguna de estas cambia.

  // PANTALLA DE CARGA: mientras se verifica la sesión, mostramos un spinner.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          {/* animate-spin → clase de Tailwind que aplica animación de giro */}
          <svg className="animate-spin h-8 w-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado (y ya terminó de cargar), no renderizamos nada.
  // El useEffect de arriba ya habrá iniciado la redirección al login.
  if (!isAuthenticated) return null;

  // PANTALLA DE DESVINCULACIÓN: si el empleado está marcado como inactivo
  // (isEmployeeActive=false), mostramos la pantalla de opciones sin sidebar.
  // user?.employeeId → el operador ?. (optional chaining) evita errores si
  // user es null o undefined.
  if (user?.employeeId && user.isEmployeeActive === false) {
    return (
      <DeactivatedScreen
        user={user}
        tenantName={user.tenantName || 'la empresa'}
        // Cuando hace logout: primero llama al backend para invalidar el token,
        // luego redirige a la raíz. async/await espera que logout() termine.
        onLogout={async () => { await logout(); router.replace('/'); }}
        // onSuccess: recargamos la página completa con href (no con router)
        // para que el nuevo token del nuevo tenant surta efecto desde cero.
        onSuccess={() => { window.location.href = '/employee'; }}
      />
    );
  }

  // Checklist de campos requeridos para "perfil completo". Cada item
  // muestra estado (hecho/pendiente) en el banner, asi el usuario sabe
  // exactamente que le falta sin tener que adivinar.
  //
  // Si empData aún no llegó (null/undefined), el arreglo está vacío.
  // !! convierte el valor a booleano: !!null = false, !!'url.jpg' = true
  const profileChecklist = empData
    ? [
        { key: 'avatar', label: 'Foto de perfil', done: !!empData.avatarUrl },
        { key: 'bio', label: 'Presentacion', done: !!empData.bio },
      ]
    : [];

  // doneCount: cuántos ítems del checklist están completados.
  // .filter() crea un nuevo arreglo solo con los elementos que cumplen
  // la condición (en este caso: done === true). .length da el total.
  const doneCount = profileChecklist.filter((i) => i.done).length;

  // totalCount: total de ítems en el checklist.
  const totalCount = profileChecklist.length;

  // progressPercent: porcentaje de completitud (0-100).
  // Math.round() redondea al entero más cercano.
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // profileIncomplete: true si el perfil existe pero le faltan campos.
  // Se usa para mostrar/ocultar el banner de "Completa tu perfil".
  const profileIncomplete = empData && doneCount < totalCount;

  return (
    <SectionHelpProvider>
    <TopbarActionProvider>
    {/* Contenedor principal: ocupa toda la pantalla, los hijos se colocan en fila. */}
    <div className="flex h-screen bg-gray-50">
      {/* ForceLightTheme: evita que el sistema operativo aplique modo oscuro */}
      <ForceLightTheme />

      {/* Barra lateral de navegación del empleado.
          isOpen → prop que le dice si debe estar abierta (en móvil).
          onClose → callback que se llama cuando el usuario cierra la barra.
          () => setIsSidebarOpen(false) es una función flecha que actualiza el estado. */}
      <EmployeeSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Columna derecha: ocupa el espacio restante después del sidebar.
          lg:ml-64 → en pantallas grandes (lg = 1024px+) deja un margen izquierdo
          de 64 unidades (256px) para que el contenido no quede debajo del sidebar. */}
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">

        {/* ─── Barra superior en MÓVIL (oculta en desktop con lg:hidden) ─── */}
        {/* sticky top-0 → se queda pegado arriba al hacer scroll.
            z-40 → nivel de apilamiento: queda encima del contenido. */}
        <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 flex items-center px-3 py-2.5">
          {/* Botón hamburger (≡): abre la barra lateral en móvil */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="Abrir menu"
            // aria-label: etiqueta accesible para lectores de pantalla
          >
            {/* Ícono de tres líneas horizontales ("hamburger") */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* Ayuda contextual: ⓘ junto al botón de menú (sin el logo "Siliba"). */}
          <div className="ml-1"><SectionHelp /></div>
          {/* ml-auto → empuja las acciones al extremo derecho del header. */}
          <div className="ml-auto flex items-center gap-2">
            <EmployeeTopbarSlot />
            {/* basePath="/employee" le dice a la campana dónde están las
                páginas del portal del empleado (para construir deep-links). */}
            <NotificationBell basePath="/employee" />
          </div>
        </header>

        {/* ─── Barra superior en DESKTOP (oculta en móvil con hidden lg:flex) ─── */}
        {/* Solo contiene la campana de notificaciones, alineada a la derecha. */}
        <header className="hidden lg:flex sticky top-0 z-40 bg-white border-b border-gray-200 items-center gap-2 px-4 py-2">
          {/* Ayuda contextual: ⓘ a la izquierda. */}
          <SectionHelp />
          <div className="ml-auto flex items-center gap-2">
            <EmployeeTopbarSlot />
            <NotificationBell basePath="/employee" />
          </div>
        </header>

        {/* ─── Banner de suscripción (solo freelancer dueño de la cuenta) ─────
            Avisa los días de prueba restantes o el pago pendiente, igual que en
            el panel del negocio. El banner se auto-oculta si no aplica. */}
        {user?.tenantType === 'FREELANCER' && (
          <SubscriptionBanner status={user?.subscriptionStatus || 'ACTIVE'} trialEndsAt={user?.trialEndsAt} />
        )}

        {/* ─── Banner "Completa tu perfil" ─────────────────────────────── */}
        {/* Se renderiza SOLO si profileIncomplete es true (operador &&).
            En JSX, "condición && <Componente>" muestra el componente solo
            si la condición es verdadera. */}
        {profileIncomplete && (
          <div className="bg-teal-50 border-b border-teal-200 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Ícono de información */}
                <svg className="w-5 h-5 flex-shrink-0 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-teal-800">
                      Completa tu perfil profesional
                    </span>
                    {/* Mostramos cuántos ítems están listos y el porcentaje */}
                    <span className="text-xs text-teal-700">
                      {doneCount} de {totalCount} listos · {progressPercent}%
                    </span>
                  </div>
                  {/* Barra de progreso visual.
                      style={{ width: `${progressPercent}%` }} → la anchura
                      de la barra rellena cambia dinámicamente con el porcentaje.
                      `${...}` es template literal de JavaScript para insertar
                      variables dentro de strings. */}
                  <div className="mt-1 h-1.5 bg-teal-100 rounded-full overflow-hidden max-w-xs">
                    <div
                      className="h-full bg-[#008080] transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {/* Lista checklist visual: itera sobre profileChecklist con .map().
                      .map() transforma cada elemento del arreglo en un nodo JSX.
                      key={item.key} → React requiere una clave única en listas
                      para identificar qué elemento cambió y optimizar el render. */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    {profileChecklist.map((item) => (
                      <span
                        key={item.key}
                        // Clases condicionales con ternario: si item.done es true
                        // usa text-teal-700, si es false usa text-gray-500.
                        className={`text-xs inline-flex items-center gap-1 ${
                          item.done ? 'text-teal-700' : 'text-gray-500'
                        }`}
                      >
                        {/* Renderizado condicional dentro del .map():
                            si está hecho → ícono de check verde
                            si no → círculo vacío */}
                        {item.done ? (
                          <svg className="w-3.5 h-3.5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="w-3 h-3 rounded-full border-[1.5px] border-gray-400 inline-block" />
                        )}
                        {/* line-through → tachado para los ítems completados */}
                        <span className={item.done ? 'line-through opacity-70' : ''}>{item.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {/* Botón "Completar" → lleva a la página de configuración del perfil */}
              <Link
                href="/employee/settings?section=profile"
                className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Completar
              </Link>
            </div>
          </div>
        )}

        {/* Área de contenido principal: aquí se renderizan las páginas hijas.
            flex-1 → ocupa todo el espacio vertical disponible.
            overflow-y-auto → permite scroll vertical si el contenido es largo.
            {children} → lo que Next.js inyecta aquí es la página actual
            (por ejemplo, /employee/appointments renderiza su page.tsx aquí). */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
    </TopbarActionProvider>
    </SectionHelpProvider>
  );
}
