'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import { formatDate } from '@/lib/utils';
import { ClientDrawer } from '@/components/clients/client-drawer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  color?: string | null;
}

interface AppointmentItem {
  serviceNameSnapshot: string;
  priceSnapshot: number;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  employee?: Employee | null;
  items: AppointmentItem[];
}

interface Payment {
  id: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  createdAt: string;
  appointmentId: string | null;
}

interface ActiveCoupon {
  id: string;
  code: string;
  expiresAt: string | null;
  reward: {
    name: string;
    type: 'SERVICIO' | 'DESCUENTO';
    discountAmount?: number | null;
    discountMode?: 'PERCENT' | 'FIXED' | null;
  };
}

interface Tag {
  tag: { id: string; name: string; color: string };
}

interface ClientSummary {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    loyaltyPoints: number;
    tags: Tag[];
    user?: { avatarUrl?: string | null } | null;
  };
  upcomingAppointments: Appointment[];
  completedAppointments: Appointment[];
  payments: Payment[];
  activeCoupons: ActiveCoupon[];
  stats: {
    totalCompletedAppointments: number;
    totalSpent: number;
    activeCouponsCount: number;
    loyaltyPoints: number;
  };
}

function sanitizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    POINTS: 'Puntos',
    STRIPE: 'Stripe',
    OTHER: 'Otro',
  };
  return map[method] || method;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: 'Agendada',
    CONFIRMED: 'Confirmada',
    IN_PROGRESS: 'En curso',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    NO_SHOW: 'No asistió',
  };
  return map[status] || status;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const { format: formatCurrency } = useCurrency();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['client-summary', clientId],
    queryFn: () => api.get<{ data: ClientSummary }>(`/api/clients/${clientId}/summary`),
    enabled: !!clientId,
  });

  const summary = data?.data;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/clients')}
          className="text-sm text-[#008080] hover:underline"
        >
          ← Volver a clientes
        </button>
        <p className="mt-4 text-gray-500 text-sm">Cliente no encontrado.</p>
      </div>
    );
  }

  const { client, upcomingAppointments, completedAppointments, payments, activeCoupons, stats } = summary;
  const avatarUrl = client.avatarUrl || client.user?.avatarUrl || null;
  const phoneRaw = client.phone || '';
  const phoneClean = sanitizePhone(phoneRaw);
  const hasPhone = phoneClean.length > 0;
  const hasEmail = !!client.email;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Volver */}
        <button
          onClick={() => router.push('/clients')}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#008080] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a clientes
        </button>

        {/* Header del cliente */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#e0f2f1] text-[#008080] flex items-center justify-center text-xl md:text-2xl font-semibold flex-shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={`${API_URL}${avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <>
                  {client.firstName.charAt(0)}
                  {client.lastName.charAt(0)}
                </>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900 truncate">
                {client.firstName} {client.lastName}
              </h1>
              <div className="mt-1 space-y-0.5 text-xs md:text-sm text-gray-600">
                {client.email && <p className="truncate">{client.email}</p>}
                {client.phone && <p>{client.phone}</p>}
              </div>

              {client.tags && client.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {client.tags.map((t) => (
                    <span
                      key={t.tag.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ backgroundColor: t.tag.color + '20', color: t.tag.color }}
                    >
                      {t.tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Iconos de contacto + editar */}
            <div className="flex flex-col md:flex-row items-end md:items-center gap-2">
              <div className="flex items-center gap-1.5">
                <a
                  href={hasPhone ? `tel:${phoneClean}` : undefined}
                  onClick={(e) => { if (!hasPhone) e.preventDefault(); }}
                  title={hasPhone ? `Llamar a ${phoneRaw}` : 'Sin teléfono'}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    hasPhone
                      ? 'bg-[#e0f2f1] text-[#008080] hover:bg-[#008080] hover:text-white'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </a>
                <a
                  href={hasPhone ? `https://wa.me/${phoneClean.replace(/^\+/, '')}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { if (!hasPhone) e.preventDefault(); }}
                  title={hasPhone ? `WhatsApp a ${phoneRaw}` : 'Sin teléfono'}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    hasPhone
                      ? 'bg-[#e0f2f1] text-[#008080] hover:bg-[#008080] hover:text-white'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                </a>
                <a
                  href={hasEmail ? `mailto:${client.email}` : undefined}
                  onClick={(e) => { if (!hasEmail) e.preventDefault(); }}
                  title={hasEmail ? `Enviar correo a ${client.email}` : 'Sin correo'}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    hasEmail
                      ? 'bg-[#e0f2f1] text-[#008080] hover:bg-[#008080] hover:text-white'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </a>
              </div>

              <button
                onClick={() => setIsEditOpen(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Editar
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Trabajos realizados" value={String(stats.totalCompletedAppointments)} />
          <StatCard label="Total gastado" value={formatCurrency(stats.totalSpent)} />
          <StatCard label="Cupones activos" value={String(stats.activeCouponsCount)} />
          <StatCard label="Puntos" value={String(stats.loyaltyPoints)} />
        </div>

        {/* Próximas citas */}
        <Section title="Próximas citas" count={upcomingAppointments.length}>
          {upcomingAppointments.length === 0 ? (
            <EmptyRow text="Sin citas próximas" />
          ) : (
            <div className="divide-y divide-gray-100">
              {upcomingAppointments.map((apt) => (
                <AppointmentRow
                  key={apt.id}
                  apt={apt}
                  formatCurrency={formatCurrency}
                  onClick={() => router.push(`/calendar?appointmentId=${apt.id}`)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Cupones activos */}
        <Section title="Cupones activos" count={activeCoupons.length}>
          {activeCoupons.length === 0 ? (
            <EmptyRow text="Sin cupones activos" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
              {activeCoupons.map((c) => (
                <div key={c.id} className="border border-dashed border-[#008080] rounded-lg p-3 bg-[#e0f2f1]/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {c.reward.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {c.reward.type === 'SERVICIO'
                          ? 'Servicio gratis'
                          : c.reward.discountMode === 'PERCENT'
                            ? `${c.reward.discountAmount}% descuento`
                            : `${formatCurrency(c.reward.discountAmount || 0)} descuento`}
                      </p>
                      {c.expiresAt && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          Vence el {formatDate(c.expiresAt)}
                        </p>
                      )}
                    </div>
                    <code className="text-xs font-mono bg-white border border-gray-200 rounded px-2 py-1 text-[#008080] font-semibold">
                      {c.code}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Trabajos realizados */}
        <Section title="Trabajos realizados" count={stats.totalCompletedAppointments}>
          {completedAppointments.length === 0 ? (
            <EmptyRow text="Aún no tiene trabajos completados" />
          ) : (
            <div className="divide-y divide-gray-100">
              {completedAppointments.map((apt) => (
                <AppointmentRow
                  key={apt.id}
                  apt={apt}
                  formatCurrency={formatCurrency}
                  onClick={() => router.push(`/calendar?appointmentId=${apt.id}`)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Pagos */}
        <Section title="Pagos" count={payments.length}>
          {payments.length === 0 ? (
            <EmptyRow text="Sin pagos registrados" />
          ) : (
            <div className="divide-y divide-gray-100">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {paymentMethodLabel(p.paymentMethod)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(p.createdAt)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[#008080] whitespace-nowrap">
                    {formatCurrency(p.totalAmount, p.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {isEditOpen && (
        <ClientDrawer
          clientId={clientId}
          onClose={() => {
            setIsEditOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
      <p className="text-[11px] md:text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg md:text-xl font-semibold text-gray-900 truncate">{value}</p>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="text-xs text-gray-500">{count}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-sm text-gray-500">{text}</p>;
}

function AppointmentRow({
  apt,
  formatCurrency,
  onClick,
}: {
  apt: Appointment;
  formatCurrency: (n: number) => string;
  onClick: () => void;
}) {
  const total = apt.items.reduce((sum, it) => sum + Number(it.priceSnapshot || 0), 0);
  const serviceNames = apt.items.map((it) => it.serviceNameSnapshot).join(', ');
  const employeeColor = apt.employee?.color || '#008080';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      {apt.employee && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden"
          style={{
            backgroundColor: employeeColor + '20',
            color: employeeColor,
          }}
        >
          {apt.employee.avatarUrl ? (
            <img
              src={`${API_URL}${apt.employee.avatarUrl}`}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              {apt.employee.firstName.charAt(0)}
              {apt.employee.lastName.charAt(0)}
            </>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {serviceNames || statusLabel(apt.status)}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatDate(apt.startTime, 'D MMM YYYY, HH:mm')}
          {apt.employee && ` · ${apt.employee.firstName} ${apt.employee.lastName}`}
        </p>
      </div>
      <span className="text-sm font-semibold text-[#008080] whitespace-nowrap">
        {formatCurrency(total)}
      </span>
    </button>
  );
}
