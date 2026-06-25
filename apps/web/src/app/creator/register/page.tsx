// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/creator/register/page.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Página de REGISTRO para nuevos creadores/influencers de Siliba.
// URL: /creator/register
//
// QUÉ MUESTRA
// -----------
// Tiene DOS pantallas distintas en uno:
//   A) El formulario de registro (estado normal, done = false)
//   B) Una pantalla de confirmación con palomita verde (cuando done = true,
//      es decir, el registro fue exitoso)
//
// FLUJO
// -----
// 1. El usuario llena el formulario: email, nombre, apellido, teléfono, contraseña.
// 2. Al enviar, se llama a creatorRegister() que hace POST al backend.
// 3. El backend crea la cuenta en estado PENDIENTE (requiere aprobación de admin).
// 4. Cuando termina → setDone(true) → el componente re-renderiza y muestra la
//    pantalla de confirmación.
// 5. Desde ahí el usuario puede ir al login (ya sabe que debe esperar aprobación).
// ─────────────────────────────────────────────────────────────────────────────

// Necesario para usar hooks de React (useState) y hacer el componente interactivo.
'use client';

import { useState } from 'react';
import Link from 'next/link';

// creatorRegister: función que hace la petición HTTP POST para crear la cuenta.
// Está en apps/web/src/lib/creator-auth.ts.
import { creatorRegister } from '@/lib/creator-auth';

// PasswordField: input de contraseña con ojo para mostrar/ocultar.
// isPasswordValid: función que verifica que la contraseña cumpla los requisitos
// (longitud mínima, número, símbolo). La usamos para habilitar/deshabilitar el botón.
import { PasswordField, isPasswordValid } from '@/components/ui/password-field';

// Color primario de la marca (verde azulado). Constante en módulo para no repetir.
const TEAL = '#008080';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CreatorRegisterPage() {
  // ── ESTADO: FORMULARIO COMO UN OBJETO ─────────────────────────────────────
  // En lugar de crear un useState por campo (setEmail, setFirstName, etc.),
  // agrupamos todos los campos del formulario en UN SOLO objeto.
  // Esto es un patrón muy común en formularios con muchos campos.
  // Cada clave del objeto corresponde a un campo del formulario HTML.
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', phone: '', password: '' });

  // error: texto de error de la API (ej: "El email ya está registrado").
  const [error, setError] = useState('');

  // done: bandera que indica si el registro fue exitoso.
  // false → mostrar formulario | true → mostrar pantalla de confirmación.
  const [done, setDone] = useState(false);

  // loading: true mientras la petición está en curso (deshabilitamos el botón).
  const [loading, setLoading] = useState(false);

  // ── FUNCIÓN DE ENVÍO ───────────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    // Evitamos la recarga de página que haría el formulario por defecto.
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Llamamos a la función de registro enviando los datos del formulario.
      // .trim() elimina espacios accidentales de los campos de texto.
      // phone: form.phone.trim() || undefined → si el teléfono quedó vacío
      // después del trim, enviamos undefined (el campo es opcional). El
      // operador || devuelve el lado derecho cuando el izquierdo es falsy
      // (string vacío, null, undefined, 0, false).
      await creatorRegister({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      // Si llegamos aquí, el registro fue exitoso → mostramos confirmación.
      setDone(true);
    } catch (err: any) {
      // err?.message: si el error tiene mensaje, lo mostramos; si no, texto genérico.
      setError(err?.message || 'No se pudo crear la cuenta');
      setLoading(false);
    }
  }

  // ── RENDERIZADO CONDICIONAL: PANTALLA DE ÉXITO ────────────────────────────
  // Cuando done = true, retornamos TEMPRANO con la pantalla de confirmación.
  // React ejecuta el return que encuentre primero, así que si done es true,
  // nunca llega al formulario de abajo (early return pattern).
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 text-center">
          {/* Círculo con palomita (checkmark) verde, símbolo visual de éxito */}
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#e0f2f1' }}>
            {/* SVG inline: dibujamos la palomita directamente con código.
                stroke={TEAL}: usamos la variable JS dentro del atributo. */}
            <svg className="w-7 h-7" fill="none" stroke={TEAL} viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Cuenta creada</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Un administrador revisará y aprobará tu cuenta pronto. Te avisaremos cuando puedas entrar.
          </p>
          {/* inline-block en Link para que el botón no ocupe todo el ancho */}
          <Link href="/creator/login" className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: TEAL }}>
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  // ── RENDERIZADO NORMAL: FORMULARIO DE REGISTRO ────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        {/* Cabecera con logo */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black" style={{ color: TEAL }}>Siliba</h1>
          <p className="text-sm text-gray-500 mt-1">Únete como reclutador o creador de contenido</p>
        </div>

        {/* Formulario de registro. space-y-3: separación de 12px entre campos. */}
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
          <h2 className="text-lg font-bold text-gray-900">Crear cuenta</h2>

          {/* Campo email: formulario controlado.
              onChange actualiza solo el campo email del objeto form.
              { ...form, email: e.target.value } crea un NUEVO objeto copiando
              todos los campos del form anterior (...form) y reemplazando solo
              el campo email con el nuevo valor. Esto es inmutabilidad: nunca
              modificamos el objeto original, siempre creamos uno nuevo. */}
          <input type="email" placeholder="Email" value={form.email} required
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: TEAL }} />

          {/* grid grid-cols-2 gap-2: los dos campos (nombre y apellido) se
              muestran UNO AL LADO DEL OTRO en una cuadrícula de 2 columnas. */}
          <div className="grid grid-cols-2 gap-2">
            {/* Campo nombre: igual patrón de formulario controlado */}
            <input type="text" placeholder="Nombre" value={form.firstName} required
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: TEAL }} />
            {/* Campo apellido */}
            <input type="text" placeholder="Apellido" value={form.lastName} required
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: TEAL }} />
          </div>

          {/* Campo teléfono: opcional (sin required). Si el usuario no lo llena,
              enviamos undefined (ver la función submit arriba). */}
          <input type="text" placeholder="Teléfono (opcional)" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: TEAL }} />

          {/* Campo contraseña con componente especializado.
              showRequirements: prop que activa la lista de requisitos debajo del input
              (mínimo 8 caracteres, 1 número, 1 símbolo).
              onChange={(v) => ...}: v es el nuevo valor de la contraseña. El
              componente llama onChange con el valor directamente (no con el evento). */}
          <PasswordField
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            placeholder="Contraseña"
            showRequirements
            required
          />

          {/* Mensaje de error de la API (si existe) */}
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Botón: deshabilitado si está cargando O si la contraseña no cumple
              los requisitos mínimos. El operador || une las dos condiciones:
              si CUALQUIERA es true, el botón queda deshabilitado. */}
          <button type="submit" disabled={loading || !isPasswordValid(form.password)}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
            {loading ? 'Creando...' : 'Crear cuenta'}
          </button>

          {/* Enlace al login para quienes ya tienen cuenta */}
          <p className="text-xs text-center text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/creator/login" className="font-medium" style={{ color: TEAL }}>Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
