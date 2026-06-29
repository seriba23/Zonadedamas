'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTenantTier } from '@/lib/hooks/use-tenant-tier';
import { Sidebar } from '@/components/layout/sidebar';
import { SubscriptionBanner } from '@/components/subscription-banner';
import { useWebSocket, EmployeeJoinedEvent, PurchaseCreatedEvent } from '@/lib/hooks/use-websocket';
import { useCurrency } from '@/lib/hooks/use-currency';
import { TopbarActionProvider, useTopbarAction } from '@/lib/hooks/use-topbar-action';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useEnsurePushSubscription } from '@/lib/hooks/use-staff-notifications';

function EmployeeJoinedNotification({
  employee,
  onDismiss,
}: {
  employee: EmployeeJoinedEvent;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right w-96 max-w-[calc(100vw-2rem)]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-[#008080] px-5 py-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <span className="text-white font-semibold text-sm">Nuevo empleado se ha unido</span>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-full bg-[#e0f2f1] flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-[#008080]">
                {employee.firstName[0]}{employee.lastName[0]}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{employee.firstName} {employee.lastName}</p>
              <p className="text-xs text-gray-500">{employee.email}</p>
            </div>
          </div>
          {employee.jobTitle && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">Puesto:</span>
              <span className="text-xs font-semibold text-[#008080] bg-teal-50 border border-teal-100 rounded-full px-2.5 py-0.5">{employee.jobTitle}</span>
            </div>
          )}
          <button
            onClick={onDismiss}
            className="w-full mt-3 py-2 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#008080' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006666')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008080')}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseCreatedNotification({
  purchase,
  onDismiss,
}: {
  purchase: PurchaseCreatedEvent;
  onDismiss: () => void;
}) {
  const { format: formatCurrency } = useCurrency();
  const itemCount = purchase.items.reduce((sum, it) => sum + it.quantity, 0);
  const fulfillmentLabel = purchase.fulfillmentType === 'SHIPPING' ? 'Envío' : 'Recoger en tienda';
  const paymentLabel =
    purchase.paymentMethod === 'CASH' ? 'Efectivo' :
    purchase.paymentMethod === 'SPEI' ? 'SPEI' :
    purchase.paymentMethod === 'CARD' ? 'Tarjeta' : purchase.paymentMethod;
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right w-96 max-w-[calc(100vw-2rem)]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-[#008080] px-5 py-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <span className="text-white font-semibold text-sm">Nueva compra recibida</span>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-gray-900">{purchase.customerName}</p>
              <p className="text-xs text-gray-500">{purchase.customerEmail || purchase.customerPhone}</p>
            </div>
            <p className="text-base font-bold text-[#008080]">{formatCurrency(purchase.total)}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 mb-3">
            {purchase.items.slice(0, 3).map((it) => (
              <div key={it.productId} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate flex-1">{it.productName}</span>
                <span className="text-gray-500 ml-2 flex-shrink-0">×{it.quantity}</span>
              </div>
            ))}
            {purchase.items.length > 3 && (
              <p className="text-[10px] text-gray-400">+{purchase.items.length - 3} producto(s) más</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-[10px] font-semibold text-[#008080] bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5">
              {itemCount} artículo{itemCount !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
              {fulfillmentLabel}
            </span>
            <span className="text-[10px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
              {paymentLabel}
            </span>
          </div>

          <button
            onClick={onDismiss}
            className="w-full mt-1 py-2 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#008080' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006666')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008080')}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

function getSectionTitle(pathname: string): string {
  if (pathname.startsWith('/home')) return 'Inicio';
  if (pathname.startsWith('/calendar')) return 'Citas';
  if (pathname.startsWith('/reminders')) return 'Recordatorios';
  if (pathname.startsWith('/clients')) return 'Clientes';
  if (pathname.startsWith('/staff')) return 'Personal';
  if (pathname.startsWith('/services/')) return 'Detalle del servicio';
  if (pathname === '/services') return 'Servicios';
  if (pathname.startsWith('/bundles')) return 'Paquetes';
  if (pathname.startsWith('/rewards')) return 'Cupones';
  if (pathname.startsWith('/inventory')) return 'Inventario';
  if (pathname.startsWith('/suppliers')) return 'Proveedores';
  if (pathname.startsWith('/resources')) return 'Activos y Recursos';
  if (pathname.startsWith('/shop')) return 'Tienda';
  if (pathname.startsWith('/reservations')) return 'Apartados';
  if (pathname.startsWith('/reports')) return 'Reportes';
  if (pathname.startsWith('/payments')) return 'Pagos';
  if (pathname.startsWith('/pos')) return 'Punto de Venta';
  if (pathname.startsWith('/settings/notifications')) return 'Notificaciones';
  if (pathname.startsWith('/settings/business')) return 'Negocio';
  if (pathname.startsWith('/settings/locations')) return 'Ubicaciones';
  if (pathname.startsWith('/settings/hours/employees')) return 'Horarios de Empleados';
  if (pathname.startsWith('/settings/hours')) return 'Horarios del Negocio';
  if (pathname.startsWith('/settings/payments')) return 'Pagos';
  if (pathname.startsWith('/settings/qr')) return 'QR';
  if (pathname.startsWith('/settings/invite-codes')) return 'Códigos de invitación';
  if (pathname.startsWith('/settings/subscription')) return 'Suscripción';
  if (pathname.startsWith('/settings/shop')) return 'Tienda';
  if (pathname.startsWith('/settings/roles')) return 'Roles y Permisos';
  if (pathname.startsWith('/settings')) return 'Configuración';
  if (pathname.startsWith('/dashboard')) return 'Inicio';
  return 'Siliba';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TopbarActionProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </TopbarActionProvider>
  );
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isFreelancer } = useTenantTier();
  const router = useRouter();
  const pathname = usePathname();
  const { notifications, dismissNotification, purchases, dismissPurchase } = useWebSocket();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const topbarAction = useTopbarAction();
  // Contenedor scrolleable principal: al cambiar de sección lo llevamos al tope.
  const mainRef = useRef<HTMLElement>(null);

  useEnsurePushSubscription();

  // Cerrar drawer al navegar entre paginas (mobile) y volver al tope de la sección.
  useEffect(() => {
    setIsSidebarOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  // Freelancer no entra al admin: su unica interfaz es /employee. Esto
  // evita exponer secciones de "negocio con equipo" (sucursales, personal,
  // tienda) que no aplican a un independiente.
  useEffect(() => {
    if (!isLoading && isAuthenticated && isFreelancer) {
      router.replace('/employee');
    }
  }, [isLoading, isAuthenticated, isFreelancer, router]);

  // Redirect to suspended page if subscription is suspended
  useEffect(() => {
    if (
      user?.subscriptionStatus === 'SUSPENDED' &&
      pathname !== '/suspended'
    ) {
      router.replace('/suspended');
    }
  }, [user?.subscriptionStatus, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Mientras el useEffect anterior redirige, no renderizamos el shell admin
  // para evitar parpadeo de UI que no corresponde al freelancer.
  if (isFreelancer) {
    return null;
  }

  const sectionTitle = getSectionTitle(pathname);

  return (
    <div className="flex h-[100dvh]" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        {/* Topbar (mobile + desktop) — titulo centrado a TODO el viewport en mobile. */}
        <header
          className="relative sticky top-0 z-40 flex items-center px-3 md:px-6 py-2.5 md:py-3"
          style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden relative z-10 p-2 -ml-2 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
            aria-label="Abrir menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* Toggle de tema visible junto al hamburger en mobile */}
          <div className="md:hidden relative z-10">
            <ThemeToggle />
          </div>
          <h1 className="pointer-events-none absolute inset-0 flex items-center justify-center text-base font-semibold text-[var(--text-primary)] truncate px-24 md:relative md:px-0 md:inset-auto md:flex-1 md:justify-start md:text-xl md:pointer-events-auto">
            <span className="truncate">{sectionTitle}</span>
          </h1>
          <div className="relative z-10 ml-auto flex items-center gap-2 flex-shrink-0">
            {topbarAction && <div>{topbarAction}</div>}
            <NotificationBell basePath="" />
          </div>
        </header>

        <SubscriptionBanner status={user?.subscriptionStatus || 'ACTIVE'} trialEndsAt={user?.trialEndsAt} />
        <main ref={mainRef} className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Real-time notifications */}
      {notifications.length > 0 && (
        <EmployeeJoinedNotification
          employee={notifications[0]}
          onDismiss={() => dismissNotification(notifications[0].id)}
        />
      )}
      {purchases.length > 0 && notifications.length === 0 && (
        <PurchaseCreatedNotification
          purchase={purchases[0]}
          onDismiss={() => dismissPurchase(purchases[0].id)}
        />
      )}
    </div>
  );
}
