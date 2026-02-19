# RBAC - Role-Based Access Control

## Overview

The RBAC system uses a permission-based model where:

- **Permissions** are atomic capabilities (e.g., `appointments.create`)
- **Roles** are named collections of permissions
- **UserRoles** assign roles to users, optionally scoped to a specific location
- Roles can be system-defined (seeded, not editable) or tenant-defined (custom)

---

## Permission List (53 Permissions)

### appointments (7)

| Permission | Description |
|---|---|
| `appointments.create` | Create new appointments |
| `appointments.read` | View appointments |
| `appointments.update` | Update appointment details (notes) |
| `appointments.delete` | Delete appointments (soft) |
| `appointments.cancel` | Cancel appointments |
| `appointments.reschedule` | Reschedule appointments to new time/employee |
| `appointments.complete` | Mark appointments as completed |

### availability (2)

| Permission | Description |
|---|---|
| `availability.read` | Query available time slots |
| `availability.manage` | Manage availability settings |

### clients (5)

| Permission | Description |
|---|---|
| `clients.create` | Create new clients |
| `clients.read` | View clients and their details |
| `clients.update` | Update client information and tags |
| `clients.delete` | Delete (soft) clients |
| `clients.export` | Export client data to CSV |

### services (4)

| Permission | Description |
|---|---|
| `services.create` | Create new services |
| `services.read` | View services |
| `services.update` | Update service details |
| `services.delete` | Delete (soft) services |

### employees (6)

| Permission | Description |
|---|---|
| `employees.create` | Create employee profiles |
| `employees.read` | View employee details |
| `employees.update` | Update employee information |
| `employees.delete` | Delete (soft) employee profiles |
| `employees.schedules.manage` | Manage employee weekly schedules |
| `employees.time_off.manage` | Manage employee time-off |

### resources (4)

| Permission | Description |
|---|---|
| `resources.create` | Create resources (rooms, chairs) |
| `resources.read` | View resources |
| `resources.update` | Update resource details |
| `resources.delete` | Delete resources |

### payments (4)

| Permission | Description |
|---|---|
| `payments.create` | Create payments (POS) |
| `payments.read` | View payment records |
| `payments.refund` | Issue refunds |
| `payments.export` | Export payment data |

### reports (4)

| Permission | Description |
|---|---|
| `reports.revenue` | View revenue reports |
| `reports.appointments` | View appointment reports |
| `reports.staff` | View staff productivity reports |
| `reports.clients` | View client analytics |

### audit (1)

| Permission | Description |
|---|---|
| `audit.read` | View audit log |

### automations (5)

| Permission | Description |
|---|---|
| `automations.create` | Create automation rules |
| `automations.read` | View automation rules |
| `automations.update` | Update automation rules |
| `automations.delete` | Delete automation rules |
| `automations.execute` | Manually trigger automations |

### settings (3)

| Permission | Description |
|---|---|
| `settings.general` | Manage general tenant settings |
| `settings.billing` | Manage billing and subscription (owner only) |
| `settings.integrations` | Manage third-party integrations |

### roles (4)

| Permission | Description |
|---|---|
| `roles.create` | Create custom roles |
| `roles.read` | View roles and permissions |
| `roles.update` | Update role permissions |
| `roles.delete` | Delete custom roles |

### users (5)

| Permission | Description |
|---|---|
| `users.create` | Create user accounts |
| `users.read` | View user accounts |
| `users.update` | Update user accounts |
| `users.delete` | Deactivate user accounts |
| `users.manage` | Assign/remove roles from users |

### locations (4)

| Permission | Description |
|---|---|
| `locations.create` | Create new locations |
| `locations.read` | View locations |
| `locations.update` | Update location details |
| `locations.delete` | Delete locations |

### notifications (1)

| Permission | Description |
|---|---|
| `notifications.manage` | Manage notification templates |

**Total: 53 permissions**

---

## Default Roles (7 System Roles)

System roles are seeded during tenant onboarding and cannot be edited or deleted.

### owner (53 permissions)

All permissions. Automatically assigned to the tenant creator. The `settings.billing` permission is exclusive to this role.

### admin (52 permissions)

All permissions except `settings.billing`. Can manage everything except billing/subscription.

### manager (35 permissions)

Manages day-to-day operations at one or more locations.

```
appointments.*         (7)
availability.*         (2)
clients.create         (1)
clients.read           (1)
clients.update         (1)
employees.read         (1)
employees.update       (1)
employees.schedules.manage (1)
employees.time_off.manage  (1)
resources.*            (4)
services.read          (1)
payments.create        (1)
payments.read          (1)
reports.*              (4)
locations.read         (1)
notifications.manage   (1)
roles.read             (1)
users.read             (1)
```

Total: ~35 permissions

### frontdesk (16 permissions)

Front desk staff who manage daily bookings and client interactions.

```
appointments.create    (1)
appointments.read      (1)
appointments.update    (1)
appointments.cancel    (1)
appointments.reschedule(1)
clients.create         (1)
clients.read           (1)
clients.update         (1)
services.read          (1)
employees.read         (1)
resources.read         (1)
payments.create        (1)
payments.read          (1)
availability.read      (1)
```

Total: 14 permissions

### staff (5 permissions)

Service providers (stylists, therapists, etc.) with limited read access.

```
appointments.read      (1) - own appointments only (filtered by app layer)
clients.read           (1) - basic info only
services.read          (1)
employees.read         (1) - own profile only (filtered by app layer)
availability.read      (1)
```

Total: 5 permissions

Note: The "own" scope filtering is enforced at the application layer in the service method, not at the permission level.

### accountant (11 permissions)

Finance team with access to payment and reporting data.

```
payments.create        (1)
payments.read          (1)
payments.refund        (1)
payments.export        (1)
reports.revenue        (1)
reports.appointments   (1)
reports.staff          (1)
reports.clients        (1)
clients.read           (1)
audit.read             (1)
```

Total: 10 permissions

### readonly (8 permissions)

Read-only access across all modules for auditors or observers.

```
appointments.read      (1)
clients.read           (1)
services.read          (1)
employees.read         (1)
resources.read         (1)
payments.read          (1)
reports.revenue        (1)
reports.appointments   (1)
```

Total: 8 permissions

---

## Role-Permission Matrix

| Permission | owner | admin | manager | frontdesk | staff | accountant | readonly |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| appointments.create | Y | Y | Y | Y | - | - | - |
| appointments.read | Y | Y | Y | Y | Y | - | Y |
| appointments.update | Y | Y | Y | Y | - | - | - |
| appointments.delete | Y | Y | Y | - | - | - | - |
| appointments.cancel | Y | Y | Y | Y | - | - | - |
| appointments.reschedule | Y | Y | Y | Y | - | - | - |
| appointments.complete | Y | Y | Y | Y | - | - | - |
| availability.read | Y | Y | Y | Y | Y | - | - |
| availability.manage | Y | Y | - | - | - | - | - |
| clients.create | Y | Y | Y | Y | - | - | - |
| clients.read | Y | Y | Y | Y | Y | Y | Y |
| clients.update | Y | Y | Y | Y | - | - | - |
| clients.delete | Y | Y | - | - | - | - | - |
| clients.export | Y | Y | Y | - | - | - | - |
| services.create | Y | Y | Y | - | - | - | - |
| services.read | Y | Y | Y | Y | Y | - | Y |
| services.update | Y | Y | Y | - | - | - | - |
| services.delete | Y | Y | - | - | - | - | - |
| employees.create | Y | Y | Y | - | - | - | - |
| employees.read | Y | Y | Y | Y | Y | - | Y |
| employees.update | Y | Y | Y | - | - | - | - |
| employees.delete | Y | Y | - | - | - | - | - |
| employees.schedules.manage | Y | Y | Y | - | - | - | - |
| employees.time_off.manage | Y | Y | Y | - | - | - | - |
| resources.create | Y | Y | Y | - | - | - | - |
| resources.read | Y | Y | Y | Y | - | - | Y |
| resources.update | Y | Y | Y | - | - | - | - |
| resources.delete | Y | Y | Y | - | - | - | - |
| payments.create | Y | Y | Y | Y | - | Y | - |
| payments.read | Y | Y | Y | Y | - | Y | Y |
| payments.refund | Y | Y | - | - | - | Y | - |
| payments.export | Y | Y | Y | - | - | Y | - |
| reports.revenue | Y | Y | Y | - | - | Y | Y |
| reports.appointments | Y | Y | Y | - | - | Y | Y |
| reports.staff | Y | Y | Y | - | - | Y | - |
| reports.clients | Y | Y | Y | - | - | Y | - |
| audit.read | Y | Y | - | - | - | Y | - |
| automations.create | Y | Y | - | - | - | - | - |
| automations.read | Y | Y | Y | - | - | - | - |
| automations.update | Y | Y | - | - | - | - | - |
| automations.delete | Y | Y | - | - | - | - | - |
| automations.execute | Y | Y | - | - | - | - | - |
| settings.general | Y | Y | - | - | - | - | - |
| settings.billing | Y | - | - | - | - | - | - |
| settings.integrations | Y | Y | - | - | - | - | - |
| roles.create | Y | Y | - | - | - | - | - |
| roles.read | Y | Y | Y | - | - | - | - |
| roles.update | Y | Y | - | - | - | - | - |
| roles.delete | Y | Y | - | - | - | - | - |
| users.create | Y | Y | Y | - | - | - | - |
| users.read | Y | Y | Y | - | - | - | - |
| users.update | Y | Y | - | - | - | - | - |
| users.delete | Y | Y | - | - | - | - | - |
| users.manage | Y | Y | Y | - | - | - | - |
| locations.create | Y | Y | - | - | - | - | - |
| locations.read | Y | Y | Y | Y | Y | - | Y |
| locations.update | Y | Y | - | - | - | - | - |
| locations.delete | Y | Y | - | - | - | - | - |
| notifications.manage | Y | Y | Y | - | - | - | - |

---

## Backend Implementation

### Permission Guard

```typescript
// apps/api/src/common/guards/permission.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../../modules/rbac/rbac.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    // No permissions required - allow through
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Injected by JwtAuthGuard

    // Get user permissions for this tenant + optional location context
    const userPermissions = await this.rbacService.getUserPermissions(
      user.userId,
      user.tenantId,
      request.params.locationId, // optional - from route params
    );

    // ALL required permissions must be present
    return requiredPermissions.every(p => userPermissions.includes(p));
  }
}
```

### Require Permissions Decorator

```typescript
// apps/api/src/common/decorators/require-permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
```

### Usage in Controller

```typescript
// apps/api/src/modules/appointments/appointments.controller.ts
@Controller('appointments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppointmentsController {

  @Post()
  @RequirePermissions('appointments.create')
  async create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.create(dto, user.tenantId, user.userId);
  }

  @Get(':id')
  @RequirePermissions('appointments.read')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.findOne(id, user.tenantId);
  }

  @Post(':id/cancel')
  @RequirePermissions('appointments.cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.appointmentsService.cancel(id, dto, user.tenantId, user.userId);
  }
}
```

### Permission Resolution (with Location Scoping)

```typescript
// apps/api/src/modules/rbac/rbac.service.ts
@Injectable()
export class RbacService {
  private readonly cache = new Map<string, { permissions: string[]; expiresAt: number }>();

  async getUserPermissions(
    userId: string,
    tenantId: string,
    locationId?: string,
  ): Promise<string[]> {
    const cacheKey = `perms:${userId}:${tenantId}:${locationId ?? 'all'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.permissions;

    // Fetch user roles (tenant-wide + location-specific)
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
        OR: [
          { locationId: null },            // tenant-wide roles
          { locationId: locationId ?? null }, // location-specific roles
        ],
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    // Flatten unique permissions
    const permissions = [
      ...new Set(
        userRoles.flatMap(ur =>
          ur.role.rolePermissions.map(rp => rp.permission.name)
        )
      ),
    ];

    this.cache.set(cacheKey, { permissions, expiresAt: Date.now() + 60_000 });
    return permissions;
  }
}
```

---

## Frontend Implementation

### usePermissions Hook

```typescript
// apps/web/src/hooks/usePermissions.ts
import { useAuth } from '@/contexts/AuthContext';

export function usePermissions() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  const hasPermission = (permission: string): boolean =>
    permissions.includes(permission);

  const hasAnyPermission = (...perms: string[]): boolean =>
    perms.some(p => permissions.includes(p));

  const hasAllPermissions = (...perms: string[]): boolean =>
    perms.every(p => permissions.includes(p));

  return { hasPermission, hasAnyPermission, hasAllPermissions, permissions };
}
```

### Conditional Rendering

```tsx
// apps/web/src/components/appointments/AppointmentActions.tsx
import { usePermissions } from '@/hooks/usePermissions';

export function AppointmentActions({ appointment }: { appointment: Appointment }) {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex gap-2">
      {hasPermission('appointments.cancel') && (
        <Button variant="destructive" onClick={() => handleCancel()}>
          Cancel
        </Button>
      )}
      {hasPermission('appointments.reschedule') && (
        <Button variant="outline" onClick={() => handleReschedule()}>
          Reschedule
        </Button>
      )}
      {hasPermission('appointments.complete') && (
        <Button variant="default" onClick={() => handleComplete()}>
          Complete
        </Button>
      )}
    </div>
  );
}
```

### Route Protection (middleware.ts)

```typescript
// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/book'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));

  if (isPublic) return NextResponse.next();

  // Check for auth cookie or header
  const token = request.cookies.get('access_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Location Scoping Rules

| Scenario | Behavior |
|---|---|
| UserRole with `locationId = NULL` | Permission applies to ALL locations in the tenant |
| UserRole with `locationId = X` | Permission applies ONLY to location X |
| User with both tenant-wide and location-specific roles | Permissions are UNIONED (broader wins) |
| Request without `locationId` param | Only tenant-wide permissions are checked |
| Cross-tenant access attempt | Returns 404 (prevents enumeration) |

---

## Seeding Script

```typescript
// prisma/seed.ts
const DEFAULT_PERMISSIONS = [
  // appointments
  { name: 'appointments.create', module: 'appointments', description: 'Create new appointments' },
  { name: 'appointments.read',   module: 'appointments', description: 'View appointments' },
  // ... all 53 permissions
];

const SYSTEM_ROLES = [
  {
    slug: 'owner',
    name: 'Owner',
    isSystem: true,
    permissions: '*', // all
  },
  {
    slug: 'admin',
    name: 'Admin',
    isSystem: true,
    permissions: DEFAULT_PERMISSIONS
      .filter(p => p.name !== 'settings.billing')
      .map(p => p.name),
  },
  // ... remaining roles
];

async function seed() {
  // Upsert permissions
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      create: perm,
      update: perm,
    });
  }

  // Upsert system roles (tenant_id = null)
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { slug_tenantId: { slug: role.slug, tenantId: null } },
      create: { ...role },
      update: { name: role.name },
    });
  }
}
```
