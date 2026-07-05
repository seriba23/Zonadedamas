// ─────────────────────────────────────────────────────────────────────────────
// RUTA: /employee/clients
//
// Sección de Clientes del portal del profesional independiente (freelancer).
// Reutiliza EXACTAMENTE la misma página de clientes del panel de administración;
// esa página detecta el portal (via usePathname) y navega al detalle/volver dentro
// de /employee para no sacar al freelancer de su portal.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import ClientsPage from '@/app/(dashboard)/clients/page';

export default function EmployeeClientsPage() {
  return <ClientsPage />;
}
