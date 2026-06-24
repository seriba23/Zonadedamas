// ─────────────────────────────────────────────────────────────────────────────
// AppointmentSuccessSheet — pantalla de "¡Reserva confirmada!" con confeti.
//
// CONCEPTOS DE REACT QUE APARECEN AQUÍ:
// - 'use client': directiva de Next.js 14. Marca este archivo como Componente
//   de Cliente, es decir, que corre en el NAVEGADOR (puede usar estado, eventos,
//   etc.). Sin ella sería un Componente de Servidor y no podría usar useState.
// - useState: "hook" que da memoria al componente. Devuelve [valor, funciónParaCambiarlo].
//   Cuando cambias el valor, React vuelve a pintar el componente.
// - Props con valor por defecto: `primaryLabel = 'Aceptar'` usa 'Aceptar' si el
//   padre no pasa nada.
// - Renderizado condicional con && y con el operador ternario (cond ? a : b).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

// useState: el único hook que usa este archivo (memoria del componente).
import { useState } from 'react';
// dayjs: librería ligera para formatear fechas (ej. "17 de jun de 2026").
import dayjs from 'dayjs';
// useCurrency: hook propio que devuelve una función para formatear dinero según
// la moneda configurada del negocio (ej. $ 350.00).
import { useCurrency } from '@/lib/hooks/use-currency';
// ConfettiCelebration: componente que lanza la animación de confeti.
import { ConfettiCelebration } from '@/components/ui/confetti-celebration';

// Constantes de color reutilizadas (teal = verde azulado, color principal).
const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';
// URL base de la API; si la variable de entorno no existe usa localhost.
// El operador `||` significa "usa lo de la izquierda salvo que sea falsy
// (vacío/undefined), en cuyo caso usa lo de la derecha".
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Forma de cada servicio que se mostrará en el resumen de la reserva.
interface SuccessService {
  id: string;            // Identificador único del servicio.
  name: string;          // Nombre visible (ej. "Corte de cabello").
  price: number;         // Precio del servicio.
  employeeName?: string; // Profesional asignado (opcional: el "?" lo hace opcional).
}

interface AppointmentSuccessSheetProps {
  /** Nombre del negocio. En el flujo del cliente se muestra; en el admin se
   * puede omitir o pasar el del tenant actual. */
  businessName?: string;
  /** Servicios contratados (nombre, precio y opcional empleado por servicio). */
  services: SuccessService[];
  /** ISO string del inicio de la cita. */
  startTime: string;
  /** Nombre completo del profesional principal (si hay uno solo). */
  employeeName?: string;
  /** Total de la cita en la moneda actual. */
  total: number;
  /** Puntos ganados con la reserva. Si null/0 no se muestra. */
  pointsEarned?: number;
  /** Texto del botón primario. Default "Aceptar". */
  primaryLabel?: string;
  /** Texto del botón secundario. Si null no se muestra. */
  secondaryLabel?: string;
  /** Callback del botón primario. */
  onPrimary: () => void;
  /** Callback del botón secundario. Opcional. */
  onSecondary?: () => void;
  /** Si el tenant deshabilitó la animación de confeti, pásalo como false. */
  confettiEnabled?: boolean;
  /** Lista de figuras (hasta 3, se mezclan). */
  confettiShapes?: string[] | null;
  /** Legacy: figura única. */
  confettiShape?: string | null;
  /** Paleta de colores del confeti (hasta 4 hex). */
  confettiColors?: string[] | null;
}

/**
 * Pantalla de éxito tras reservar/crear cita. Estilo unificado para
 * cliente del marketplace y admin del dashboard, basado en la card que
 * usaba el flujo del cliente (negocio + servicios + horario + profesional
 * + total + puntos). Disparа confeti corto (5s, partículas reducidas).
 *
 * QUÉ MUESTRA: un modal centrado (overlay oscuro detrás) con un check verde,
 *   el resumen de la cita y uno o dos botones de acción.
 * QUÉ RECIBE: ver AppointmentSuccessSheetProps (servicios, fecha, total, etc.).
 * QUÉ HACE: lanza confeti una sola vez y, al pulsar el botón, ejecuta la
 *   función onPrimary/onSecondary que le pasó el componente padre.
 */
export function AppointmentSuccessSheet({
  // Desestructuramos todas las props. Las que tienen "=" usan ese valor por
  // defecto cuando el padre no las pasa.
  businessName,
  services,
  startTime,
  employeeName,
  total,
  pointsEarned,
  primaryLabel = 'Aceptar', // Texto por defecto del botón principal.
  secondaryLabel,
  onPrimary,                 // Función que se ejecuta al pulsar el botón principal.
  onSecondary,
  confettiEnabled = true,    // Por defecto el confeti está activado.
  confettiShapes,
  confettiShape,
  confettiColors,
}: AppointmentSuccessSheetProps) {
  // useCurrency devuelve un objeto; con `{ format: formatCurrency }` sacamos su
  // campo `format` y lo renombramos a `formatCurrency` para mayor claridad.
  const { format: formatCurrency } = useCurrency();
  // Estado booleano: ¿ya terminó el confeti? Empieza en false (aún no terminó).
  // setConfettiDone es la función para cambiarlo; al ponerlo en true ocultamos
  // la animación pero el modal sigue visible.
  const [confettiDone, setConfettiDone] = useState(false);

  return (
    // <> ... </> es un "Fragment": agrupa varios elementos sin añadir un <div>
    // extra al HTML. JSX obliga a devolver un único elemento raíz; el Fragment
    // cumple ese requisito sin ensuciar el árbol.
    <>
      {/* Renderizado condicional con &&: si `confettiEnabled` es true se pinta
          el confeti; si es false, React no pinta nada (el && corta la evaluación). */}
      {confettiEnabled && (
        <ConfettiCelebration
          show={!confettiDone}            // Mostrar mientras NO haya terminado (el ! invierte el booleano).
          duration={5000}                 // Duración 5 segundos.
          particlesPerBurst={20}          // Cantidad de partículas por estallido.
          shapes={confettiShapes}         // Figuras posibles (puede ser null).
          shape={confettiShape}           // Figura única legacy (compatibilidad).
          colors={confettiColors}         // Paleta de colores.
          onComplete={() => setConfettiDone(true)} // Al acabar, marcamos como terminado.
        />
      )}

      {/* Capa que cubre toda la pantalla (fixed inset-0) con fondo negro al 40%
          de opacidad (bg-black/40). En móvil el modal se pega abajo (items-end)
          y en pantallas medianas se centra (md:items-center). */}
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center px-4">
        {/* La tarjeta blanca del modal. animate-bounce-in le da el efecto de
            aparición con rebote. */}
        <div
          className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col border-2 animate-bounce-in"
          style={{ borderColor: TEAL }}
        >
          {/* Header con check */}
          <div className="px-6 pt-6 pb-3 text-center">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: TEAL_LIGHT }}
            >
              <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Reserva confirmada</h2>
            <p className="text-sm text-gray-500 mt-1">
              Tu cita ha sido reservada exitosamente.
            </p>
          </div>

          {/* Detalle: filas con la info de la cita. overflow-y-auto permite
              hacer scroll si el contenido no cabe. space-y-3 separa cada fila. */}
          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
            {/* Solo mostramos el negocio si nos pasaron businessName (&&). */}
            {businessName && (
              <Row label="Negocio" value={businessName} />
            )}

            <Row
              // Ternario: si hay exactamente 1 servicio la etiqueta es singular
              // ("Servicio"); si hay más de uno, plural ("Servicios").
              label={services.length === 1 ? 'Servicio' : 'Servicios'}
              // .map(s => s.name) transforma la lista de servicios en una lista
              // de SOLO sus nombres; .join(', ') los une separados por coma.
              value={services.map((s) => s.name).join(', ')}
            />

            <Row
              label="Fecha y hora"
              // dayjs.utc interpreta la fecha como UTC (sin desfase de zona) y
              // .format(...) la convierte a texto legible. Lo que va entre
              // corchetes [de] son palabras literales que no se interpretan.
              value={dayjs.utc(startTime).format('D [de] MMM [de] YYYY, h:mm A')}
            />

            {/* Profesional solo si nos lo pasaron. */}
            {employeeName && (
              <Row label="Profesional" value={employeeName} />
            )}

            {/* `valueBold` (sin valor) equivale a valueBold={true}: pone el total en negrita. */}
            <Row label="Total" value={formatCurrency(total)} valueBold />

            {/* Bloque de puntos ganados. Doble condición:
                - pointsEarned != null  → existe (no es null ni undefined).
                - pointsEarned > 0      → es mayor que cero.
                Si ambas se cumplen, se muestra. */}
            {pointsEarned != null && pointsEarned > 0 && (
              <div
                className="rounded-xl p-3 flex items-center justify-between"
                style={{ backgroundColor: TEAL_LIGHT }}
              >
                <span className="text-xs font-medium" style={{ color: TEAL }}>
                  Puntos ganados
                </span>
                <span className="text-sm font-bold" style={{ color: TEAL }}>
                  +{pointsEarned} pts
                </span>
              </div>
            )}
          </div>

          {/* Acciones: botones al pie del modal. */}
          <div className="border-t border-gray-100 p-4 space-y-2">
            {/* Botón principal. onClick recibe la función `onPrimary` que vino
                por props; React la ejecutará cuando el usuario haga clic. */}
            <button
              onClick={onPrimary}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: TEAL }}
            >
              {primaryLabel}
            </button>
            {/* Botón secundario opcional: solo se pinta si nos dieron AMBOS, la
                etiqueta y la función de clic (secondaryLabel && onSecondary). */}
            {secondaryLabel && onSecondary && (
              <button
                onClick={onSecondary}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Row — pequeño componente auxiliar reutilizable: muestra una etiqueta gris
// arriba (ej. "Total") y un valor debajo (ej. "$350.00"). Recibe la forma de
// las props directamente "en línea" en vez de declarar una interface aparte.
function Row({ label, value, valueBold }: { label: string; value: string; valueBold?: boolean }) {
  return (
    <div>
      {/* Etiqueta pequeña en mayúsculas. */}
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      {/* Valor. El `${...}` dentro de las comillas invertidas (template string)
          añade la clase 'font-bold' SOLO si valueBold es verdadero; si no, añade
          cadena vacía. Así el mismo componente sirve para texto normal o negrita. */}
      <p className={`text-sm text-gray-900 mt-0.5 ${valueBold ? 'font-bold' : ''}`}>
        {value}
      </p>
    </div>
  );
}
