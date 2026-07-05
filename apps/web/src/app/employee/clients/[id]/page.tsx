// ─────────────────────────────────────────────────────────────────────────────
// RUTA: /employee/clients/[id]
//
// Detalle de cliente en el portal del profesional independiente. Reutiliza la
// misma página de detalle del panel admin (lee el id via useParams y "volver"
// según el portal). Así el freelancer gestiona sus clientes sin salir de /employee.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import ClientDetailPage from '@/app/(dashboard)/clients/[id]/page';

export default function EmployeeClientDetailPage() {
  return <ClientDetailPage />;
}
