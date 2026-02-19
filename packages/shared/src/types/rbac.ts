// ─── PERMISSION MODULES ──────────────────────────────────────────────────────

export type PermissionModule =
  | 'appointments'
  | 'availability'
  | 'clients'
  | 'services'
  | 'employees'
  | 'resources'
  | 'payments'
  | 'reports'
  | 'audit'
  | 'automations'
  | 'settings'
  | 'roles'
  | 'users'
  | 'locations'
  | 'notifications';

// ─── CORE TYPES ──────────────────────────────────────────────────────────────

export interface Permission {
  id: string;
  module: PermissionModule;
  action: string;
  description?: string | null;
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  permissions?: Permission[];
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  tenantId: string;
  locationId?: string | null;
  assignedBy?: string | null;
  createdAt: string;
  role?: Role;
}

// ─── REQUEST TYPES ───────────────────────────────────────────────────────────

export interface CreateRoleRequest {
  name: string;
  slug: string;
  description?: string;
  permissionIds: string[];
}

export type UpdateRoleRequest = Partial<CreateRoleRequest>;

export interface AssignRoleRequest {
  userId: string;
  roleId: string;
  locationId?: string;
}
