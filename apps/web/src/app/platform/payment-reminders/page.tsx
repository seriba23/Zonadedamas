// ─────────────────────────────────────────────────────────────────────────────
// RUTA: /platform/payment-reminders  (Super Admin)
//
// Lista de negocios afiliados ordenados por proximidad de su pago de suscripción.
// Permite enviar, por WhatsApp, un recordatorio preescrito con el monto, la fecha
// y un enlace a su sección de suscripción para que paguen (tarjeta o transferencia).
// Empezamos a recordar cuando faltan 3 días o menos (filtro ajustable).
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-auth';
import { buildWhatsAppUrl, buildSubscriptionPaymentReminder } from '@/lib/whatsapp';
import dayjs from 'dayjs';

const TEAL = '#008080';
const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL || 'https://app.siliba.com';
// Enlace a la sección de suscripción del negocio (donde paga con tarjeta o ve
// las instrucciones de transferencia).
const SUBSCRIPTION_LINK = `${WEB_BASE}/dashboard/settings/subscription`;

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  tenantType: 'BUSINESS' | 'FREELANCER';
  subscription: {
    plan: string;
    status: string; // TRIAL | ACTIVE | PAST_DUE | SUSPENDED | CANCELLED
    monthlyAmountUsd: string;
    nextBillingDate: string;
    trialEndsAt: string | null;
  } | null;
  users?: { firstName: string; lastName: string }[];
}

// Días desde hoy hasta una fecha (negativo si ya pasó). Usa el día calendario.
function daysUntil(dateStr: string): number {
  return dayjs(dateStr).startOf('day').diff(dayjs().startOf('day'), 'day');
}

const WINDOW_OPTIONS = [3, 7, 15, 30];

export default function PaymentRemindersPage() {
  // Ventana de días: por defecto 3 (empezamos a recordar a los 3 días).
  const [windowDays, setWindowDays] = useState(3);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-payment-reminders'],
    queryFn: () =>
      platformApi.get<{ data: Tenant[] }>('/api/platform/tenants?perPage=100'),
  });

  const rows = useMemo(() => {
    const tenants = (data as any)?.data || [];
    return tenants
      .filter((t: Tenant) => t.subscription && t.subscription.status !== 'CANCELLED')
      .map((t: Tenant) => {
        const sub = t.subscription!;
        // Fecha de pago relevante: en TRIAL es el fin de prueba; si no, el próximo cobro.
        const dueDate =
          sub.status === 'TRIAL' ? sub.trialEndsAt || sub.nextBillingDate : sub.nextBillingDate;
        const daysLeft = dueDate ? daysUntil(dueDate) : 9999;
        const owner = t.users && t.users[0] ? `${t.users[0].firstName} ${t.users[0].lastName}`.trim() : '';
        return { t, sub, dueDate, daysLeft, owner };
      })
      .filter((r: any) => r.dueDate && r.daysLeft <= windowDays)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [data, windowDays]);

  function reminderUrl(r: any): string | null {
    if (!r.t.phone) return null;
    const msg = buildSubscriptionPaymentReminder({
      ownerName: r.owner ? r.owner.split(' ')[0] : undefined,
      tenantName: r.t.name,
      amount: Number(r.sub.monthlyAmountUsd || 0),
      dueDate: r.dueDate,
      daysLeft: r.daysLeft,
      link: SUBSCRIPTION_LINK,
    });
    return buildWhatsAppUrl(r.t.phone, msg);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Recordatorios de pago</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Negocios cuya suscripción vence pronto. Envía el recordatorio por WhatsApp con el monto,
          la fecha y el enlace para pagar.
        </p>
      </div>

      {/* Filtro de ventana de días */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-medium text-gray-500">Vencen en:</span>
        {WINDOW_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setWindowDays(d)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
            style={windowDays === d
              ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
              : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
            }
          >
            ≤ {d} días
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No hay negocios con pago próximo en esta ventana.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => {
            const url = reminderUrl(r);
            const overdue = r.daysLeft < 0;
            const urgent = r.daysLeft <= 3;
            return (
              <div key={r.t.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.t.name}</p>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {r.t.tenantType === 'FREELANCER' ? 'Freelancer' : 'Negocio'}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {r.sub.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-gray-500">
                    {r.owner && <span>{r.owner}</span>}
                    <span className="font-medium text-gray-700">${Number(r.sub.monthlyAmountUsd || 0)} MXN</span>
                    <span>Vence {dayjs(r.dueDate).format('D MMM YYYY')}</span>
                    {r.t.phone ? <span>{r.t.phone}</span> : <span className="text-gray-400">Sin teléfono</span>}
                  </div>
                </div>

                {/* Badge de días restantes */}
                <span
                  className={`flex-shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${
                    overdue
                      ? 'bg-red-100 text-red-700'
                      : urgent
                        ? 'bg-red-50 text-red-600'
                        : 'bg-teal-50 text-teal-700'
                  }`}
                >
                  {overdue ? `Vencida (${Math.abs(r.daysLeft)}d)` : r.daysLeft === 0 ? 'Hoy' : `${r.daysLeft}d`}
                </span>

                {/* Botón de recordatorio por WhatsApp */}
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Enviar recordatorio por WhatsApp"
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#25D366' }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                    Recordar
                  </a>
                ) : (
                  <span className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium bg-gray-100 text-gray-400">Sin teléfono</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
