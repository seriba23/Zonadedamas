// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/creator/set-password/page.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Página para que un creador/influencer ESTABLEZCA SU CONTRASEÑA la primera vez.
// URL: /creator/set-password?token=XXXX
//
// CUÁNDO SE USA
// -------------
// Cuando un administrador INVITA a un creador por email. El email tiene un enlace
// con un TOKEN de invitación temporal (ej: /creator/set-password?token=abc123).
// Este token prueba que el usuario es quien dice ser. Sin él, no puede crear la
// contraseña.
//
// ESTRUCTURA DE DOS COMPONENTES
// ─────────────────────────────
// Este archivo exporta DOS funciones de componente:
//   1. SetPasswordInner(): el formulario real (necesita acceso a useSearchParams)
//   2. CreatorSetPasswordPage(): el contenedor/página principal (exportación default)
//
// ¿Por qué dos? Porque useSearchParams() requiere que el componente esté envuelto
// en <Suspense> para que Next.js pueda hacer "streaming" (renderizar mientras
// carga). Si ponemos useSearchParams() directamente en el componente raíz de la
// página, Next.js lanza un error. La solución estándar es separarlo en un
// componente hijo y envolverlo en <Suspense>.
// ─────────────────────────────────────────────────────────────────────────────

// 'use client': necesario porque usamos hooks (useState, useSearchParams).
'use client';

// Suspense: componente de React para mostrar un "fallback" (texto de carga)
// mientras el componente hijo está cargando. Requerido por useSearchParams en Next.js 14.
import { Suspense, useState } from 'react';

// useRouter: para redirigir al usuario después de establecer la contraseña.
// useSearchParams: para leer los parámetros de la URL (el ?token=XXXX).
import { useRouter, useSearchParams } from 'next/navigation';

// creatorSetPassword: función que envía al backend el token + la nueva contraseña.
import { creatorSetPassword } from '@/lib/creator-auth';

// PasswordField: input de contraseña con ojo.
// isPasswordValid: valida que la contraseña cumpla los requisitos.
import { PasswordField, isPasswordValid } from '@/components/ui/password-field';

// Color de marca.
// Identidad NEGRA/tinta del portal de reclutamiento (nombre conservado).
const TEAL = '#111827';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE INTERNO: SetPasswordInner
// Este componente contiene la lógica real. Está separado del componente
// principal porque usa useSearchParams(), que requiere estar dentro de <Suspense>.
// ─────────────────────────────────────────────────────────────────────────────
function SetPasswordInner() {
  // router para redirigir después del éxito.
  const router = useRouter();

  // useSearchParams() devuelve un objeto que permite leer los parámetros de la URL.
  // Por ejemplo, si la URL es /creator/set-password?token=abc123,
  // params.get('token') devuelve 'abc123'.
  const params = useSearchParams();

  // Leemos el token de la URL. Si no existe (el usuario llegó sin token),
  // el operador || asigna un string vacío.
  const token = params.get('token') || '';

  // Estado local del formulario.
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── FUNCIÓN DE ENVÍO ───────────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Enviamos el token (prueba de identidad) y la contraseña al backend.
      // El backend valida el token y, si es válido, establece la contraseña
      // y devuelve un accessToken para iniciar sesión automáticamente.
      const res = await creatorSetPassword(token, password);

      // Si el backend devolvió un accessToken, redirigimos al dashboard.
      // Si no (raro, pero defensivo), mandamos al login.
      if (res.accessToken) router.replace('/creator/dashboard');
      else router.replace('/creator/login');
    } catch (err: any) {
      setError(err?.message || 'No se pudo establecer la contraseña');
      setLoading(false);
    }
  }

  // ── GUARDA DE SEGURIDAD: token faltante ───────────────────────────────────
  // Si el usuario llegó a esta página sin token en la URL (o el token es inválido),
  // mostramos un mensaje de error y NO mostramos el formulario.
  // Esto es un "early return" con guard clause.
  if (!token) {
    return <p className="text-sm text-red-600">Falta el token de invitación en el enlace.</p>;
  }

  // ── FORMULARIO DE CONTRASEÑA ───────────────────────────────────────────────
  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Crea tu contraseña</h2>
      <p className="text-xs text-gray-500">Define la contraseña con la que entrarás a tu panel.</p>

      {/* PasswordField con showRequirements activa la lista de requisitos.
          autoFocus: el cursor se coloca en este campo automáticamente al cargar
          la página, ahorrando al usuario un clic. */}
      <PasswordField
        value={password}
        onChange={setPassword}
        placeholder="Contraseña"
        showRequirements
        autoFocus
        required
      />

      {/* Mensaje de error si la petición falló */}
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {/* Botón deshabilitado si cargando O si la contraseña no es válida.
          !isPasswordValid(password): el ! niega el resultado (si es válida
          devuelve true, !true = false = botón habilitado). */}
      <button type="submit" disabled={loading || !isPasswordValid(password)}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
        {loading ? 'Guardando...' : 'Guardar y entrar'}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL (exportación default = la página real de Next.js)
// ─────────────────────────────────────────────────────────────────────────────
export default function CreatorSetPasswordPage() {
  return (
    // Pantalla completa centrada con fondo gris
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        {/* Cabecera de marca */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black" style={{ color: TEAL }}>Siliba</h1>
          <p className="text-sm text-gray-500 mt-1">Panel de reclutadores</p>
        </div>

        {/* <Suspense>: mientras SetPasswordInner carga (porque useSearchParams
            causa una pausa de hidratación), muestra el texto "Cargando...".
            fallback: lo que se muestra mientras espera. Cuando SetPasswordInner
            está listo, React lo reemplaza automáticamente con el formulario. */}
        <Suspense fallback={<p className="text-center text-gray-400 text-sm">Cargando...</p>}>
          <SetPasswordInner />
        </Suspense>
      </div>
    </div>
  );
}
