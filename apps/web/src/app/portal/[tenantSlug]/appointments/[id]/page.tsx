// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/portal/[tenantSlug]/appointments/[id]/page.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Página de DETALLE de una cita específica en el portal del cliente.
// URL: /portal/[tenantSlug]/appointments/[id]
// Ejemplo: /portal/salon-lucia/appointments/clxyz123
//
// RUTA DINÁMICA ANIDADA
// ----------------------
// Esta página tiene DOS parámetros dinámicos en su URL:
//   - [tenantSlug]: el negocio (ej: "salon-lucia")
//   - [id]: el ID de la cita (ej: "clxyz123")
// Ambos se leen con useParams(). Esta es la potencia del App Router de Next.js:
// las rutas anidadas con parámetros dinámicos se crean solo con carpetas.
//
// QUÉ MUESTRA
// -----------
// Tarjetas de información organizadas verticalmente:
//   1. Fecha, hora y estado de la cita + datos del profesional
//   2. Lista de servicios (con precios snapshot)
//   3. Productos reservados (si hay)
//   4. Cupón aplicado (si hay)
//   5. Desglose financiero: subtotal, descuento, propina, TOTAL
//   6. Ubicación del negocio (si aplica)
//   7. Fotos de resultado (galería con lightbox)
//   8. Reseña existente (si ya la dejó)
//   9. Botón para dejar reseña (si COMPLETED y sin reseña)
//  10. Botón para cancelar (si aún cancelable)
//
// MUTACIONES (useMutation)
// ------------------------
// A diferencia de useQuery (GET/lectura), useMutation se usa para peticiones
// que CAMBIAN datos: POST, PUT, DELETE.
// Aquí tenemos dos mutaciones:
//   - cancelMutation: POST para cancelar la cita
//   - reviewMutation: POST para enviar la reseña
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

// useQuery: para leer los datos de la cita (GET).
// useMutation: para operaciones de escritura (cancelar, dejar reseña).
// useQueryClient: para invalidar/refrescar queries después de una mutación.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientAuth } from '@/lib/hooks/use-client-auth';
import { portalApi } from '@/lib/portal-api';
import { formatCurrency, formatDate } from '@/lib/utils';
import dayjs from 'dayjs';

// DualReviewModal: modal que permite calificar al profesional Y al negocio
// en un mismo formulario de dos pasos.
import { DualReviewModal } from '@/components/ui/dual-review-modal';

// Diccionario de estados → etiqueta visual. Mismo que en la lista de citas.
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Ausente', color: 'bg-gray-100 text-gray-800' },
};

// URL del backend para construir URLs de imágenes.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function AppointmentDetailPage() {
  const { isAuthenticated, isLoading: authLoading, tenantSlug } = useClientAuth();
  const router = useRouter();
  const params = useParams();

  // Extraemos el ID de la cita del segmento [id] de la URL.
  const appointmentId = params.id as string;

  // useQueryClient: acceso al cliente de react-query para invalidar queries.
  // Al cancelar o dejar reseña, necesitamos que las listas se actualicen.
  const queryClient = useQueryClient();

  // ── ESTADOS DE LA UI ──────────────────────────────────────────────────────
  // showCancelModal: controla visibilidad del modal de confirmación de cancelación.
  const [showCancelModal, setShowCancelModal] = useState(false);

  // cancelReason: texto opcional del motivo de cancelación.
  const [cancelReason, setCancelReason] = useState('');

  // showReviewModal: controla visibilidad del modal de reseña dual.
  const [showReviewModal, setShowReviewModal] = useState(false);

  // selectedPhoto: URL de la foto ampliada en el lightbox. null = lightbox cerrado.
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // ── PROTECCIÓN DE RUTA ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/portal/${tenantSlug}/login`);
    }
  }, [authLoading, isAuthenticated, router, tenantSlug]);

  // ── PETICIÓN DE DATOS DE LA CITA ──────────────────────────────────────────
  // queryKey: ['portal-appointment', appointmentId] — específica para ESTA cita.
  // Cuando invalidamos esta key (tras cancelar o reseñar), react-query vuelve
  // a hacer el GET y la página se actualiza con los datos frescos.
  const { data, isLoading } = useQuery({
    queryKey: ['portal-appointment', appointmentId],
    queryFn: () => portalApi.get<{ data: any }>(`/appointments/${appointmentId}`),
    enabled: isAuthenticated,
  });

  // Extraemos el objeto de la cita de la respuesta envuelta en { data: ... }.
  const appointment = (data as any)?.data;

  // ── EFECTO: MOSTRAR MODAL DE RESEÑA AUTOMÁTICAMENTE ───────────────────────
  // Si la cita está COMPLETADA y no tiene reseña, mostramos el modal
  // automáticamente cuando los datos cargan. Esto invita al cliente a calificar.
  // Las dependencias son appointment?.status y appointment?.review:
  // el efecto se ejecuta cada vez que cambian esos dos valores.
  useEffect(() => {
    if (appointment?.status === 'COMPLETED' && !appointment?.review) {
      setShowReviewModal(true);
    }
  }, [appointment?.status, appointment?.review]);

  // ── MUTACIÓN: CANCELAR CITA ────────────────────────────────────────────────
  // useMutation: para operaciones que modifican datos en el servidor.
  // mutationFn: la función que hace la petición. Se ejecuta al llamar a .mutate().
  // onSuccess: callback que se ejecuta cuando la petición es exitosa.
  //   - invalidateQueries: le dice a react-query que las queries con esa key
  //     están "viejas" y deben re-fetchearse. Así la UI se actualiza sola.
  const cancelMutation = useMutation({
    mutationFn: () =>
      portalApi.post(`/appointments/${appointmentId}/cancel`, {
        reason: cancelReason,
      }),
    onSuccess: () => {
      // Invalidamos la cita actual (para refrescar su estado a CANCELLED)
      queryClient.invalidateQueries({ queryKey: ['portal-appointment'] });
      // Invalidamos la lista de citas (para que desaparezca de "Próximas")
      queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
      // Cerramos el modal de confirmación
      setShowCancelModal(false);
    },
  });

  // ── MUTACIÓN: ENVIAR RESEÑA ────────────────────────────────────────────────
  // El tipo del parámetro data define qué campos acepta esta mutación.
  // Los campos con ? son opcionales (businessRating, comment, businessComment).
  const reviewMutation = useMutation({
    mutationFn: (data: { rating: number; comment?: string; businessRating?: number; businessComment?: string }) =>
      portalApi.post(`/appointments/${appointmentId}/review`, data),
    onSuccess: () => {
      // Refrescamos los datos de esta cita (para mostrar la reseña recién enviada)
      queryClient.invalidateQueries({ queryKey: ['portal-appointment'] });
      setShowReviewModal(false);
    },
  });

  // ── RENDERS CONDICIONALES TEMPRANOS ──────────────────────────────────────
  // Spinner mientras carga auth O mientras carga la cita del backend.
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // Si no hay datos de cita (ID inválido, error de red), no renderizamos.
  if (!appointment) return null;

  // ── CÁLCULOS FINANCIEROS ──────────────────────────────────────────────────
  // Estos cálculos se hacen DESPUÉS de los early returns para garantizar
  // que appointment no es null/undefined cuando los ejecutamos.

  // Label y color del estado actual de la cita.
  const status = STATUS_LABELS[appointment.status] || STATUS_LABELS.PENDING;

  // Subtotal de servicios: suma de los precios snapshot de todos los ítems.
  const servicesSubtotal = appointment.items.reduce(
    (sum: number, i: any) => sum + Number(i.priceSnapshot),
    0,
  );

  // Productos reservados con la cita (carrito de tienda durante el booking).
  // Excluimos CANCELLED — el resto es cobrable o ya cobrado.
  // .filter() devuelve un nuevo array con solo los elementos que cumplen la condición.
  const visibleProducts = (appointment.productReservations || []).filter(
    (r: any) => r.status !== 'CANCELLED',
  );

  // Subtotal de productos: precio unitario × cantidad de cada reserva.
  const productsSubtotal = visibleProducts.reduce(
    (sum: number, r: any) => sum + Number(r.unitPrice || 0) * Number(r.quantity || 1),
    0,
  );

  // Precio total antes de descuentos/propinas.
  const totalPrice = servicesSubtotal + productsSubtotal;

  // Montos REALES del cobro (propina, descuento, total) desde el pago, para que
  // el detalle coincida con lo cobrado y no solo con la suma de precios.
  const payments: any[] = appointment.payments || [];

  // Buscamos el pago completado. .find() devuelve el PRIMER elemento que cumple la condición.
  // || payments[0]: si no hay pago completado, usamos el primero de todos.
  // || null: si no hay pagos, null.
  const paidPayment = payments.find((p: any) => p.status === 'COMPLETED') || payments[0] || null;

  // Propina: del pago real, o 0 si no hay pago.
  // Number(paidPayment?.tipAmount || 0): convierte a número; si es null/undefined, usa 0.
  const tipAmount = Number(paidPayment?.tipAmount || 0);

  // Descuento: del pago real, o del appointment directamente, o 0.
  // El operador ?? (nullish coalescing) es como || pero solo devuelve el lado derecho
  // si el izquierdo es NULL o UNDEFINED (no si es 0, false, o '').
  // Esto importa para descuentos: descuento de $0 no debería caer al fallback.
  const discountAmount = Number(paidPayment?.discountAmount ?? appointment.discountAmount ?? 0);

  // Total real: si hay pago registrado → usamos su totalAmount (lo que se cobró).
  // Si no → calculamos: max(0, total-descuento) + propina.
  // Math.max(0, x): evita totales negativos.
  const grandTotal = paidPayment
    ? Number(paidPayment.totalAmount)
    : Math.max(0, totalPrice - discountAmount) + tipAmount;

  // Cupón/recompensa aplicada a esta cita (puede ser null).
  const redemption = appointment.redemption || null;

  // canCancel: se puede cancelar si el estado es uno de los tres "cancelables".
  // .includes(): devuelve true si el elemento está en el array.
  const canCancel = ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(appointment.status);

  // canReview: se puede reseñar si completada Y sin reseña previa.
  // !appointment.review: el ! niega — true si review es null/undefined.
  const canReview = appointment.status === 'COMPLETED' && !appointment.review;

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER CON BOTÓN ATRÁS */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        {/* router.back(): equivalente al botón de atrás del navegador */}
        <button
          onClick={() => router.back()}
          className="p-1 hover:bg-gray-100 rounded-lg"
        >
          {/* Flecha izquierda SVG */}
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Detalle de cita</h1>
      </div>

      {/* CONTENIDO PRINCIPAL: serie de tarjetas */}
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">

        {/* TARJETA PRINCIPAL: fecha, estado, profesional, servicios, financiero */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {/* Fila de fecha/hora + badge de estado */}
          <div className="flex items-center justify-between mb-4">
            <div>
              {/* MMMM: mes completo. Produce "jue, 24 de junio". */}
              <p className="text-lg font-bold text-gray-900">
                {formatDate(appointment.startTime, 'ddd, D [de] MMMM')}
              </p>
              <p className="text-sm text-gray-500">
                {dayjs.utc(appointment.startTime).format('h:mm A')} -{' '}
                {dayjs.utc(appointment.endTime).format('h:mm A')}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>

          {/* SECCIÓN: Profesional (con avatar foto o iniciales) */}
          <div className="flex items-center gap-3 py-3 border-t border-gray-100">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
              style={{ backgroundColor: appointment.employee.color }}
            >
              {appointment.employee.avatarUrl ? (
                <img src={`${API_URL}${appointment.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <>{appointment.employee.firstName[0]}{appointment.employee.lastName[0]}</>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {appointment.employee.firstName} {appointment.employee.lastName}
              </p>
              <p className="text-xs text-gray-500">Profesional</p>
            </div>
          </div>

          {/* SECCIÓN: Servicios (lista de ítems con precio snapshot) */}
          <div className="py-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Servicios</p>
            {/* Iteramos los ítems de la cita */}
            {appointment.items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-700">{item.serviceNameSnapshot}</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(Number(item.priceSnapshot))}
                </span>
              </div>
            ))}
          </div>

          {/* SECCIÓN: Productos (solo si hay productos visibles/no cancelados) */}
          {visibleProducts.length > 0 && (
            <div className="py-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Productos</p>
              {visibleProducts.map((r: any) => {
                // Calculamos el total de esta línea: precio × cantidad.
                const lineTotal = Number(r.unitPrice || 0) * Number(r.quantity || 1);
                return (
                  <div key={r.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-700 truncate">
                      {/* r.product?.name: optional chaining si product es null */}
                      {r.product?.name || 'Producto'}
                      {/* Solo mostramos "× cantidad" si la cantidad es > 1 */}
                      {Number(r.quantity) > 1 ? ` × ${r.quantity}` : ''}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(lineTotal)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* SECCIÓN: Cupón aplicado (visual, solo si hay redemption) */}
          {redemption && (
            <div className="py-3 border-t border-gray-100">
              <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
                {/* Ícono de cupón/ticket */}
                <div className="w-9 h-9 rounded-lg bg-white border border-teal-200 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  {/* redemption.reward?.name: el nombre de la recompensa (puede ser null) */}
                  <p className="text-sm font-semibold text-teal-800 truncate">{redemption.reward?.name || 'Cupón aplicado'}</p>
                  {/* Código del cupón en fuente monoespaciada */}
                  <p className="text-[11px] text-teal-600 font-mono">Código {redemption.code}</p>
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN: Desglose financiero real del cobro */}
          <div className="py-3 border-t border-gray-100 space-y-1.5">
            {/* Subtotal siempre visible */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">{formatCurrency(totalPrice)}</span>
            </div>
            {/* Descuento: solo si > 0 */}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                {/* Si hay cupón, mencionamos que el descuento viene de él */}
                <span className="text-gray-500">Descuento{redemption ? ' (cupón)' : ''}</span>
                {/* − (guión largo) para indicar resta, en teal para destacar */}
                <span className="text-teal-700">−{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {/* Propina: solo si > 0 */}
            {tipAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Propina</span>
                <span className="text-gray-700">+{formatCurrency(tipAmount)}</span>
              </div>
            )}
            {/* Total final: más grande y en negrita para destacarlo */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* SECCIÓN: Ubicación (solo si la cita tiene location) */}
          {appointment.location && (
            <div className="py-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1">Ubicación</p>
              <p className="text-sm text-gray-700">{appointment.location.name}</p>
              {/* Dirección: solo si existe */}
              {appointment.location.address && (
                <p className="text-xs text-gray-500">{appointment.location.address}</p>
              )}
            </div>
          )}
        </div>

        {/* TARJETA DE FOTOS DE RESULTADO */}
        {/* appointment.photos?.length > 0: optional chaining + verificación de length */}
        {appointment.photos?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              Fotos de resultado
            </p>
            {/* Cuadrícula de 3 columnas para las miniaturas */}
            <div className="grid grid-cols-3 gap-2">
              {appointment.photos.map((photo: any) => (
                // Al hacer clic en una foto, la guardamos en selectedPhoto
                // para abrir el lightbox a pantalla completa.
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo.imageUrl)}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100"
                >
                  {/* aspect-square: el contenedor siempre es cuadrado.
                      object-cover: la imagen llena el cuadrado recortándose si es necesario. */}
                  <img
                    src={`${API_URL}${photo.imageUrl}`}
                    alt={photo.caption || 'Resultado'}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TARJETA DE RESEÑA EXISTENTE (si ya la dejó) */}
        {appointment.review && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-2">Tu reseña</p>
            {/* Estrellas: iteramos [1,2,3,4,5] y coloreamos las que están ≤ al rating */}
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  // Si star ≤ rating → estrella dorada; si no → gris claro.
                  className={`w-5 h-5 ${
                    star <= appointment.review.rating
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
            {/* El comentario es opcional (puede no haber escrito nada) */}
            {appointment.review.comment && (
              <p className="text-sm text-gray-600">{appointment.review.comment}</p>
            )}
          </div>
        )}

        {/* BOTÓN INVITACIÓN A RESEÑA: visible solo si canReview === true */}
        {canReview && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            ⭐ Dejar una calificación
          </button>
        )}

        {/* SECCIÓN DE ACCIONES: solo si se puede cancelar */}
        {canCancel && (
          <div className="space-y-2">
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Cancelar cita
            </button>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN DE CANCELACIÓN */}
      {showCancelModal && (
        // Overlay oscuro
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Cancelar cita?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Esta acción no se puede deshacer.
            </p>
            {/* Textarea para el motivo opcional de cancelación.
                resize-none: desactivamos el redimensionamiento manual.
                h-20: altura fija en pixels (80px). */}
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo de cancelación (opcional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-20 mb-4 focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              {/* Botón "Volver": cierra el modal sin cancelar */}
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Volver
              </button>
              {/* Botón "Sí, cancelar": ejecuta la mutación de cancelación.
                  .mutate(): dispara la mutationFn de cancelMutation.
                  isPending: true mientras la petición está en curso. */}
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RESEÑA DUAL (empleado + negocio) */}
      {/* DualReviewModal siempre está en el DOM (no condicional), pero solo es
          visible cuando show={showReviewModal} es true. Internamente el componente
          se oculta si show es false. */}
      <DualReviewModal
        show={showReviewModal}
        // Nombre del profesional para mostrar en el modal.
        // Template literal con optional chaining: si employee es null, usa texto genérico.
        employeeName={appointment?.employee ? `${appointment.employee.firstName} ${appointment.employee.lastName}` : 'el profesional'}
        businessName={appointment?.tenant?.name || 'el negocio'}
        // onSubmit: cuando el usuario envía la reseña, llamamos a reviewMutation.mutate()
        // con los datos del formulario del modal.
        onSubmit={(data) => reviewMutation.mutate(data)}
        // onSkip: si el usuario cierra/omite la reseña, ocultamos el modal.
        onSkip={() => setShowReviewModal(false)}
        // isLoading: mientras reviewMutation procesa, el modal desactiva el botón.
        isLoading={reviewMutation.isPending}
      />

      {/* LIGHTBOX DE FOTOS: pantalla completa cuando se hace clic en una foto */}
      {selectedPhoto && (
        // Overlay oscuro casi opaco. Clic en cualquier parte → cierra el lightbox.
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setSelectedPhoto(null)}
        >
          {/* La imagen se escala para ajustarse a la pantalla sin recortarse.
              max-w-full max-h-full: no desborda la pantalla.
              object-contain: mantiene las proporciones originales de la foto. */}
          <img
            src={`${API_URL}${selectedPhoto}`}
            alt="Resultado"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
