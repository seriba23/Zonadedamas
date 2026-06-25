// ============================================================
// ARCHIVO: apps/web/src/app/platform/login/page.tsx
// RUTA EN EL NAVEGADOR: /platform/login
//
// Página de inicio de sesión exclusiva para el SUPER ADMIN
// de la plataforma Siliba. Tiene su propio formulario separado
// del login de los negocios (que vive en /login).
//
// ¿QUÉ MUESTRA?
// - Logo de Siliba
// - Formulario con email y contraseña
// - Mensaje de error si las credenciales son incorrectas
// - Spinner (animación de carga) mientras se verifica el login
//
// ¿QUÉ HACE?
// Al enviar el formulario llama a login() del contexto de
// autenticación de plataforma. Si tiene éxito, redirige al
// dashboard. Si falla, muestra el error al usuario.
// ============================================================

// 'use client': este componente usa estado (useState) y eventos
// del formulario, por eso debe correr en el navegador (cliente).
'use client';

// useState: guarda valores que cambian con el tiempo (email, password, etc.)
// FormEvent: tipo de TypeScript para el evento que se dispara al enviar un formulario HTML.
import { useState, type FormEvent } from 'react';

// useRouter: permite redirigir al usuario a otra página después del login exitoso.
import { useRouter } from 'next/navigation';

// usePlatformAuth: hook personalizado que expone la función login()
// y el estado de autenticación del Super Admin.
// Viene del contexto PlatformAuthProvider definido en layout.tsx.
import { usePlatformAuth } from '@/lib/hooks/use-platform-auth';

// Componente principal: la página de login del Super Admin.
export default function PlatformLoginPage() {
  // router: se usará para redirigir al usuario después del login.
  const router = useRouter();

  // login: función que llama a la API para autenticar al super admin.
  // Viene del contexto de autenticación de plataforma.
  const { login } = usePlatformAuth();

  // email: valor actual del campo de correo electrónico.
  const [email, setEmail] = useState('');

  // password: valor actual del campo de contraseña.
  const [password, setPassword] = useState('');

  // error: mensaje de error que se muestra si el login falla.
  // null significa "sin error".
  const [error, setError] = useState<string | null>(null);

  // isLoading: true mientras se espera la respuesta de la API.
  // Se usa para deshabilitar el botón y mostrar el spinner.
  const [isLoading, setIsLoading] = useState(false);

  // handleSubmit: función asíncrona que se ejecuta cuando el usuario
  // hace clic en "Iniciar sesión" o presiona Enter en el formulario.
  // El parámetro "e" es el evento del formulario (FormEvent).
  async function handleSubmit(e: FormEvent) {
    // e.preventDefault(): evita que el formulario recargue la página
    // (comportamiento por defecto en HTML). Queremos manejarlo con JS.
    e.preventDefault();

    // Limpiar error previo antes de intentar de nuevo.
    setError(null);

    // Activar el indicador de carga.
    setIsLoading(true);

    try {
      // Llama a la función login() con email y password.
      // login() es async: hace una petición al servidor y espera respuesta.
      // Si las credenciales son correctas, guarda el token en el contexto.
      await login(email, password);

      // Si no hubo error, redirige al dashboard (añadiendo entrada al historial).
      router.push('/platform/dashboard');
    } catch (err: unknown) {
      // Si el servidor rechazó las credenciales, err contiene el error.
      // Casteamos a un tipo con propiedad opcional "message".
      const apiErr = err as { message?: string };

      // Mostramos el mensaje del servidor, o un texto genérico si no viene.
      // El operador "||" devuelve el lado derecho si el izquierdo es falsy (null/undefined/'').
      setError(apiErr?.message || 'Credenciales inválidas');
    } finally {
      // Este bloque siempre se ejecuta (éxito o error): desactiva el spinner.
      setIsLoading(false);
    }
  }

  // ── RENDERIZADO ──────────────────────────────────────────
  // JSX: sintaxis parecida a HTML que React convierte en elementos de la página.
  return (
    // Contenedor de pantalla completa con fondo oscuro, centrado.
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      {/* Caja de formulario centrada, máximo 384px de ancho. */}
      <div className="w-full max-w-sm">

        {/* Logo y subtítulo de la plataforma. */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Siliba</h1>
          <p className="mt-1 text-gray-400 text-sm">Tu confianza, en manos de profesionales</p>
        </div>

        {/* Tarjeta con fondo gris oscuro que contiene el formulario. */}
        <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Super Admin</h2>

          {/* Renderizado condicional con &&:
              Si "error" es un string no vacío (truthy), se muestra el bloque.
              Si "error" es null (falsy), no se muestra nada. */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700">
              {/* Muestra el mensaje de error. */}
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* El formulario llama a handleSubmit cuando se envía.
              "onSubmit" es el evento de envío del formulario. */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Campo de correo electrónico */}
            <div>
              {/* htmlFor="email" vincula el <label> con el <input id="email">:
                  al hacer clic en el texto del label, el cursor va al input. */}
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"                     // El navegador valida formato de email automáticamente.
                autoComplete="email"             // El navegador sugiere emails guardados.
                value={email}                    // Valor controlado: viene del estado "email".
                onChange={(e) => setEmail(e.target.value)}
                // onChange se dispara en cada tecla. "e.target.value" es el
                // texto que el usuario escribió en ese momento.
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="super@siliba.com"
                required                         // HTML5: el formulario no se envía si está vacío.
              />
            </div>

            {/* Campo de contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"                  // Oculta los caracteres con puntos/asteriscos.
                autoComplete="current-password"  // El navegador sugiere la contraseña guardada.
                value={password}                 // Valor controlado: viene del estado "password".
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Tu contraseña"
                required
              />
            </div>

            {/* Botón de envío.
                disabled={isLoading}: se desactiva mientras se espera la respuesta.
                "disabled:opacity-50" aplica 50% de opacidad cuando está desactivado. */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {/* Renderizado condicional: muestra el spinner SVG SOLO si isLoading es true.
                  "animate-spin" es una clase de Tailwind que gira el elemento continuamente. */}
              {isLoading && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {/* Operador ternario: condición ? valor_si_true : valor_si_false.
                  Muestra texto diferente según si está cargando o no. */}
              {isLoading ? 'Iniciando...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
