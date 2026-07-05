'use client';

import { useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import { formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { AppointmentModal } from '@/components/appointments/appointment-modal';
import { useAuth } from '@/lib/hooks/use-auth';
import { buildWhatsAppUrl, buildEmergencyContactMessage, buildClaimMessage } from '@/lib/whatsapp';

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

interface PurchaseItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Purchase {
  id: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  createdAt: string;
  items: PurchaseItem[];
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
    creditBalance?: number | string | null;
    tags: Tag[];
    userId?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    // Datos que el cliente mantiene en su cuenta de la plataforma (validada).
    user?: { avatarUrl?: string | null; allergies?: string | null; birthDate?: string | null; gender?: string | null } | null;
    profile?: { allergies?: string | null; dateOfBirth?: string | null; gender?: string | null } | null;
    allergies?: string | null;
    emergencyContactName?: string | null;
    emergencyContactLastName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
  };
  upcomingAppointments: Appointment[];
  completedAppointments: Appointment[];
  payments: Payment[];
  purchases: Purchase[];
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

function genderLabel(g: string): string {
  const map: Record<string, string> = {
    MALE: 'Masculino',
    FEMALE: 'Femenino',
    NON_BINARY: 'No binario',
    PREFER_NOT_SAY: 'Prefiere no decir',
    OTHER: 'Otro',
  };
  return map[g] || g;
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
  // Volver a la lista correcta según el portal (admin vs freelancer).
  const pathname = usePathname();
  const clientsBase = pathname?.startsWith('/employee') ? '/employee/clients' : '/clients';
  const { format: formatCurrency } = useCurrency();
  const { user } = useAuth();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  // Edición del crédito a favor del cliente: null = no editando; string = valor en edición.
  const [creditEdit, setCreditEdit] = useState<string | null>(null);
  const [savingCredit, setSavingCredit] = useState(false);
  // Modal del contacto de emergencia (detalles + llamar / WhatsApp).
  const [showEmergency, setShowEmergency] = useState(false);
  // inviting: mientras se genera el token y se abre WhatsApp para invitar al
  // cliente a activar/vincular su cuenta real de la plataforma.
  const [inviting, setInviting] = useState(false);

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
          onClick={() => router.push(clientsBase)}
          className="text-sm text-[#008080] hover:underline"
        >
          ← Volver a clientes
        </button>
        <p className="mt-4 text-gray-500 text-sm">Cliente no encontrado.</p>
      </div>
    );
  }

  const { client, upcomingAppointments, completedAppointments, payments, purchases, activeCoupons, stats } = summary;

  // handleInvite: genera el token de reclamo y abre WhatsApp con el enlace para
  // que el cliente active/vincule su cuenta real de la plataforma.
  async function handleInvite() {
    if (!client.phone || inviting) return;
    setInviting(true);
    try {
      const res = await api.post<{ data: { token: string } }>(`/api/clients/${clientId}/claim-token`, {});
      const msg = buildClaimMessage({
        clientFirstName: client.firstName,
        tenantName: (user as any)?.tenantName || 'nuestro negocio',
        token: res.data.token,
      });
      const url = buildWhatsAppUrl(client.phone, msg);
      if (url) window.open(url, '_blank');
      else alert('El teléfono del cliente no es válido para WhatsApp.');
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'No se pudo generar la invitación.');
    } finally {
      setInviting(false);
    }
  }
  const creditBalance = Math.max(0, Number(client.creditBalance || 0));

  // Guarda el nuevo saldo de crédito (el negocio lo ajusta a mano al usarlo).
  const saveCredit = async () => {
    setSavingCredit(true);
    try {
      await api.put(`/api/clients/${clientId}`, { creditBalance: Math.max(0, Number(creditEdit) || 0) });
      setCreditEdit(null);
      refetch();
    } catch (err: any) {
      alert(err?.message || 'No se pudo actualizar el crédito');
    } finally {
      setSavingCredit(false);
    }
  };
  const avatarUrl = client.avatarUrl || client.user?.avatarUrl || null;
  const phoneRaw = client.phone || '';
  const phoneClean = sanitizePhone(phoneRaw);
  const hasPhone = phoneClean.length > 0;
  const hasEmail = !!client.email;
  // ¿La ficha está vinculada a una cuenta real de la plataforma? (validado)
  const isLinked = !!(client.userId || client.user);
  // Datos del perfil del cliente. Preferimos lo que el propio cliente mantiene
  // en su cuenta (perfil > titular) y caemos a lo que registró el negocio (ficha).
  const clientAllergies = client.profile?.allergies || client.user?.allergies || client.allergies || null;
  const clientBirthDate = client.profile?.dateOfBirth || client.user?.birthDate || client.dateOfBirth || null;
  const clientGender = client.profile?.gender || client.user?.gender || client.gender || null;
  // Contacto de emergencia.
  const emName = [client.emergencyContactName, client.emergencyContactLastName].filter(Boolean).join(' ').trim();
  const emPhoneClean = sanitizePhone(client.emergencyContactPhone || '');
  const hasEmergency = !!(emName || emPhoneClean);
  const iconBtnBase = 'w-9 h-9 rounded-full flex items-center justify-center transition-colors';
  const iconBtnActive = 'bg-[var(--primary-tint)] text-[var(--primary-tint-fg)] hover:bg-[#008080] hover:text-white';
  const iconBtnDisabled = 'bg-gray-100 text-gray-300 cursor-not-allowed';

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Volver */}
        <button
          onClick={() => router.push(clientsBase)}
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
            <Avatar
              avatarUrl={avatarUrl}
              firstName={client.firstName}
              lastName={client.lastName}
              className="w-16 h-16 md:w-20 md:h-20"
              textClassName="text-xl md:text-2xl"
              ring={isLinked}
            />

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

            {/* Iconos de contacto */}
            <div className="flex items-center gap-1.5">
                <a
                  href={hasPhone ? `tel:${phoneClean}` : undefined}
                  onClick={(e) => { if (!hasPhone) e.preventDefault(); }}
                  title={hasPhone ? `Llamar a ${phoneRaw}` : 'Sin teléfono'}
                  className={`${iconBtnBase} ${hasPhone ? iconBtnActive : iconBtnDisabled}`}
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
                  className={`${iconBtnBase} ${hasPhone ? iconBtnActive : iconBtnDisabled}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                </a>
                <a
                  href={hasEmail ? `mailto:${client.email}` : undefined}
                  onClick={(e) => { if (!hasEmail) e.preventDefault(); }}
                  title={hasEmail ? `Enviar correo a ${client.email}` : 'Sin correo'}
                  className={`${iconBtnBase} ${hasEmail ? iconBtnActive : iconBtnDisabled}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </a>
                {/* 4º icono: contacto de emergencia. Abre un modal con los datos
                    y botones para llamar / WhatsApp. */}
                <button
                  type="button"
                  onClick={() => { if (hasEmergency) setShowEmergency(true); }}
                  title={hasEmergency ? 'Contacto de emergencia' : 'Sin contacto de emergencia'}
                  className={`${iconBtnBase} ${hasEmergency ? iconBtnActive : iconBtnDisabled}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
            </div>
          </div>

          {/* Invitación a la plataforma: enviar enlace por WhatsApp para que el
              cliente active/vincule su cuenta real, o distintivo si ya está. */}
          {client.user ? (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#e4f5ee', color: '#0a7d54' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#12a86e' }} />
              Cuenta de la plataforma vinculada
            </div>
          ) : hasPhone ? (
            <button
              onClick={handleInvite}
              disabled={inviting}
              className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#25D366' }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
              {inviting ? 'Generando…' : 'Invitar por WhatsApp'}
            </button>
          ) : null}
        </div>

        {/* Alergias del cliente — alerta evidente. */}
        {clientAllergies && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-800">
              <span className="font-semibold">Alergias del cliente:</span> {clientAllergies}
            </p>
          </div>
        )}

        {/* Datos del perfil del cliente. Cuando la cuenta está validada, muchos
            de estos datos los mantiene el propio cliente. NUNCA mostramos su
            dirección (esa solo se usa al hacer un pedido a domicilio). */}
        {(clientBirthDate || clientGender || hasEmergency) && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Datos del perfil</h2>
              {isLinked && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e4f5ee', color: '#0a7d54' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#12a86e' }} />
                  Cuenta verificada
                </span>
              )}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {clientBirthDate && (
                <div className="flex justify-between sm:block">
                  <dt className="text-gray-500">Fecha de nacimiento</dt>
                  <dd className="text-gray-900 font-medium sm:mt-0.5">{formatDate(clientBirthDate)}</dd>
                </div>
              )}
              {clientGender && (
                <div className="flex justify-between sm:block">
                  <dt className="text-gray-500">Género</dt>
                  <dd className="text-gray-900 font-medium sm:mt-0.5">{genderLabel(clientGender)}</dd>
                </div>
              )}
              {hasEmergency && (
                <div className="flex justify-between sm:block sm:col-span-2">
                  <dt className="text-gray-500">Contacto de emergencia</dt>
                  <dd className="text-gray-900 font-medium sm:mt-0.5">
                    {[client.emergencyContactName, client.emergencyContactLastName].filter(Boolean).join(' ')}
                    {client.emergencyContactPhone ? ` · ${client.emergencyContactPhone}` : ''}
                    {client.emergencyContactRelation ? ` (${client.emergencyContactRelation})` : ''}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Trabajos realizados" value={String(stats.totalCompletedAppointments)} />
          <StatCard label="Total gastado" value={formatCurrency(stats.totalSpent)} />
          <StatCard label="Cupones activos" value={String(stats.activeCouponsCount)} />
          <StatCard label="Puntos" value={String(stats.loyaltyPoints)} />
        </div>

        {/* Crédito a favor del cliente (ej. anticipo de cita cancelada). El
            negocio lo descuenta a mano al cobrar y aquí ajusta el saldo. */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Crédito a favor</p>
            {creditEdit === null ? (
              <p className="text-xl font-bold" style={{ color: '#008080' }}>{formatCurrency(creditBalance)}</p>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={creditEdit}
                    onChange={(e) => setCreditEdit(e.target.value.replace(/[^0-9.]/g, ''))}
                    autoFocus
                    className="w-28 pl-6 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]"
                  />
                </div>
                <button onClick={saveCredit} disabled={savingCredit} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
                  {savingCredit ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setCreditEdit(null)} className="text-xs text-gray-500 px-2">Cancelar</button>
              </div>
            )}
          </div>
          {creditEdit === null && (
            <button
              onClick={() => setCreditEdit(creditBalance ? String(creditBalance) : '')}
              className="text-xs font-medium text-[#008080] hover:underline flex-shrink-0"
            >
              Ajustar
            </button>
          )}
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
                  onClick={() => setSelectedAppointmentId(apt.id)}
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
                  onClick={() => setSelectedAppointmentId(apt.id)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Compras */}
        {purchases.length > 0 && (
          <Section title="Compras" count={purchases.length}>
            <div className="divide-y divide-gray-100">
              {purchases.map((p) => (
                <div key={p.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      {formatDate(p.createdAt)} · {paymentMethodLabel(p.paymentMethod)}
                    </p>
                    <span className="text-sm font-semibold text-[#008080] whitespace-nowrap">
                      {formatCurrency(p.totalAmount, p.currency)}
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {p.items.map((it) => (
                      <li key={it.id} className="text-sm text-gray-700 flex items-center justify-between gap-2">
                        <span className="truncate">
                          {it.quantity}× {it.description}
                        </span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatCurrency(Number(it.totalPrice), p.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}

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

      {selectedAppointmentId && (
        <AppointmentModal
          appointmentId={selectedAppointmentId}
          onClose={() => setSelectedAppointmentId(null)}
          onSave={() => {
            setSelectedAppointmentId(null);
            refetch();
          }}
        />
      )}

      {/* Modal del contacto de emergencia */}
      {showEmergency && hasEmergency && (() => {
        const emWaUrl = buildWhatsAppUrl(
          client.emergencyContactPhone || '',
          buildEmergencyContactMessage({
            contactName: client.emergencyContactName || undefined,
            clientName: `${client.firstName} ${client.lastName}`.trim(),
            tenantName: user?.tenantName || 'tu negocio',
          }),
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowEmergency(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Contacto de emergencia</h3>
                <button onClick={() => setShowEmergency(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-5 py-4 space-y-2 text-sm">
                {emName && (
                  <div className="flex justify-between gap-3"><span className="text-gray-500">Nombre</span><span className="font-medium text-gray-900 text-right">{emName}</span></div>
                )}
                {client.emergencyContactRelation && (
                  <div className="flex justify-between gap-3"><span className="text-gray-500">Relación</span><span className="font-medium text-gray-900 text-right">{client.emergencyContactRelation}</span></div>
                )}
                {client.emergencyContactPhone && (
                  <div className="flex justify-between gap-3"><span className="text-gray-500">Teléfono</span><span className="font-medium text-gray-900 text-right">{client.emergencyContactPhone}</span></div>
                )}
                {!client.emergencyContactPhone && (
                  <p className="text-xs text-gray-400">Sin teléfono registrado para este contacto.</p>
                )}
              </div>
              <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-2">
                <a
                  href={emPhoneClean ? `tel:${emPhoneClean}` : undefined}
                  onClick={(e) => { if (!emPhoneClean) e.preventDefault(); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-1.5 ${emPhoneClean ? 'bg-[#008080] text-white hover:bg-[#006666]' : 'bg-gray-100 text-gray-300 cursor-not-allowed'} transition-colors`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                  Llamar
                </a>
                <a
                  href={emWaUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { if (!emWaUrl) e.preventDefault(); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-1.5 ${emWaUrl ? 'bg-[#25D366] text-white hover:opacity-90' : 'bg-gray-100 text-gray-300 cursor-not-allowed'} transition-colors`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        );
      })()}
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
        <Avatar
          avatarUrl={apt.employee.avatarUrl}
          firstName={apt.employee.firstName}
          lastName={apt.employee.lastName}
          color={employeeColor}
          className="w-8 h-8"
          textClassName="text-xs"
        />
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
