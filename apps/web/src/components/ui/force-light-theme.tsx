'use client';

import { useEffect } from 'react';

/**
 * Forza el tema claro en el árbol donde se monta. Se usa en layouts no-admin
 * (marketplace, portal cliente, empleado, platform) porque el modo oscuro
 * sólo está habilitado en el dashboard de administrador por ahora — el
 * resto se mostrará en oscuro de forma involuntaria si el usuario ya tenía
 * `localStorage.theme = "dark"` cuando entra desde otro portal.
 *
 * Cuando se desmonta NO restaura nada: el toggle del dashboard volverá a
 * leer su preferencia desde localStorage al re-montar.
 */
export function ForceLightTheme() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = 'light';
  }, []);
  return null;
}
