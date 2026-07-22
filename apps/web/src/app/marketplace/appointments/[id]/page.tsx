// ============================================================
// PÁGINA: Detalle de una cita del marketplace
// RUTA:   /marketplace/appointments/[id]
//
// ¿Qué muestra?
//   - Cabecera con nombre del negocio, logo, estado y badge de estado coloreado.
//   - Fecha y hora de la cita (formateada con helpers de booking-time).
//   - Lista de servicios con precio y duración.
//   - Foto del profesional y nombre del empleado.
//   - Sección de comprobante de pago (AppointmentProofRow): el cliente puede
//     subir una foto del pago para facilitar la coordinación con el negocio.
//   - Cupón aplicado a la cita.
//   - Fotos del resultado (subidas por el staff al completar).
//   - Botón de WhatsApp para contactar al negocio.
//   - Modal DualReviewModal: se abre automáticamente si la cita está COMPLETED
//     y el cliente no ha dejado reseña.
//   - Botón "Cancelar cita" (solo para citas futuras PENDING/CONFIRMED).
//
// DISEÑO (rediseño "soft"): una sola superficie blanca; las secciones se
// separan con una línea fina (1px #eef3f1) en vez de tarjetas con borde y
// sombra. Labels de sección en gris atenuado 800 uppercase; el foco visual
// va al contenido (nombres, montos) y al TOTAL en teal grande. Estados en
// paleta teal/verde (nunca ámbar ni morado). Solo lectura para el cliente.
// ============================================================
'use client';

// useEffect: para auto-abrir el modal de reseña y redirigir si no existe la cita.
// useState: para controlar el modal de reseña y el estado de envío.
import { useEffect, useState } from 'react';

// useParams: lee el [id] de la URL (ID de la cita).
// useRouter: para navegar (volver, redirigir si la cita no existe).
import { useParams, useRouter } from 'next/navigation';

// React Query: cargar citas, enviar reseña, cancelar cita.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Cliente HTTP del marketplace.
import { marketplaceApi } from '@/lib/marketplace-api';

// Estado de autenticación del cliente marketplace.
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

// Helpers de formato de fecha y hora para citas (respetan zona horaria del negocio).
import { formatBookingTime, formatBookingDate } from '@/lib/booking-time';

// Formateo de moneda.
import { formatCurrency } from '@/lib/utils';

// Botón de WhatsApp con mensaje pre-armado.
import { WhatsAppButton } from '@/components/ui/whatsapp-button';

// Función que construye el mensaje de WhatsApp con los detalles de la cita.
import { buildAppointmentMessage } from '@/lib/whatsapp';

// Modal de reseña dual (empleado + negocio en un solo formulario).
import { DualReviewModal } from '@/components/ui/dual-review-modal';

// URL base del backend (variable de entorno del build).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Tokens de color del rediseño "soft" (reutilizados en todo el archivo).
const INK = '#0f1e1c'; // texto principal
const MUTED = '#7c8d89'; // texto atenuado / labels de sección
const LINE = '#eef3f1'; // línea divisoria fina
const TEAL = '#008080'; // color de marca

// Diccionario de traducción de estado → etiqueta legible.
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  RESCHEDULED: 'Reprogramada',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Ausente',
};

// Estilos del badge de estado — SIEMPRE en paleta teal/verde (nunca ámbar ni
// morado, según la regla de marca). Cada estado: fondo tint suave, texto y
// punto. Confirmada = verde éxito; Cancelada/Ausente = rojo destructivo.
const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  PENDING: { bg: '#eff6f4', color: '#0b6b64', dot: '#12a86e' },
  CONFIRMED: { bg: '#e7f5ee', color: '#0a7d54', dot: '#12a86e' },
  RESCHEDULED: { bg: '#e0f2f1', color: '#008080', dot: '#008080' },
  IN_PROGRESS: { bg: '#d4e9e6', color: '#0b6b64', dot: '#0b6b64' },
  COMPLETED: { bg: '#eef3f1', color: '#5a6f6b', dot: '#7c8d89' },
  CANCELLED: { bg: '#fbeaea', color: '#c14242', dot: '#c14242' },
  NO_SHOW: { bg: '#fbeaea', color: '#c14242', dot: '#c14242' },
};

function formatDateTime(dateStr: string) {
  return {
    date: formatBookingDate(dateStr, 'long'),
    time: formatBookingTime(dateStr),
  };
}

// Label de sección reutilizable: gris atenuado, 800, uppercase, tracking amplio.
// Es discreto a propósito: lo que resalta es el contenido, no la etiqueta.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] mb-3" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

// ── Componente principal ───────────────────────────────────
export default function AppointmentDetailPage() {
  // `id`: el segmento dinámico [id] de la URL, leído con useParams.
  // `<{ id: string }>`: tipo genérico que indica la forma del objeto de parámetros.
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useMarketplaceAuth();

  // Controla si el modal de reseña está abierto.
  const [showReview, setShowReview] = useState(false);

  // true = el usuario ya envió la reseña en esta sesión (evita re-abrir el modal).
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Carga TODAS las citas del cliente. Usamos la misma key que la lista para
  // compartir el caché (no hay petición de red duplicada si la lista ya cargó).
  // Luego filtramos por `id` para encontrar esta cita específica.
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-appointments'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-appointments?filter=all&perPage=100'),
    enabled: isAuthenticated,
  });

  const appointments: any[] = (data as any)?.data || [];
  // `.find()`: devuelve el primer elemento que cumple la condición, o undefined.
  const appt = appointments.find((a) => a.id === id);

  useEffect(() => {
    if (!isLoading && !authLoading && !appt && appointments.length > 0) {
      router.replace('/marketplace/appointments');
    }
  }, [isLoading, authLoading, appt, appointments.length]);

  // Auto-abre el modal de reseña al entrar al detalle si la cita está
  // COMPLETED, tiene pago registrado, y aún no tiene review. Si el usuario
  // lo cierra, no vuelve a saltar en esta navegación.
  useEffect(() => {
    if (
      appt &&
      appt.status === 'COMPLETED' &&
      (appt.payments || []).length > 0 &&
      !appt.review &&
      !reviewSubmitted
    ) {
      setShowReview(true);
    }
  }, [appt?.id, appt?.status, appt?.review, appt?.payments?.length, reviewSubmitted]);

  const submitReviewMutation = useMutation({
    mutationFn: (payload: { rating: number; comment?: string; businessRating?: number; businessComment?: string }) =>
      marketplaceApi.post(`/my-appointments/${id}/review`, payload),
    onSuccess: () => {
      setReviewSubmitted(true);
      setShowReview(false);
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-appointments'] });
    },
    onError: (err: any) => {
      alert(err?.message || 'No se pudo enviar la reseña');
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: TEAL }} />
      </div>
    );
  }

  if (!appt) return null;

  const style = STATUS_STYLE[appt.status] || { bg: '#eef3f1', color: MUTED, dot: MUTED };
  const { date, time } = formatDateTime(appt.startTime);
  const endTime = formatBookingTime(appt.endTime || appt.startTime);
  const servicesSubtotal = appt.items?.reduce((sum: number, i: any) => sum + Number(i.priceSnapshot || 0), 0) ?? 0;
  // Productos reservados en el booking (si el cliente sumó del carrito de
  // tienda al reservar). Incluimos cantidad para que un mismo producto con
  // qty=2 cuente doble. Excluimos solo CANCELLED — los demás (PENDING/
  // CONFIRMED/READY/DELIVERED) son cobrables o ya cobrados.
  const productsSubtotal = (appt.productReservations || [])
    .filter((r: any) => r.status !== 'CANCELLED')
    .reduce((sum: number, r: any) => sum + Number(r.unitPrice || 0) * Number(r.quantity || 1), 0);
  const total = servicesSubtotal + productsSubtotal;
  // Moneda del negocio; default a MXN si por algún motivo no viene.
  const currency: string = appt.tenant?.currency || 'MXN';
  const totalDuration = appt.items?.reduce((sum: number, i: any) => sum + Number(i.durationSnapshot || 0), 0) ?? 0;
  const visibleProducts = (appt.productReservations || []).filter((r: any) => r.status !== 'CANCELLED');
  const grandTotal = Math.max(0, total - Number(appt.discountAmount || 0));

  // Profesional(es) que atendieron: empleados DISTINTOS de los items (varios si
  // cada servicio lo hizo otro); fallback al empleado principal de la cita.
  const reviewProfessionals = (() => {
    const map = new Map<string, any>();
    for (const it of (appt.items || [])) {
      if (it.employee?.id) map.set(it.employee.id, it.employee);
    }
    if (map.size === 0 && appt.employee?.id) map.set(appt.employee.id, appt.employee);
    return Array.from(map.values()).map((e: any) => ({
      name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
      avatarUrl: e.avatarUrl ? `${API_URL}${e.avatarUrl}` : null,
      color: e.color,
    }));
  })();
  // Desglose del pago: propina, descuento, anticipo y total pagado.
  const reviewPayment = (() => {
    const pay = appt.payments?.[0];
    const lines: { label: string; value: string }[] = [];
    const disc = Number(pay?.discountAmount || appt.discountAmount || 0);
    const dep = Number(appt.depositPaid || 0);
    const tip = Number(pay?.tipAmount || 0);
    if (disc > 0) lines.push({ label: 'Descuento', value: `-${formatCurrency(disc, currency)}` });
    if (dep > 0) lines.push({ label: 'Anticipo', value: `-${formatCurrency(dep, currency)}` });
    if (tip > 0) lines.push({ label: 'Propina', value: formatCurrency(tip, currency) });
    return { total: pay ? formatCurrency(Number(pay.totalAmount || 0), currency) : undefined, lines };
  })();

  return (
    <div className="min-h-screen bg-white">
      {/* Header respetado: botón atrás + título */}
      <div className="bg-white border-b px-4 pb-3 safe-top sticky top-0 z-10" style={{ borderColor: LINE }}>
        <div className="max-w-2xl mx-auto pt-2 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <svg className="w-5 h-5" style={{ color: MUTED }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold" style={{ color: INK }}>Detalle de cita</h1>
        </div>
      </div>

      {/* Una sola superficie: las secciones se separan con línea fina (divide-y),
          sin tarjetas ni sombras por sección. */}
      <div className="max-w-2xl mx-auto pb-28">
        <div className="divide-y divide-[#eef3f1]">

          {/* Negocio + estado */}
          <section className="px-5 py-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {appt.tenant?.logoUrl ? (
                <img src={`${API_URL}${appt.tenant.logoUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-extrabold text-gray-400">{appt.tenant?.name?.[0]}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-extrabold truncate tracking-[-0.02em]" style={{ color: INK }}>{appt.tenant?.name}</p>
              <button
                onClick={() => router.push(`/marketplace/${appt.tenant?.slug}`)}
                className="text-[13px] font-semibold mt-0.5"
                style={{ color: TEAL }}
              >
                Ver negocio →
              </button>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: style.bg, color: style.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
                {STATUS_LABEL[appt.status] || appt.status}
              </span>
              <WhatsAppButton
                phone={appt.tenant?.businessPhone}
                message={buildAppointmentMessage({
                  tenantName: appt.tenant?.name || 'el negocio',
                  serviceName: (appt.items || []).map((i: any) => i.serviceNameSnapshot).join(', '),
                  startTime: appt.startTime,
                  appointmentId: appt.id,
                })}
                label="WhatsApp"
              />
            </div>
          </section>

          {/* Servicio a domicilio (si aplica): sección discreta con chip teal,
              sin caja tint que compita con el resto. */}
          {appt.serviceType === 'DOMICILIO' && (
            <section className="px-5 py-5 space-y-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-xs font-bold" style={{ backgroundColor: TEAL }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
                </svg>
                Servicio a domicilio
              </span>
              {appt.deliveryAddress && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#e0f2f1' }}>
                    <svg className="w-5 h-5" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: MUTED }}>Dirección de entrega</p>
                    <p className="text-sm break-words mt-0.5" style={{ color: INK }}>{appt.deliveryAddress}</p>
                  </div>
                </div>
              )}
              {Number(appt.homeServiceFee) > 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t" style={{ borderColor: LINE }}>
                  <span className="font-medium" style={{ color: MUTED }}>Cargo por desplazamiento</span>
                  <span className="font-bold" style={{ color: INK }}>{formatCurrency(Number(appt.homeServiceFee), currency)}</span>
                </div>
              )}
            </section>
          )}

          {/* Fecha y hora */}
          <section className="px-5 py-5">
            <SectionLabel>Fecha y hora</SectionLabel>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#e0f2f1' }}>
                <svg className="w-5 h-5" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75" />
                </svg>
              </div>
              <div>
                <p className="text-[15px] font-bold first-letter:uppercase" style={{ color: INK }}>{date}</p>
                <p className="text-sm mt-0.5" style={{ color: MUTED }}>{time}{appt.endTime ? ` – ${endTime}` : ''}{totalDuration ? ` · ${totalDuration} min` : ''}</p>
              </div>
            </div>
          </section>

          {/* Especialista */}
          {appt.employee && (
            <section className="px-5 py-5">
              <SectionLabel>Especialista</SectionLabel>
              <button
                onClick={() => router.push(`/marketplace/${appt.tenant?.slug}/professional/${appt.employee.id}`)}
                className="flex items-center gap-3 w-full text-left"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 text-sm font-bold"
                  style={{ backgroundColor: appt.employee.color ? `${appt.employee.color}22` : '#e0f2f1', color: appt.employee.color || TEAL }}
                >
                  {appt.employee.avatarUrl ? (
                    <img src={`${API_URL}${appt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <>{appt.employee.firstName?.[0]}{appt.employee.lastName?.[0]}</>
                  )}
                </div>
                <p className="text-[15px] font-bold flex-1" style={{ color: INK }}>
                  {appt.employee.firstName} {appt.employee.lastName}
                </p>
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: MUTED }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </section>
          )}

          {/* Servicios */}
          {appt.items?.length > 0 && (
            <section className="px-5 py-5">
              <SectionLabel>Servicios</SectionLabel>
              <div className="space-y-2.5">
                {appt.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: INK }}>{item.serviceNameSnapshot}</p>
                      {item.durationSnapshot && (
                        <p className="text-xs mt-0.5" style={{ color: MUTED }}>{item.durationSnapshot} min</p>
                      )}
                    </div>
                    {item.priceSnapshot != null && (
                      <p className="text-sm font-bold" style={{ color: INK }}>{formatCurrency(Number(item.priceSnapshot), currency)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Productos reservados con la cita */}
          {visibleProducts.length > 0 && (
            <section className="px-5 py-5">
              <SectionLabel>Productos</SectionLabel>
              <div className="space-y-2.5">
                {visibleProducts.map((r: any) => {
                  const lineTotal = Number(r.unitPrice || 0) * Number(r.quantity || 1);
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      {r.product?.imageUrl ? (
                        <img
                          src={`${API_URL}${r.product.imageUrl}`}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: INK }}>{r.product?.name || 'Producto'}</p>
                        <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                          {formatCurrency(Number(r.unitPrice || 0), currency)}
                          {Number(r.quantity) > 1 ? ` × ${r.quantity}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold" style={{ color: INK }}>{formatCurrency(lineTotal, currency)}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Resumen del cobro: subtotales por categoría, descuento y TOTAL en
              teal grande separado por una línea superior. */}
          {(appt.items?.length > 0 || visibleProducts.length > 0) && (
            <section className="px-5 py-5">
              <SectionLabel>Resumen</SectionLabel>
              <div className="space-y-1.5">
                {servicesSubtotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <p style={{ color: MUTED }}>Servicios</p>
                    <p style={{ color: INK }}>{formatCurrency(servicesSubtotal, currency)}</p>
                  </div>
                )}
                {productsSubtotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <p style={{ color: MUTED }}>Productos</p>
                    <p style={{ color: INK }}>{formatCurrency(productsSubtotal, currency)}</p>
                  </div>
                )}
                {Number(appt.discountAmount) > 0 && (() => {
                  const fromRedemption = appt.redemption?.reward?.name;
                  const fromNotes = (() => {
                    const m = (appt.notes || '').match(/\[Promoci[oó]n: ([^\]]+)\]/);
                    if (m) return m[1];
                    const r = (appt.notes || '').match(/\[C[oó]digo 2x1: [^—]+— Promoci[oó]n: ([^\]]+)\]/);
                    if (r) return r[1];
                    return null;
                  })();
                  const label = fromRedemption || fromNotes || 'Cupón aplicado';
                  return (
                    <div className="flex justify-between text-sm">
                      <p className="font-semibold" style={{ color: '#0a7d54' }}>{label}</p>
                      <p className="font-semibold" style={{ color: '#0a7d54' }}>-{formatCurrency(Number(appt.discountAmount), currency)}</p>
                    </div>
                  );
                })()}
                <div className="flex items-end justify-between pt-3 mt-1 border-t" style={{ borderColor: LINE }}>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: MUTED }}>Total</p>
                  <p className="text-2xl font-extrabold tracking-[-0.02em]" style={{ color: TEAL }}>
                    {formatCurrency(grandTotal, currency)}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Cupón aplicado — se mantiene con su estilo de cupón de papel
              existente (stub teal + perforaciones). */}
          {appt.redemption?.reward && (
            <section className="px-5 py-5">
              <AppointmentCouponCard redemption={appt.redemption} currency={currency} />
            </section>
          )}

          {/* Fotos del resultado — subidas por el staff al cerrar la cita. */}
          {appt.photos?.length > 0 && (
            <section className="px-5 py-5">
              <SectionLabel>Fotos del resultado</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {appt.photos.map((ph: any) => (
                  <a
                    key={ph.id}
                    href={`${API_URL}${ph.imageUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border hover:border-[#008080] transition-colors aspect-square bg-gray-100"
                    style={{ borderColor: LINE }}
                  >
                    <img src={`${API_URL}${ph.imageUrl}`} alt={ph.caption || ''} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Pago */}
          {appt.payments?.[0] && (
            <section className="px-5 py-5">
              <SectionLabel>Pago</SectionLabel>
              <div className="flex items-center justify-between">
                <p className="text-sm capitalize" style={{ color: MUTED }}>{appt.payments[0].paymentMethod?.toLowerCase().replace('_', ' ') || '—'}</p>
                <p className="text-sm font-bold" style={{ color: INK }}>{formatCurrency(Number(appt.payments[0].totalAmount || 0), appt.payments[0].currency || currency)}</p>
              </div>
            </section>
          )}

          {/* Comprobante de pago — sección plana, sin recuadro grande. */}
          {!['CANCELLED', 'NO_SHOW'].includes(appt.status) && (
            <AppointmentProofRow appt={appt} />
          )}

          {/* Notas */}
          {appt.notes && (
            <section className="px-5 py-5">
              <SectionLabel>Notas</SectionLabel>
              <p className="text-sm" style={{ color: MUTED }}>{appt.notes}</p>
            </section>
          )}
        </div>

        {/* CTA "Dejar reseña" si ya pasó pero no se ha dejado y el usuario
            cerró el modal. Mismo gate: COMPLETED + pago registrado. */}
        {appt.status === 'COMPLETED' && (appt.payments || []).length > 0 && !appt.review && !reviewSubmitted && !showReview && (
          <div className="px-5 py-5">
            <button
              onClick={() => setShowReview(true)}
              className="w-full py-3 rounded-full text-sm font-bold text-white transition-colors"
              style={{ backgroundColor: TEAL }}
            >
              Dejar mi reseña
            </button>
          </div>
        )}
      </div>

      <DualReviewModal
        show={showReview}
        employeeName={`${appt.employee?.firstName || ''} ${appt.employee?.lastName || ''}`.trim()}
        businessName={appt.tenant?.name || ''}
        mode={appt.tenant?.tenantType === 'FREELANCER' ? 'freelancer' : 'business'}
        appointment={{
          services: (appt.items || []).map((i: any) => i.serviceNameSnapshot).join(', '),
          dateText: `${date}, ${time}`,
          professionals: reviewProfessionals,
          payment: reviewPayment,
        }}
        onSubmit={(payload) => submitReviewMutation.mutate(payload)}
        onSkip={() => setShowReview(false)}
        isLoading={submitReviewMutation.isPending}
      />
    </div>
  );
}

// Tarjeta visual de cupón aplicado en la cita — mismo diseño que la
// CouponCard de /marketplace/coupons (stub teal a la izquierda con valor
// + perforaciones + separador punteado + contenido principal a la
// derecha). Sin botón CANJEAR porque ya se usó en esta cita.
function AppointmentCouponCard({ redemption, currency }: { redemption: any; currency: string }) {
  const reward = redemption.reward;
  const isDiscount = reward?.type === 'DESCUENTO';

  const valueLabel = isDiscount
    ? (reward?.discountMode === 'PERCENT' || reward?.discountMode === 'PERCENTAGE'
      ? `-${Number(reward.discountAmount)}%`
      : `-${formatCurrency(Number(reward.discountAmount || 0), currency).replace(/\s?[A-Z]{3}$/, '')}`)
    : 'GRATIS';
  const stubFontSize = valueLabel.length <= 4 ? '1.125rem' : valueLabel.length <= 6 ? '0.875rem' : '0.75rem';

  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] mb-3" style={{ color: MUTED }}>Cupón aplicado</p>
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>
        {/* Stub izquierdo */}
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: '#008080' }}
        >
          <span
            className="text-white font-black leading-tight text-center break-all w-full px-2"
            style={{ fontSize: stubFontSize, wordBreak: 'break-all' }}
          >
            {valueLabel}
          </span>
          <span className="text-white/70 text-[9px] uppercase tracking-wider">
            {isDiscount ? 'descuento' : 'servicio'}
          </span>

          {/* Perforaciones */}
          <div
            className="absolute -right-3 -top-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#ffffff' }}
          />
          <div
            className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#ffffff' }}
          />
        </div>

        {/* Separador punteado */}
        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        {/* Contenido principal */}
        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">{reward?.name || 'Cupón'}</p>
              <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                APLICADO
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isDiscount
                ? (reward.discountMode === 'PERCENT' || reward.discountMode === 'PERCENTAGE'
                  ? `${Number(reward.discountAmount)}% de descuento`
                  : `${formatCurrency(Number(reward.discountAmount || 0), currency)} de descuento`)
                : 'Servicio gratis'}
            </p>
          </div>

          {redemption.code && (
            <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-gray-50 self-start">
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
              </svg>
              <span className="text-[10px] font-mono font-semibold text-gray-700 tracking-wider">
                {redemption.code}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Comprobante de pago en estilo plano: una sección más de la superficie
// (padding + label gris), sin recuadro con borde. Si ya hay imagen, muestra
// preview + "Reemplazar"; si no, "Pago pendiente" con botón discreto para subir.
function AppointmentProofRow({ appt }: { appt: any }) {
  const [error, setError] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = marketplaceApi.getAccessToken();
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API_URL}/api/marketplace/appointments/${appt.id}/payment-proof`, {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo subir el comprobante');
      }
      return r.json();
    },
    onSuccess: () => {
      setError('');
      // Full reload para garantizar que el cliente vea el nuevo estado de
      // la cita (con comprobante adjunto) sin que la query cacheada le
      // muestre el estado anterior por unos segundos.
      window.location.reload();
    },
    onError: (err: any) => setError(err?.message || 'Error al subir el comprobante'),
  });

  return (
    <section className="px-5 py-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: MUTED }}>Comprobante de pago</p>
        <span className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: appt.paymentProofUrl ? '#12a86e' : '#cdddd8' }}
          />
          {appt.paymentProofUrl ? 'Pagado' : 'Pago pendiente'}
        </span>
      </div>
      {appt.paymentProofUrl ? (
        <>
          <a
            href={`${API_URL}${appt.paymentProofUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl overflow-hidden border hover:border-[#008080] transition-colors"
            style={{ borderColor: LINE }}
          >
            <img src={`${API_URL}${appt.paymentProofUrl}`} alt="Comprobante" className="max-h-40 object-contain mx-auto" />
          </a>
          <label className="block mt-3 text-xs cursor-pointer hover:underline" style={{ color: TEAL }}>
            Reemplazar comprobante
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 5 * 1024 * 1024) { setError('La imagen no puede pesar más de 5MB'); return; }
                  uploadMutation.mutate(f);
                }
              }}
            />
          </label>
        </>
      ) : (
        <>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: MUTED }}>
            Sube la captura de tu pago (transferencia, depósito o cargo) para que el negocio confirme.
          </p>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border text-xs font-semibold cursor-pointer transition-colors hover:bg-[#f2f9f7]" style={{ borderColor: '#cdddd8', color: TEAL }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {uploadMutation.isPending ? 'Subiendo...' : 'Subir comprobante'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploadMutation.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 5 * 1024 * 1024) { setError('La imagen no puede pesar más de 5MB'); return; }
                  uploadMutation.mutate(f);
                }
              }}
            />
          </label>
        </>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </section>
  );
}
