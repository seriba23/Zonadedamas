import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// ---------------------------------------------------------------------------
// PermissionGuard inline implementation for testing
// ---------------------------------------------------------------------------

const PERMISSIONS_KEY = 'permissions';

class PermissionGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user as
      | { id: string; permissions: string[] }
      | undefined;

    // No user on request = deny
    if (!user) {
      return false;
    }

    const userPermissions: string[] = user.permissions ?? [];

    // All required permissions must be present (AND logic)
    return requiredPermissions.every((perm) => userPermissions.includes(perm));
  }
}

// ---------------------------------------------------------------------------
// Helper: build a fake ExecutionContext
// ---------------------------------------------------------------------------

function buildContext(
  requiredPermissions: string[] | undefined,
  userPermissions: string[] | null,
): ExecutionContext {
  const mockHandler = jest.fn();
  const mockClass = jest.fn();

  const request =
    userPermissions === null
      ? {} // no user property
      : { user: { id: 'user-1', permissions: userPermissions } };

  return {
    getHandler: () => mockHandler,
    getClass: () => mockClass,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    // Store requiredPermissions so the Reflector mock can return them
    __requiredPermissions: requiredPermissions,
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    reflector = module.get<Reflector>(Reflector);
    guard = new PermissionGuard(reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow access when user has the required permission', () => {
    const ctx = buildContext(['appointments:read'], ['appointments:read', 'clients:read']);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['appointments:read']);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should deny access when user lacks the required permission', () => {
    const ctx = buildContext(['roles:manage'], ['appointments:read', 'clients:read']);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['roles:manage']);

    const result = guard.canActivate(ctx);

    expect(result).toBe(false);
  });

  it('should allow access when no permissions are required (no decorator)', () => {
    const ctx = buildContext(undefined, []);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should require ALL permissions when multiple are specified (AND logic)', () => {
    const ctx = buildContext(
      ['appointments:read', 'employees:read'],
      ['appointments:read', 'employees:read', 'clients:read'],
    );
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'appointments:read',
      'employees:read',
    ]);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should deny access when user has some but not all required permissions', () => {
    const ctx = buildContext(
      ['appointments:read', 'appointments:delete'],
      ['appointments:read'], // missing appointments:delete
    );
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'appointments:read',
      'appointments:delete',
    ]);

    const result = guard.canActivate(ctx);

    expect(result).toBe(false);
  });

  it('should handle missing user gracefully and return false', () => {
    // null means the request has no user property at all
    const ctx = buildContext(['appointments:read'], null);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['appointments:read']);

    const result = guard.canActivate(ctx);

    expect(result).toBe(false);
  });
});
