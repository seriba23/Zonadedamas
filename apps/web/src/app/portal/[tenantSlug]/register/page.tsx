// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/portal/[tenantSlug]/register/page.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Página de REGISTRO de un nuevo cliente en el portal de un negocio específico.
// URL: /portal/[tenantSlug]/register
// Ejemplo: /portal/salon-lucia/register
//
// QUÉ MUESTRA
// -----------
// Formulario de creación de cuenta con:
//   - Nombre y apellido (en dos columnas)
//   - Email o teléfono (identificador de acceso)
//   - Contraseña (con requisitos: mín. 8 chars, 1 número, 1 símbolo)
//   - Confirmar contraseña (validación del lado cliente)
//
// VALIDACIÓN
// ----------
// Hacemos validación EN EL CLIENTE (antes de llamar al backend):
//   1. Las contraseñas deben coincidir.
//   2. La contraseña debe cumplir los requisitos mínimos.
// Esto ahorra llamadas innecesarias al servidor y da feedback inmediato.
//
// FLUJO TRAS REGISTRO EXITOSO
// ---------------------------
// Redirige directamente a /appointments (el usuario queda autenticado).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

// register: función del hook que hace POST al backend para crear la cuenta
// y automáticamente guarda el token si el registro es exitoso.
import { useClientAuth } from '@/lib/hooks/use-client-auth';
import Link from 'next/link';

export default function PortalRegisterPage() {
  // Solo necesitamos la función register de useClientAuth.
  const { register } = useClientAuth();
  const router = useRouter();

  // Obtenemos el slug del tenant de la URL dinámica.
  const params = useParams();
  const slug = params.tenantSlug as string;

  // ── ESTADO: TODOS LOS CAMPOS DEL FORMULARIO ────────────────────────────────
  // Un solo objeto de estado para todos los campos. Patrón común en formularios.
  const [form, setForm] = useState({
    identifier: '',       // Email o teléfono
    password: '',         // Contraseña elegida
    confirmPassword: '',  // Repetición de contraseña (solo validación cliente)
    firstName: '',        // Nombre
    lastName: '',         // Apellido
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── FUNCIÓN HELPER: updateField ────────────────────────────────────────────
  // Actualiza un campo específico del formulario sin tocar los demás.
  // field: el nombre del campo (ej: 'firstName', 'password').
  // value: el nuevo valor del campo.
  //
  // prev => ({ ...prev, [field]: value }):
  // - prev: el valor ANTERIOR del estado (React garantiza que es el más reciente).
  // - Spread operator (...prev): copia todos los campos previos.
  // - [field]: key computada — en lugar de escribir { firstName: value } o
  //   { password: value }, usamos la variable field como nombre de propiedad.
  //   Esto nos permite tener UNA sola función para actualizar cualquier campo.
  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── FUNCIÓN: validatePassword ──────────────────────────────────────────────
  // Valida que la contraseña cumpla los requisitos mínimos de seguridad.
  // Devuelve null si es válida, o un string con el mensaje de error si no.
  // Regex (expresiones regulares): /[0-9]/.test(pwd) verifica si el string
  // contiene al menos un dígito del 0 al 9. Si no → error.
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    // /[0-9]/.test(): devuelve true si pwd contiene algún dígito, false si no.
    if (!/[0-9]/.test(pwd)) return 'La contraseña debe contener al menos un número';
    // Misma lógica para verificar que haya al menos un símbolo especial.
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/.test(pwd))
      return 'La contraseña debe contener al menos un símbolo';
    // Si llegamos aquí, la contraseña es válida.
    return null;
  };

  // ── FUNCIÓN DE ENVÍO DEL FORMULARIO ───────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // VALIDACIÓN 1: las contraseñas deben coincidir.
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return; // Salimos sin llamar al backend.
    }

    // VALIDACIÓN 2: requisitos de seguridad de la contraseña.
    const pwdError = validatePassword(form.password);
    if (pwdError) {
      setError(pwdError);
      return; // El mensaje de error viene de validatePassword().
    }

    // Si las validaciones pasaron → activamos loading y llamamos al backend.
    setLoading(true);
    try {
      // register() hace POST al backend con los datos del nuevo cliente.
      // Nota: NO enviamos confirmPassword al backend (es solo validación cliente).
      await register({
        identifier: form.identifier,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      });
      // Registro exitoso → el hook habrá guardado el token → redirigimos a citas.
      router.push(`/portal/${slug}/appointments`);
    } catch (err: any) {
      // Error típico: "El email ya está registrado" o error de servidor.
      setError(err.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    // py-8: padding vertical para que el formulario no pegue en los bordes en móvil.
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Crear cuenta
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Regístrate para gestionar tus citas
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre y apellido en dos columnas: grid grid-cols-2 gap-3 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                {/* onChange usa updateField('firstName', ...) → actualiza solo ese campo */}
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
              </div>
            </div>

            {/* Campo identificador: email o teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email o teléfono
              </label>
              <input
                type="text"
                value={form.identifier}
                onChange={(e) => updateField('identifier', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="correo@ejemplo.com o +1234567890"
                required
              />
            </div>

            {/* Campo contraseña nueva */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="Mín. 8 caracteres, 1 número, 1 símbolo"
                required
              />
            </div>

            {/* Campo confirmar contraseña (solo validación cliente, no va al servidor) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                required
              />
            </div>

            {/* Mensaje de error (validación o API) */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          {/* Enlace al login para quienes ya tienen cuenta en este tenant */}
          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link
              href={`/portal/${slug}/login`}
              className="text-indigo-600 font-medium hover:text-indigo-700"
            >
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
