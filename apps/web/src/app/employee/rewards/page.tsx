// ─────────────────────────────────────────────────────────────────────────────
// RUTA: /employee/rewards  (obsoleta para el profesional independiente)
//
// Un profesional independiente NO crea cupones/recompensas (puede dar puntos por
// servicio, pero no cupones para canjearlos). Esta ruta ya no está en su menú;
// aquí solo redirige a Servicios por si algún enlace/bookmark antiguo la abre.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployeeRewardsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/employee/services');
  }, [router]);
  return null;
}
