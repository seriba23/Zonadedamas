'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency as rawFormatCurrency, resolveImageUrl } from '@/lib/utils';
import { useCurrency } from '@/lib/hooks/use-currency';
import dayjs from 'dayjs';
import { DatePicker } from '@/components/ui/date-picker';
import { CloseAppointmentWizard } from './close-wizard';
import { formatBookingTime, formatBookingDay, formatBookingMonthShort, formatBookingWeekday } from '@/lib/booking-time';

interface AppointmentItem {
  serviceId: string;
  serviceNameSnapshot: string;
  priceSnapshot: string | number;
  durationSnapshot: number;
}

interface ProductReservation {
  id: string;
  quantity: number;
  unitPrice: string | number;
  product: { id: string; name: string; imageUrl: string | null };
}

interface AppointmentRedemption {
  id: string;
  code: string;
  reward: { name: string; type: string; discountAmount?: string | number; discountMode?: string };
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  photoConsent: boolean | null;
  discountAmount: string | number | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    allergies?: string | null;
    user?: { avatarUrl?: string | null; allergies?: string | null } | null;
  };
  items: AppointmentItem[];
  productReservations?: ProductReservation[];
  redemption?: AppointmentRedemption | null;
}

type RangeFilter = 'today' | 'week' | 'month' | 'custom';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Ausente', color: 'bg-gray-100 text-gray-800' },
};

// Estilo inline para badges (igual al de marketplace/appointments para
// consistencia visual entre vista cliente y vista empleado).
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  CONFIRMED: { bg: '#d1fae5', color: '#059669' },
  RESCHEDULED: { bg: '#fed7aa', color: '#ea580c' },
  IN_PROGRESS: { bg: '#dbeafe', color: '#2563eb' },
  COMPLETED: { bg: '#f3f4f6', color: '#6b7280' },
  CANCELLED: { bg: '#fee2e2', color: '#dc2626' },
  NO_SHOW: { bg: '#fee2e2', color: '#dc2626' },
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  RESCHEDULED: 'Reagendada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Ausente',
};

function getDateRange(range: RangeFilter, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const today = dayjs();
  switch (range) {
    case 'today':
      return { startDate: today.format('YYYY-MM-DD'), endDate: today.format('YYYY-MM-DD') };
    case 'week':
      return { startDate: today.startOf('week').format('YYYY-MM-DD'), endDate: today.endOf('week').format('YYYY-MM-DD') };
    case 'month':
      return { startDate: today.startOf('month').format('YYYY-MM-DD'), endDate: today.endOf('month').format('YYYY-MM-DD') };
    case 'custom':
      return { startDate: customStart || today.format('YYYY-MM-DD'), endDate: customEnd || today.format('YYYY-MM-DD') };
  }
}

export default function EmployeeAppointmentsPage() {
  const { user } = useAuth();
  const currencyHook = useCurrency();
  const formatCurrency = currencyHook?.format ?? rawFormatCurrency;
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeFilter>('today');
  const [customStart, setCustomStart] = useState(dayjs().format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [wizardApt, setWizardApt] = useState<Appointment | null>(null);

  const { startDate, endDate } = getDateRange(range, customStart, customEnd);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['employee-appointments', user?.employeeId, startDate, endDate],
    queryFn: async () => {
      if (!user?.employeeId) return [];
      const res = await api.get<{ data: Appointment[] }>(
        `/api/appointments?employeeId=${user.employeeId}&startDate=${startDate}&endDate=${endDate}`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/appointments/${id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
      setSelectedApt(null);
    },
  });

  const handleWizardDone = () => {
    queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
    setWizardApt(null);
    setSelectedApt(null);
  };

  const noShowMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/appointments/${id}/no-show`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
      setSelectedApt(null);
    },
  });

  const sorted = (appointments || [])
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Group by date for week/month view
  const grouped = new Map<string, Appointment[]>();
  sorted.forEach((apt) => {
    const dateKey = dayjs.utc(apt.startTime).format('YYYY-MM-DD');
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(apt);
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Mis Citas</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {([
              { key: 'today' as RangeFilter, label: 'Día' },
              { key: 'week' as RangeFilter, label: 'Semana' },
              { key: 'month' as RangeFilter, label: 'Mes' },
              { key: 'custom' as RangeFilter, label: 'Personalizado' },
            ]).map((filter) => (
              <button
                key={filter.key}
                onClick={() => setRange(filter.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 ${
                  range === filter.key
                    ? 'bg-[#008080] text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input-field w-auto text-sm py-1.5" />
              <span className="text-gray-500">-</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input-field w-auto text-sm py-1.5" />
            </div>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {!isLoading && sorted.length > 0 && (
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-500">
            {sorted.length} cita{sorted.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            {sorted.filter((a) => a.status === 'COMPLETED').length} completada{sorted.filter((a) => a.status === 'COMPLETED').length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-700">
            {formatCurrency(sorted.filter((a) => a.status === 'COMPLETED').reduce((s, a) => s + a.items.reduce((ss, i) => ss + Number(i.priceSnapshot), 0), 0))} generados
          </span>
        </div>
      )}

      <div>
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando...</div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            No hay citas en este período
          </div>
        ) : range === 'today' ? (
          <div className="space-y-3">
            {sorted.map((apt) => (
              <AppointmentRow
                key={apt.id}
                apt={apt}
                showDate={false}
                onClick={() => setSelectedApt(apt)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(grouped.entries()).map(([dateKey, apts]) => (
              <section key={dateKey}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                  {dayjs(dateKey).format('dddd, D [de] MMMM')}
                </p>
                <div className="space-y-3">
                  {apts.map((apt) => (
                    <AppointmentRow
                      key={apt.id}
                      apt={apt}
                      showDate={false}
                      onClick={() => setSelectedApt(apt)}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedApt && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setSelectedApt(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Detalle de cita</h3>
                <button
                  onClick={() => setSelectedApt(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status */}
              {(() => {
                const st = STATUS_LABELS[selectedApt.status] || STATUS_LABELS.PENDING;
                return (
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 ${st.color}`}>
                    {st.label}
                  </span>
                );
              })()}

              {/* Date/Time */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {dayjs.utc(selectedApt.startTime).format('dddd, D [de] MMMM YYYY')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dayjs.utc(selectedApt.startTime).format('h:mm A')} - {dayjs.utc(selectedApt.endTime).format('h:mm A')}
                    </p>
                  </div>
                </div>

                {/* Client */}
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedApt.client.firstName} {selectedApt.client.lastName}
                    </p>
                    {selectedApt.client.phone && (
                      <p className="text-xs text-gray-500">{selectedApt.client.phone}</p>
                    )}
                    {selectedApt.client.email && (
                      <p className="text-xs text-gray-500">{selectedApt.client.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Alergias del cliente — visible solo si el cliente las
                  registro en su perfil del marketplace. Importante para el
                  empleado: evita reacciones alergicas al usar productos
                  durante el servicio. */}
              {(() => {
                const allergies = selectedApt.client.user?.allergies || selectedApt.client.allergies;
                if (!allergies || !allergies.trim()) return null;
                return (
                  <div className="mb-5 p-3 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-0.5">
                        Alergias del cliente
                      </p>
                      <p className="text-sm text-amber-900 break-words">{allergies}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Services + Products + Discount + Total */}
              {(() => {
                const servicesSubtotal = selectedApt.items.reduce(
                  (s, i) => s + Number(i.priceSnapshot),
                  0,
                );
                const products = selectedApt.productReservations || [];
                const productsSubtotal = products.reduce(
                  (s, p) => s + Number(p.unitPrice) * p.quantity,
                  0,
                );
                const discount = Number(selectedApt.discountAmount || 0);
                const total = Math.max(0, servicesSubtotal + productsSubtotal - discount);

                // Nombre del cupón si lo hay: del redemption o de las notas.
                const couponLabel = (() => {
                  if (selectedApt.redemption?.reward?.name) return selectedApt.redemption.reward.name;
                  const m = (selectedApt.notes || '').match(/\[Cup[oó]n: ([^\]]+)\]/);
                  if (m) return m[1];
                  const p = (selectedApt.notes || '').match(/\[Promoci[oó]n: ([^\]]+)\]/);
                  if (p) return p[1];
                  const r = (selectedApt.notes || '').match(/\[C[oó]digo 2x1: [^—]+— (?:Cup[oó]n|Promoci[oó]n): ([^\]]+)\]/);
                  if (r) return r[1];
                  return discount > 0 ? 'Cupón aplicado' : null;
                })();

                return (
                  <div className="border-t border-gray-100 pt-4 mb-4">
                    {/* Servicios */}
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Servicios</p>
                    {selectedApt.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <div>
                          <p className="text-sm text-gray-700">{item.serviceNameSnapshot}</p>
                          <p className="text-xs text-gray-400">{item.durationSnapshot} min</p>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(Number(item.priceSnapshot))}
                        </span>
                      </div>
                    ))}

                    {/* Productos */}
                    {products.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 mt-3 mb-2 uppercase">Productos</p>
                        {products.map((p) => (
                          <div key={p.id} className="flex items-center justify-between py-1.5">
                            <p className="text-sm text-gray-700">
                              {p.quantity}× {p.product.name}
                            </p>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(Number(p.unitPrice) * p.quantity)}
                            </span>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Desglose */}
                    <div className="pt-3 mt-2 border-t border-gray-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Subtotal servicios</span>
                        <span className="text-xs text-gray-700">{formatCurrency(servicesSubtotal)}</span>
                      </div>
                      {productsSubtotal > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Subtotal productos</span>
                          <span className="text-xs text-gray-700">{formatCurrency(productsSubtotal)}</span>
                        </div>
                      )}
                      {discount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-green-600 font-medium">
                            {couponLabel || 'Descuento'}
                          </span>
                          <span className="text-xs text-green-600 font-medium">
                            -{formatCurrency(discount)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-sm font-semibold text-gray-900">Total</span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(total)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              {selectedApt.notes && (
                <div className="border-t border-gray-100 pt-4 mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Notas</p>
                  <p className="text-sm text-gray-600">{selectedApt.notes}</p>
                </div>
              )}

              {/* Actions */}
              {['CONFIRMED', 'IN_PROGRESS'].includes(selectedApt.status) && (
                <div className="border-t border-gray-100 pt-4 flex gap-2">
                  <button
                    onClick={() => setWizardApt(selectedApt)}
                    className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors"
                    style={{ backgroundColor: '#008080' }}
                  >
                    Cerrar cita
                  </button>
                  <button
                    onClick={() => noShowMutation.mutate(selectedApt.id)}
                    disabled={noShowMutation.isPending}
                    className="py-2.5 px-4 text-sm font-medium border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Ausente
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Close Wizard */}
      {wizardApt && (
        <CloseAppointmentWizard
          appointment={wizardApt}
          onDone={handleWizardDone}
          onClose={() => setWizardApt(null)}
        />
      )}
    </div>
  );
}

function AppointmentRow({
  apt,
  showDate,
  onClick,
  formatCurrency,
}: {
  apt: Appointment;
  showDate: boolean;
  onClick: () => void;
  formatCurrency: (amount: number) => string;
}) {
  const style = STATUS_STYLE[apt.status] || STATUS_STYLE.PENDING;
  const services = apt.items.map((i) => i.serviceNameSnapshot).join(', ') || '—';
  const servicesSubtotal = apt.items.reduce(
    (sum, i) => sum + Number(i.priceSnapshot),
    0,
  );
  const productsSubtotal = (apt.productReservations || []).reduce(
    (sum, p) => sum + Number(p.unitPrice) * p.quantity,
    0,
  );
  const discount = Number(apt.discountAmount || 0);
  const totalPrice = Math.max(0, servicesSubtotal + productsSubtotal - discount);
  const hasDiscount = discount > 0;

  // Avatar del cliente: foto si existe, fallback a iniciales sobre teal.
  // Si el cliente registró cuenta en el portal, su foto está en user.avatarUrl.
  const initials = `${apt.client.firstName?.[0] || ''}${apt.client.lastName?.[0] || ''}`.toUpperCase();
  const clientColor = '#008080';
  const clientAvatarUrl = resolveImageUrl(
    (apt.client as any).avatarUrl || (apt.client as any).user?.avatarUrl,
  );

  // Fecha desglosada (mismo formato que marketplace card).
  // No usamos new Date(...) porque convierte a TZ del browser. La hora
  // se muestra siempre como "hora del negocio" (raw).
  const day = formatBookingDay(apt.startTime);
  const month = formatBookingMonthShort(apt.startTime);
  const time = formatBookingTime(apt.startTime);
  const weekday = formatBookingWeekday(apt.startTime);

  // Nombre del cupón si lo hay (mismo fallback que el detalle)
  const couponLabel = (() => {
    if ((apt as any).redemption?.reward?.name) return (apt as any).redemption.reward.name;
    const notes = apt.notes || '';
    const m = notes.match(/\[Cup[oó]n: ([^\]]+)\]/);
    if (m) return m[1];
    const p = notes.match(/\[Promoci[oó]n: ([^\]]+)\]/);
    if (p) return p[1];
    const r = notes.match(/\[C[oó]digo 2x1: [^—]+— (?:Cup[oó]n|Promoci[oó]n): ([^\]]+)\]/);
    if (r) return r[1];
    return discount > 0 ? 'Cupón aplicado' : null;
  })();

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow"
    >
      {/* Header: nombre del cliente + status badge */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {apt.client.firstName} {apt.client.lastName}
        </p>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {STATUS_LABEL[apt.status] || apt.status}
        </span>
      </div>

      {/* Main content */}
      <div className="flex items-center gap-3">
        {/* Avatar del cliente: foto si existe, fallback a iniciales */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0 ring-2 ring-white shadow"
          style={{ backgroundColor: clientColor }}
        >
          {clientAvatarUrl ? (
            <img src={clientAvatarUrl} alt="" className="w-full h-full object-cover" />
          ) : initials ? (
            initials
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
          )}
        </div>

        {/* Servicios + total */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate">{services}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            {hasDiscount && (
              <span className="text-[10px] text-gray-400 line-through leading-none">
                {formatCurrency(servicesSubtotal + productsSubtotal)}
              </span>
            )}
            <span className={`text-sm font-semibold ${hasDiscount ? 'text-green-600' : 'text-gray-900'}`}>
              {formatCurrency(totalPrice)}
            </span>
          </div>
        </div>

        {/* Fecha grande a la derecha */}
        <div className="flex-shrink-0 text-right">
          <p className="text-2xl font-bold text-gray-900 leading-none">{day}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase">{month}</p>
          <p className="text-sm font-semibold mt-1" style={{ color: '#008080' }}>{time}</p>
          <p className="text-[10px] text-gray-400 capitalize">{weekday}</p>
        </div>
      </div>

      {/* Cupón aplicado */}
      {hasDiscount && (
        <div className="mt-3 flex items-center justify-between text-xs bg-green-50 rounded-lg px-3 py-2 border border-green-100">
          <span className="text-green-700 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            </svg>
            {couponLabel}
          </span>
          <span className="text-green-700 font-bold">-{formatCurrency(discount)}</span>
        </div>
      )}
    </button>
  );
}
