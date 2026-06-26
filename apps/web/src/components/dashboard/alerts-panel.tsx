// NOTA: este archivo tiene errores TypeScript preexistentes — no se modifican.
// 'use client': componente de navegador (usa useQuery y renderiza JSX dinámico).
'use client';

// Link: componente de Next.js para navegación interna (evita recarga completa de página).
import Link from 'next/link';
// useQuery: consulta al backend con caché y refresco automático.
import { useQuery } from '@tanstack/react-query';
// api: cliente HTTP del proyecto.
import { api } from '@/lib/api';

// AlertCounts: interfaz con los contadores de alertas que devuelve el backend.
// Estos campos vienen del endpoint /api/reports/alerts.
interface AlertCounts {
  lowStockCount: number;                           // Productos con stock bajo
  pendingReservations: number;                     // Apartados pendientes de confirmar
  unconfirmedAppointments: number;                 // Citas en estado PENDING (sin confirmar)
  unconfirmedRange: { from: string | null; to: string | null }; // Rango de fechas de las citas sin confirmar
}

// AlertsPanel: panel de alertas accionables que aparece en el home del dashboard.
// Solo se muestra si hay alertas con count > 0. Devuelve null si no hay nada que mostrar.
export function AlertsPanel() {
  // useQuery: consulta GET al endpoint de alertas con refresco cada 60 segundos.
  // refetchInterval: 60_000 → el _ es un separador visual (60_000 = 60000 ms = 1 min).
  const { data } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => api.get<AlertCounts>('/api/reports/alerts'),
    refetchInterval: 60_000,
  });

  // data?.data: acceso seguro (si data es undefined, devuelve undefined sin error).
  const alerts = data?.data;
  // Early return: si los datos aún no llegaron (undefined), no renderiza nada.
  if (!alerts) return null;

  // stock bajo y apartados pendientes ya se entregan al staff via el
  // sistema de notificaciones (bell + push); ya no se duplican aqui.
  // Solo se mantiene "citas sin confirmar" porque es un estado acumulado
  // (no un evento puntual) y conviene tenerlo visible en el home.
  // items: array de alertas a mostrar. Cada objeto tiene count, label, href e icono.
  // .filter((a) => a.count > 0): elimina las alertas con count = 0 (no hay nada que alertar).
  const items = [
    {
      count: alerts.unconfirmedAppointments, // Cuántas citas sin confirmar hay
      label: 'citas por confirmar',
      action: 'Ver citas',
      // href: URL del calendario. Si conocemos el rango exacto, pasamos from/to como query params
      // para que el calendario muestre exactamente esas N citas.
      // ?.from && ?.to: solo si ambos valores son no-nulos (??. acceso seguro + && evaluación corta).
      // Si conocemos el rango exacto, abrir el calendario en vista
      // Personalizada con from-to ajustados para mostrar las N citas.
      href: alerts.unconfirmedRange?.from && alerts.unconfirmedRange?.to
        ? `/calendar?status=PENDING&view=custom&from=${alerts.unconfirmedRange.from}&to=${alerts.unconfirmedRange.to}`
        : '/calendar?status=PENDING', // Fallback: filtrar por estado PENDING sin rango
      // icon: JSX con el ícono SVG de calendario (inline SVG, no necesita imagen externa).
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
  ].filter((a) => a.count > 0); // Solo mostrar alertas con count mayor a 0

  // Si no hay ninguna alerta activa → no renderizar el panel.
  if (items.length === 0) return null;

  // Renderiza una tarjeta por cada alerta activa.
  // Link: hace que cada tarjeta sea un enlace al calendario con el filtro correcto.
  // key={item.label}: clave única para la lista (el label es único en este contexto).
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="card card-highlight flex items-center gap-3 hover:shadow-sm transition-shadow"
        >
          {/* Ícono en círculo teal claro */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--primary-tint)', color: 'var(--primary-tint-fg)' }}
          >
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            {/* El count va en negrita + más grande para destacar el número. */}
            <p className="text-sm font-semibold" style={{ color: 'var(--primary-tint-fg)' }}>
              <span className="text-base font-bold">{item.count}</span> {item.label}
            </p>
            {/* Llamada a acción con flecha → */}
            <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--primary-tint-fg)' }}>{item.action} →</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
