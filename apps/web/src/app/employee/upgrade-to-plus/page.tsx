'use client';

// La comparativa Pro vs Plus vivía aquí, pero quedó integrada como upsell dentro
// de la pantalla de Suscripción del profesional. Esta ruta solo redirige, para que
// cualquier enlace/bookmark antiguo lleve al lugar correcto (y no a la vista rota).

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UpgradeToPlusRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/employee/subscription');
  }, [router]);
  return null;
}
