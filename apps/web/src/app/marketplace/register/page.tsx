// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/register/page.tsx
// ROL: Página de registro de nuevos usuarios del marketplace.
//
// ¿Qué muestra?
//   Formulario de creación de cuenta con:
//     - Botones de login social (Google, Facebook) → SocialLoginButtons.
//     - Nombre y apellido (2 campos en una fila).
//     - Email.
//     - Contraseña (con validación de seguridad).
//     - Confirmar contraseña.
//     - Mensaje de error si algo falla.
//     - Aceptación de Términos y Aviso de Privacidad.
//     - Botón "Crear cuenta".
//     - Link a /marketplace/login si ya tiene cuenta.
//
// Validaciones del lado del cliente (ANTES de enviar a la API):
//   1. Las contraseñas coinciden.
//   2. La contraseña tiene al menos 8 caracteres.
//   3. La contraseña contiene al menos 1 número (regex /[0-9]/).
//   4. La contraseña contiene al menos 1 símbolo (regex de símbolos).
//   Si alguna falla → muestra error en pantalla sin llamar a la API.
//
// Nota sobre el teléfono:
//   Se eliminó del formulario de registro. Lo pide el CompleteProfileModal
//   después del registro para evitar duplicar campos.
// ============================================================

// 'use client': usa useState, router, hooks → se ejecuta en el navegador.
'use client';

// Suspense: necesario por useSearchParams (Next.js App Router requiere
// que los componentes que usan useSearchParams estén dentro de Suspense
// para permitir el pre-render estático en build).
// useState: para manejar los campos del formulario y estados de UI.
import { Suspense, useState } from 'react';

// useRouter: para navegar a /marketplace tras registrarse exitosamente.
// useSearchParams: para leer ?redirect=... y saber a dónde llevar al usuario.
import { useRouter, useSearchParams } from 'next/navigation';

// useMarketplaceAuth: hook del contexto de auth que expone:
//   register({ email, password, firstName, lastName }): llama a la API
//     para crear la cuenta y guarda el token JWT automáticamente.
//   socialLogin(provider, token): login/registro con Google o Facebook.
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

// SocialLoginButtons: componente con los botones de "Continuar con Google"
// y "Continuar con Facebook". Maneja el flujo OAuth externamente.
import { SocialLoginButtons } from '@/components/ui/social-login-buttons';

// Link: componente de Next.js para navegación client-side.
import Link from 'next/link';

// PhoneInput y COUNTRY_CODES eliminados: el teléfono se pide en el
// CompleteProfileModal post-creación junto con género/fecha/alergias.

// ─── Componente interno del formulario de registro ───────────────────
// Se separa para poder envolverlo en <Suspense> (por useSearchParams).
function MarketplaceRegisterPageInner() {
  // Extraemos register y socialLogin del contexto de auth.
  const { register, socialLogin } = useMarketplaceAuth();

  // router: para navegar programáticamente tras el registro.
  const router = useRouter();

  // searchParams: leemos ?redirect para saber adónde llevar al usuario.
  const searchParams = useSearchParams();

  // redirect: valor del parámetro ?redirect en la URL, o null si no existe.
  const redirect = searchParams.get('redirect');

  // Phone se elimina del form de registro normal: el CompleteProfileModal
  // lo pide después junto con birthDate/género/alergias en una sola pasada
  // para evitar la duplicación que reportó el usuario (le pedíamos teléfono
  // en el form y otra vez en el popup post-creación).

  // form: estado del formulario. Es un objeto con todos los campos.
  // useState inicializa con todos los campos vacíos.
  // Actualizamos un campo a la vez con updateField (ver más abajo).
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  // error: mensaje de error para mostrar al usuario. '' = sin error.
  const [error, setError] = useState('');

  // loading: true mientras se espera la respuesta de la API.
  // Sirve para deshabilitar el botón y mostrar "Registrando..."
  // evitando que el usuario haga click varias veces.
  const [loading, setLoading] = useState(false);

  // updateField: función auxiliar para actualizar UN campo del formulario.
  // Patrón "spread" (operador ...):
  //   setForm((prev) => ({ ...prev, [field]: value }))
  //   Crea un NUEVO objeto copiando todos los campos de prev (...prev)
  //   y sobreescribiendo solo el campo indicado ([field]: value).
  //   La notación [field] usa el valor de la variable field como nombre de propiedad.
  //   Ej: updateField('email', 'juan@test.com') → form.email = 'juan@test.com'.
  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // handleSubmit: manejador del evento "submit" del formulario.
  // Se llama cuando el usuario hace click en "Crear cuenta" (o presiona Enter).
  const handleSubmit = async (e: React.FormEvent) => {
    // e.preventDefault(): evita que el formulario recargue la página.
    // Por defecto, un <form> HTML hace una petición HTTP al hacer submit.
    // Aquí queremos controlarlo nosotros con JavaScript.
    e.preventDefault();

    // Limpiamos el error anterior para que no quede el mensaje viejo.
    setError('');

    // ─── Validaciones del lado del cliente ──────────────────────────
    // Las validaciones se hacen ANTES de llamar a la API para dar
    // feedback inmediato al usuario sin esperar respuesta del servidor.

    // Validación 1: las contraseñas deben coincidir.
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return; // return: detiene la ejecución del handleSubmit aquí.
    }

    // Validación 2: mínimo 8 caracteres.
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    // Validación 3: debe contener al menos un dígito.
    // /[0-9]/ es una expresión regular que busca caracteres del 0 al 9.
    // .test(string) devuelve true si el string contiene el patrón.
    // ! niega el resultado: true si NO hay ningún dígito.
    if (!/[0-9]/.test(form.password)) {
      setError('La contraseña debe contener al menos un número');
      return;
    }

    // Validación 4: debe contener al menos un símbolo especial.
    // La regex busca cualquiera de los caracteres entre los corchetes [].
    // El \ antes de algunos caracteres es un "escape" necesario en regex.
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/.test(form.password)) {
      setError('La contraseña debe contener al menos un símbolo');
      return;
    }

    // Activamos el estado de carga.
    setLoading(true);

    try {
      // Llamamos a la función register del contexto de auth.
      // await espera a que la promesa (petición HTTP) se resuelva.
      // register() guarda el token JWT automáticamente si tiene éxito.
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      });

      // Si el registro fue exitoso, navegamos a:
      //   - redirect (la ruta que el usuario intentaba ver antes del registro), O
      //   - '/marketplace' (la pantalla principal del marketplace).
      // El operador || devuelve el primer valor "truthy" (no falso/vacío/null).
      router.push(redirect || '/marketplace');
    } catch (err: any) {
      // Si la API devuelve un error (email ya registrado, etc.),
      // mostramos el mensaje de error. err.message es el texto del error.
      setError(err.message || 'Error al registrarse');
    } finally {
      // finally siempre se ejecuta, haya error o no.
      // Desactivamos el estado de carga al terminar.
      setLoading(false);
    }
  };

  return (
    // min-h-screen: ocupa al menos el 100% de la altura de la pantalla.
    // flex items-center justify-center: centra el formulario.
    // px-4 py-8: padding horizontal y vertical.
    // safe-top: respeta el notch superior en iPhones.
    <div className="min-h-screen flex items-center justify-center px-4 py-8 safe-top">
      {/* Contenedor del formulario, ancho máximo de 384px. */}
      <div className="w-full max-w-sm">
        {/* Cabecera del formulario: logo y texto introductorio. */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#008080' }}>Siliba</h1>
          <p className="text-sm text-gray-500 mt-1">Crea tu cuenta gratuita</p>
        </div>

        {/* Tarjeta blanca con el formulario y los botones sociales. */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {/* SocialLoginButtons: botones de login social (Google, Facebook).
              PROP onSocialLogin: función callback que se llama cuando el usuario
              selecciona un proveedor social. Recibe:
                provider: string ('google' o 'facebook').
                token: string (token de acceso del proveedor OAuth).
              Dentro llamamos a socialLogin() del contexto de auth.
              PROP disabled: deshabilita los botones mientras loading=true. */}
          <SocialLoginButtons
            onSocialLogin={async (provider, token) => {
              setError('');
              try {
                await socialLogin(provider, token);
                router.push(redirect || '/marketplace');
              } catch (err: any) {
                setError(err.message || 'Error al registrarse');
              }
            }}
            disabled={loading}
          />

          {/* Formulario HTML con manejador onSubmit.
              onSubmit={handleSubmit}: cuando se envía el form, llamamos a handleSubmit.
              className="space-y-4": espacio de 16px entre elementos hijos. */}
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fila con Nombre y Apellido lado a lado.
              grid grid-cols-2 gap-3: 2 columnas con separación de 12px. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
              {/* Campo de nombre:
                  value={form.firstName}: el input está "controlado" por React.
                    Su valor siempre refleja el estado form.firstName.
                  onChange={(e) => updateField('firstName', e.target.value)}:
                    cuando el usuario escribe, actualizamos el estado.
                    e es el evento, e.target es el input, e.target.value es el texto.
                  onFocus/onBlur: cambiamos el estilo del borde del input al
                    enfocar/desfocar (simula el ring de Tailwind con color teal). */}
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Apellido</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Campo Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
              placeholder="tu@email.com"
            />
          </div>

          {/* Campo Contraseña */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
              placeholder="Mín. 8 caracteres, 1 número, 1 símbolo"
            />
          </div>

          {/* Campo Confirmar Contraseña */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.3)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Renderizado condicional con &&:
              Si error es un string no vacío (truthy), muestra el párrafo de error.
              Si error es '' (falsy), no renderiza nada. */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Texto de aceptación de términos legales.
              {' '} es un espacio en blanco explícito en JSX
              (necesario porque JSX ignora espacios entre elementos). */}
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Al crear tu cuenta, aceptas nuestros{' '}
            <Link href="/marketplace/legal/terms" className="underline" style={{ color: '#008080' }}>
              Términos y Condiciones
            </Link>{' '}
            y{' '}
            <Link href="/marketplace/legal/privacy" className="underline" style={{ color: '#008080' }}>
              Aviso de Privacidad
            </Link>.
          </p>

          {/* Botón de submit:
              disabled={loading}: mientras loading=true, el botón queda
              deshabilitado (no clickeable). Tailwind "disabled:opacity-50"
              lo hace semi-transparente visualmente.
              onMouseEnter/onMouseLeave: cambia el color al pasar el mouse
              (hover effect manual con style inline). */}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#008080' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#006666'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#008080'; }}
          >
            {/* Renderizado condicional ternario en el texto del botón:
                Si loading → "Registrando..." (con puntos de espera).
                Si no → "Crear cuenta". */}
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
          </form>
        </div>

        {/* Link a la página de login para usuarios que ya tienen cuenta.
            Usamos template literal (backticks + ${}) para construir la URL:
            Si hay redirect → añadimos ?redirect=<valor>.
            Si no → solo /marketplace/login. */}
        <p className="text-center text-sm text-gray-500 mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link
            href={`/marketplace/login${redirect ? `?redirect=${redirect}` : ''}`}
            className="font-medium"
            style={{ color: '#008080' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#006666')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#008080')}
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─── Componente principal de la página ──────────────────────────────
// Envuelve el formulario en Suspense para que Next.js pueda hacer
// el pre-render estático del build sin errores por useSearchParams.
export default function MarketplaceRegisterPage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceRegisterPageInner />
    </Suspense>
  );
}
