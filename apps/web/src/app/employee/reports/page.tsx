// ─────────────────────────────────────────────────────────────────────────────
// RUTA: /employee/reports
//
// Reportes del FREELANCER (profesional independiente). Reutiliza EXACTAMENTE el
// mismo reporte del administrador, pero con hideTeam=true para ocultar la sección
// "Empleados destacados": el freelancer trabaja solo, así que sus datos ya son
// individuales (su negocio = él mismo) y no necesita desgloses de equipo.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import AdminReportsPage from '@/app/(dashboard)/reports/page';

// El propio reporte detecta que es un freelancer (por el tipo de cuenta) y oculta
// la sección de equipo. Aquí solo lo montamos dentro del portal del empleado.
export default function FreelancerReportsPage() {
  return <AdminReportsPage />;
}
