'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ detail-sheet.tsx                                                        │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Implementa el patrón oficial de "bottom sheet" (panel deslizante desde  │
// │ abajo) de la plataforma Siliba. Es adaptativo:                          │
// │                                                                         │
// │  - En MÓVIL: aparece desde la parte inferior de la pantalla, ancho     │
// │    completo, esquinas superiores redondeadas. (Patrón nativo de iOS/   │
// │    Android muy familiar para los usuarios móviles)                      │
// │                                                                         │
// │  - En ESCRITORIO: se centra como un modal tradicional con ancho máximo  │
// │    configurable y todas las esquinas redondeadas.                        │
// │                                                                         │
// │ Se usa para mostrar detalles de entidades: citas, ventas, productos,    │
// │ clientes, etc. Siempre tiene el mismo aspecto visual (borde teal).     │
// │                                                                         │
// │ Props:                                                                   │
// │  - title: texto del encabezado                                          │
// │  - subtitle: texto secundario pequeño (opcional)                        │
// │  - children: cualquier contenido que se inyecte dentro del panel        │
// │  - footer: contenido fijo al pie del panel (botones de acción, etc.)   │
// │  - size: ancho máximo en escritorio ('sm' | 'md' | 'lg' | 'xl')       │
// │  - onClose: función a llamar cuando el usuario cierra el panel          │
// │                                                                         │
// │ Cierre: click en el overlay oscuro, click en la X, o tecla ESC.        │
// └─────────────────────────────────────────────────────────────────────────┘

// useEffect: para registrar el listener de la tecla ESC
// ReactNode: tipo de TypeScript que representa cualquier cosa que React puede renderizar
// (texto, elementos JSX, arrays, null, etc.)
import { useEffect, type ReactNode } from 'react';

// ─── INTERFAZ DE PROPS ───────────────────────────────────────────────────────
interface DetailSheetProps {
  title: string;             // Título principal del panel (en el header)
  onClose: () => void;       // Función a llamar para cerrar el panel
  children: ReactNode;       // Contenido del cuerpo del panel (cualquier JSX)
  footer?: ReactNode;        // Contenido del pie del panel (opcional, ej. botones)
  /** Ancho máximo en desktop. `md` = max-w-md (default), `sm` = max-w-sm,
   * `lg` = max-w-lg, `xl` = max-w-2xl. */
  size?: 'sm' | 'md' | 'lg' | 'xl'; // Tamaño del panel en escritorio
  /** Subtítulo opcional debajo del título, en gris pequeño. */
  subtitle?: string;         // Texto secundario debajo del título
}

/**
 * Patrón oficial de detalle de la plataforma: bottom sheet adaptativo.
 *
 * Mobile: ocupa todo el ancho y aparece desde abajo con esquinas superiores
 *   redondeadas (`items-end` + `rounded-t-2xl`).
 * Desktop: se centra y limita su ancho (`md:items-center` + `md:max-w-md` +
 *   `md:rounded-2xl`).
 *
 * Identidad visual:
 *  - Borde teal 2px (`#008080`).
 *  - Header sticky con título + botón cerrar blanco con sombra pronunciada
 *    y icono X teal con trazo grueso (queda legible sobre cualquier fondo).
 *  - Cuerpo scroleable hasta 90vh.
 *  - Footer opcional fijo abajo con separador.
 *
 * Cierre: click en el overlay o en la X. Click en el contenido no propaga.
 * Tecla ESC también cierra.
 *
 * Úsalo para detalle de entidades (venta, cita, producto, etc.) en lugar
 * de inventar variantes propias.
 */
export function DetailSheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md', // Ancho por defecto: md (max-w-md ≈ 448px)
}: DetailSheetProps) {

  // ─── EFECTO: Cerrar con la tecla ESC ─────────────────────────────────────
  // ESC para cerrar — comportamiento estándar de cualquier diálogo.
  useEffect(() => {
    // Definimos el manejador del evento de teclado
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(); // Si la tecla es ESC, llamamos a onClose
    };

    // Registramos el listener en el objeto window (escucha TODAS las teclas)
    window.addEventListener('keydown', handler);

    // Limpieza: eliminamos el listener cuando el componente se desmonta
    // o cuando onClose cambia (para evitar closures stale)
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]); // Dependencia: si onClose cambia, re-registramos el listener

  // ─── CLASE DE ANCHO MÁXIMO EN ESCRITORIO ─────────────────────────────────
  // Determinamos la clase de Tailwind para el ancho máximo según la prop "size".
  // Las clases "md:" aplican solo en pantallas medianas (≥768px).
  const widthClass =
    size === 'sm'
      ? 'md:max-w-sm'   // max-w-sm ≈ 384px
      : size === 'lg'
        ? 'md:max-w-lg' // max-w-lg ≈ 512px
        : size === 'xl'
          ? 'md:max-w-2xl' // max-w-2xl ≈ 672px
          : 'md:max-w-md'; // Default: max-w-md ≈ 448px

  // ─── JSX PRINCIPAL ────────────────────────────────────────────────────────
  return (
    // ── OVERLAY OSCURO ────────────────────────────────────────────────────
    // fixed inset-0: cubre toda la pantalla de forma fija (no se mueve con scroll)
    // z-50: encima de casi todo el contenido de la página
    // bg-black/40: fondo negro con 40% de opacidad (semitransparente)
    // items-end: alinea el panel en la parte inferior (para móvil = bottom sheet)
    // md:items-center: en escritorio lo centra verticalmente
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose} // Click en el overlay (fuera del panel) cierra el sheet
    >
      {/* ── PANEL DEL SHEET ─────────────────────────────────────────────── */}
      {/* w-full: ancho completo (en móvil ocupa toda la pantalla de ancho) */}
      {/* rounded-t-2xl: solo las esquinas superiores en móvil */}
      {/* md:rounded-2xl: todas las esquinas en escritorio */}
      {/* max-h-[90vh]: el panel nunca supera el 90% de la altura de pantalla */}
      {/* flex flex-col: header + body + footer en columna */}
      {/* border-2: borde de 2px con el color teal (estilo de la plataforma) */}
      <div
        className={`bg-white w-full ${widthClass} md:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col border-2`}
        style={{ borderColor: '#008080' }} // Borde teal de la identidad visual
        onClick={(e) => e.stopPropagation()} // Evita que el click dentro propague al overlay
      >
        {/* ── HEADER (encabezado fijo) ───────────────────────────────────── */}
        {/* flex-shrink-0: el header nunca se encoge, siempre visible arriba */}
        {/* gap-3: espacio entre el título y el botón de cerrar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          {/* Área del título (ocupa todo el espacio disponible) */}
          <div className="min-w-0 flex-1">
            {/* truncate: si el título es muy largo, lo corta con "..." */}
            <h3 className="text-sm font-semibold text-gray-900 truncate">{title}</h3>
            {/* Subtítulo: solo se renderiza si la prop "subtitle" existe */}
            {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
          </div>

          {/* Botón de cerrar (X) */}
          {/* ring-1 ring-black/5: sombra de anillo muy sutil */}
          {/* hover:scale-105: se agranda ligeramente al pasar el mouse */}
          {/* flex-shrink-0: el botón no se encoge aunque el título sea largo */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center ring-1 ring-black/5 hover:scale-105 transition-transform flex-shrink-0"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} // Sombra personalizada (más pronunciada)
            aria-label="Cerrar" // Accesibilidad: texto alternativo para lectores de pantalla
          >
            {/* Ícono "X" para cerrar */}
            <svg
              className="w-5 h-5"
              style={{ color: '#008080' }} // Color teal del ícono
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5} // Trazo más grueso para mejor visibilidad
            >
              {/* Dos líneas que forman la "X": de esquina a esquina */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── BODY (cuerpo desplazable) ─────────────────────────────────── */}
        {/* flex-1: ocupa todo el espacio vertical disponible entre header y footer */}
        {/* overflow-y-auto: añade scroll vertical si el contenido es muy largo */}
        {/* p-5: padding de 20px en todos los lados */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {/* children: aquí se renderiza todo lo que el padre pase dentro del componente */}

        {/* ── FOOTER (pie fijo, opcional) ───────────────────────────────── */}
        {/* Solo se renderiza si la prop "footer" no es undefined/null */}
        {footer && (
          // flex-shrink-0: el footer nunca se encoge, siempre visible abajo
          // bg-white: fondo blanco explícito (por si el body tiene scroll)
          <div className="border-t border-gray-100 bg-white p-4 flex-shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}
