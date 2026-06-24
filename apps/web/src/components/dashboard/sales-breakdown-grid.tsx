'use client'; // usa hooks (useQuery, useCurrency) -> debe correr en el navegador.

import { useQuery } from '@tanstack/react-query'; // hook para pedir datos al backend.
import { api } from '@/lib/api';                  // cliente HTTP propio.
import { useCurrency } from '@/lib/hooks/use-currency'; // formateo de dinero.

// "interface" describe la FORMA de un objeto en TypeScript: aquí, el desglose
// de ventas que devuelve el backend. Sirve para que el editor avise si usamos
// un campo que no existe. No genera código en tiempo de ejecución.
interface SalesBreakdown {
  total: number;     // venta total del período.
  services: number;  // parte que vino de servicios.
  bundles: number;   // parte que vino de paquetes.
  products: number;  // parte que vino de productos.
}

/**
 * Grid "Venta Total" — 4 cards: Total | Servicios | Paquetes | Productos.
 *
 * Usado en /reports, /home y /pos history. El rango lo controla el padre y
 * se pasa por props para reutilizar el mismo endpoint con el período activo
 * en cada vista (selector de Reports, mes en Home, filtro POS).
 */
export function SalesBreakdownGrid({
  // ── PROPS ──
  startDate,    // fecha inicio del rango a consultar (texto "YYYY-MM-DD").
  endDate,      // fecha fin del rango.
  periodLabel,  // texto opcional para el card Total.
}: {
  startDate: string;
  endDate: string;
  /** Texto pequeño en el card Total (ej: "Este mes", "Hoy"). */
  periodLabel?: string;
}) {
  const { format: formatCurrency } = useCurrency();

  // Pedimos el desglose al backend. La queryKey incluye las fechas: si cambian,
  // react-query detecta que es otra consulta y vuelve a pedir los datos.
  // "isLoading" es true mientras la petición está en curso (para mostrar skeletons).
  const { data, isLoading } = useQuery({
    queryKey: ['sales-breakdown', startDate, endDate],
    queryFn: () =>
      api.get<{ data: SalesBreakdown }>(
        `/api/reports/sales-breakdown?startDate=${startDate}&endDate=${endDate}`,
      ),
  });

  // breakdown = los datos recibidos. El operador "??" (nullish coalescing) usa el
  // objeto de ceros SOLO si data?.data es null o undefined (aún no cargó). A
  // diferencia de "||", el "??" NO reemplaza valores como 0 o "" (que son válidos).
  const breakdown = data?.data ?? { total: 0, services: 0, bundles: 0, products: 0 };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* Card destacado — Venta Total */}
      <div
        className="rounded-xl p-3 md:p-5 overflow-hidden text-white"
        style={{ backgroundColor: '#008080' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 md:w-4.5 md:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[10px] md:text-[11px] uppercase tracking-wide font-semibold opacity-90 truncate">
            Venta Total
          </p>
        </div>
        {/* Si está cargando mostramos un "skeleton" (barra gris que pulsa);
            si ya hay datos, el total formateado como dinero. */}
        <p className="text-lg md:text-2xl font-extrabold leading-tight tabular-nums break-words" style={{ letterSpacing: '-0.015em' }}>
          {isLoading ? <span className="inline-block h-6 w-24 bg-white/20 rounded animate-pulse" /> : formatCurrency(breakdown.total)}
        </p>
        {/* periodLabel && ... : el subtítulo solo aparece si vino esa prop. */}
        {periodLabel && (
          <p className="text-[10px] md:text-[11px] mt-1 opacity-80 truncate">{periodLabel}</p>
        )}
      </div>

      {/* Las otras 3 cards reutilizan el mismo subcomponente BreakdownCell,
          pasándole por props su etiqueta, su valor y su icono. */}
      <BreakdownCell
        label="Servicios"
        value={breakdown.services}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
        iconPath="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
        iconExtra="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
      <BreakdownCell
        label="Paquetes"
        value={breakdown.bundles}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
        iconPath="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
      <BreakdownCell
        label="Productos"
        value={breakdown.products}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
        iconPath="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BreakdownCell: subcomponente reutilizable para cada una de las 3 cards
// secundarias (Servicios / Paquetes / Productos). Recibe todo por props, así
// evitamos repetir el mismo JSX tres veces.
// ─────────────────────────────────────────────────────────────────────────────
function BreakdownCell({
  label,          // título de la card.
  value,          // monto a mostrar.
  isLoading,      // si true, muestra skeleton en vez del monto.
  formatCurrency, // función para formatear el monto como dinero (viene del padre).
  iconPath,       // trazo principal del icono SVG.
  iconExtra,      // trazo extra opcional del icono.
}: {
  label: string;
  value: number;
  isLoading: boolean;
  formatCurrency: (n: number) => string; // tipo: función que recibe número y da texto.
  iconPath: string;
  iconExtra?: string;
}) {
  return (
    <div
      className="rounded-xl p-3 md:p-5 overflow-hidden"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--primary-tint)', color: 'var(--primary-tint-fg)' }}
        >
          <svg className="w-4 h-4 md:w-4.5 md:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            {/* Trazo principal del icono (d = el "dibujo" recibido por props). */}
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
            {/* Segundo trazo solo si la prop iconExtra existe (&&). */}
            {iconExtra && <path strokeLinecap="round" strokeLinejoin="round" d={iconExtra} />}
          </svg>
        </div>
        <p className="text-[10px] md:text-[11px] uppercase tracking-wide font-semibold truncate" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>
      {/* Igual que en el card Total: skeleton mientras carga, valor cuando llega. */}
      <p className="text-base md:text-xl font-extrabold leading-tight tabular-nums break-words" style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>
        {isLoading ? <span className="inline-block h-6 w-20 bg-[var(--border)] rounded animate-pulse" /> : formatCurrency(value)}
      </p>
    </div>
  );
}
