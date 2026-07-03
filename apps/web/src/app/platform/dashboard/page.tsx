// ============================================================
// ARCHIVO: apps/web/src/app/platform/dashboard/page.tsx
// RUTA EN EL NAVEGADOR: /platform/dashboard
//
// Panel de control principal del Super Admin. Muestra una
// vista rápida del estado general de la plataforma Siliba:
// cuántos negocios hay, cuántos pagan, ingresos, y los
// últimos negocios registrados.
//
// ¿QUÉ MUESTRA?
// 1. Tarjetas KPI (indicadores clave de rendimiento):
//    - Total negocios, activos, en prueba, pago pendiente, etc.
//    - Ingresos totales e ingresos del mes actual
// 2. Lista de los últimos negocios registrados en la plataforma
//
// ¿CÓMO OBTIENE LOS DATOS?
// Hace una sola petición GET a /api/platform/dashboard al
// montarse el componente, usando useEffect + platformApi.
// ============================================================

// 'use client': usa hooks de React (useState, useEffect) → cliente.
'use client';

// useState: para guardar los datos del dashboard y el estado de carga.
// useEffect: para hacer la petición a la API cuando el componente aparece.
import { useState, useEffect } from 'react';

// Link: componente de Next.js para navegación sin recarga de página.
// Algunos KPIs son clicables y llevan a listas filtradas.
import Link from 'next/link';

// platformApi: cliente HTTP preconfigurado para el área de Super Admin.
// Añade automáticamente el token JWT del super admin en cada petición.
import { platformApi } from '@/lib/platform-auth';

// ─── TIPOS DE TYPESCRIPT ─────────────────────────────────
// TypeScript usa "interface" para describir la forma de los objetos.
// Esto ayuda a detectar errores en tiempo de desarrollo.

// DashboardData: forma exacta de los datos que devuelve la API.
interface DashboardData {
  // kpis: objeto con contadores y montos agregados de la plataforma.
  kpis: {
    totalTenants: number;        // Total de negocios registrados en la plataforma.
    activeTenants: number;       // Negocios con suscripción ACTIVE.
    trialTenants: number;        // Negocios en período de prueba (TRIAL).
    suspendedTenants: number;    // Negocios suspendidos.
    pastDueTenants: number;      // Negocios con pago vencido (PAST_DUE).
    newTenantsThisMonth: number; // Nuevos registros en el mes actual.
    totalRevenue: number;        // Suma de todos los ingresos históricos (USD).
    revenueThisMonth: number;    // Ingresos del mes en curso (USD).
  };
  // subscriptionsByPlan: cuántos negocios hay por cada plan de suscripción.
  // Array de objetos {plan: string, count: number}.
  subscriptionsByPlan: Array<{ plan: string; count: number }>;
  // recentRegistrations: los negocios registrados más recientemente.
  recentRegistrations: Array<{
    id: string;
    name: string;
    slug: string;                              // URL amigable del negocio (ej: "salon-maria").
    email: string;
    businessType: string | null;              // Puede ser null si no definió tipo.
    createdAt: string;                        // Fecha de creación (string ISO).
    subscription: { plan: string; status: string } | null; // null si no tiene suscripción.
  }>;
}

// STATUS_LABELS: objeto que mapea códigos de estado → texto legible en español.
// Record<string, string> = objeto cuyas claves y valores son strings.
// Uso: STATUS_LABELS['TRIAL'] → 'Prueba'
const STATUS_LABELS: Record<string, string> = {
  TRIAL: 'Prueba',
  ACTIVE: 'Activo',
  PAST_DUE: 'Pago pendiente',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
};

// STATUS_BADGES: mapea códigos de estado → clases CSS de Tailwind para colorear badges.
// Uso: STATUS_BADGES['ACTIVE'] → 'bg-green-100 text-green-700'
const STATUS_BADGES: Record<string, string> = {
  TRIAL: 'bg-teal-100 text-teal-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

// Componente principal de la página de Dashboard.
export default function PlatformDashboardPage() {
  // data: los datos del dashboard cargados desde la API.
  // null significa "aún no cargados" o "error al cargar".
  const [data, setData] = useState<DashboardData | null>(null);

  // loading: true mientras se espera la respuesta de la API.
  const [loading, setLoading] = useState(true);

  // useEffect con arreglo vacío []: se ejecuta UNA sola vez cuando el
  // componente aparece en pantalla (equivalente a "componentDidMount").
  useEffect(() => {
    // platformApi.get hace una petición GET al endpoint del dashboard.
    // El tipo genérico <{ data: DashboardData }> le dice a TypeScript la
    // forma de la respuesta esperada.
    platformApi
      .get<{ data: DashboardData }>('/api/platform/dashboard')
      // .then: si la petición tuvo éxito, guarda los datos en el estado.
      // res.data es la propiedad "data" del objeto JSON de respuesta.
      .then((res) => setData(res.data))
      // .catch: si hay error (ej. red caída, 401), lo registra en consola.
      .catch(console.error)
      // .finally: siempre se ejecuta (éxito o error). Desactiva el spinner.
      .finally(() => setLoading(false));
  }, []); // Arreglo vacío: no hay dependencias, se ejecuta solo al montar.

  // Si está cargando O los datos son null, muestra un spinner centrado.
  // El operador "||" hace que la condición sea verdadera si CUALQUIERA es true.
  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        {/* Spinner SVG giratorio */}
        <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // kpiCards: arreglo que define cada tarjeta KPI a mostrar.
  // Se construye AQUÍ (después de tener datos) para poder usar data.kpis.
  // Cada objeto tiene:
  //   - label: texto descriptivo
  //   - value: número o string del indicador
  //   - color: clase CSS para el color del número
  //   - link (opcional): URL a la que lleva al hacer clic
  const kpiCards = [
    { label: 'Total negocios', value: data.kpis.totalTenants, color: 'text-gray-900', link: '/platform/tenants' },
    // Cada KPI con "link" navega a la lista de negocios ya filtrada por ese criterio.
    { label: 'Activos', value: data.kpis.activeTenants, color: 'text-green-600', link: '/platform/tenants?status=ACTIVE' },
    { label: 'En período de prueba', value: data.kpis.trialTenants, color: 'text-teal-600', link: '/platform/tenants?status=TRIAL' },
    { label: 'Pago pendiente', value: data.kpis.pastDueTenants, color: 'text-amber-600', link: '/platform/tenants?status=PAST_DUE' },
    { label: 'Suspendidos', value: data.kpis.suspendedTenants, color: 'text-red-600', link: '/platform/tenants?status=SUSPENDED' },
    { label: 'Nuevos este mes', value: data.kpis.newTenantsThisMonth, color: 'text-blue-600', link: '/platform/tenants?new=month' },
    // .toFixed(2): formatea el número con exactamente 2 decimales (ej. "1234.50").
    { label: 'Ingresos totales', value: `$${data.kpis.totalRevenue.toFixed(2)}`, color: 'text-gray-900' },
    { label: 'Ingresos este mes', value: `$${data.kpis.revenueThisMonth.toFixed(2)}`, color: 'text-green-600' },
  ];

  // ── RENDERIZADO ──────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* KPI Cards */}
      {/* grid: rejilla CSS. cols-2 en móvil, cols-4 en pantallas medianas (md ≥ 768px). */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* .map() recorre kpiCards y genera una tarjeta por cada KPI.
            kpi = objeto actual de la iteración. */}
        {kpiCards.map((kpi) => {
          // content: el JSX visual de la tarjeta (igual para todos).
          // Se define aquí porque se reutiliza en dos ramas del ternario.
          const content = (
            // Si tiene link, el borde cambia a teal al pasar el mouse (hover).
            <div className={`bg-white rounded-xl border border-gray-200 p-4 ${kpi.link ? 'hover:border-teal-300 cursor-pointer transition-colors' : ''}`}>
              {/* Etiqueta descriptiva pequeña */}
              <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
              {/* Valor grande. kpi.color aplica el color específico del KPI. */}
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          );

          // Si el KPI tiene una propiedad "link", envuelve la tarjeta en un Link.
          // Si no tiene link, solo es un div. Ternario: condición ? A : B.
          return kpi.link ? (
            // key={kpi.label}: identificador único para React. Usamos label porque es único.
            <Link key={kpi.label} href={kpi.link}>{content}</Link>
          ) : (
            <div key={kpi.label}>{content}</div>
          );
        })}
      </div>

      {/* Recent registrations */}
      {/* Tarjeta con los negocios más recientemente registrados */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Registros recientes</h2>
        <div className="space-y-3">
          {/* Itera sobre recentRegistrations. "t" = tenant (negocio actual). */}
          {data.recentRegistrations.map((t) => (
            // Cada fila es un Link que lleva al detalle del negocio.
            // ${t.id} inserta el id del negocio en la URL dinámica.
            <Link key={t.id} href={`/platform/tenants/${t.id}`} className="flex items-center justify-between hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors">
              <div>
                {/* Nombre del negocio */}
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                {/* Email de contacto */}
                <p className="text-xs text-gray-500">{t.email}</p>
              </div>
              {/* Badge de estado de suscripción.
                  Se muestra solo si t.subscription no es null (operador &&). */}
              {t.subscription && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGES[t.subscription.status] || 'bg-gray-100 text-gray-700'}`}>
                  {/* STATUS_LABELS[...]: busca el texto en español.
                      Si no existe en el diccionario, el operador "||" muestra el código original. */}
                  {STATUS_LABELS[t.subscription.status] || t.subscription.status}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
