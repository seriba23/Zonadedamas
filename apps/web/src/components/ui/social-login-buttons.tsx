// Componente de cliente: carga scripts externos (SDKs de Google y Facebook)
// y usa hooks de React para manejar el estado de carga y errores.
'use client';

// Importamos tres hooks de React:
// - useState: variable de estado reactiva.
// - useEffect: código que se ejecuta después del render (aquí, para cargar SDKs).
// - useCallback: memoriza una función para que no se recree en cada render.
//   Útil cuando la función se pasa como dependencia a otro hook o componente.
import { useState, useEffect, useCallback } from 'react';

// Leemos las credenciales de los proveedores sociales desde variables de entorno.
// NEXT_PUBLIC_* son las únicas variables de entorno de Next.js accesibles en el
// navegador (las demás solo están disponibles en el servidor).
// Si las variables no están configuradas, los strings quedan vacíos ('').
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '';

// ─── Props del componente ────────────────────────────────────────────────────
interface SocialLoginButtonsProps {
  // Función del padre que se llama cuando el login social es exitoso.
  // provider: 'google' | 'facebook' — indica con qué proveedor se inició sesión.
  // token: el access token o ID token obtenido del proveedor (se envía al backend).
  // Promise<void>: la función es asíncrona (puede tardar en completarse).
  onSocialLogin: (provider: 'google' | 'facebook', token: string) => Promise<void>;

  // Si true, deshabilita ambos botones (ej. mientras el formulario está enviando).
  disabled?: boolean;
}

// ─── Función auxiliar: detecta si la app corre en móvil nativo ───────────────
// Detect Capacitor native platform safely (SSR-safe)
// Capacitor es el framework que convierte la app web en app nativa de Android/iOS.
// En web, el módulo no existe, así que el require lanzaría un error.
// Por eso usamos try/catch: si falla, devolvemos false (no es nativo).
// En Next.js con SSR, require puede no funcionar en el servidor, de ahí el try.
function isNativePlatform(): boolean {
  try {
    // require() es la forma de importar módulos en CommonJS (Node.js/Capacitor).
    // Aquí lo usamos dinámicamente (en tiempo de ejecución, no en tiempo de compilación)
    // para evitar errores de build cuando el módulo no está instalado.
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    // Si el módulo no existe o lanza error → no es plataforma nativa.
    return false;
  }
}

// ─── Componente principal exportado ─────────────────────────────────────────
export function SocialLoginButtons({ onSocialLogin, disabled }: SocialLoginButtonsProps) {
  // Estado del botón que está cargando. null = ninguno cargando.
  // 'google' = el botón de Google muestra spinner.
  // 'facebook' = el botón de Facebook muestra spinner.
  const [loading, setLoading] = useState<'google' | 'facebook' | null>(null);

  // Estado de los SDKs: sabemos si Google/Facebook ya terminaron de cargarse.
  // Empieza en false para ambos (no cargados aún).
  const [sdkReady, setSdkReady] = useState({ google: false, facebook: false });

  // Mensaje de error para mostrar debajo de los botones.
  const [error, setError] = useState('');

  // Si la app corre en modo nativo (Android/iOS con Capacitor).
  // Empieza en false y se actualiza después del primer render.
  const [isNative, setIsNative] = useState(false);

  // Detectamos si es nativo después del primer render (no durante SSR).
  // Array de dependencias vacío [] → se ejecuta una sola vez al montar.
  useEffect(() => {
    setIsNative(isNativePlatform());
  }, []);

  // ── Carga del SDK de Google Identity Services (solo en web) ──────────────
  // Google ofrece un SDK (biblioteca JavaScript) en su servidor para manejar
  // el flujo de autenticación. Lo cargamos dinámicamente creando una etiqueta
  // <script> e insertándola en el <head> del documento.
  //
  // Load Google Identity Services SDK (web only)
  useEffect(() => {
    // No cargamos el SDK si:
    // - Estamos en app nativa (usamos el plugin de Capacitor en ese caso).
    // - No hay CLIENT_ID configurado (sin credenciales no funciona).
    // - El script ya fue insertado (document.getElementById lo detecta).
    if (isNative || !GOOGLE_CLIENT_ID || document.getElementById('google-gsi-script')) return;

    // Creamos el elemento <script> programáticamente.
    const script = document.createElement('script');

    // id: identificador para detectar si ya fue insertado (ver condición arriba).
    script.id = 'google-gsi-script';

    // src: URL del SDK de Google. Al cargar este script, Google añade
    // window.google.accounts con las APIs de autenticación.
    script.src = 'https://accounts.google.com/gsi/client';

    // async: el script se descarga en paralelo sin bloquear el renderizado de la página.
    script.async = true;

    // defer: el script se ejecuta después de que el HTML esté completamente analizado.
    script.defer = true;

    // onload: función que se ejecuta cuando el script termina de cargarse.
    // { ...prev, google: true } es "spread": copia todas las propiedades de prev
    // y sobreescribe solo "google" con true.
    script.onload = () => setSdkReady((prev) => ({ ...prev, google: true }));

    // Insertamos el script en el <head> del documento.
    document.head.appendChild(script);
  }, [isNative]); // Se re-ejecuta si isNative cambia (al detectar la plataforma).

  // ── Carga del SDK de Facebook (solo en web) ───────────────────────────────
  // El SDK de Facebook funciona de forma diferente: define window.fbAsyncInit
  // como una función que Facebook llama automáticamente cuando su script carga.
  // Dentro de esa función inicializamos el SDK con nuestro App ID.
  //
  // Load Facebook SDK (web only)
  useEffect(() => {
    // No cargamos si: es nativo, no hay APP_ID, o el script ya fue insertado.
    if (isNative || !FACEBOOK_APP_ID || document.getElementById('facebook-jssdk')) return;

    // (window as any): cast de TypeScript para añadir propiedades no estándar a window.
    // window.fbAsyncInit es la función de callback que Facebook llama al cargar.
    (window as any).fbAsyncInit = function () {
      // FB.init configura el SDK de Facebook con nuestras credenciales.
      (window as any).FB.init({
        appId: FACEBOOK_APP_ID,  // ID de nuestra app en Meta/Facebook Developers.
        cookie: true,             // Permite a Facebook guardar cookies de sesión.
        xfbml: false,             // No analizamos tags especiales de Facebook en el HTML.
        version: 'v19.0',         // Versión de la API de Facebook Graph a usar.
      });
      // Marcamos el SDK de Facebook como listo.
      setSdkReady((prev) => ({ ...prev, facebook: true }));
    };

    // Creamos e insertamos el script del SDK de Facebook.
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    // sdk.js en español latinoamericano (es_LA).
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [isNative]);

  // ── Google Sign-In (native Android via plugin) ───────────────────────────
  // useCallback memoriza la función. Solo la recrea si cambian las dependencias
  // [loading, disabled, onSocialLogin]. Esto evita re-renders innecesarios.
  const handleGoogleNative = useCallback(async () => {
    // Guardas: no hacer nada si ya hay una operación en curso o está deshabilitado.
    if (loading || disabled) return;
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In no está configurado');
      return;
    }
    setLoading('google'); // Activamos el spinner del botón de Google.
    setError('');         // Limpiamos errores anteriores.

    try {
      // import() dinámico: importa el módulo solo cuando se necesita.
      // Esto reduce el tamaño del bundle inicial (no se descarga hasta que el
      // usuario intenta iniciar sesión).
      // Solo funciona en Capacitor (app nativa), de ahí que esté en "handleGoogleNative".
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');

      // Inicializamos el plugin con nuestras credenciales.
      // scopes: qué datos del perfil pedimos acceso ('profile' y 'email').
      // grantOfflineAccess: permite obtener un refresh token para acceso offline.
      await GoogleAuth.initialize({ clientId: GOOGLE_CLIENT_ID, scopes: ['profile', 'email'], grantOfflineAccess: true });

      // Abrimos el selector de cuentas de Google nativo del dispositivo.
      const result = await GoogleAuth.signIn();

      // result.authentication?.idToken: optional chaining — si authentication
      // existe, accede a idToken; si no, devuelve undefined.
      const idToken = result.authentication?.idToken;

      // Si no obtuvimos el token, lanzamos un error.
      if (!idToken) throw new Error('No se obtuvo token de Google');

      // Llamamos al backend con el token para que lo verifique y cree la sesión.
      await onSocialLogin('google', idToken);
    } catch (err: any) {
      // "err: any" tipamos el error como any porque catch no permite tipar en TypeScript.
      // Ignoramos el error de "usuario canceló" (es una acción normal, no un error).
      // err?.message: optional chaining — si err existe, accede a message; si no, undefined.
      if (err?.message !== 'The user canceled the sign-in flow.') {
        // err?.message || 'Error...': si message es undefined/falsy, usamos el texto por defecto.
        setError(err?.message || 'Error al iniciar sesión con Google');
      }
    } finally {
      // finally: se ejecuta SIEMPRE (haya o no error) después del try/catch.
      // Desactivamos el spinner, tanto si tuvo éxito como si falló.
      setLoading(null);
    }
  }, [loading, disabled, onSocialLogin]);

  // ── Google Sign-In (web browser via OAuth popup) ──
  // Usamos initTokenClient en lugar de One Tap (prompt) porque:
  // - One Tap depende de FedCM/cookies de terceros que Chrome 115+ bloquea por default
  // - El truco de renderButton+click sintetico falla con COOP same-origin
  // - El popup OAuth funciona en todos los navegadores sin requisitos especiales
  // El backend acepta tanto ID tokens como access tokens (verifyGoogleToken hace
  // fallback a /v3/userinfo con Bearer).
  const handleGoogleWeb = useCallback(() => {
    if (loading || disabled) return;
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In no está configurado todavía');
      return;
    }

    // Accedemos a window.google que el SDK inyecta al cargarse.
    // (window as any): cast para evitar error de TypeScript (google no está en
    // la definición estándar de window).
    const google = (window as any).google;

    // Verificamos que el SDK de Google (accounts.oauth2) esté disponible.
    // google?.accounts?.oauth2: encadenamiento opcional — si alguno es undefined,
    // devuelve undefined sin lanzar error.
    if (!google?.accounts?.oauth2) {
      setError('Google Sign-In aún se está cargando, intenta de nuevo en un momento');
      return;
    }

    setError('');

    // initTokenClient crea un "cliente OAuth" que abre el popup de selección
    // de cuenta de Google al llamar a .requestAccessToken().
    // Al completarse (éxito o error), llama a la función "callback".
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      // scope: qué permisos pedimos al usuario. "openid" = identidad básica.
      scope: 'openid email profile',
      // callback: función asíncrona llamada con el resultado de la autenticación.
      callback: async (response: any) => {
        // Si hubo error en el proceso OAuth, mostramos el mensaje.
        if (response.error) {
          // response.error_description es el mensaje legible del error;
          // si no existe, usamos un texto genérico.
          setError(response.error_description || 'No se pudo iniciar sesión con Google');
          return;
        }
        // Si no hay access_token en la respuesta, no hacemos nada.
        if (!response.access_token) return;

        setLoading('google'); // Mostramos spinner mientras el backend verifica.
        try {
          // Enviamos el access_token al backend para que lo valide con Google
          // y cree la sesión en nuestra plataforma.
          await onSocialLogin('google', response.access_token);
        } catch {
          // error mostrado por el padre
          // El padre maneja el error de backend; aquí no hacemos nada extra.
        } finally {
          setLoading(null); // Quitamos spinner siempre.
        }
      },
    });

    // Abrimos el popup de selección de cuenta de Google.
    tokenClient.requestAccessToken();
  }, [loading, disabled, onSocialLogin]);

  // Elegimos qué handler usar según la plataforma:
  // - En nativo (Android/iOS): usamos el plugin de Capacitor.
  // - En web (navegador): usamos el popup OAuth de Google.
  const handleGoogle = isNative ? handleGoogleNative : handleGoogleWeb;

  // ── Facebook Sign-In ──────────────────────────────────────────────────────
  const handleFacebook = useCallback(async () => {
    if (loading || disabled) return;
    if (!FACEBOOK_APP_ID) {
      setError('Facebook Login no está configurado todavía');
      return;
    }

    // Facebook SDK requiere HTTPS para funcionar en web (política de seguridad de Meta).
    // window.location.protocol devuelve "https:" o "http:".
    // En app nativa no aplica esta restricción, de ahí el !isNative.
    if (!isNative && window.location.protocol !== 'https:') {
      setError('Facebook requiere HTTPS. Disponible próximamente.');
      return;
    }

    setLoading('facebook');
    setError('');

    try {
      // Accedemos a window.FB que el SDK de Facebook inyecta al cargarse.
      const FB = (window as any).FB;
      if (!FB) throw new Error('Facebook SDK no disponible');

      // FB.login abre el popup de Facebook para que el usuario autorice nuestra app.
      // El primer argumento es el callback, el segundo son las opciones.
      FB.login(
        async (response: any) => {
          // response.authResponse existe si el usuario autorizó exitosamente.
          // Si canceló o hubo error, authResponse es null.
          if (response.authResponse) {
            try {
              // Enviamos el accessToken de Facebook al backend para verificar la identidad.
              await onSocialLogin('facebook', response.authResponse.accessToken);
            } catch {
              // error handled by parent
            }
          }
          // Desactivamos el spinner (haya o no authResponse).
          setLoading(null);
        },
        // Permisos que pedimos al usuario en Facebook:
        // email: su dirección de correo.
        // public_profile: nombre, foto, etc.
        { scope: 'email,public_profile' },
      );
    } catch {
      setLoading(null);
    }
  }, [loading, disabled, isNative, onSocialLogin]);

  // ── JSX retornado ────────────────────────────────────────────────────────
  return (
    // space-y-3: espacio vertical de 12px entre cada elemento hijo directo.
    <div className="space-y-3">
      {/* Botón de Google: siempre visible (aunque el CLIENT_ID no esté configurado,
          el botón se muestra pero mostrará un error al hacer clic). */}
      <button
        type="button"
        onClick={handleGoogle}
        // disabled: el botón no responde a clicks si disabled=true o si algo está cargando.
        // loading !== null: true si google O facebook está cargando (bloqueamos ambos).
        disabled={disabled || loading !== null}
        className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-white border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {/* Renderizado condicional: spinner si cargando, logo de Google si no */}
        {loading === 'google' ? (
          // Spinner SVG: círculo con animación de giro (animate-spin de Tailwind)
          <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          // Logo de Google en SVG: 4 paths con los colores oficiales de la G.
          // Cada path dibuja un segmento de la "G" multicolor de Google.
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Continuar con Google
      </button>

      {/* Facebook: solo se muestra cuando NEXT_PUBLIC_FACEBOOK_APP_ID está
          configurado (app de Meta creada). El backend ya verifica el token.
          Sin configurar, no aparece el botón (evita un botón roto). */}
      {/* Renderizado condicional con &&: si FACEBOOK_APP_ID es string vacío
          (falsy), no renderiza nada. Solo aparece cuando está configurado. */}
      {FACEBOOK_APP_ID && (
        <button
          type="button"
          onClick={handleFacebook}
          disabled={disabled || loading !== null}
          // Color azul oficial de Facebook (#1877F2) como fondo y borde.
          className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-[#1877F2] border border-[#1877F2] rounded-lg text-base font-medium text-white hover:bg-[#166FE5] disabled:opacity-50 transition-colors"
        >
          {/* Spinner si cargando Facebook, logo de Facebook si no */}
          {loading === 'facebook' ? (
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            // Logo oficial de Facebook en SVG (la "f" blanca sobre fondo azul).
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          )}
          Continuar con Facebook
        </button>
      )}

      {/* Mensaje de error: solo se muestra si error no es string vacío (falsy).
          El && hace la condición: si error es '' (vacío/falsy) → no renderiza. */}
      {error && (
        <p className="text-xs text-amber-600 text-center">{error}</p>
      )}

      {/* Divisor "o con tu email": línea horizontal con texto centrado encima.
          La técnica usa position:absolute para superponer el texto sobre la línea:
          - La línea ocupa todo el ancho (w-full border-t).
          - El span se centra con flex justify-center y tiene bg-white para
            "tapar" la línea debajo y dar la ilusión de que la atraviesa. */}
      <div className="relative my-3 md:my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400">o con tu email</span>
        </div>
      </div>
    </div>
  );
}
