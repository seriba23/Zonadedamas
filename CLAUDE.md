# Zona de Damas - SaaS Booking Platform

## Stack
- Monorepo: Turborepo + npm workspaces
- Backend: NestJS + TypeScript + Prisma + MySQL (XAMPP MariaDB)
- Frontend: Next.js 14 + TypeScript + Tailwind CSS
- Shared: @zonadedamas/shared (types + Zod schemas)
- Cache: In-memory (Map-based, replaces Redis)
- Events: @nestjs/event-emitter (replaces BullMQ)

## Project Structure
```
apps/api/        → NestJS backend (port 3001)
apps/web/        → Next.js frontend (port 3000)
packages/shared/ → Shared types and Zod validation schemas
docs/            → Architecture and design documentation
```

## Key Conventions
- All database IDs: UUID (CUID via Prisma)
- All timestamps: UTC
- Multi-tenant: EVERY database query MUST filter by tenant_id
- API prefix: /api
- Success response: { data, meta? }
- Error response: { statusCode, error, message, details?, requestId }
- Permissions format: "module.action" (e.g., "appointments.create")
- Guards pattern: @UseGuards(JwtAuthGuard, PermissionGuard) + @RequirePermissions()
- Audit: every write operation logs to audit_log and emits domain_event

## Development Setup (XAMPP)
1. Start XAMPP (Apache + MySQL)
2. Create database "zonadedamas" via phpMyAdmin
3. `npm install` (from root)
4. `cd apps/api && npx prisma migrate dev`
5. `npm run db:seed`
6. `npm run dev` (from root - starts both API and Web)

## Commands
- `npm run dev` → Start all apps in dev mode
- `npm run build` → Build all apps
- `npm run test` → Run all tests
- `cd apps/api && npm run db:migrate` → Run Prisma migrations
- `cd apps/api && npm run db:seed` → Seed database with defaults + demo data
- `cd apps/api && npx prisma studio` → Open Prisma Studio (DB browser)

## Database
- Engine: MySQL/MariaDB via XAMPP (port 3306, user root, no password)
- ORM: Prisma (schema at apps/api/prisma/schema.prisma)
- Anti-double-booking: Application-level with Serializable transaction isolation
- Snapshot pattern: appointment_items stores denormalized price/duration at booking time
- Json fields are nullable (MySQL doesn't support Json defaults)

## Auth Flow
- POST /api/auth/login → returns accessToken + refreshToken
- Access token: JWT, 15 min expiry, sent as Bearer header
- Refresh token: opaque UUID, 7 day expiry, stored hashed in DB, rotated on use
- All protected endpoints require JwtAuthGuard
- Permission-based endpoints additionally require PermissionGuard
