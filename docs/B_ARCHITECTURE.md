# Architecture

## Overview

Modular monolith with NestJS. Each domain is a NestJS module with clear boundaries. Modules communicate via direct service injection (not HTTP). This allows easy extraction to microservices later.

---

## Module Map

```
┌─────────────────────────────────────────────────────┐
│                    API Gateway                       │
│              (Guards, Interceptors)                  │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────┤
│ Auth │Tenant│ RBAC │Client│ Svc  │ Emp  │ Resource │
├──────┴──────┴──────┴──────┴──────┴──────┴──────────┤
│ Availability │ Appointments │ Payments │ Reports    │
├──────────────┴──────────────┴──────────┴────────────┤
│ Notifications │ Automations │ Audit │ Events        │
├───────────────┴─────────────┴───────┴───────────────┤
│              Prisma (PostgreSQL) + Redis             │
└─────────────────────────────────────────────────────┘
```

---

## Modules and Responsibilities

1. **auth** - Login, JWT generation, refresh token rotation, password hashing, JWT strategy
2. **tenants** - Tenant CRUD, onboarding (create tenant + owner + default roles), location CRUD
3. **rbac** - Roles CRUD, permissions (seeded), role-permission mapping, user-role assignment, permission evaluation
4. **clients** - Client CRUD, search, tags, notes, history
5. **services** - Service CRUD, addons, categories, pricing
6. **employees** - Employee CRUD, weekly schedule management, time-off, service assignments
7. **resources** - Resource CRUD (rooms, chairs, equipment)
8. **availability** - Core engine: calculates available time slots considering schedules, appointments, time-off, buffers, resources. Redis caching with event-driven invalidation.
9. **appointments** - Appointment lifecycle (create, reschedule, cancel, complete), status history, price snapshots, anti-double-booking
10. **payments** - Payment creation, POS flow, payment items, tips, discounts
11. **notifications** - (V1) Template management, notification dispatch via email/SMS
12. **automations** - (V1) Rules engine: triggers, conditions, actions, quiet hours, rate limits
13. **audit** - Append-only audit log with before/after diffs, query interface
14. **events** - Domain event emission, BullMQ queue, consumer processing
15. **reports** - Revenue, appointments, no-show rate, staff productivity

---

## Cross-Cutting Concerns

- **Error Handling**: Global `HttpExceptionFilter` returns `{ statusCode, error, message, details?, requestId }`
- **Logging**: Structured JSON via `LoggingInterceptor`, includes requestId, method, path, statusCode, responseTime
- **Request Tracing**: `RequestIdInterceptor` generates UUID per request, propagated through logs and responses
- **Tenant Isolation**: `TenantInterceptor` extracts `tenantId` from JWT, every DB query filters by it
- **Validation**: `class-validator` on DTOs, Zod schemas in shared package for client-side validation

---

## Migration to Microservices

When needed:

1. Extract high-traffic modules (availability, appointments) to standalone NestJS services
2. Replace direct service injection with message queue (BullMQ → RabbitMQ/NATS)
3. Each microservice gets its own database schema (or separate DB)
4. API Gateway routes requests to correct service
5. Shared events bus (Redis Streams or NATS JetStream) for cross-service communication

---

## Error Response Format

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "must be a valid email" }
  ],
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Success Response Format

```json
{
  "data": { },
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20,
    "totalPages": 5
  }
}
```

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Backend framework | NestJS (Node.js) |
| ORM | Prisma |
| Database | PostgreSQL 15+ |
| Cache | Redis 7+ |
| Queue | BullMQ (backed by Redis) |
| Frontend framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Auth | JWT (access + refresh token rotation) |
| Monorepo | Turborepo |
| Language | TypeScript (strict mode) |

---

## Directory Structure (Turborepo)

```
zona-de-damas/
  apps/
    api/                  → NestJS backend
      src/
        modules/
          auth/
          tenants/
          rbac/
          clients/
          services/
          employees/
          resources/
          availability/
          appointments/
          payments/
          notifications/
          automations/
          audit/
          events/
          reports/
        common/
          guards/
          interceptors/
          filters/
          decorators/
          pipes/
    web/                  → Next.js 14 frontend
      src/
        app/
        components/
        hooks/
        lib/
  packages/
    shared/               → Shared types, Zod schemas, utilities
    ui/                   → Shared UI component library
    config/               → Shared ESLint, TypeScript configs
  prisma/                 → Schema, migrations, seed
  docker-compose.yml
  turbo.json
```
