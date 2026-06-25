// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/complete-profile-gate.tsx
// ROL: Modal automático que invita al usuario a completar su perfil.
//
// ¿Qué hace?
//   Después de que el usuario se registra (o inicia sesión), verifica
//   si le faltan datos obligatorios del perfil:
//     - Teléfono (phone)
//     - Fecha de nacimiento (birthDate)
//     - Género (gender)
//   Si alguno falta, muestra un modal (CompleteProfileModal) para
//   que el usuario los complete, pero lo hace con 800ms de retraso
//   para que primero se cargue y muestre la página principal.
//
// ¿Cuándo NO se muestra?
//   - Mientras carga el estado de auth (isLoading = true).
//   - Si el usuario no está autenticado.
//   - Si el usuario ya tiene todos los datos requeridos.
//   - Si el usuario ya cerró el modal esta sesión (sessionStorage).
//
// Uso de sessionStorage vs localStorage:
//   sessionStorage: datos que se borran al cerrar la pestaña/navegador.
//     → Perfecto aquí: si el usuario cierra el modal "saltándolo", no
//       lo molestamos en esa sesión, pero sí en la siguiente visita.
//   localStorage: datos que persisten indefinidamente.
// ============================================================

// 'use client': usa useState y useEffect → debe ejecutarse en el navegador.
'use client';

// useState: para controlar si el modal se muestra (show: boolean).
// useEffect: para ejecutar la lógica de verificación después del render.
import { useState, useEffect } from 'react';

// useMarketplaceAuth: hook que nos da el usuario autenticado,
// isAuthenticated, isLoading, y refreshUser (recarga datos del usuario
// desde la API, útil después de guardar el perfil).
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

// CompleteProfileModal: componente del modal que muestra los campos
// faltantes (teléfono, fecha de nacimiento, género) y los envía a la API.
import { CompleteProfileModal } from '@/components/ui/complete-profile-modal';

// ─── Clave del sessionStorage ─────────────────────────────────────
// Este string es la "llave" con la que guardamos en sessionStorage
// el hecho de que el usuario cerró el modal. Si esta clave existe
// en sessionStorage, no volvemos a mostrar el modal en esta sesión.
const DISMISSED_KEY = 'marketplace_profile_dismissed';

// ─── Función auxiliar: ¿El perfil está incompleto? ───────────────
// Recibe el objeto user (tipado como any porque el tipo exacto
// no está importado aquí) y devuelve true si falta algún dato.
// Datos obligatorios: teléfono, fecha de nacimiento, género.
// El operador ! convierte un valor a booleano negado:
//   !user.phone → true si phone es null, undefined o string vacío.
//   !user.birthDate → true si birthDate es null/undefined.
//   !user.gender → true si gender es null/undefined/''.
// El operador || (OR) devuelve true si ALGUNA condición es verdadera.
function isProfileIncomplete(user: any): boolean {
  return !user.phone || !user.birthDate || !user.gender;
}

// ─── Componente CompleteProfileGate ──────────────────────────────
// No recibe props: lee directamente del contexto de auth.
export function CompleteProfileGate() {
  // Extraemos del contexto de auth lo que necesitamos:
  //   user: objeto con los datos del usuario (firstName, email, phone...).
  //   isAuthenticated: ¿está el usuario logueado?
  //   isLoading: ¿está verificando el token aún?
  //   refreshUser: función para recargar los datos del usuario desde la API.
  const { user, isAuthenticated, isLoading, refreshUser } = useMarketplaceAuth();

  // show: estado local que controla si el modal está visible.
  // useState(false): empieza oculto. setShow(true) lo muestra.
  const [show, setShow] = useState(false);

  // useEffect: se ejecuta cuando cambian isLoading, isAuthenticated o user.
  // Aquí decidimos si mostramos el modal.
  useEffect(() => {
    // Retorno anticipado: no hacemos nada si...
    //   - isLoading: aún no sabemos el estado de auth.
    //   - !isAuthenticated: el usuario no tiene sesión.
    //   - !user: no tenemos datos del usuario aún.
    if (isLoading || !isAuthenticated || !user) return;

    // Verificamos si el usuario ya cerró el modal en esta sesión.
    // sessionStorage.getItem(DISMISSED_KEY) devuelve '1' si fue cerrado,
    // o null si no ha sido cerrado en esta sesión.
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed) return; // ya lo cerró → no molestamos de nuevo.

    // Verificamos si el perfil está incompleto.
    if (isProfileIncomplete(user)) {
      // Pequeño retraso de 800ms para que la página principal cargue
      // y sea visible antes de mostrar el modal. Mejor UX: el usuario
      // ve a dónde llegó antes de que aparezca el modal.
      // setTimeout devuelve un ID de timer que podemos cancelar con clearTimeout.
      const timer = setTimeout(() => setShow(true), 800);

      // Función de limpieza del useEffect:
      // React llama a esta función cuando el componente se desmonta
      // o cuando el efecto se vuelve a ejecutar. Cancela el timer
      // para evitar memory leaks (intentar setShow en componente desmontado).
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, user]);

  // Renderizado condicional con retorno anticipado:
  // Si show es false o no hay usuario → no renderizamos nada.
  if (!show || !user) return null;

  // Si show es true → renderizamos el modal de completar perfil.
  return (
    // CompleteProfileModal recibe:
    //   user: los datos actuales del usuario (tipado como any para flexibilidad).
    //   onComplete: callback que se llama cuando el usuario guarda los datos.
    //     → Ocultamos el modal (setShow(false)) y recargamos el usuario (refreshUser).
    //       refreshUser vuelve a pedir los datos a la API para que el gate
    //       no vuelva a mostrarse (ahora el perfil estará completo).
    //   onSkip: callback que se llama cuando el usuario cierra el modal sin completar.
    //     → Ocultamos el modal y guardamos en sessionStorage que fue descartado.
    //       Con '1' como valor (cualquier string sirve, solo necesitamos que exista).
    <CompleteProfileModal
      user={user as any}
      onComplete={() => {
        setShow(false);
        refreshUser();
      }}
      onSkip={() => {
        setShow(false);
        sessionStorage.setItem(DISMISSED_KEY, '1');
      }}
    />
  );
}
