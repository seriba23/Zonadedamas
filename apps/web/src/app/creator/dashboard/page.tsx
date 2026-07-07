'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  creatorApi,
  creatorLogout,
  getCreatorToken,
  creatorChangePassword,
} from '@/lib/creator-auth';
import { PasswordField, isPasswordValid } from '@/components/ui/password-field';

// Identidad NEGRA/tinta del portal de reclutamiento (nombre conservado).
const TEAL = '#111827';

// Número de WhatsApp del admin (incluye código de país, sin + ni espacios).
// Configurable vía NEXT_PUBLIC_SUPPORT_WHATSAPP.
const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '523334405600';

const STATE_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVO: { label: 'Nuevo', className: 'bg-gray-100 text-gray-600' },
  PAGANDO: { label: 'Pagando comisión', className: 'bg-gray-100 text-gray-800' },
  EN_RIESGO: { label: 'En riesgo', className: 'bg-red-50 text-red-600' },
  PERDIDO: { label: 'Perdido', className: 'bg-gray-100 text-gray-400' },
};

const CLIENT_FILTERS = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'ACTIVOS', label: 'Activos' },
  { key: 'POR_CUMPLIR', label: 'Por cumplir 3 meses' },
  { key: 'PAGANDO', label: '+3 meses (comisión)' },
  { key: 'INACTIVOS', label: 'Dejaron de pagar' },
];

function clientMatches(c: any, key: string): boolean {
  switch (key) {
    case 'ACTIVOS': return c.subscriptionStatus === 'ACTIVE';
    case 'POR_CUMPLIR': return c.state === 'ACTIVO';
    case 'PAGANDO': return c.state === 'PAGANDO';
    case 'INACTIVOS': return c.state === 'EN_RIESGO' || c.state === 'PERDIDO';
    default: return true;
  }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Dinero legible con separador de miles: 999999 -> "$999,999"
function money(n: number) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
}

const CLIENT_STATE_HELP = [
  { label: 'Nuevos', desc: 'En sus primeros 2 meses. Tienen descuento y aún no te generan comisión.', color: '#374151' },
  { label: 'Pagando comisión', desc: 'Ya pasaron el mes 3 y siguen activos: cada mes te generan comisión.', color: TEAL },
  { label: 'En riesgo', desc: 'Cancelaron su licencia pero todavía están dentro de la ventana de reactivación (60 días). Si vuelven, recuperas la comisión.', color: '#dc2626' },
  { label: 'Perdidos', desc: 'Cancelaron y pasó la ventana de 60 días: ya no te generan comisión.', color: '#9ca3af' },
];

export default function CreatorDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [tab, setTab] = useState<'dashboard' | 'clientes'>('dashboard');
  const [clientFilter, setClientFilter] = useState('TODOS');
  const [menuOpen, setMenuOpen] = useState(false);
  // Feedback del botón "Copiar" del código.
  const [copied, setCopied] = useState(false);
  // Error inline al configurar cobros (en vez de un alert seco del navegador).
  const [cobrosError, setCobrosError] = useState('');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showClientsInfo, setShowClientsInfo] = useState(false);

  useEffect(() => {
    if (!getCreatorToken()) {
      router.replace('/creator/login');
      return;
    }
    creatorApi
      .get<{ data: any }>('/api/creator/dashboard')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function configurarCobros() {
    setStripeBusy(true);
    setCobrosError('');
    try {
      const res = await creatorApi.post<{ data: { url: string } }>('/api/creator/stripe/onboarding-link');
      if (res?.data?.url) { window.location.href = res.data.url; return; }
      setCobrosError('No se pudo generar el enlace de configuración. Intenta de nuevo.');
    } catch (e: any) {
      setCobrosError(e?.message || 'No se pudo iniciar la configuración de cobros.');
    }
    setStripeBusy(false);
  }

  const inf = data?.influencer;
  const code = data?.codes?.[0]?.code;

  const filteredClients = useMemo(
    () => (data?.clients || []).filter((c: any) => clientMatches(c, clientFilter)),
    [data, clientFilter],
  );

  const waUrl = useMemo(() => {
    if (!inf) return '#';
    const text = `Hola, soy ${inf.firstName} ${inf.lastName} (creador en Siliba${code ? `, código ${code}` : ''}, ${inf.email}). Necesito ayuda con mi panel.`;
    return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
  }, [inf, code]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>;
  }
  if (!data || !inf) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-gray-600">No pudimos cargar tu panel.</p>
        <button onClick={creatorLogout} className="text-sm font-medium" style={{ color: TEAL }}>Cerrar sesión</button>
      </div>
    );
  }

  const totals = data.totals;
  const sc = data.stateCounts;
  const thisMonth = monthKey(new Date());
  const earnedThisMonth = (data.payouts || [])
    .filter((p: any) => p.forMonth === thisMonth)
    .reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between relative" style={{ background: `linear-gradient(135deg, #1f2937 0%, #000000 100%)` }}>
        <div>
          <p className="text-white/80 text-xs">Hola,</p>
          <h1 className="text-white text-lg font-bold">{inf.firstName} {inf.lastName}</h1>
        </div>
        <button onClick={() => setMenuOpen((o) => !o)} className="text-white p-2 -mr-2" aria-label="Menú">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-4 top-14 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-48">
              <button
                onClick={() => { setMenuOpen(false); setShowChangePwd(true); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cambiar contraseña
              </button>
              <button
                onClick={creatorLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-gray-50"
              >
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="inline-flex w-full rounded-lg border border-gray-300 bg-white p-1">
          {(['dashboard', 'clientes'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'text-white' : 'text-gray-600'
              }`}
              style={tab === t ? { backgroundColor: TEAL } : undefined}
            >
              {t === 'dashboard' ? 'Dashboard' : `Clientes (${data.clients.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {tab === 'dashboard' ? (
          <>
            {inf.status === 'PENDING' && (
              <div className="rounded-xl p-3 text-sm bg-white border border-gray-200 text-gray-600">
                Tu cuenta está <strong>pendiente de aprobación</strong>. Cuando un administrador la apruebe, tu código quedará activo.
              </div>
            )}

            {/* Tu código */}
            {code && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Tu código para compartir</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xl font-black" style={{ color: TEAL }}>{code}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(code)
                        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })
                        .catch(() => {});
                    }}
                    className="text-xs font-medium text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                    style={{ backgroundColor: copied ? '#059669' : TEAL }}
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        ¡Copiado!
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Cobros */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">Cobros</p>
              {inf.stripeOnboardingComplete ? (
                <p className="text-sm text-gray-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-900" /> Cobros activos — recibirás tus comisiones automáticamente.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-3">Configura tu cuenta para recibir tus comisiones por Stripe.</p>
                  <button onClick={configurarCobros} disabled={stripeBusy}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
                    {stripeBusy ? 'Abriendo...' : 'Configurar cobros'}
                  </button>
                  {cobrosError && (
                    <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-xs text-red-700">{cobrosError}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Ingresos */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
                <p className="text-[11px] text-gray-500">Este mes</p>
                <p className="text-base font-black tabular-nums whitespace-nowrap" style={{ color: TEAL }}>{money(earnedThisMonth)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
                <p className="text-[11px] text-gray-500">Acumulado</p>
                <p className="text-base font-black tabular-nums whitespace-nowrap text-gray-900">{money(totals.accrued)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
                <p className="text-[11px] text-gray-500">Pendiente</p>
                <p className="text-base font-black tabular-nums whitespace-nowrap text-gray-900">{money(totals.pending)}</p>
              </div>
            </div>

            {/* Resumen de clientes por estado */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-gray-800">Tus clientes</p>
                  <button
                    onClick={() => setShowClientsInfo(true)}
                    aria-label="Qué significa cada estado"
                    className="text-gray-400 hover:text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                  </button>
                </div>
                <button onClick={() => setTab('clientes')} className="text-xs font-medium" style={{ color: TEAL }}>
                  Ver todos →
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { n: sc.PAGANDO, label: 'Pagando', color: TEAL },
                  { n: sc.EN_RIESGO, label: 'En riesgo', color: '#dc2626' },
                  { n: sc.ACTIVO, label: 'Nuevos', color: '#374151' },
                  { n: sc.PERDIDO, label: 'Perdidos', color: '#9ca3af' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-black" style={{ color: s.color }}>{s.n}</p>
                    <p className="text-[11px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total de clientes */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">Total de clientes referidos</p>
              <p className="text-xl font-black text-gray-900">{totals.referredClients}</p>
            </div>

            {/* Historial de comisiones */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">Historial de comisiones</p>
              </div>
              {data.payouts.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-6 text-center">Sin comisiones todavía.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.payouts.map((p: any) => (
                    <li key={p.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                      <span className="text-gray-700">{p.forMonth}</span>
                      <span className="font-medium text-gray-900 tabular-nums">{money(p.amount)}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${p.transferred ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-500'}`}>
                        {p.transferred ? 'Pagado' : 'Pendiente'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Filtros de clientes */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {CLIENT_FILTERS.map((f) => {
                const active = clientFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setClientFilter(f.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      active ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    style={active ? { backgroundColor: TEAL } : undefined}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-gray-400">{filteredClients.length} cliente(s)</p>

            {/* Lista filtrada */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {filteredClients.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-8 text-center">
                  No hay clientes en este filtro.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredClients.map((c: any) => {
                    const badge = STATE_BADGE[c.state] || STATE_BADGE.ACTIVO;
                    return (
                      <li key={c.usageId} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.tenantName}</p>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}>{badge.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                          <span>{c.monthsActive} mes(es)</span>
                          <span>·</span>
                          <span className="tabular-nums">{money(c.commissionsSum)} generados</span>
                          {c.subscriptionStatus && (
                            <>
                              <span>·</span>
                              <span>{c.subscriptionStatus === 'ACTIVE' ? 'Licencia activa' : 'Licencia inactiva'}</span>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Botón flotante de WhatsApp */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full shadow-lg text-white font-medium text-sm"
        style={{ backgroundColor: '#25D366' }}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        ¿Necesitas ayuda?
      </a>

      {/* Modal cambiar contraseña */}
      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}

      {/* Modal info de estados de clientes */}
      {showClientsInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowClientsInfo(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">¿Qué significa cada estado?</h2>
              <button onClick={() => setShowClientsInfo(false)} className="text-gray-400 hover:text-gray-600 p-1 -mr-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ul className="space-y-3">
              {CLIENT_STATE_HELP.map((s) => (
                <li key={s.label} className="flex gap-3">
                  <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: s.color }} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowClientsInfo(false)} className="mt-5 w-full py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: TEAL }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal cambiar contraseña ───────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isPasswordValid(next)) {
      setError('La nueva contraseña no cumple los requisitos');
      return;
    }
    setLoading(true);
    try {
      await creatorChangePassword(current, next);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cambiar la contraseña');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        {done ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#e0f2f1' }}>
              <svg className="w-7 h-7" fill="none" stroke={TEAL} viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Contraseña actualizada</h2>
            <button onClick={onClose} className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: TEAL }}>
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Cambiar contraseña</h2>
            <div>
              <label className="text-xs text-gray-500">Contraseña actual</label>
              <div className="mt-1">
                <PasswordField value={current} onChange={setCurrent} placeholder="Contraseña actual" required />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Nueva contraseña</label>
              <div className="mt-1">
                <PasswordField value={next} onChange={setNext} placeholder="Nueva contraseña" showRequirements required />
              </div>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={loading || !current || !isPasswordValid(next)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
