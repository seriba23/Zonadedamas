// ─────────────────────────────────────────────────────────────────────────────
// /creator/welcome — pantalla de bienvenida al programa de Creadores.
//
// Es el destino del deep-link de la notificación DORADA que recibe el usuario en
// su consola normal cuando lo aprueban como creador. Muestra el modal dorado con
// la explicación de comisiones y el botón para entrar al portal "ya logueado".
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { CreatorWelcomeModal } from '@/components/creator/creator-welcome-modal';

export default function CreatorWelcomePage() {
  // Tomamos el nombre de la sesión activa de Siliba para un saludo personalizado.
  const { user } = useAuth();

  return (
    // Fondo suave por si el usuario llega directo por URL (sin la consola detrás).
    <div className="min-h-[100dvh] bg-gray-50">
      <CreatorWelcomeModal firstName={user?.firstName} />
    </div>
  );
}
