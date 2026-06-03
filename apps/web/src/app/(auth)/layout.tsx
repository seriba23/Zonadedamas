'use client';

import { ForceLightTheme } from '@/components/ui/force-light-theme';

/**
 * Layout del grupo de rutas (auth): login, register, forgot-password, etc.
 * El modo oscuro vive solo en el dashboard administrativo. Las pantallas
 * de autenticación tienen que mantenerse en claro independientemente del
 * `data-theme` persistido en localStorage por el ThemeToggle.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ForceLightTheme />
      {children}
    </>
  );
}
