// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/portal/[tenantSlug]/history/page.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Historial de servicios del cliente, agrupado por tipo de servicio.
// URL: /portal/[tenantSlug]/history
//
// QUÉ MUESTRA
// -----------
// Una lista de "acordeones" (elementos colapsables). Cada acordeón representa
// un TIPO DE SERVICIO que el cliente ha recibido (ej: "Corte de cabello").
// Al expandir un acordeón, se muestran todas las citas de ese servicio con:
//   - Fecha y nombre del profesional
//   - Calificación en estrellas (si dejó reseña)
//   - Galería de fotos de resultado (en cuadrícula 4 columnas)
//   - Comentario de la reseña (si existe)
//   - Botón para dejar reseña (si no la ha dejado)
//
// PATRÓN ACORDEÓN
// ---------------
// expandedService: guarda el nombre del servicio expandido actualmente.
// Al hacer clic en un acordeón: si ya está expandido → lo colapsa (null).
//                               Si no estaba expandido → lo expande (guarda nombre).
// Solo un acordeón puede estar expandido a la vez.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useClientAuth } from '@/lib/hooks/use-client-auth';
import { portalApi } from '@/lib/portal-api';
import { formatDate } from '@/lib/utils';
import PortalNav from '../portal-nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── INTERFAZ DE TIPOS ─────────────────────────────────────────────────────────
// ServiceGroup: un grupo de citas agrupadas por tipo de servicio.
// El backend ya hace la agrupación; nosotros solo renderizamos el resultado.
interface ServiceGroup {
  serviceName: string;   // Nombre del tipo de servicio (ej: "Corte de cabello")
  serviceId: string;     // ID del servicio en la BD
  totalAppointments: number;  // Cuántas citas ha tenido de este servicio
  totalPhotos: number;        // Cuántas fotos de resultado hay en total
  appointments: {             // Array de citas individuales de este servicio
    id: string;
    startTime: string;
    status: string;
    employee: { id: string; firstName: string; lastName: string };
    photos: { id: string; imageUrl: string; caption: string | null; createdAt: string }[];
    review: { id: string; rating: number; comment: string | null } | null;
    items: { serviceNameSnapshot: string }[];
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalHistoryPage() {
  const { isAuthenticated, isLoading: authLoading, tenantSlug } = useClientAuth();
  const router = useRouter();

  // expandedService: nombre del servicio cuyo acordeón está abierto.
  // null significa que todos están cerrados.
  const [expandedService, setExpandedService] = useState<string | null>(null);

  // selectedPhoto: URL de la foto abierta en el lightbox. null = cerrado.
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // ── PROTECCIÓN DE RUTA ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/portal/${tenantSlug}/login`);
    }
  }, [authLoading, isAuthenticated, router, tenantSlug]);

  // ── PETICIÓN DEL HISTORIAL ────────────────────────────────────────────────
  // El backend devuelve el historial agrupado por servicio.
  // queryKey estático: se hace una sola vez (no tiene parámetros que cambien).
  const { data, isLoading } = useQuery({
    queryKey: ['portal-service-history'],
    queryFn: () => portalApi.get<{ data: ServiceGroup[] }>('/service-history'),
    enabled: isAuthenticated,
  });

  // Extraemos el array de grupos de la respuesta.
  const history: ServiceGroup[] = (data as any)?.data || [];

  // ── RENDERS CONDICIONALES TEMPRANOS ──────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  return (
    <div className="pb-20 min-h-screen">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Historial de servicios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tus servicios completados con fotos y reseñas
        </p>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {isLoading ? (
          // Estado de carga
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : history.length === 0 ? (
          // Estado vacío: no ha completado ningún servicio todavía
          <div className="text-center py-12">
            <p className="text-gray-400 mb-2">No tienes servicios completados aún</p>
            <p className="text-sm text-gray-400">
              Aquí verás tu historial con fotos de resultados
            </p>
          </div>
        ) : (
          // ── LISTA DE GRUPOS (ACORDEONES) ────────────────────────────────
          // Iteramos cada grupo de servicio. group = un ServiceGroup.
          history.map((group) => {
            // ¿Este acordeón está actualmente expandido?
            // Comparamos el nombre del grupo con el estado expandedService.
            const isExpanded = expandedService === group.serviceName;

            return (
              // overflow-hidden: importante para que el acordeón al colapsar
              // no muestre el contenido desbordado durante la transición.
              <div
                key={group.serviceName}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* CABECERA DEL ACORDEÓN (siempre visible) */}
                <button
                  onClick={() =>
                    // LÓGICA DE TOGGLE DEL ACORDEÓN:
                    // Si isExpanded → lo cerramos poniendo null.
                    // Si no → lo abrimos guardando el nombre del servicio.
                    // Esto asegura que solo uno esté abierto a la vez: al abrir
                    // uno, el anterior queda con un nombre diferente → se cierra.
                    setExpandedService(isExpanded ? null : group.serviceName)
                  }
                  className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {group.serviceName}
                    </p>
                    {/* Subtítulo: número de citas y fotos */}
                    <p className="text-xs text-gray-500 mt-0.5">
                      {group.totalAppointments} cita
                      {/* Pluralización de "cita/citas" */}
                      {group.totalAppointments !== 1 ? 's' : ''}
                      {/* Fotos: solo si hay más de 0. && encadena la condición. */}
                      {group.totalPhotos > 0 &&
                        ` · ${group.totalPhotos} foto${group.totalPhotos !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {/* Flecha: rota 180° cuando está expandido (CSS transition-transform) */}
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* CONTENIDO DEL ACORDEÓN: solo visible si isExpanded === true */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Iteramos cada cita dentro de este grupo de servicio */}
                    {group.appointments.map((apt) => (
                      // last:border-b-0: clases de Tailwind con selector CSS last-child.
                      // Elimina la línea inferior del último elemento de la lista.
                      <div
                        key={apt.id}
                        className="px-5 py-4 border-b border-gray-50 last:border-b-0"
                      >
                        {/* Fila: fecha/profesional + estrellas de reseña */}
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDate(apt.startTime, 'D [de] MMM YYYY')}
                            </p>
                            <p className="text-xs text-gray-500">
                              Con {apt.employee.firstName} {apt.employee.lastName}
                            </p>
                          </div>
                          {/* Estrellas de la reseña: solo si tiene reseña */}
                          {apt.review && (
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  // apt.review!.rating: el ! es "non-null assertion".
                                  // Le decimos a TypeScript que confiamos en que review
                                  // no es null aquí (ya lo verificamos en la condición {apt.review &&}).
                                  className={`w-3.5 h-3.5 ${
                                    star <= apt.review!.rating
                                      ? 'text-amber-400'
                                      : 'text-gray-200'
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* GALERÍA DE FOTOS (cuadrícula 4 columnas, solo si hay fotos) */}
                        {apt.photos.length > 0 && (
                          <div className="grid grid-cols-4 gap-1.5 mt-2">
                            {apt.photos.map((photo) => (
                              <button
                                key={photo.id}
                                // Guardar la imageUrl abre el lightbox a pantalla completa
                                onClick={() => setSelectedPhoto(photo.imageUrl)}
                                className="aspect-square rounded-lg overflow-hidden bg-gray-100"
                              >
                                <img
                                  src={`${API_URL}${photo.imageUrl}`}
                                  alt={photo.caption || 'Resultado'}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* COMENTARIO DE LA RESEÑA: solo si existe */}
                        {/* apt.review?.comment: optional chaining + verificación.
                            &ldquo; y &rdquo;: entidades HTML para comillas tipográficas
                            "..." (curvy quotes), más elegantes que las rectas "...". */}
                        {apt.review?.comment && (
                          <p className="text-xs text-gray-500 mt-2 italic">
                            &ldquo;{apt.review.comment}&rdquo;
                          </p>
                        )}

                        {/* BOTÓN "DEJAR RESEÑA": solo si NO tiene reseña.
                            !apt.review: verdadero cuando review es null. */}
                        {!apt.review && (
                          <button
                            onClick={() =>
                              // Navega al detalle de la cita donde está el modal de reseña.
                              router.push(
                                `/portal/${tenantSlug}/appointments/${apt.id}`,
                              )
                            }
                            className="text-xs text-amber-600 font-medium mt-2 hover:text-amber-700"
                          >
                            Dejar reseña
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* LIGHTBOX DE FOTOS: pantalla completa al hacer clic en una miniatura */}
      {selectedPhoto && (
        // Clic en el overlay → cierra el lightbox (setSelectedPhoto(null))
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setSelectedPhoto(null)}
        >
          <img
            src={`${API_URL}${selectedPhoto}`}
            alt="Resultado"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* Barra de navegación inferior */}
      <PortalNav />
    </div>
  );
}
