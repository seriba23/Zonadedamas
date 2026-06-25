// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/app/(auth)/forgot-password/page.tsx
//
// CONCEPTO: Página de recuperación de contraseña.
// URL: /forgot-password
//
// Este es un flujo de 4 pasos (wizard) implementado con estado local.
// En vez de 4 páginas separadas, se usa UN solo componente que muestra
// contenido diferente según el "step" actual.
//
// FLUJO:
//  Paso 1 ('email')    → Usuario ingresa su correo electrónico
//  Paso 2 ('code')     → Usuario ingresa el código de 6 dígitos recibido por email
//  Paso 3 ('password') → Usuario elige su nueva contraseña
//  Paso 4 ('done')     → Pantalla de éxito + redirección automática al login
//
// ENDPOINTS DE LA API que usa:
//  POST /api/auth/forgot-password     → recibe email, envía código por correo
//  POST /api/auth/verify-reset-code   → verifica código + devuelve resetToken
//  POST /api/auth/reset-password      → recibe resetToken + nueva contraseña
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// ─── TIPO DEL STEP ──────────────────────────────────────────────────────────
// "type" en TypeScript define un alias de tipo. Este es un "union type":
// Step puede ser exactamente uno de estos 4 string literals.
// El compilador dará error si intentas asignar cualquier otro string.
type Step = 'email' | 'code' | 'password' | 'done';

export default function ForgotPasswordPage() {
  const router = useRouter();

  // "step" controla qué formulario/pantalla se muestra.
  // Empieza en 'email' (el primer paso del flujo).
  const [step, setStep] = useState<Step>('email');

  // Guardamos los valores que el usuario va ingresando en cada paso,
  // porque se necesitan en pasos posteriores:
  //  - email: se necesita en el paso 2 (para mandar junto con el código)
  //  - code: el código que el usuario escribe
  //  - resetToken: token que devuelve el servidor al verificar el código,
  //    y que se usa en el paso 3 para autenticar el cambio de contraseña
  //  - newPassword, confirmPassword: la nueva contraseña del usuario
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estado compartido para errores y loading (aplican a todos los pasos).
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ─── PASO 1: Enviar código al correo ────────────────────────────────────
  // Se llama cuando el usuario hace submit del formulario de email.
  // React.FormEvent es el tipo de TypeScript para el evento del <form>.
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();  // Evita recarga de página.
    setError('');
    // Validación del email con regex antes de llamar a la API.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresa un correo válido');
      return;
    }
    setLoading(true);
    try {
      // api.post hace una petición POST a la API del backend.
      // El backend envía un email con un código de 6 dígitos.
      await api.post('/api/auth/forgot-password', { email });
      // Si todo salió bien, avanzamos al paso 2 (ingresar el código).
      setStep('code');
    } catch (err: any) {
      setError(err?.message || 'No se pudo enviar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // ─── PASO 2: Verificar el código ────────────────────────────────────────
  // Se llama cuando el usuario ingresó el código de 6 dígitos.
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // Validación del código: debe ser exactamente 6 dígitos numéricos.
    // ^\d{6}$: ^ inicio, \d un dígito, {6} exactamente 6 veces, $ fin.
    if (!/^\d{6}$/.test(code)) {
      setError('El código debe tener 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      // El tipo genérico <{ data: { resetToken: string } }> le indica a TypeScript
      // cómo se ve la respuesta exitosa de esta API. Es solo información
      // de tipos, no afecta el comportamiento en tiempo de ejecución.
      const res = await api.post<{ data: { resetToken: string } }>(
        '/api/auth/verify-reset-code',
        { email, code },  // Mandamos email + código que el usuario escribió.
      );
      // Guardamos el resetToken para usarlo en el paso 3.
      setResetToken(res.data.resetToken);
      setStep('password');
    } catch (err: any) {
      setError(err?.message || 'Código inválido o expirado');
    } finally {
      setLoading(false);
    }
  }

  // ─── PASO 3: Cambiar la contraseña ──────────────────────────────────────
  // Se llama cuando el usuario escribe su nueva contraseña (dos veces).
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // Validaciones manuales antes de llamar a la API.
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      // Mandamos el resetToken (prueba de que verificó el email) + nueva contraseña.
      await api.post('/api/auth/reset-password', { resetToken, newPassword });
      // Mostramos la pantalla de éxito.
      setStep('done');
      // setTimeout ejecuta la función después de 2500ms (2.5 segundos).
      // Redirigimos al login automáticamente para que el usuario inicie sesión
      // con su nueva contraseña.
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  // ─── RENDERIZADO (JSX) ──────────────────────────────────────────────────────
  // JSX (JavaScript XML): sintaxis que parece HTML pero en realidad es JavaScript.
  // Cada elemento JSX como <div className="..."> se transforma en una llamada
  // a React.createElement() en tiempo de compilación.
  //
  // RENDERIZADO CONDICIONAL:
  // Esta página usa el operador ternario (condición ? valorSiTrue : valorSiFalse)
  // y el operador && para mostrar contenido diferente según el "step" actual.
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
          <p className="mt-1 text-gray-500 text-sm">
            Tu confianza, en manos de profesionales
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* RENDERIZADO CONDICIONAL CON TERNARIO:
              Si step === 'done' → muestra la pantalla de éxito
              Si no (else)      → muestra el formulario del paso actual */}
          {step === 'done' ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#e0f2f1] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#008080]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Contraseña actualizada
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Te llevaremos al inicio de sesión.
              </p>
              <Link href="/login" className="btn-primary inline-block px-6 py-2.5">
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            // El fragmento (<>...</>) agrupa múltiples elementos sin <div> extra.
            <>
              {/* El título y la descripción cambian según el paso actual.
                  PATRÓN: condición && <elemento>
                  Si "condición" es true, React renderiza <elemento>.
                  Si "condición" es false, React no renderiza nada.
                  Es el equivalente de: if (step === 'email') { mostrar esto } */}
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {step === 'email' && 'Recuperar contraseña'}
                {step === 'code' && 'Verifica tu correo'}
                {step === 'password' && 'Nueva contraseña'}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {step === 'email' &&
                  'Te enviaremos un código de 6 dígitos a tu correo.'}
                {step === 'code' && (
                  // En el paso del código, mostramos el email del usuario
                  // para que sepa a dónde mirar su bandeja de entrada.
                  // {email} dentro de JSX inserta el valor de la variable "email".
                  <>
                    Ingresa el código que enviamos a{' '}
                    <span className="font-medium text-gray-700">{email}</span>.
                  </>
                )}
                {step === 'password' &&
                  'Elige una contraseña nueva de al menos 8 caracteres.'}
              </p>

              {/* RENDERIZADO CONDICIONAL con &&:
                  Si hay un mensaje de error ("error" es un string no vacío,
                  que en JavaScript es "truthy"), se muestra el div de error.
                  Si "error" es '' (string vacío), es "falsy" y no se renderiza nada. */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Cada formulario solo se muestra cuando corresponde al paso actual. */}
              {step === 'email' && (
                // onSubmit: evento de React que se dispara cuando el usuario
                // hace submit del formulario (click en botón type="submit" o Enter).
                <form onSubmit={handleSendCode} className="space-y-5">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Correo electrónico
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field"
                      placeholder="correo@ejemplo.com"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full btn-primary py-2.5 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Enviando…' : 'Enviar código'}
                  </button>
                </form>
              )}

              {step === 'code' && (
                <form onSubmit={handleVerifyCode} className="space-y-5">
                  <div>
                    <label
                      htmlFor="code"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Código de verificación
                    </label>
                    <input
                      id="code"
                      type="text"
                      // inputMode="numeric" muestra el teclado numérico en móviles
                      // (aunque el tipo sea "text", no "number").
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      // onChange se dispara cada vez que el usuario escribe algo.
                      // "e.target.value" es el texto que tiene el input en ese momento.
                      // .replace(/\D/g, '') elimina todos los caracteres que NO son
                      // dígitos (\D = "no digit", /g = global, todas las ocurrencias).
                      // .slice(0, 6) toma solo los primeros 6 caracteres.
                      // Combinado: solo deja pasar dígitos y máximo 6.
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      // tracking-[0.5em]: separado entre letras (para que el código
                      // se vea como 1 2 3 4 5 6 y sea más fácil de leer).
                      className="input-field text-center tracking-[0.5em] text-lg"
                      placeholder="••••••"
                      // autoFocus: hace foco automático en este input al mostrarse.
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full btn-primary py-2.5 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Verificando…' : 'Verificar código'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCode('');
                      setError('');
                      setStep('email');
                    }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cambiar correo
                  </button>
                </form>
              )}

              {step === 'password' && (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label
                      htmlFor="newPassword"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Nueva contraseña
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field"
                      placeholder="Mínimo 8 caracteres"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Confirmar contraseña
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                      placeholder="Repite la contraseña"
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full btn-primary py-2.5 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Guardando…' : 'Cambiar contraseña'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          <Link
            href="/login"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
