// ─────────────────────────────────────────────────────────────────────────────
// 'use client'
// En Next.js 14 los archivos son, por defecto, "Server Components" (se ejecutan
// en el servidor). Esta directiva al inicio convierte el archivo en un
// "Client Component": se ejecuta en el navegador del usuario. Lo necesitamos
// porque usamos hooks (useRouter) y manejamos clics, cosas que solo existen en
// el navegador.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

// useRouter: hook (función especial de React/Next) que nos da un objeto para
// navegar entre páginas mediante código (ej. router.push('/ruta')).
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS (propiedades)
// Las "props" son los datos que el componente recibe DESDE FUERA, como los
// argumentos de una función. Esta interface describe qué forma tienen esos
// datos para que TypeScript nos avise si pasamos algo incorrecto.
// ─────────────────────────────────────────────────────────────────────────────
interface SubscriptionBannerProps {
  status: string;               // estado de la suscripción: 'TRIAL', 'PAST_DUE', etc.
  trialEndsAt?: string | null;  // fecha de fin del período de prueba (el '?' = opcional)
}

// Componente "SubscriptionBanner": muestra una barra de aviso en la parte
// superior del dashboard según el estado de la suscripción del negocio.
// Recibe { status, trialEndsAt } desestructurados de las props.
export function SubscriptionBanner({ status, trialEndsAt }: SubscriptionBannerProps) {
  // Instanciamos el router para poder mandar al usuario a la pantalla de
  // suscripciones cuando pulse el botón.
  const router = useRouter();

  // ── CASO 1: período de prueba activo ──
  // Renderizado condicional clásico: si el estado es 'TRIAL', devolvemos el
  // banner de prueba y la función termina aquí (return temprano).
  if (status === 'TRIAL') {
    // Calculamos cuántos días faltan para que termine la prueba.
    //   - trialEndsAt ? ... : 0  → operador ternario: SI hay fecha, calcula;
    //     SI NO, usa 0.
    //   - new Date(trialEndsAt).getTime()  → fecha de fin en milisegundos.
    //   - Date.now()  → momento actual en milisegundos.
    //   - restamos y dividimos entre 86400000 (ms que tiene un día) → días.
    //   - Math.ceil redondea hacia arriba (2.1 días → 3).
    //   - Math.max(0, ...) evita números negativos si la fecha ya pasó.
    const daysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0;

    // "urgency" es true cuando quedan 3 días o menos: pintamos el banner en
    // rojo para llamar la atención.
    const urgency = daysLeft <= 3;

    // JSX: la sintaxis tipo HTML que React usa para describir la interfaz.
    // Las llaves { } dentro del JSX insertan valores/expresiones de JavaScript.
    return (
      // className con template string (comillas invertidas `...`): mezclamos
      // clases fijas con clases que cambian según "urgency". Esto pinta el
      // fondo rojo si es urgente, o teal si no lo es.
      <div className={`border-b px-4 py-2.5 ${urgency ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'}`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Ícono de reloj. El color también depende de "urgency". */}
            <svg className={`w-4 h-4 flex-shrink-0 ${urgency ? 'text-red-500' : 'text-teal-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className={`text-sm ${urgency ? 'text-red-800' : 'text-teal-800'}`}>
              <span className="font-semibold">Período de prueba de Siliba Business</span>
              {/* {' — '} inserta un guion literal con espacios (en JSX el texto
                  suelto se recorta, por eso lo ponemos como string). */}
              {' — '}
              {/* Ternario: si quedan días, mostramos el contador; si no,
                  mostramos el mensaje de vencido.
                  <>...</> es un "Fragment": agrupa elementos sin crear un <div>
                  extra en el HTML final. */}
              {daysLeft > 0
                ? <>Te quedan <span className="font-bold">{daysLeft} {daysLeft === 1 ? 'día' : 'días'}</span>.</>
                : <span className="font-semibold text-red-700">Tu período de prueba ha vencido.</span>
              }
            </p>
          </div>
          <button
            // onClick: evento que se dispara al pulsar el botón. La función
            // flecha () => ... lleva al usuario a la página de suscripciones.
            onClick={() => router.push('/settings?tab=suscripcion')}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              urgency
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-[#008080] text-white hover:bg-[#006666]'
            }`}
          >
            Ver suscripciones
          </button>
        </div>
      </div>
    );
  }

  // ── CASO 2: pago vencido (PAST_DUE) ──
  // Banner ámbar de aviso de pago pendiente. (Excepción al "no usar ámbar"
  // del proyecto: este banner es heredado.)
  if (status === 'PAST_DUE') {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Pago pendiente</span> — Tienes 24 horas para regularizar tu cuenta.
            Mientras tanto, no podrás crear o modificar citas.
          </p>
        </div>
      </div>
    );
  }

  // ── CASO 3: cualquier otro estado (ACTIVE, etc.) ──
  // Devolver null le dice a React "no pintes nada": el banner desaparece
  // cuando la suscripción está al día.
  return null;
}
