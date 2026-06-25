// ============================================================
// ARCHIVO: review-card.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Muestra una tarjeta de reseña individual de un cliente
//   hacia un empleado. Incluye el nombre del cliente, la fecha
//   de la cita, las estrellas de calificación, los servicios
//   realizados como "chips" (etiquetas tipo píldora) y el
//   comentario del cliente si lo dejó.
// ¿QUÉ RECIBE? (props)
//   - review: objeto con todos los datos de la reseña (ver interface).
// ============================================================

'use client';
// Necesario para que Next.js lo trate como componente del cliente.

import { StarRating } from './star-rating';
// Componente de estrellas (★) del mismo directorio.

import { formatDate } from '@/lib/utils';
// Función de utilidad para formatear fechas a texto legible.
// Ej: formatDate("2026-07-01T10:00:00", "D MMM YYYY") → "1 jul 2026"

// ─── TIPOS ──────────────────────────────────────────────────

interface ReviewCardProps {
  review: {
    // Datos de la reseña que recibe el componente.
    id: string;
    rating: number;          // puntuación del 1 al 5
    comment?: string | null; // comentario opcional del cliente
    createdAt: string;       // cuándo se creó la reseña (ISO datetime)
    client: {
      firstName: string;
      lastName: string;
    };
    appointment: {
      startTime: string;     // fecha/hora de inicio de la cita (ISO datetime)
      items: Array<{
        serviceNameSnapshot: string;
        // "Snapshot" = copia del nombre del servicio al momento de la cita.
        // Se guarda porque el nombre del servicio podría cambiar después.
      }>;
    };
  };
}

// ─── COMPONENTE ─────────────────────────────────────────────
export function ReviewCard({ review }: ReviewCardProps) {
  // Construimos un string con los nombres de todos los servicios separados
  // por coma. ".map()" extrae solo el nombre de cada item, y ".join(', ')"
  // une el array en un string.
  // Ej: ["Corte", "Color"] → "Corte, Color"
  const services = review.appointment.items
    .map((i) => i.serviceNameSnapshot)
    .join(', ');

  // ─── JSX ──────────────────────────────────────────────
  return (
    // Tarjeta con borde y esquinas redondeadas.
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Primera fila: nombre del cliente + estrellas */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Nombre completo del cliente */}
          <p className="font-medium text-gray-900 text-sm">
            {review.client.firstName} {review.client.lastName}
          </p>
          {/* Fecha de la cita formateada */}
          <p className="text-xs text-gray-400 mt-0.5">
            {/* formatDate convierte el ISO datetime a texto legible.
                'D MMM YYYY' → "1 jul 2026" */}
            Cita del {formatDate(review.appointment.startTime, 'D MMM YYYY')}
          </p>
        </div>
        {/* Estrellas de calificación (modo lectura, no interactivo).
            "size='sm'" muestra estrellas pequeñas. */}
        <StarRating rating={review.rating} size="sm" />
      </div>

      {/* Segunda fila: chips de servicios */}
      {/* Solo se renderiza si "services" no está vacío.
          Un string vacío es falsy en JS, por lo que && no renderiza nada. */}
      {services && (
        <div className="mt-2 flex flex-wrap gap-1">
          {/* Generamos un chip (etiqueta píldora) por cada item de la cita.
              "item" = { serviceNameSnapshot }
              "i" = índice numérico del array (lo usamos como key porque
              los items no tienen un ID propio accesible aquí). */}
          {review.appointment.items.map((item, i) => (
            <span
              key={i}
              // Cada chip es gris con texto del nombre del servicio.
              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
            >
              {item.serviceNameSnapshot}
            </span>
          ))}
        </div>
      )}

      {/* Comentario del cliente */}
      {/* Solo se renderiza si "review.comment" tiene valor (no es null/undefined/''). */}
      {review.comment && (
        <p className="mt-2 text-sm text-gray-600">{review.comment}</p>
      )}
    </div>
  );
}
