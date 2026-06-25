// ─── reviews/page.tsx — Reseñas del Empleado ─────────────────────────────
//
// Esta página está en /employee/reviews y muestra:
//   1. Resumen: valoración promedio, estrellas y desglose por puntuación.
//   2. Lista de todas las reseñas con nombre del cliente, fecha, estrellas y comentario.
//
// Las reseñas las dejan los clientes después de completar una cita
// (ya sea desde el portal del cliente o desde el QR de confirmación del wizard).

'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import dayjs from 'dayjs';
// dayjs → para formatear la fecha de la reseña en español.

// Review: objeto de una reseña individual.
interface Review {
  id: string;
  rating: number;             // valoración de 1 a 5 estrellas
  comment: string | null;     // comentario del cliente (opcional)
  createdAt: string;          // cuándo se dejó la reseña (ISO 8601)
  client: { id: string; firstName: string; lastName: string };
  appointment: {              // cita asociada (puede ser null en algunos casos)
    id: string;
    startTime: string;
    items: { serviceNameSnapshot: string }[]; // servicios de esa cita
  } | null;
}

// ReviewsData: la respuesta completa del endpoint /reviews.
interface ReviewsData {
  reviews: Review[];
  averageRating: number | null; // null si no hay reseñas aún
  totalReviews: number;
}

// ─── StarRating: componente reutilizable de estrellas ────────────────────
// Muestra N estrellas rellenas (rating) y 5-N estrellas vacías.
// PROPS:
//   rating → número de estrellas a colorear (1-5)
//   size   → clase CSS de tamaño del ícono (valor predeterminado: 'w-4 h-4')
//
// El = en la firma de la prop define el VALOR PREDETERMINADO:
//   size = 'w-4 h-4' → si no se pasa size, usa 'w-4 h-4'.
function StarRating({ rating, size = 'w-4 h-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {/* Iteramos del 1 al 5. [1,2,3,4,5].map() crea 5 estrellas SVG.
          Si star <= rating → estrella rellena (text-amber-400 = dorado)
          Si star > rating  → estrella vacía (text-gray-200 = gris claro) */}
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          // Clases dinámicas: el tamaño viene de la prop 'size',
          // el color depende de si la estrella está dentro del rating.
          className={`${size} ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── RatingBreakdown: desglose de puntuaciones ────────────────────────────
// Muestra una barra por cada puntuación (5, 4, 3, 2, 1 estrellas)
// con el conteo y el porcentaje proporcional.
// PROP: reviews → el arreglo completo de reseñas para calcular los conteos.
function RatingBreakdown({ reviews }: { reviews: Review[] }) {
  // counts: arreglo de 5 posiciones, una por cada puntuación (índice 0 = 1 estrella).
  // Ejemplo: counts = [0, 2, 1, 3, 10] → 0 de 1★, 2 de 2★, 1 de 3★, 3 de 4★, 10 de 5★
  const counts = [0, 0, 0, 0, 0];

  // Contamos cuántas reseñas hay de cada puntuación.
  // r.rating - 1 → convierte 1-5 a índice 0-4 del arreglo.
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++;
  });

  // total: para calcular porcentajes. Si no hay reseñas usamos 1 para evitar división por 0.
  const total = reviews.length || 1;

  return (
    <div className="space-y-1.5">
      {/* Mostramos de mayor a menor (5, 4, 3, 2, 1) para que las mejores queden arriba */}
      {[5, 4, 3, 2, 1].map((star) => {
        // counts[star - 1] → accedemos al conteo de esta puntuación.
        // star=5 → counts[4], star=1 → counts[0]
        const count = counts[star - 1];
        // pct: porcentaje de reseñas con esta puntuación (0-100)
        const pct = Math.round((count / total) * 100);
        return (
          <div key={star} className="flex items-center gap-2 text-sm">
            {/* Número de estrellas (5, 4, 3, 2, 1) */}
            <span className="w-3 text-gray-500 text-right">{star}</span>
            {/* Ícono de estrella individual */}
            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {/* Barra de progreso: ancho proporcional al porcentaje */}
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div
                className="bg-amber-400 h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* Número de reseñas con esta puntuación */}
            <span className="w-6 text-gray-400 text-xs">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────
export default function EmployeeReviewsPage() {
  const { user } = useAuth();

  // Petición al backend para obtener las reseñas del empleado.
  // El endpoint devuelve las reseñas ordenadas por fecha (más recientes primero).
  const { data, isLoading } = useQuery({
    queryKey: ['employee-reviews', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: ReviewsData }>(
        `/api/employees/${user!.employeeId}/reviews`,
      );
      return res.data; // ReviewsData: { reviews, averageRating, totalReviews }
    },
    enabled: !!user?.employeeId, // solo si hay employeeId
  });

  // Pantalla de error: si la cuenta no tiene employeeId vinculado.
  // Esto no debería ocurrir en condiciones normales (el login ya lo verifica).
  if (!user?.employeeId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
          Tu cuenta no está vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  // Extraemos los datos de la respuesta con valores por defecto.
  // Si data es undefined (aún cargando), usamos valores seguros.
  const reviews = data?.reviews || [];         // arreglo de reseñas
  const averageRating = data?.averageRating;   // puede ser null (sin reseñas)
  const totalReviews = data?.totalReviews || 0; // número total

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis Reseñas</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start gap-8">
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-900">
                  {averageRating ?? '-'}
                </p>
                <StarRating rating={Math.round(averageRating || 0)} size="w-5 h-5" />
                <p className="text-sm text-gray-500 mt-1">
                  {totalReviews} reseña{totalReviews !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex-1">
                <RatingBreakdown reviews={reviews} />
              </div>
            </div>
          </div>

          {/* ─── Lista de reseñas ─────────────────────────────────────── */}
          {/* Ternario: sin reseñas → mensaje vacío; con reseñas → lista */}
          {reviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <span className="text-4xl mb-3 block">⭐</span>
              <p className="text-gray-500">Aún no tienes reseñas</p>
              <p className="text-sm text-gray-400 mt-1">
                Las reseñas aparecerán aquí cuando tus clientes las dejen
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* .map() convierte cada reseña en una tarjeta.
                  key={review.id} → clave única requerida por React. */}
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-xl border border-gray-200 p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3">
                        {/* Avatar del cliente: círculo con iniciales.
                            [0] accede al primer carácter del string. */}
                        <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">
                          {review.client.firstName[0]}{review.client.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {review.client.firstName} {review.client.lastName}
                          </p>
                          {/* dayjs(review.createdAt).format() → formatea la fecha.
                              'D [de] MMM YYYY' → "15 de jun 2026"
                              El texto entre [] se incluye literalmente sin formatear. */}
                          <p className="text-xs text-gray-400">
                            {dayjs(review.createdAt).format('D [de] MMM YYYY')}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Estrellas de la valoración (componente reutilizable) */}
                    <StarRating rating={review.rating} />
                  </div>

                  {/* Comentario: solo se muestra si el cliente dejó texto.
                      review.comment && → renderiza solo si no es null/undefined/''. */}
                  {review.comment && (
                    <p className="text-sm text-gray-600 mb-3">{review.comment}</p>
                  )}

                  {/* Referencia a la cita: muestra el servicio y la fecha.
                      Solo si review.appointment no es null. */}
                  {review.appointment && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">
                        {/* .map().join(', ') → "Corte, Tinte" si hay varios servicios */}
                        Servicio: {review.appointment.items.map((i) => i.serviceNameSnapshot).join(', ')}
                        {' — '}
                        {/* dayjs.utc() para interpretar como hora del negocio (UTC) */}
                        {dayjs.utc(review.appointment.startTime).format('D MMM YYYY')}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
