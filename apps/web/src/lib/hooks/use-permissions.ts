'use client';

import { useAuth } from './use-auth';

interface PermissionsHook {
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (perms: string[]) => boolean;
  hasAllPermissions: (perms: string[]) => boolean;
  permissions: string[];
}

export function usePermissions(): PermissionsHook {
  const { user } = useAuth();
  const permissions = user?.permissions || [];

  const hasPermission = (permission: string): boolean =>
    permissions.includes(permission);

  const hasAnyPermission = (perms: string[]): boolean =>
    perms.some((p) => permissions.includes(p));

  const hasAllPermissions = (perms: string[]): boolean =>
    perms.every((p) => permissions.includes(p));

  return { hasPermission, hasAnyPermission, hasAllPermissions, permissions };
}
