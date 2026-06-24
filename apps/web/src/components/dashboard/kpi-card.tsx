// ─────────────────────────────────────────────────────────────────────────────
// KpiCard: tarjeta pequeña que muestra UN indicador clave (KPI) del negocio.
// Ejemplos: "Citas hoy: 12", "Ingresos hoy: $1.200". Se usa varias veces en
// el dashboard, cambiando solo las props que recibe.
//
// CONCEPTO REACT — COMPONENTE Y PROPS:
//   Un "componente" es una función que devuelve JSX (la mezcla de HTML + JS que
//   describe la pantalla). Las "props" son los datos que el componente padre le
//   pasa, igual que los argumentos de una función. Aquí las props llegan ya
//   "desestructuradas": en vez de recibir un objeto "props" y leer props.icon,
//   sacamos directamente { icon, label, value, ... } entre llaves.
// ─────────────────────────────────────────────────────────────────────────────
export function KpiCard({
  // ── PROPS QUE RECIBE ESTA TARJETA ──
  icon,     // icono a mostrar (un <svg>); React.ReactNode = "cualquier cosa pintable".
  label,    // texto del título pequeño en mayúsculas (ej. "CITAS HOY").
  value,    // el número/valor grande y destacado (ej. "12" o "$1.200").
  subtitle, // texto opcional bajo el valor; el "?" en el tipo lo marca opcional.
  trend,    // texto opcional de tendencia (ej. "+18% vs mes anterior").
  onClick,  // función opcional: si existe, la tarjeta se vuelve clicable.
}: {
  // ── TIPOS DE CADA PROP (TypeScript: describe qué forma tiene cada dato) ──
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subtitle?: string; // el "?" = opcional, puede no venir.
  /** Texto pequeño tipo "+18% vs mes anterior". Positivo si empieza con "+", negativo con "-". */
  trend?: string;
  onClick?: () => void; // función que no recibe nada y no devuelve nada.
}) {
  // ── VARIABLES CALCULADAS antes del render ──
  // trend?.trim() usa el "optional chaining" (?.): si "trend" es undefined NO
  // explota, simplemente da undefined. .trim() quita espacios sobrantes.
  // .startsWith('+') devuelve true si el texto empieza con "+" (tendencia buena).
  const trendPositive = trend?.trim().startsWith('+');
  // Igual pero para "-" (tendencia mala, se pinta en rojo).
  const trendNegative = trend?.trim().startsWith('-');
  // "!!onClick" convierte el valor a booleano puro: si onClick existe -> true,
  // si es undefined -> false. interactive nos dice si la tarjeta es clicable.
  const interactive = !!onClick;
  // A partir de aquí devolvemos el JSX que se verá en pantalla.
  return (
    // Contenedor principal de la tarjeta.
    // onClick={onClick}: al hacer click ejecuta la función recibida (si vino).
    //   Si onClick es undefined, React simplemente no hace nada al clicar.
    // className usa un "template string" (comillas invertidas `...`) para mezclar
    //   clases fijas + clases que dependen de "interactive": el ternario
    //   "interactive ? 'cursor-pointer...' : ''" añade cursor de mano y hover SOLO
    //   si la tarjeta es clicable; si no, agrega cadena vacía (nada).
    // style={{...}}: estilos en línea usando variables CSS del tema (colores que
    //   cambian con modo claro/oscuro).
    <div
      onClick={onClick}
      className={`rounded-xl p-3 md:p-5 flex items-start gap-2.5 md:gap-3 overflow-hidden ${interactive ? 'cursor-pointer transition-colors hover:bg-[var(--bg-muted)]' : ''}`}
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {/* Cuadrito de color que contiene el icono a la izquierda. */}
      <div
        className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: 'var(--primary-tint)', color: 'var(--primary-tint-fg)' }}
      >
        {/* {icon} inserta el SVG recibido por props dentro del cuadrito. */}
        {icon}
      </div>
      {/* Columna derecha con el texto. min-w-0 + flex-1 deja que el texto se
          encoja y se trunque sin desbordar la tarjeta. */}
      <div className="min-w-0 flex-1">
        {/* Etiqueta pequeña en mayúsculas. truncate = corta con "..." si no cabe. */}
        <p
          className="text-[10px] md:text-[11px] uppercase tracking-wide font-semibold truncate"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </p>
        {/* El valor grande y destacado (el dato principal de la tarjeta). */}
        <p
          className="text-base md:text-xl font-extrabold leading-tight mt-0.5 tabular-nums break-words"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}
        >
          {value}
        </p>
        {/* RENDERIZADO CONDICIONAL con "&&": si "trend" tiene texto (es "truthy")
            se pinta el <p>; si es undefined/"" no se pinta nada.
            El className usa ternarios ANIDADOS para elegir color:
              verde si positivo, rojo si negativo, y si no, ninguna clase.
            El style aplica color gris SOLO cuando no es ni positivo ni negativo
            (cuando lo es, el color ya viene de la clase). undefined = "sin estilo". */}
        {trend && (
          <p
            className={`text-[11px] font-semibold mt-1 truncate ${trendPositive ? 'text-success-700' : trendNegative ? 'text-danger-700' : ''}`}
            style={!trendPositive && !trendNegative ? { color: 'var(--text-muted)' } : undefined}
          >
            {trend}
          </p>
        )}
        {/* Si NO hay trend pero SÍ hay subtitle, mostramos el subtítulo en su lugar.
            "!trend && subtitle &&" = solo se pinta cuando ambas condiciones se cumplen. */}
        {!trend && subtitle && (
          <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
