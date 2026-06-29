'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ dual-review-modal.tsx                                                   │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Modal para dejar dos calificaciones al mismo tiempo después de una       │
// │ cita completada:                                                         │
// │  1. Rating del PROFESIONAL (empleado que atendió) → OBLIGATORIO         │
// │  2. Rating del NEGOCIO (donde fue atendido) → OPCIONAL (solo en modo   │
// │     'business'; en modo 'freelancer' no aplica porque no hay negocio)   │
// │                                                                         │
// │ Cada calificación incluye:                                               │
// │  - Estrellas (1 a 5) con hover interactivo                              │
// │  - Textarea para comentario opcional (visible solo si hay rating)       │
// │                                                                         │
// │ El componente exporta dos piezas:                                        │
// │  - StarRating: componente interno reutilizable para las estrellas        │
// │  - DualReviewModal: el modal completo                                    │
// └─────────────────────────────────────────────────────────────────────────┘

// useState: necesario para rastrear el estado local (ratings, comentarios, hover)
import { useState } from 'react';

// Color teal de la identidad visual de la plataforma
const TEAL = '#008080';

// ══════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTE: StarRating
// Muestra 5 estrellas interactivas. El usuario puede hacer hover y click.
// ══════════════════════════════════════════════════════════════════════════════

// Interfaz de props del subcomponente StarRating
interface StarRatingProps {
  value: number;              // Calificación actual (0 = sin calificar, 1-5 = estrellas)
  onChange: (v: number) => void; // Callback cuando el usuario hace click en una estrella
}

// StarRating: componente de función (no exportado; solo se usa internamente)
function StarRating({ value, onChange }: StarRatingProps) {
  // hovered: qué estrella está el mouse encima ahora mismo (0 = ninguna)
  const [hovered, setHovered] = useState(0);

  return (
    // flex gap-1: las 5 estrellas en fila con separación pequeña
    <div className="flex gap-1">
      {/* [1, 2, 3, 4, 5].map: generamos un botón por cada estrella */}
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star} // Clave única requerida por React en listas
          type="button"
          onClick={() => onChange(star)} // Al clickear, seleccionamos esa estrella
          onMouseEnter={() => setHovered(star)}   // Al entrar el mouse, marcamos el hover
          onMouseLeave={() => setHovered(0)}      // Al salir el mouse, quitamos el hover
          className="transition-transform active:scale-110"
          // active:scale-110: al hacer click, la estrella se agranda ligeramente
        >
          <svg
            className="w-8 h-8"
            // LÓGICA DE COLOR: usamos "hovered || value" como referencia
            // hovered || value: si hay hover usa hovered; si no hay hover usa value
            // Si ese número es >= star, la estrella va rellena (amarillo)
            // Si es < star, la estrella va vacía (solo contorno gris)
            fill={(hovered || value) >= star ? '#f59e0b' : 'none'}
            stroke={(hovered || value) >= star ? '#f59e0b' : '#d1d5db'}
            // #f59e0b = amarillo ámbar (color de estrellas). #d1d5db = gris claro
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            {/* Path SVG que dibuja la forma de estrella de 5 puntas */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: DualReviewModal
// ══════════════════════════════════════════════════════════════════════════════

// Interfaz de props del modal
interface DualReviewModalProps {
  show: boolean;              // true = mostrar el modal, false = ocultar
  /** Nombre del profesional que dio el servicio. */
  employeeName: string;       // Para mostrar "Califica al profesional (Juan)"
  /** Nombre del negocio (ignorado si mode='freelancer' — ahí no hay negocio). */
  businessName: string;       // Para mostrar "Califica Salón XYZ"
  /**
   * Modo de reseña:
   * - 'business' (default): rating del servicio (required) + rating del negocio (opcional)
   * - 'freelancer': rating del servicio (required) + rating del profesional (opcional)
   * En ambos casos el primer rating se guarda en `rating` y el segundo en `businessRating`.
   */
  mode?: 'business' | 'freelancer'; // Tipo de contexto: negocio con local o freelancer
  /** Detalle de la cita a la que se refiere la reseña (para que el cliente la
   *  reconozca): servicios y fecha/hora ya formateados por quien llama. */
  appointment?: {
    services?: string;   // Ej: "Corte de cabello, Tinte"
    dateText?: string;   // Ej: "Lun 15 de junio, 3:30 PM"
  };
  onSubmit: (data: {
    rating: number;               // Calificación del profesional (1-5, obligatorio)
    comment?: string;             // Comentario del profesional (opcional)
    businessRating?: number;      // Calificación del negocio (opcional)
    businessComment?: string;     // Comentario del negocio (opcional)
  }) => void;
  onSkip: () => void;         // Callback: el usuario omitió sin calificar
  isLoading?: boolean;        // true mientras se envía al servidor (deshabilita botón)
}

// Componente exportado
export function DualReviewModal({
  show,
  employeeName,
  businessName,
  mode = 'business', // Por defecto: modo negocio (hay local + empleado)
  appointment,
  onSubmit,
  onSkip,
  isLoading,
}: DualReviewModalProps) {

  // ─── ESTADO LOCAL ─────────────────────────────────────────────────────────

  // employeeRating: calificación del profesional (0 = sin calificar)
  const [employeeRating, setEmployeeRating] = useState(0);

  // employeeComment: comentario sobre el profesional (texto libre)
  const [employeeComment, setEmployeeComment] = useState('');

  // businessRating: calificación del negocio (0 = sin calificar)
  const [businessRating, setBusinessRating] = useState(0);

  // businessComment: comentario sobre el negocio
  const [businessComment, setBusinessComment] = useState('');

  // ─── RENDERIZADO CONDICIONAL ──────────────────────────────────────────────
  // Si show=false, retornamos null (el modal es invisible en el DOM)
  if (!show) return null;

  // ─── MANEJADOR: handleSubmit ──────────────────────────────────────────────
  const handleSubmit = () => {
    // El rating del profesional es obligatorio: si es 0, no enviamos
    if (employeeRating === 0) return;

    onSubmit({
      rating: employeeRating,
      // || undefined: si el string está vacío (''), enviamos undefined (no se envía al backend)
      comment: employeeComment || undefined,
      // businessRating || undefined: si es 0 (no calificó), enviamos undefined
      businessRating: businessRating || undefined,
      businessComment: businessComment || undefined,
    });
  };

  // ─── JSX PRINCIPAL ────────────────────────────────────────────────────────
  return (
    // Overlay: cubre toda la pantalla
    // items-end sm:items-center: en móvil desde abajo (bottom sheet), en tablet centrado
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      {/* Panel del modal */}
      {/* overflow-hidden: el header redondeado no se desborda */}
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          {/* Ícono de estrella en círculo teal claro */}
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#e0f2f1' }}>
            <svg className="w-6 h-6" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              {/* Mismo path SVG de estrella (idéntico al de StarRating) */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">¿Cómo fue tu experiencia?</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tu opinión ayuda a mejorar el servicio</p>
        </div>

        {/* ── BODY (con scroll si el contenido es largo) ────────────────── */}
        {/* max-h-[70vh]: el cuerpo no supera el 70% de la pantalla */}
        <div className="px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* ─── DETALLE DE LA CITA: para que el cliente reconozca a qué cita
              se refiere la reseña (servicios, fecha/hora y profesional). ─── */}
          {appointment && (appointment.services || appointment.dateText) && (
            <div className="rounded-xl border p-3" style={{ backgroundColor: '#f9fafb', borderColor: '#f3f4f6' }}>
              {appointment.services && (
                <p className="text-sm font-semibold text-gray-900 break-words">{appointment.services}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 mt-1">
                {appointment.dateText && <span>{appointment.dateText}</span>}
                {appointment.dateText && employeeName && <span className="text-gray-300">·</span>}
                {employeeName && <span>con {employeeName}</span>}
              </div>
            </div>
          )}

          {/* ─── SECCIÓN 1: Rating del PROFESIONAL ─────────────────────── */}
          {/* Rating principal: AL PROFESIONAL que dio el servicio (modo
              business y freelancer). Se guarda en EmployeeReview.rating y
              afecta el promedio del empleado. */}
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Califica al{' '}
              {/* {' '}: espacio en JSX (necesario entre "al" y el span siguiente) */}
              <span style={{ color: TEAL }}>
                {/* Ternario: si hay nombre lo mostramos entre paréntesis */}
                profesional{employeeName ? ` (${employeeName})` : ''}
              </span>
            </p>

            {/* Componente de estrellas */}
            <StarRating value={employeeRating} onChange={setEmployeeRating} />

            {/* Textarea de comentario: SOLO aparece si el usuario ya eligió un rating */}
            {/* employeeRating > 0 && (...): el operador && muestra el bloque solo si la condición es true */}
            {employeeRating > 0 && (
              <textarea
                value={employeeComment}
                onChange={(e) => setEmployeeComment(e.target.value)}
                placeholder="¿Cómo te atendió el profesional? (opcional)"
                rows={2} // Altura inicial de 2 líneas
                className="mt-2 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2"
                // resize-none: evita que el usuario pueda redimensionar el textarea
                style={{ ['--tw-ring-color' as any]: TEAL }}
                // ['--tw-ring-color' as any]: forma de pasar variables CSS de Tailwind en JSX
              />
            )}
          </div>

          {/* ─── SECCIÓN 2: Rating del NEGOCIO (opcional) ─────────────── */}
          {/* Rating secundario opcional:
              - 'business' → al negocio (afecta TenantReview / promedio del tenant)
              - 'freelancer' → no aplica (no hay negocio que calificar) */}
          {/* mode === 'business' && (...): solo se muestra en modo negocio */}
          {mode === 'business' && (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Califica <span style={{ color: TEAL }}>{businessName}</span>{' '}
                <span className="text-xs text-gray-400 font-normal">(opcional)</span>
              </p>

              <StarRating value={businessRating} onChange={setBusinessRating} />

              {/* Textarea del negocio: mismo patrón, visible solo si hay rating */}
              {businessRating > 0 && (
                <textarea
                  value={businessComment}
                  onChange={(e) => setBusinessComment(e.target.value)}
                  placeholder="¿Cómo te pareció el lugar? (opcional)"
                  rows={2}
                  className="mt-2 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2"
                  style={{ ['--tw-ring-color' as any]: TEAL }}
                />
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER con botones ─────────────────────────────────────────── */}
        <div className="px-6 pb-6 pt-2 flex gap-2">
          {/* Botón "Omitir": cierra el modal sin enviar calificación */}
          {/* flex-shrink-0: no se encoge aunque el botón "Enviar" crezca */}
          <button
            onClick={onSkip}
            className="flex-shrink-0 py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Omitir
          </button>

          {/* Botón "Enviar calificación": deshabilitado si no hay rating o está cargando */}
          {/* flex-1: ocupa todo el espacio restante del flex */}
          <button
            onClick={handleSubmit}
            disabled={employeeRating === 0 || isLoading}
            // disabled=true cuando: el usuario no seleccionó estrellas O se está guardando
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
            // disabled:opacity-40: cuando está deshabilitado, se ve opaco (40% de opacidad)
            style={{ backgroundColor: TEAL }}
          >
            {/* Ternario: mientras carga muestra "Enviando...", si no "Enviar calificación" */}
            {isLoading ? 'Enviando...' : 'Enviar calificación'}
          </button>
        </div>
      </div>
    </div>
  );
}
