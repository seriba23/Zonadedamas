# Security Checklist

## Overview

This document is the authoritative security checklist for the Zona de Damas platform. All items must be verified before production launch. Items marked with MVP are required for the initial release; items marked V1 can be deferred.

---

## Tenant Isolation

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Every DB query includes `WHERE tenant_id = ?` filter | MVP | Enforced in every Prisma query via service layer |
| 2 | `TenantInterceptor` extracts `tenantId` from JWT claim, never from request body | MVP | tenantId in body is ignored |
| 3 | Cross-tenant access returns 404 (not 403) to prevent enumeration | MVP | `findUniqueOrThrow` with tenantId filter |
| 4 | Integration tests verify tenant isolation on all list + detail endpoints | MVP | Separate test tenant in test suite |
| 5 | No raw `tenant_id` accepted from client in any DTO | MVP | Validated in PermissionGuard + service |
| 6 | PostgreSQL RLS as defense-in-depth secondary layer | V1 | App-level is primary; RLS adds redundancy |

### Implementation Pattern

```typescript
// CORRECT: tenantId from JWT
async findAll(tenantId: string, params: QueryDto) {
  return this.prisma.client.findMany({
    where: { tenantId, ...buildFilters(params) },
  });
}

// WRONG: never do this
async findAll(body: { tenantId: string }) {  // attacker can forge tenantId
  return this.prisma.client.findMany({ where: { tenantId: body.tenantId } });
}
```

---

## Authentication

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Passwords hashed with bcrypt (12 rounds) | MVP | Using `bcrypt` npm package |
| 2 | JWT access tokens: 15 min expiry | MVP | `expiresIn: '15m'` in JwtModule |
| 3 | JWT signed with HS256 + strong secret (min 32 chars) | MVP | `JWT_SECRET` env var validated at startup |
| 4 | Refresh tokens: opaque UUID v4, stored as SHA-256 hash in DB | MVP | Never store raw token in DB |
| 5 | Refresh tokens have 7-day expiry | MVP | `expires_at` checked on every use |
| 6 | Refresh token rotation: old token revoked on use, new pair issued | MVP | Set `revoked_at` before issuing new pair |
| 7 | Revoked refresh tokens rejected immediately | MVP | Check `revoked_at IS NOT NULL` |
| 8 | Rate limit on login endpoint: 20 attempts per IP per minute | MVP | NestJS Throttler or express-rate-limit |
| 9 | Failed login does NOT reveal whether email exists | MVP | Always return generic "Invalid credentials" |
| 10 | JWT secret validated at application startup (not empty, not default) | MVP | Throw on startup if `JWT_SECRET.length < 32` |
| 11 | Access token NOT stored in localStorage (XSS risk) | MVP | Stored in React state (memory) only |

### Startup Validation

```typescript
// apps/api/src/main.ts
function validateConfig() {
  const secret = process.env.JWT_SECRET ?? '';
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters. Current length: ${secret.length}`
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
}

async function bootstrap() {
  validateConfig(); // Fail fast before starting
  const app = await NestFactory.create(AppModule);
  // ...
}
```

### Bcrypt Configuration

```typescript
// apps/api/src/modules/auth/auth.service.ts
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

async hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

async verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

---

## Authorization

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | `PermissionGuard` applied to all protected endpoints | MVP | Use `@UseGuards(JwtAuthGuard, PermissionGuard)` globally |
| 2 | 403 Forbidden returned for authenticated users missing required permission | MVP | PermissionGuard returns false → 403 |
| 3 | Location-scoped permissions checked correctly | MVP | locationId from route params, not body |
| 4 | System roles cannot be edited or deleted | MVP | `isSystem` flag check in roles service |
| 5 | Owner role cannot be removed from tenant creator | MVP | Validated in user-roles service |
| 6 | Permission evaluation uses cached result (60-second TTL) | MVP | In-memory cache in RbacService |
| 7 | Permission cache is invalidated when user roles change | MVP | On user-role mutation, clear cache for userId |

---

## Input Validation

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | All request bodies validated with `class-validator` DTOs | MVP | Global `ValidationPipe` with `whitelist: true` |
| 2 | Zod schemas in shared package for client-side pre-validation | MVP | Prevents unnecessary API calls |
| 3 | UUID format validated on all ID route parameters | MVP | `ParseUUIDPipe` on all `:id` params |
| 4 | Pagination params bounded: `perPage` max 100 | MVP | `@Max(100)` on perPage DTO field |
| 5 | Date ranges bounded: max 90 days for reports, 14 days for availability | MVP | Custom validator |
| 6 | String lengths bounded: notes max 2000, names max 255 | MVP | `@MaxLength()` decorators |
| 7 | `whitelist: true` on ValidationPipe strips unknown properties | MVP | Prevents property injection attacks |
| 8 | `forbidNonWhitelisted: true` rejects requests with extra properties | MVP | Returns 400 if unknown props present |

### Global Validation Pipe

```typescript
// apps/api/src/main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,             // Strip unknown properties
    forbidNonWhitelisted: true,  // Reject requests with unknown properties
    transform: true,             // Auto-transform to DTO types
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

### Example DTO with Validation

```typescript
// apps/api/src/modules/clients/dto/create-client.dto.ts
import { IsString, IsEmail, IsOptional, MaxLength, IsEnum, IsDateString } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  phone?: string;

  @IsEnum(['male', 'female', 'other', 'prefer_not_to_say'])
  @IsOptional()
  gender?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;
}
```

---

## SQL Injection Prevention

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Prisma ORM used exclusively for all queries | MVP | Parameterized queries by default |
| 2 | No string concatenation in query construction | MVP | Code review required |
| 3 | Raw SQL only when absolutely necessary (`$queryRaw`), and always parameterized | MVP | Tag template literal (`$queryRaw\`...\``) is parameterized |
| 4 | No user input in column names or table names | MVP | Sort fields whitelisted in DTO enum |

### Safe Raw Query Pattern (if needed)

```typescript
// CORRECT: Prisma tagged template is parameterized
const results = await this.prisma.$queryRaw`
  SELECT * FROM appointments
  WHERE employee_id = ${employeeId}::uuid
  AND tenant_id = ${tenantId}::uuid
`;

// WRONG: String interpolation is unsafe
const results = await this.prisma.$queryRawUnsafe(
  `SELECT * FROM appointments WHERE employee_id = '${employeeId}'` // NEVER DO THIS
);
```

---

## XSS Prevention

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | React auto-escaping active on all rendered user content | MVP | Default React behavior |
| 2 | `dangerouslySetInnerHTML` never used | MVP | ESLint rule `no-danger` enabled |
| 3 | Content-Security-Policy header configured | MVP | Via Next.js `headers()` in `next.config.ts` |
| 4 | Template content from automations rendered server-side only | V1 | Notification templates are not rendered in browser |

### CSP Configuration

```typescript
// apps/web/next.config.ts
const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",  // unsafe-inline needed for Next.js; tighten in V1 with nonces
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' " + process.env.NEXT_PUBLIC_API_URL,
  "frame-ancestors 'none'",
].join('; ');

const config = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
```

---

## Rate Limiting

| # | Check | Status | Rate |
|---|---|---|---|
| 1 | Global: all endpoints | MVP | 100 req/min per IP |
| 2 | Auth endpoints (`/auth/login`, `/auth/refresh`) | MVP | 20 req/min per IP |
| 3 | Availability queries | MVP | 30 req/min per IP |
| 4 | Public booking endpoints | MVP | 30 req/min per IP |
| 5 | Tenant onboarding | MVP | 5 req/hour per IP |

### NestJS Throttler Configuration

```typescript
// apps/api/src/app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 100 },
    ]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

// Override per endpoint
@Throttle({ default: { ttl: 60_000, limit: 20 } })
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

---

## CORS Configuration

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | CORS origin whitelist to `FRONTEND_URL` only | MVP | No wildcard `*` in production |
| 2 | CORS methods whitelist: GET, POST, PUT, DELETE, PATCH | MVP | |
| 3 | Credentials: true only if using cookies (we use Bearer, so false) | MVP | Not needed with Authorization header |
| 4 | CORS configured per environment (dev allows localhost:3000) | MVP | |

```typescript
// apps/api/src/main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  credentials: false,
});
```

---

## Logging Security

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Structured JSON logs (not plain text) | MVP | Winston or Pino logger |
| 2 | PII masking: emails shown as `a***@domain.com` | MVP | Mask in LoggingInterceptor |
| 3 | Phone numbers masked: `***1234` | MVP | Last 4 digits only |
| 4 | Passwords NEVER appear in logs | MVP | Never log request bodies containing `password` |
| 5 | JWT tokens NEVER appear in logs | MVP | Mask `Authorization` header |
| 6 | Request ID in all log entries | MVP | For tracing across log lines |
| 7 | Log level configurable per environment | MVP | DEBUG in dev, INFO in production |

### Logging Interceptor Pattern

```typescript
// apps/api/src/common/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;
    const requestId = headers['x-request-id'];
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          this.logger.log({
            requestId,
            method,
            path: url,
            statusCode: context.switchToHttp().getResponse().statusCode,
            responseTime,
            // Never log: body, Authorization header, passwords
          });
        },
        error: (error) => {
          this.logger.error({
            requestId,
            method,
            path: url,
            error: error.message,
            statusCode: error.status ?? 500,
          });
        },
      }),
    );
  }
}
```

---

## Secrets Management

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | `.env` file never committed to git | MVP | `.gitignore` includes `.env*` |
| 2 | `.env.example` committed with dummy values only | MVP | Documents required env vars |
| 3 | `JWT_SECRET` min 32 characters, unique per environment | MVP | Validated at startup |
| 4 | Database credentials unique per environment | MVP | Never share prod DB creds |
| 5 | Redis `AUTH` password set in staging/production | MVP | Not needed for local dev |
| 6 | Secrets rotation plan documented | V1 | JWT secret, DB password rotation procedure |
| 7 | Consider HashiCorp Vault or AWS Secrets Manager | V2 | For enterprise deployments |

### Required Environment Variables

```bash
# apps/api/.env.example
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/zonadedamas

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=REPLACE_WITH_MIN_32_CHAR_RANDOM_STRING_NEVER_USE_THIS_VALUE
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend
FRONTEND_URL=http://localhost:3000

# App
APP_URL=http://localhost:3001
```

---

## Dependencies

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | `npm audit` runs on CI pipeline | MVP | Fail build on high/critical vulnerabilities |
| 2 | Dependabot or Renovate enabled | MVP | Auto PRs for dependency updates |
| 3 | Lock file (`package-lock.json`) committed | MVP | Reproducible builds |
| 4 | Review dependency licenses | V1 | Avoid GPL in production SaaS |

---

## Infrastructure Security

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | HTTPS enforced in production (HTTP redirects to HTTPS) | MVP | Via load balancer / reverse proxy |
| 2 | HSTS header set (`Strict-Transport-Security: max-age=31536000`) | MVP | Via Nginx or Next.js headers |
| 3 | Database connections via SSL in production (`?sslmode=require`) | MVP | In `DATABASE_URL` |
| 4 | Redis `AUTH` password in production | MVP | `REDIS_PASSWORD` env var |
| 5 | Database not publicly accessible (private network only) | MVP | VPC / firewall rules |
| 6 | Automated PostgreSQL backups (daily, retain 30 days) | MVP | Cloud provider automated backups |
| 7 | Backup restore tested periodically (monthly) | V1 | Document restore procedure |
| 8 | API server does not run as root user | MVP | Use non-root Docker user |

---

## Data Protection

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Audit log is strictly append-only (no UPDATE or DELETE) | MVP | Application-level convention enforced in code review |
| 2 | Soft delete used for business entities (clients, services, employees) | MVP | `isActive = false` instead of hard delete |
| 3 | Client data exportable per tenant request | MVP | `GET /api/clients` with `clients.export` permission |
| 4 | Data retention policy configurable per tenant | V1 | For GDPR/CCPA compliance |
| 5 | PII fields documented and inventoried | V1 | For data mapping compliance |
| 6 | Right to be forgotten (hard delete client data on request) | V1 | GDPR Article 17 |

---

## Security Review Checklist (Pre-Launch)

Before going to production, complete the following:

- [ ] All MVP items in this document are checked and verified
- [ ] `npm audit` returns zero high or critical vulnerabilities
- [ ] Manual penetration test on auth endpoints (login brute force, token replay)
- [ ] Verify tenant isolation with automated test: user from Tenant A cannot read Tenant B data
- [ ] Verify all permissions are enforced (test each protected endpoint without permission)
- [ ] Confirm no secrets in git history (`git log -p | grep -i password`)
- [ ] OWASP Top 10 checklist reviewed:
  - [ ] A01 Broken Access Control - PermissionGuard on all endpoints
  - [ ] A02 Cryptographic Failures - bcrypt 12 rounds, HS256 JWT
  - [ ] A03 Injection - Prisma parameterized queries only
  - [ ] A04 Insecure Design - Tenant isolation, append-only audit
  - [ ] A05 Security Misconfiguration - CORS whitelist, CSP headers
  - [ ] A06 Vulnerable Components - `npm audit` on CI
  - [ ] A07 Authentication Failures - Rate limiting, token rotation
  - [ ] A08 Software Integrity Failures - Lock file committed
  - [ ] A09 Logging Failures - Structured logs, no PII/secrets
  - [ ] A10 SSRF - Webhook URLs validated against allowlist (V1)
