// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/portal/[tenantSlug]/login/page.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Página de inicio de sesión del PORTAL DEL CLIENTE para un tenant específico.
// URL: /portal/[tenantSlug]/login
// Ejemplo: /portal/salon-lucia/login
//
// DIFERENCIA CON EL LOGIN DEL CREADOR
// ------------------------------------
// - El portal del cliente es POR TENANT: cada negocio tiene su propio portal.
//   Un cliente de "Salón Lucía" usa /portal/salon-lucia/login.
// - El identificador puede ser email O teléfono (el backend acepta ambos).
// - Los tokens se guardan por tenantSlug (en lugar de globalmente), permitiendo
//   que el mismo cliente tenga cuentas en distintos negocios sin conflictos.
//
// FLUJO DE AUTH
// -------------
// 1. El usuario escribe email/teléfono + contraseña.
// 2. Se llama a login() del hook useClientAuth (que hace POST al backend).
// 3. Si éxito: el hook guarda el token internamente y router.push lleva a citas.
// 4. Si error: se muestra el mensaje en pantalla.
// ─────────────────────────────────────────────────────────────────────────────

// 'use client': necesario por useState, useRouter y useClientAuth (hooks).
'use client';

import { useState } from 'react';

// useRouter: para redirigir al usuario tras el login exitoso.
// useParams: para extraer el tenantSlug de la URL dinámica [tenantSlug].
import { useRouter, useParams } from 'next/navigation';

// useClientAuth: hook personalizado con toda la lógica de autenticación del
// portal del cliente. Expone: login, logout, client, isAuthenticated, etc.
import { useClientAuth } from '@/lib/hooks/use-client-auth';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalLoginPage() {
  // Desestructuramos del hook solo lo que necesitamos:
  // - login: función async que hace la petición de autenticación.
  // - isLoading: renombrado a authLoading para claridad. True mientras el
  //   ClientAuthProvider está verificando si hay token guardado (al cargar).
  const { login, isLoading: authLoading } = useClientAuth();

  const router = useRouter();

  // useParams() devuelve { tenantSlug: 'salon-lucia' } si la URL es /portal/salon-lucia/login.
  const params = useParams();
  // Guardamos el slug como string para construir URLs en esta página.
  const slug = params.tenantSlug as string;

  // ── ESTADO LOCAL DEL FORMULARIO ────────────────────────────────────────────
  // identifier: email o teléfono (el backend acepta cualquiera de los dos).
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // loading: diferente a authLoading. Este se activa cuando el USUARIO envía
  // el formulario. authLoading es de la carga inicial del contexto.
  const [loading, setLoading] = useState(false);

  // ── FUNCIÓN DE ENVÍO ───────────────────────────────────────────────────────
  // Usamos const con función flecha (arrow function) en lugar de function
  // declaration — ambas formas son equivalentes, es solo estilo.
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevenimos el comportamiento por defecto del formulario (recargar página).
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // login() está definido en el hook useClientAuth. Internamente:
      // 1. Hace POST /api/portal/[tenantSlug]/auth/login con identifier y password.
      // 2. Si éxito: guarda accessToken + refreshToken en localStorage.
      // 3. Actualiza el estado del contexto (client, isAuthenticated).
      await login(identifier, password);

      // Tras el login exitoso, redirigimos a la página de citas próximas.
      // router.push(): agrega al historial (el usuario puede pulsar "atrás").
      router.push(`/portal/${slug}/appointments`);
    } catch (err: any) {
      // Si login() lanzó un error (credenciales incorrectas, servidor caído, etc.)
      // mostramos el mensaje. err.message puede ser "Credenciales inválidas" u otro.
      setError(err.message || 'Credenciales inválidas');
    } finally {
      // finally: se ejecuta SIEMPRE, haya éxito o error.
      // Apagamos el loading para habilitar el botón nuevamente.
      setLoading(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    // min-h-screen flex items-center justify-center: ocupa toda la altura,
    // centra vertical y horizontalmente.
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Tarjeta blanca centrada con sombra suave */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Logo y textos de bienvenida */}
          <h1 className="text-2xl font-bold text-center mb-1" style={{ color: '#008080' }}>
            Siliba
          </h1>
          <p className="text-xs text-gray-400 text-center mb-1">Tu confianza, en manos de profesionales</p>
          <p className="text-sm text-gray-500 text-center mb-8">
            Inicia sesion para ver tus citas
          </p>

          {/* Formulario de login. onSubmit conecta con handleSubmit. */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* CAMPO IDENTIFICADOR: email o teléfono
                type="text" (no "email") porque aceptamos números de teléfono también. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email o teléfono
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="correo@ejemplo.com o +1234567890"
                required
              />
            </div>

            {/* CAMPO CONTRASEÑA */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="Tu contraseña"
                required
              />
            </div>

            {/* MENSAJE DE ERROR: visible solo si error no está vacío */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {/* BOTÓN DE ENVÍO:
                disabled={loading}: deshabilitado mientras espera respuesta.
                Ternario: loading ? 'Iniciando sesión...' : 'Iniciar sesión'. */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          {/* Enlace al registro. slug se incluye para ir al portal correcto del tenant. */}
          <p className="mt-6 text-center text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link
              href={`/portal/${slug}/register`}
              className="text-indigo-600 font-medium hover:text-indigo-700"
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
