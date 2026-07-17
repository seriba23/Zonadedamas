// ─────────────────────────────────────────────────────────────────────────────
// /creator/login — RETIRADO.
//
// El portal de creadores ya NO tiene login propio (email + contraseña). El
// acceso es por SSO con la sesión de Siliba desde /creator/access. Esta ruta se
// conserva solo para redirigir cualquier enlace/bookmark antiguo a la nueva
// puerta de acceso, en vez de mostrar un 404.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreatorLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/creator/access');
  }, [router]);
  return <div className="min-h-[100dvh] bg-black" />;
}
