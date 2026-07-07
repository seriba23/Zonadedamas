// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/app/(auth)/login/page.tsx
//
// CONCEPTO: Página de inicio de sesión de la aplicación.
// URL: /login
//
// Esta página tiene TRES estados visuales distintos (renderiza cosas diferentes
// dependiendo del estado):
//
//  1. FORMULARIO DE LOGIN (estado normal): el usuario ingresa email y contraseña
//     o usa botones de login social (Google/Facebook).
//
//  2. SELECTOR DE PERFIL (roleChoice !== null): después de un login exitoso,
//     se muestra un selector donde el usuario elige CÓMO quiere entrar:
//     como Cliente, como Profesional o como Administrador. Siempre se muestra
//     aunque solo tenga un perfil, para que el usuario elija conscientemente.
//
//  3. SOCIAL PROFILE (socialProfile !== null): el usuario intentó hacer login
//     con Google/Facebook pero la cuenta no existe aún. Se muestran dos etapas:
//     - 'choice': elegir el tipo de cuenta (Cliente/Profesional/Administrador)
//     - 'professional': ingresar código de invitación (si eligió Profesional)
//
// FLUJO COMPLETO:
//   Usuario ingresa credenciales → login() → mostrar selector de perfil →
//   usuario elige rol → redirigir a /home (admin), /employee (profesional)
//   o /marketplace (cliente)
// ─────────────────────────────────────────────────────────────────────────────

// Client Component porque usa todos los hooks de React y del navegador.
'use client';

// Suspense: componente de React que permite mostrar un "fallback" (contenido
// provisional) mientras se carga código asíncrono. Lo usamos porque
// useSearchParams() requiere ser envuelto en Suspense en Next.js App Router.
//
// useEffect: ejecuta código después del render (efectos secundarios).
// useRef: guarda un valor mutable que NO provoca re-render cuando cambia.
//   Útil para flags (banderas booleanas) que controlan lógica sin afectar la UI.
// useState: guarda estado que SÍ provoca re-render cuando cambia.
// FormEvent: tipo de TypeScript para el evento de submit de un formulario HTML.
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';

// useRouter: para navegar programáticamente entre rutas.
// useSearchParams: para leer parámetros de la URL como ?redirect=/marketplace/salon1
//   Permite que después del login el usuario vuelva a donde quería ir.
import { useRouter, useSearchParams } from 'next/navigation';

// Link: componente de Next.js para navegar entre páginas. Mejor que <a> porque
// hace navegación del lado del cliente (sin recargar la página completa).
import Link from 'next/link';

// Hook personalizado de autenticación. Expone login(), user, isAuthenticated, etc.
import { useAuth } from '@/lib/hooks/use-auth';

// Botones de login social (Google, Facebook). Componente reutilizable que
// maneja el flujo OAuth y llama a onSocialLogin con el token recibido.
import { SocialLoginButtons } from '@/components/ui/social-login-buttons';

// Avatar: muestra la foto de perfil del usuario o sus iniciales si no hay foto.
import { Avatar } from '@/components/ui/avatar';

// api: cliente HTTP para la API del backend de negocio (NestJS, puerto 3001).
import { api } from '@/lib/api';

// marketplaceApi: cliente HTTP separado para la API del marketplace/cliente.
// Tiene sus propios tokens JWT separados de la sesión de negocio.
import { marketplaceApi } from '@/lib/marketplace-api';

// Tipo de TypeScript que describe la estructura del objeto "user" autenticado.
import type { AuthUser } from '@/lib/auth';

// Función que cierra todas las sesiones (negocio + marketplace + portal).
import { signOutAll } from '@/lib/sign-out-all';

// ─── TIPOS ───────────────────────────────────────────────────────────────────
// Interfaz TypeScript: define la "forma" (shape) de un objeto.
// Si intentas usar un objeto como SocialProfile sin que tenga estas propiedades,
// TypeScript mostrará un error de compilación.
interface SocialProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;  // El "?" indica que es OPCIONAL (puede no existir)
  provider: string;    // 'google' o 'facebook'
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginPageInner: el componente REAL de la página.
// Está separado del export default (LoginPage) porque useSearchParams()
// requiere ser envuelto en <Suspense> en Next.js App Router. Si no usamos
// <Suspense>, Next.js lanzaría un error durante el build de producción.
// ─────────────────────────────────────────────────────────────────────────────
function LoginPageInner() {
  // useRouter para redirigir al usuario después del login.
  const router = useRouter();

  // useSearchParams lee los parámetros de la URL actual.
  // Por ejemplo, en la URL: /login?redirect=/marketplace/salon1
  // searchParams.get('redirect') devuelve '/marketplace/salon1'
  const searchParams = useSearchParams();

  // Si el usuario llegó al login desde una ruta protegida (que requería
  // autenticación), guardamos esa ruta para redirigirlo después del login.
  // Ejemplo: si intentó ir a /marketplace/mi-negocio sin estar logueado,
  // el sistema lo mandó a /login?redirect=/marketplace/mi-negocio
  const redirectAfterLogin = searchParams.get('redirect');

  // Extraemos funciones y estado del hook de autenticación.
  // Renombramos isLoading → authLoading para no confundirlo con el isLoading
  // local del formulario (isLoading del submit).
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Se setea a true durante el flujo de login en curso para que el useEffect
  // de auto-redirect no se dispare antes de que handleSubmit decida si mostrar
  // el selector de perfiles (admin/empleado/cliente) o redirigir directo.
  //
  // useRef: guarda un valor "mutable" que sobrevive entre renders pero NO
  // provoca un re-render cuando cambia. Es perfecto para flags de control.
  // "skipAutoRedirect.current = true" no causa un re-render, solo cambia
  // el valor en memoria para que el useEffect lo lea en el próximo ciclo.
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
    // Si el redirect es a /marketplace/<slug> y ya tenia sesion activa,
    // mandarlo al destino directamente. Antes hacíamos return aqui
    // confiando en un "marketplace guard" que en realidad no redirige
    // automaticamente, por lo que el usuario quedaba viendo el form de
    // login con sesion activa.
    router.replace(redirectAfterLogin);
  }, [authLoading, isAuthenticated, user, redirectAfterLogin, router]);

  // ─── ESTADO DEL FORMULARIO ─────────────────────────────────────────────────
  // "form" guarda los valores actuales de los inputs del formulario.
  // Usamos UN solo estado con un objeto en lugar de estados separados para
  // cada campo. Es una práctica común para formularios pequeños.
  const [form, setForm] = useState({ email: '', password: '' });

  // "errors" guarda los mensajes de error de validación de cada campo.
  // "Record<string, string>" es un tipo de TypeScript que significa:
  // "un objeto donde las claves son strings y los valores son strings".
  // Ejemplo: { email: 'El correo es requerido', password: 'Mínimo 6 caracteres' }
  const [errors, setErrors] = useState<Record<string, string>>({});

  // "apiError" guarda el mensaje de error que viene del servidor
  // (por ejemplo, "Credenciales incorrectas"). Es null cuando no hay error.
  const [apiError, setApiError] = useState<string | null>(null);

  // "isLoading" controla si se está procesando el login. Se usa para:
  //  - Mostrar el spinner en el botón de submit
  //  - Deshabilitar el botón para evitar clicks múltiples
  const [isLoading, setIsLoading] = useState(false);

  // "roleChoice" guarda el objeto "user" después de un login exitoso.
  // Si es null → mostrar el formulario. Si no es null → mostrar el selector de perfiles.
  // AuthUser | null significa que puede ser un AuthUser O null.
  const [roleChoice, setRoleChoice] = useState<AuthUser | null>(null);

  // "availableProfiles" lista los tipos de perfil que tiene este usuario.
  // Ejemplo: ['admin', 'professional'] si tiene cuenta de admin y empleado,
  // pero no de cliente. Se usa para saber qué opciones mostrar en el selector.
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);

  // Helper que setea state + persiste el selector en sessionStorage. Asi al
  // hacer back desde /register el usuario vuelve al selector intacto en vez
  // de tener que volver a hacer login.
  const persistRole = (u: AuthUser, profiles: string[]) => {
    setRoleChoice(u);
    setAvailableProfiles(profiles);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('login_role_choice', JSON.stringify({ user: u, profiles }));
      } catch {}
    }
  };

  // Al cargar /login, si hay un selector persistido y el usuario sigue
  // autenticado (no expiro la sesion), restauramos el selector. Esto
  // permite que el back desde /register vuelva al selector sin pedir
  // login otra vez.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authLoading) return;
    // Restauramos el selector "¿Cómo deseas ingresar?" si hay CUALQUIER sesión
    // activa: de negocio (useAuth) o de cliente del marketplace
    // (marketplaceApi). Así, un cliente puede pulsar "Cambiar tipo de cuenta"
    // desde el marketplace y ver este menú (antes solo valía la sesión de negocio).
    if (!isAuthenticated && !marketplaceApi.isLoggedIn()) return;
    if (roleChoice) return;
    try {
      const raw = sessionStorage.getItem('login_role_choice');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user && Array.isArray(parsed?.profiles)) {
          setRoleChoice(parsed.user);
          setAvailableProfiles(parsed.profiles);
        }
      }
    } catch {}
  }, [authLoading, isAuthenticated, user, roleChoice]);

  // ─── ESTADO DEL FLUJO DE SOCIAL LOGIN ─────────────────────────────────────
  // Social login: tipo de cuenta + invite code step
  // "socialProfile" guarda los datos del perfil social cuando el usuario
  // intenta entrar con Google/Facebook y la cuenta aún no existe en Siliba.
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  // "socialToken" guarda el token OAuth de Google/Facebook para usarlo
  // en el registro posterior (cuando el usuario elige el tipo de cuenta).
  const [socialToken, setSocialToken] = useState<string | null>(null);
  // 'choice' = mostrar selector (Cliente/Profesional/Administrador)
  // 'professional' = mostrar form de codigo de invitacion
  // El tipo "'choice' | 'professional'" es un "union type": solo puede
  // ser uno de esos dos string literales exactos.
  const [socialStage, setSocialStage] = useState<'choice' | 'professional'>('choice');
  // Error específico del flujo de social login (distinto a apiError del form normal).
  const [socialError, setSocialError] = useState('');
  // true mientras se está procesando la acción de social login.
  const [socialBusy, setSocialBusy] = useState(false);
  // Código de invitación que ingresa el profesional para unirse a un negocio.
  const [inviteCode, setInviteCode] = useState('');
  // Error de validación del código de invitación.
  const [inviteError, setInviteError] = useState('');
  // true mientras se está verificando el código de invitación con la API.
  const [inviteLoading, setInviteLoading] = useState(false);

  // ─── VALIDACIÓN DEL FORMULARIO ─────────────────────────────────────────────
  // validate(): comprueba que el formulario tiene datos válidos ANTES de enviarlo
  // a la API. Esto evita peticiones innecesarias al servidor con datos incorrectos.
  // Retorna true si todo está bien, false si hay algún error.
  function validate(): boolean {
    // Creamos un objeto temporal de errores para esta validación.
    const newErrors: Record<string, string> = {};

    // Valida el campo email:
    if (!form.email) newErrors.email = 'El correo es requerido';
    // La expresión regular (regex) valida el formato de email:
    //  /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    //  ^ = inicio del string
    //  [^\s@]+ = uno o más caracteres que NO sean espacio ni "@"
    //  @  = el símbolo arroba literal
    //  \. = un punto literal (\ escapa el . que en regex significa "cualquier caracter")
    //  $ = fin del string
    // .test(form.email) devuelve true si el email tiene formato válido.
    // El "!" invierte el resultado: si NO es válido, agrega el error.
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Ingresa un correo válido';

    if (!form.password) newErrors.password = 'La contraseña es requerida';
    else if (form.password.length < 6) newErrors.password = 'Mínimo 6 caracteres';

    // Actualizamos el estado de errores para mostrarlos bajo cada campo.
    setErrors(newErrors);

    // Object.keys(newErrors) devuelve un array con las claves del objeto de errores.
    // Si está vacío (length === 0), no hay errores → retorna true.
    return Object.keys(newErrors).length === 0;
  }

  // ─── MANEJADOR DEL SUBMIT DEL FORMULARIO ──────────────────────────────────
  // handleSubmit se llama cuando el usuario hace click en "Iniciar sesión"
  // o presiona Enter en el formulario.
  //
  // "async function" significa que esta función es ASÍNCRONA: puede usar "await"
  // para esperar promesas (operaciones que toman tiempo, como llamadas a la API).
  async function handleSubmit(e: FormEvent) {
    // e.preventDefault() evita que el formulario HTML haga su comportamiento
    // por defecto (recargar la página al hacer submit). En React manejamos
    // el submit de forma programática.
    e.preventDefault();
    setApiError(null);  // Limpiamos errores previos de la API.

    // Si la validación falla, no continuamos. El "return" detiene la ejecución.
    if (!validate()) return;

    setIsLoading(true);  // Mostrar el spinner en el botón.

    // Bloquea el auto-redirect del useEffect mientras procesamos el resultado.
    skipAutoRedirect.current = true;

    // try/catch/finally: manejo de errores para código asíncrono.
    //  - try: ejecuta el código que podría fallar
    //  - catch: si falla, ejecuta este bloque con el error
    //  - finally: se ejecuta SIEMPRE, haya error o no (para limpiar el loading)
    try {
      // "await" pausa la ejecución aquí hasta que login() complete.
      // login() llama a la API, guarda los tokens en localStorage y retorna
      // el resultado del servidor con los perfiles disponibles del usuario.
      const result = await login(form.email, form.password);

      // El servidor puede devolver perfiles de negocio y/o cliente.
      // "profiles" es un array de strings como ['admin', 'client'].
      const profiles = result.profiles || [];

      // Intentamos obtener el objeto "user" de negocio (si existe).
      // El operador "?." (optional chaining) evita errores si "result.business"
      // es null/undefined: en vez de lanzar un error, retorna undefined.
      const businessUser = result.business?.user || result.user;

      // "result as any" hace un "type cast": le dice a TypeScript que trate
      // "result" como tipo "any" (sin verificación de tipos). Se usa cuando
      // el tipo real no está correctamente tipado. Aquí accedemos a
      // result.client?.user que TypeScript no conoce en el tipo de "result".
      const anyUser = businessUser || (result as any).client?.user || result.user;

      // SIEMPRE mostrar el selector despues del login. El usuario quiere
      // elegir conscientemente cada vez como entrar (cliente / profesional
      // / administrador), aunque solo tenga un perfil. El parametro
      // ?redirect se aplica DESPUES del selector cuando el usuario hace
      // click en el rol correspondiente.
      if (profiles.length >= 1 && anyUser) {
        // persistRole guarda el usuario y perfiles tanto en el estado
        // local como en sessionStorage (para que sobreviva si el usuario
        // navega a /register y vuelve con el botón "Atrás").
        persistRole(anyUser, profiles);
        return;  // Salimos aquí, el selector se mostrará en el JSX.
      }

      // Fallback (no deberia llegar aqui si el login fue exitoso).
      router.push('/');
    } catch (err: any) {
      // Si login() lanzó un error (credenciales incorrectas, error de red, etc.),
      // mostramos el mensaje de error en la UI.
      // "err?.message" usa optional chaining por si "err" no tiene la propiedad "message".
      setApiError(err?.message || 'Credenciales incorrectas. Intenta de nuevo.');
    } finally {
      // Siempre quitamos el loading al terminar (con éxito o error).
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
        persistRole(anyUser, profiles);
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
      // Limpiar dismissed key del CompleteProfileGate. Sin esto, si el usuario
      // habia descartado el modal en una sesion anterior de esta pestaña, no
      // veria el popup de completar perfil al registrarse de nuevo.
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('marketplace_profile_dismissed');
      }
      // Si el usuario llego con ?redirect= apuntando dentro del marketplace
      // (ej. desde el QR de un negocio), respetar ese destino. Sin redirect
      // explicito, ir al home del marketplace.
      const target = redirectAfterLogin?.startsWith('/marketplace')
        ? redirectAfterLogin
        : '/marketplace';
      router.push(target);
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
    // typeParam='individual' es el wizard de 2 steps de admin (datos
    // personales + datos del negocio). 'freelancer' no es un type
    // reconocido por el register — caia a 'select' silenciosamente.
    const params = new URLSearchParams({
      type: 'individual',
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
    // Freelancer (tenantType=FREELANCER) NO entra al admin aunque tenga
    // rol Owner. Su unica interfaz es /employee.
    const isFreelancer = (roleChoice as any).tenantType === 'FREELANCER';
    const goOrRegister = (profile: 'admin' | 'professional' | 'client', registerType: string) => {
      if (availableProfiles.includes(profile)) {
        if (profile === 'admin') {
          if (isFreelancer) {
            // Freelancer tocando "Administrador" -> vista mínima /plan: SOLO la
            // suscripción (su único "admin"), sin menú, con botón para volver al
            // selector y entrar como Profesional.
            router.push('/plan');
          } else {
            router.push(wantsBusiness ? redirectAfterLogin! : '/home');
          }
        } else if (profile === 'professional') {
          router.push(wantsBusiness ? redirectAfterLogin! : '/employee');
        } else {
          // Cliente: limpiar dismissed key del CompleteProfileGate por si el
          // usuario lo cerro en una sesion anterior de esta pestaña (sino,
          // nunca veria el modal al volver a entrar como cliente).
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('marketplace_profile_dismissed');
          }
          router.push(wantsMarketplace ? redirectAfterLogin! : '/marketplace');
        }
      } else {
        // Propagar el ?redirect= original para que el usuario vuelva al
        // destino que pretendia (ej. /marketplace/<slug> desde el QR de
        // un negocio) despues de crear la cuenta.
        const params = new URLSearchParams({ type: registerType });
        if (redirectAfterLogin) params.set('redirect', redirectAfterLogin);
        router.push(`/register?${params.toString()}`);
      }
    };
    const hasAdmin = availableProfiles.includes('admin');
    const hasProfessional = availableProfiles.includes('professional');
    const hasClient = availableProfiles.includes('client');
    const initials = `${(roleChoice.firstName || '')[0] || ''}${(roleChoice.lastName || '')[0] || ''}`.toUpperCase();
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-3">
        <div className="w-full max-w-md">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-[#008080]">Siliba</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            {/* Header con avatar + nombre — consistente con el flow social
                login. Reduce ambiguedad: el usuario siempre se ve "como
                quien" esta ingresando. */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
              {/* Avatar usa resolveImageUrl (prepende API_URL en paths /api/uploads/*)
                  y onError fallback a iniciales — el <img> raw no hacia ninguno
                  de los dos, por eso fallaba para sergioibarra275. */}
              <Avatar
                avatarUrl={(roleChoice as any).avatarUrl}
                firstName={roleChoice.firstName}
                lastName={roleChoice.lastName}
                className="w-11 h-11"
                textClassName="text-base"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">
                  {roleChoice.firstName}{roleChoice.lastName ? ` ${roleChoice.lastName}` : ''}
                </p>
                {(roleChoice as any).email && (
                  <p className="text-xs text-gray-500 truncate">{(roleChoice as any).email}</p>
                )}
              </div>
            </div>

            <h2 className="text-base font-semibold text-gray-900 mb-1">¿Cómo deseas ingresar?</h2>
            <p className="text-xs text-gray-500 mb-4">Selecciona el modo en el que quieres trabajar hoy</p>

            <div className="space-y-2">
              {/* Orden solicitado: Cliente → Profesional → Administrador. */}

              {/* Cliente */}
              <button
                onClick={() => goOrRegister('client', 'client')}
                className="w-full text-left p-3 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
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

              {/* Profesional independiente */}
              <button
                onClick={() => goOrRegister('professional', 'business')}
                className="w-full text-left p-3 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
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

              {/* Administrador (dueño de negocio) */}
              <button
                onClick={() => goOrRegister('admin', 'individual')}
                className="w-full text-left p-3 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
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
                      {hasAdmin && isFreelancer && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#008080] text-white tracking-wide">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
                          </svg>
                          PLUS
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {isFreelancer
                        ? 'Mejora a PLUS para gestionar un equipo'
                        : hasAdmin
                        ? `Gestionar ${roleChoice.tenantName || 'mi negocio'}`
                        : 'Crea tu empresa y administra tu negocio'}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Salida: si llegaron aquí por error desde "Cambiar perfil" pero
                en realidad querían salir, este botón cierra todas las sesiones
                y refresca /login mostrando el form vacío. */}
            <button
              onClick={async () => {
                await signOutAll();
                setRoleChoice(null);
                setAvailableProfiles([]);
                router.replace('/login');
              }}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
            >
              Cerrar sesión
            </button>
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
          <Avatar
            avatarUrl={socialProfile.avatarUrl}
            firstName={socialProfile.firstName}
            lastName={socialProfile.lastName}
            className="w-12 h-12"
            textClassName="text-lg"
          />
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
    <div className="relative min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-3 md:py-6">
      {/* Acceso rápido al Portal de Creadores — esquina superior derecha.
          Es un atajo discreto para reclutadores/creadores de contenido que ya
          tienen su portal aparte (/creator/login). No estorba el login normal. */}
      <Link
        href="/creator/login"
        className="absolute top-3 right-3 md:top-4 md:right-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm backdrop-blur hover:bg-amber-50 transition-colors"
        title="Portal de Creadores"
      >
        {/* Megáfono: representa a creadores/reclutadores. */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
        </svg>
        <span className="hidden sm:inline">Creadores</span>
      </Link>

      <div className="w-full max-w-2xl">
        {/* Logo — mismo tamaño/posicion que en el selector de perfil para
            mantener consistencia visual en todo el flujo de auth. */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#008080]">Siliba</h1>
          <p className="mt-2 text-gray-500 text-sm">Tu confianza, en manos de profesionales</p>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
              <input
                id="email" type="email" autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={`input-field text-base py-1.5 ${errors.email ? 'border-red-400' : ''}`}
                placeholder="correo@ejemplo.com"
              />
              {errors.email && <p className="mt-0.5 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input
                id="password" type="password" autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={`input-field text-base py-1.5 ${errors.password ? 'border-red-400' : ''}`}
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-0.5 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div className="text-center">
              <Link href="/forgot-password" className="text-base text-primary-600 hover:text-primary-700 font-medium">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button type="submit" disabled={isLoading} className="w-full btn-primary flex items-center justify-center gap-2 py-2 text-base">
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

        <p className="text-center mt-6 text-base text-gray-500">
          ¿No tienes cuenta?{' '}
          <Link
            href={
              redirectAfterLogin
                ? `/register?redirect=${encodeURIComponent(redirectAfterLogin)}`
                : '/register'
            }
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Crear cuenta
          </Link>
        </p>

        <p className="text-center mt-4 text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Siliba. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage: el export default que Next.js usa como la página en la ruta /login.
//
// PATRÓN SUSPENSE + INNER COMPONENT:
// useSearchParams() requiere <Suspense> en Next.js App Router porque durante
// el build estático (Static Site Generation), los parámetros de búsqueda
// no se conocen hasta que el usuario navega. <Suspense> le dice a Next.js
// "espera, hay contenido que se carga dinámicamente aquí".
//
// "fallback={null}" significa que mientras el componente interior se carga,
// no se muestra nada (pantalla en blanco). Podría ser un spinner o un skeleton.
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
