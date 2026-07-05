'use client'; // necesita el navegador (usa el hook useCurrency y mide tamaños).

import dayjs from 'dayjs';                                  // para leer el día de la semana de una fecha.
import { useCurrency } from '@/lib/hooks/use-currency';     // hook propio: da una función para formatear dinero.

// Etiquetas de los días, en el ORDEN que usa JS (0=Dom, 1=Lun ... 6=Sáb).
// Así DAY_LABELS[fecha.day()] devuelve el nombre corto correcto.
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─────────────────────────────────────────────────────────────────────────────
// Last7DaysChart: mini-gráfica de ingresos de los últimos 7 días. Dibuja una
// línea suave (sparkline en SVG) + barras por día con tooltip al pasar el ratón.
// PROP "days": arreglo de objetos { date, revenue } (fecha e ingreso de ese día).
// ─────────────────────────────────────────────────────────────────────────────
export function Last7DaysChart({ days }: { days: { date: string; revenue: number }[] }) {
  // Sacamos del hook la función "format" y la renombramos a "formatCurrency"
  // (sintaxis { format: formatCurrency } = renombrar al desestructurar).
  const { format: formatCurrency } = useCurrency();
  // INGRESO MÁXIMO de la semana, usado para escalar las barras (el más alto = 100%).
  // Math.max(...lista) recibe números sueltos; "..." (spread) expande el arreglo
  // en argumentos. El "1" final evita que el máximo sea 0 (no se puede dividir por 0).
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  // TOTAL de la semana: reduce suma el revenue de cada día partiendo de 0.
  const total = days.reduce((s, d) => s + d.revenue, 0);

  // Compara primera mitad vs segunda mitad para sacar tendencia.
  // half = mitad de la cantidad de días (Math.floor redondea hacia abajo).
  const half = Math.floor(days.length / 2);
  // slice(0, half) = primeros días; slice(half) = del medio en adelante.
  // Sumamos los ingresos de cada mitad por separado.
  const firstHalf = days.slice(0, half).reduce((s, d) => s + d.revenue, 0);
  const secondHalf = days.slice(half).reduce((s, d) => s + d.revenue, 0);
  // TENDENCIA en %: cuánto creció/cayó la segunda mitad respecto a la primera.
  // Si la primera mitad fue 0, no podemos dividir; entonces: si hay algo en la
  // segunda decimos +100%, si no, 0%. (ternario anidado dentro del ternario).
  // Si no, fórmula normal: (segunda - primera) / primera * 100, redondeado.
  const trend = firstHalf === 0
    ? (secondHalf > 0 ? 100 : 0)
    : Math.round(((secondHalf - firstHalf) / firstHalf) * 100);

  // SVG sparkline con gradiente teal.
  // Trabajamos en un "lienzo virtual" de 100x30 unidades (pad = margen interno).
  const pad = 8;
  const W = 100; // ancho del lienzo.
  const H = 30;  // alto del lienzo.
  // xs = posición horizontal de cada punto. (_, i): ignoramos el día, usamos el
  // índice i para repartir los puntos uniformemente a lo ancho.
  const xs = days.map((_, i) => pad + (i * (W - pad * 2)) / Math.max(days.length - 1, 1));
  // ys = posición vertical: a más ingreso, más arriba. En SVG "y" crece hacia
  // ABAJO, por eso restamos desde H (invertimos para que lo alto quede arriba).
  const ys = days.map((d) => H - pad - ((d.revenue / maxRevenue) * (H - pad * 2)));
  // pathD = el comando de dibujo de la línea SVG. "M x y" = mover al primer punto;
  // luego por cada día siguiente "L x y" = trazar línea hasta ese punto. join(' ')
  // une todos los tramos en un solo texto. Si no hay días, queda cadena vacía.
  const pathD = days.length > 0
    ? `M ${xs[0]} ${ys[0]} ` + days.slice(1).map((_, i) => `L ${xs[i + 1]} ${ys[i + 1]}`).join(' ')
    : '';
  // areaD = el mismo trazo pero CERRADO hacia abajo para rellenar el área bajo la
  // línea con el degradado. "L ... H" baja al borde inferior y "Z" cierra la forma.
  const areaD = pathD ? `${pathD} L ${xs[xs.length - 1]} ${H} L ${xs[0]} ${H} Z` : '';

  return (
    <div
      className="rounded-[22px] shadow-soft p-5 overflow-hidden min-w-0"
      style={{ backgroundColor: 'var(--soft-card)', border: '1px solid var(--soft-border)' }}
    >
      <div className="flex items-start justify-between mb-3 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
            Ingresos · últimos 7 días
          </p>
          {/* Total de la semana ya formateado como dinero (ej. "$1.234"). */}
          <p className="text-2xl font-extrabold mt-1 truncate" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(total)}
          </p>
          {/* Mostramos la tendencia SOLO si no es 0 (&& evita pintar "0%").
              Flecha ↑ y color verde si subió; ↓ y rojo si bajó.
              Math.abs(trend) = valor absoluto (sin signo), porque el signo ya lo
              indica la flecha y el color. */}
          {trend !== 0 && (
            <p className={`text-xs font-semibold mt-0.5 truncate ${trend > 0 ? 'text-success-700' : 'text-danger-700'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs inicio de semana
            </p>
          )}
        </div>
      </div>

      {/* Sparkline (la línea suave). viewBox define el sistema de coordenadas
          0..W por 0..H que usamos arriba para calcular xs/ys. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 -mb-2" preserveAspectRatio="none">
        {/* <defs> guarda definiciones reutilizables; aquí el degradado teal que
            va de semitransparente arriba a transparente abajo. */}
        <defs>
          <linearGradient id="last7-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#008080" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#008080" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* areaD && ... : pinta el relleno bajo la línea solo si areaD no está vacío. */}
        {areaD && <path d={areaD} fill="url(#last7-gradient)" />}
        {/* pathD && ... : pinta la línea en sí (sin relleno, solo borde teal). */}
        {pathD && <path d={pathD} fill="none" stroke="#008080" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>

      {/* Barras compactas con tooltip on hover */}
      <div className="flex items-end justify-between gap-1 h-28 mt-2">
        {/* Una barra por día. */}
        {days.map((day) => {
          // pct = altura de la barra en %, relativa al día de mayor ingreso.
          const pct = (day.revenue / maxRevenue) * 100;
          // Nombre corto del día: dayjs(fecha).day() da 0..6, lo usamos de índice.
          const dayLabel = DAY_LABELS[dayjs(day.date).day()];
          return (
            // key = la fecha (única por día). "group" permite que el tooltip
            // reaccione al hover de TODA esta columna (group-hover).
            <div key={day.date} className="flex-1 min-w-0 flex flex-col items-center group relative">
              {/* Tooltip absolute: no afecta el ancho de la columna */}
              <span
                className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none px-1.5 py-0.5 rounded shadow-sm z-10 border"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                {/* El tooltip muestra el ingreso exacto de ese día. */}
                {formatCurrency(day.revenue)}
              </span>
              {/* Carril fijo donde "cuelga" la barra desde abajo (items-end). */}
              <div className="w-full flex items-end" style={{ height: '76px' }}>
                {/* La barra. Su altura es pct% pero con un mínimo de 2% para que
                    los días sin ingresos sigan mostrando un finito visible.
                    Color teal si hubo ingresos; gris (color de borde) si fue 0. */}
                <div
                  className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    backgroundColor: day.revenue > 0 ? '#008080' : 'var(--border)',
                    opacity: day.revenue > 0 ? 0.85 : 1,
                  }}
                />
              </div>
              {/* Etiqueta del día bajo la barra (Lun, Mar...). */}
              <span className="text-[11px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>{dayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
