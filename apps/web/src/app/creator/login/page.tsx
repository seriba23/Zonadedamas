// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/creator/login/page.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Esta es la PÁGINA DE INICIO DE SESIÓN del portal del creador/influencer.
// En Next.js 14 con App Router, cualquier archivo llamado "page.tsx" dentro
// de una carpeta se convierte automáticamente en una ruta navegable. Esta
// carpeta está en:
//   apps/web/src/app/creator/login/
// → la URL resultante es: /creator/login
//
// QUÉ MUESTRA
// -----------
// Un formulario centrado en pantalla con:
//   - Logo "Siliba" en teal (verde azulado)
//   - Campo de email
//   - Campo de contraseña (componente reutilizable PasswordField)
//   - Botón "Entrar" que llama a la API
//   - Mensaje de error si las credenciales son incorrectas
//   - Enlace para ir a registrarse
//
// FLUJO DE AUTENTICACIÓN
// ----------------------
// 1. El usuario escribe email + contraseña y envía el formulario.
// 2. Se llama a `creatorLogin(email, password)` (función externa en lib/).
// 3. Esa función guarda el accessToken en localStorage (o donde decida creator-auth.ts).
// 4. Si todo va bien → router.replace('/creator/dashboard') redirige al panel.
// 5. Si falla → se muestra el mensaje de error en pantalla.
// ─────────────────────────────────────────────────────────────────────────────

// 'use client' le dice a Next.js que este componente se ejecuta en el NAVEGADOR
// (cliente), NO en el servidor. Es obligatorio cuando usamos hooks de React
// como useState, useEffect, o cualquier cosa interactiva (eventos, formularios).
// Sin esta directiva, Next.js intentaría renderizarlo en el servidor y fallaría
// porque no existe el DOM allí.
'use client';

// useState: hook de React que crea una variable "reactiva". Cuando cambia su
// valor, React vuelve a renderizar (pintar) el componente automáticamente.
import { useState } from 'react';

// Link: componente de Next.js para navegar entre páginas SIN recargar el
// navegador completo (navegación del lado del cliente, más rápida).
import Link from 'next/link';

// useRouter: hook de Next.js que nos da acceso al objeto router para hacer
// redirecciones programáticas (cambiar de página desde código, no desde un clic).
import { useRouter } from 'next/navigation';

// creatorLogin: función que hace la petición POST al backend para autenticar
// al creador/influencer. Está definida en apps/web/src/lib/creator-auth.ts.
import { creatorLogin } from '@/lib/creator-auth';

// PasswordField: componente de UI reutilizable que muestra un input de contraseña
// con botón de mostrar/ocultar (ojo). Está en components/ui/password-field.tsx.
import { PasswordField } from '@/components/ui/password-field';

// TEAL: color de marca del portal de RECLUTAMIENTO. A diferencia del resto de
// Siliba (teal), este portal usa una identidad NEGRA/tinta para verse distinto.
// El nombre se conserva por compatibilidad; el valor es gris muy oscuro.
const TEAL = '#111827';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// Un componente de React es simplemente una FUNCIÓN que devuelve JSX (HTML con
// poderes de JavaScript). "export default" significa que es el componente
// principal de este archivo (el que Next.js usa como la página).
// ─────────────────────────────────────────────────────────────────────────────
export default function CreatorLoginPage() {
  // useRouter() nos devuelve el objeto de navegación. Con él podemos redirigir
  // al usuario a otra página usando router.push() o router.replace().
  const router = useRouter();

  // ── ESTADO DEL FORMULARIO ──────────────────────────────────────────────────
  // useState crea un par [valor, función_para_cambiarlo].
  // Cada vez que llamamos a la función (ej: setEmail('nuevo')), React
  // re-renderiza el componente con el nuevo valor.

  // email: lo que el usuario escribe en el campo de correo electrónico.
  const [email, setEmail] = useState('');

  // password: la contraseña que escribe el usuario.
  const [password, setPassword] = useState('');

  // error: mensaje de error que se muestra si el login falla.
  // Empieza vacío ('') para que no se muestre nada al inicio.
  const [error, setError] = useState('');

  // loading: indica si estamos esperando respuesta del servidor.
  // true = petición en vuelo → deshabilitamos el botón para evitar doble clic.
  const [loading, setLoading] = useState(false);

  // ── FUNCIÓN DE ENVÍO DEL FORMULARIO ───────────────────────────────────────
  // Esta función se ejecuta cuando el usuario hace clic en "Entrar".
  // Es async porque hace una llamada a la API (operación asíncrona = puede
  // tardar un tiempo antes de que el servidor responda).
  async function submit(e: React.FormEvent) {
    // e.preventDefault() evita que el formulario haga el comportamiento por
    // defecto del navegador: recargar la página completa. Con esto, controlamos
    // la navegación nosotros mismos.
    e.preventDefault();

    // Limpiamos cualquier error anterior antes de intentar de nuevo.
    setError('');

    // Activamos el estado de carga para que el botón muestre "Entrando..."
    // y quede deshabilitado.
    setLoading(true);

    try {
      // Llamamos a la función de autenticación.
      // email.trim() elimina espacios al inicio y al final del email
      // (evita errores por espacios accidentales al escribir).
      await creatorLogin(email.trim(), password);

      // Si llegamos aquí, el login fue exitoso.
      // router.replace() navega al dashboard SIN agregar la página de login
      // al historial del navegador. Así, si el usuario pulsa "atrás", no
      // vuelve al login (ya que está autenticado).
      router.replace('/creator/dashboard');
    } catch (err: any) {
      // Si creatorLogin lanzó un error (credenciales incorrectas, sin red, etc.),
      // lo capturamos aquí.
      // err?.message: el operador ?. (optional chaining) accede a .message solo
      // si err no es null/undefined. Si no existe, muestra el texto por defecto.
      setError(err?.message || 'No se pudo iniciar sesión');

      // Desactivamos el loading para que el botón vuelva a ser clicable.
      setLoading(false);
    }
  }

  // ── JSX: LO QUE SE MUESTRA EN PANTALLA ────────────────────────────────────
  // JSX es la sintaxis de React que parece HTML pero en realidad es JavaScript.
  // Podemos mezclar variables JavaScript dentro de {} en cualquier parte del JSX.
  return (
    // Contenedor principal: ocupa toda la pantalla (min-h-screen), centra todo
    // horizontal y verticalmente (flex items-center justify-center),
    // fondo gris claro (bg-gray-50), padding de 4 unidades en todos lados (p-4).
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      {/* Caja interior centrada: ancho completo en móvil, máximo sm (384px) en pantallas grandes */}
      <div className="w-full max-w-sm">

        {/* Cabecera con logo y subtítulo */}
        <div className="text-center mb-6">
          {/* h1 con el nombre de la app en teal. style={{ color: TEAL }} aplica
              CSS en línea. En JSX los estilos se escriben como un objeto de JS,
              con nombres en camelCase (color, backgroundColor, etc.). */}
          <h1 className="text-2xl font-black" style={{ color: TEAL }}>Siliba</h1>
          <p className="text-sm text-gray-500 mt-1">Panel de reclutadores</p>
        </div>

        {/* Formulario: onSubmit={submit} conecta el evento de envío con nuestra
            función submit. Tailwind: rounded-2xl = bordes muy redondeados,
            space-y-4 = 16px de separación vertical entre hijos directos. */}
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Iniciar sesión</h2>

          {/* CAMPO EMAIL:
              - type="email": el navegador valida que tenga formato de correo.
              - value={email}: formulario CONTROLADO — el input siempre muestra
                lo que está en el estado (email). React es la fuente de verdad.
              - onChange={(e) => setEmail(e.target.value)}: cada vez que el
                usuario escribe una letra, e.target.value tiene el texto actual
                del input, y lo guardamos en el estado con setEmail.
              - required: el navegador no dejará enviar el formulario si está vacío. */}
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as any]: TEAL }}
          />

          {/* PasswordField: componente reutilizable para contraseñas.
              - value={password}: estado controlado igual que el email.
              - onChange={setPassword}: cuando el usuario escribe, se actualiza
                el estado (setPassword es directamente la función del useState).
              - placeholder y required son props que el componente acepta. */}
          <PasswordField value={password} onChange={setPassword} placeholder="Contraseña" required />

          {/* RENDERIZADO CONDICIONAL con &&:
              En JavaScript, A && B evalúa B solo si A es verdadero (truthy).
              En JSX, esto significa: "solo muestra este párrafo si error no
              está vacío". Si error es '' (string vacío), es falsy y React no
              renderiza nada. */}
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* BOTÓN DE ENVÍO:
              - type="submit": cuando se hace clic, dispara el onSubmit del form.
              - disabled={loading}: cuando loading es true, el botón queda
                deshabilitado (no se puede hacer clic) y aparece semitransparente
                (disabled:opacity-50 de Tailwind).
              - Expresión ternaria: loading ? 'Entrando...' : 'Entrar'
                Si loading es true → muestra 'Entrando...'
                Si loading es false → muestra 'Entrar' */}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: TEAL }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          {/* Enlace a la página de registro. {' '} es un espacio explícito en JSX
              (necesario porque JSX comprime los espacios entre elementos). */}
          <p className="text-xs text-center text-gray-500">
            ¿No tienes cuenta?{' '}
            {/* Link navega a /creator/register sin recargar la página */}
            <Link href="/creator/register" className="font-medium" style={{ color: TEAL }}>Regístrate</Link>
          </p>
        </form>

        {/* Botón para regresar al inicio de sesión normal de Siliba (clientes /
            profesionales / administradores). Reemplaza el atajo que antes vivía
            en la pantalla de login normal: el acceso a creadores ahora está en el
            menú de cada perfil, y desde aquí se puede volver al login general. */}
        <Link
          href="/login"
          className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver al inicio de sesión de Siliba
        </Link>
      </div>
    </div>
  );
}
