# Sprint Plan

## Overview

| Sprint | Weeks | Focus | Deliverable |
|---|---|---|---|
| 1 | 1-2 | Foundation | Auth + Tenant + RBAC |
| 2 | 3-4 | Core Entities | Clients + Services |
| 3 | 5-6 | Staff + Availability | Employees + Engine |
| 4 | 7-8 | Appointments | Booking + Calendar |
| 5 | 9-10 | POS + Reports | Payments + Analytics |
| 6 | 11-12 | Polish + Public | Booking Page + QA |

---

## Sprint 1 (Weeks 1-2): Foundation

### Backend Tasks

- [ ] Docker Compose setup (PostgreSQL, Redis, API, Web)
- [ ] Turborepo monorepo setup with `apps/api`, `apps/web`, `packages/shared`
- [ ] NestJS app scaffolding with strict TypeScript
- [ ] Prisma schema (all 28 tables), migrations, seed script
- [ ] Global error handling filter (`HttpExceptionFilter`)
- [ ] Global logging interceptor (structured JSON, request ID)
- [ ] Request ID interceptor (UUID per request)
- [ ] `GET /api/health` endpoint
- [ ] **Auth module**:
  - `POST /api/auth/login` (email + password → JWT pair)
  - `POST /api/auth/refresh` (refresh token rotation)
  - `POST /api/auth/logout` (revoke refresh token)
  - `GET /api/auth/me` (current user + permissions)
  - Bcrypt password hashing (12 rounds)
  - JWT access token (15 min), refresh token (7 days, stored as SHA-256 hash)
- [ ] **Tenants module**:
  - `POST /api/tenants` (onboarding: create tenant + owner + seed default roles)
  - `GET /api/tenants/current`
- [ ] **Locations module**:
  - Full CRUD (`/api/locations`)
  - Tenant-scoped filtering
- [ ] **RBAC module**:
  - Permission seeding (53 permissions)
  - System role seeding (7 default roles)
  - Roles CRUD (`/api/roles`)
  - `GET /api/permissions` (grouped by module)
  - `POST /api/user-roles`, `DELETE /api/user-roles/:id`
  - `PermissionGuard` implementation
  - `RequirePermissions` decorator
  - Location-scoped permission resolution
- [ ] **Users module**:
  - `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`

### Frontend Tasks

- [ ] Next.js 14 app setup with App Router, TypeScript, Tailwind
- [ ] `AuthProvider` context with login/logout/token refresh
- [ ] `apiClient` with request/response interceptors (token refresh on 401)
- [ ] Login page (`/login`)
- [ ] Middleware for route protection
- [ ] Root layout with QueryClientProvider + AuthProvider

### Acceptance Criteria

- [ ] User can create a new tenant via `POST /api/tenants`
- [ ] User can login and receive JWT pair
- [ ] Refresh token rotation works correctly (old token revoked, new pair issued)
- [ ] `GET /api/auth/me` returns user with permissions array
- [ ] PermissionGuard blocks requests missing required permission (returns 403)
- [ ] Cross-tenant data access returns 404
- [ ] Health endpoint returns 200 with db/redis status
- [ ] All requests include `X-Request-Id` header in response

---

## Sprint 2 (Weeks 3-4): Core Entities

### Backend Tasks

- [ ] **Clients module**:
  - `GET /api/clients` with search (name, email, phone), pagination, sorting
  - `POST /api/clients`
  - `GET /api/clients/:id` (with tags and stats: total appointments, total spent, last visit, no-show count)
  - `PUT /api/clients/:id`
  - `DELETE /api/clients/:id` (soft delete)
  - `POST /api/clients/:id/tags`, `DELETE /api/clients/:id/tags/:tagId`
  - `GET /api/client-tags`, `POST /api/client-tags`
  - Audit logging on all mutations
- [ ] **Services module**:
  - Full CRUD (`/api/services`)
  - Filter by category, isActive
  - Audit logging on all mutations
- [ ] Audit service implementation (`AuditService.log()`)
- [ ] `GET /api/audit` with filters (entityType, entityId, userId, date range)

### Frontend Tasks

- [ ] Dashboard layout (sidebar + header with location selector)
- [ ] `usePermissions` hook
- [ ] Permission-aware sidebar menu (hide items user lacks access to)
- [ ] **Clients page** (`/clients`):
  - Search with 300ms debounce
  - Paginated table with name, email, phone, tags, last visit
  - Client drawer (view + edit + tags)
  - Create client modal
  - Tag management
- [ ] **Services page** (`/services`):
  - Services table with name, duration, price, color badge
  - Create/edit service modal with all fields
  - Color picker for service color
- [ ] `useClients`, `useCreateClient`, `useUpdateClient` hooks
- [ ] `useServices`, `useCreateService`, `useUpdateService` hooks
- [ ] Toast notifications for mutations (success/error)
- [ ] Empty states and loading skeletons

### Acceptance Criteria

- [ ] Client search returns results matching name, email, or phone (case insensitive)
- [ ] Client pagination works correctly (total, page, perPage, totalPages)
- [ ] Tags can be created and assigned to clients
- [ ] Client detail shows stats (total appointments, total spent, no-show count)
- [ ] Service CRUD persists correctly with all fields
- [ ] Changing a service price does NOT affect historical appointment_items
- [ ] All mutations create audit log entries with before/after data
- [ ] Frontend Clients page shows data from API with search + pagination
- [ ] Frontend Services page shows data from API with CRUD modals

---

## Sprint 3 (Weeks 5-6): Staff + Availability

### Backend Tasks

- [ ] **Employees module**:
  - Full CRUD (`/api/employees`) with location filter
  - `GET/PUT /api/employees/:id/schedules` (full schedule replacement)
  - `GET/POST/DELETE /api/employees/:id/time-off`
  - `GET/POST /api/employees/:id/services`
  - Audit logging on mutations
- [ ] **Resources module**:
  - Full CRUD (`/api/resources`) with location + type filter
- [ ] **Availability module**:
  - `POST /api/availability/query`
  - Core algorithm: schedule → occupied blocks → merge → slot generation
  - Redis caching (key pattern, 5-min TTL)
  - Domain events module setup (EventsService, BullMQ queue)
  - Cache invalidation consumer (appointment.*, employee.*)
  - Edge cases: DST, multi-service duration, buffers
  - Unit tests for slot generation algorithm (16 edge cases)

### Frontend Tasks

- [ ] **Staff page** (`/staff`):
  - Employee list with color avatar
  - Create/edit employee modal
  - Schedule editor (7-day weekly grid with isWorking toggle)
  - Time-off management (add/remove)
  - Service assignment (multi-select checkbox list)
- [ ] **Resources page** (`/resources`):
  - Resource table with type badge
  - Create/edit resource modal
- [ ] `useEmployees`, `useEmployee`, `useUpdateSchedule` hooks
- [ ] `useResources` hook
- [ ] `useAvailability` hook

### Acceptance Criteria

- [ ] Availability query returns correct slots for a working employee
- [ ] Non-working days return empty slots
- [ ] Time-off blocks correctly remove slots from availability
- [ ] Buffer before/after appointments correctly reduces available windows
- [ ] Multi-service duration (sum of service durations) applied correctly
- [ ] Redis cache is populated after first query, hit on second identical query
- [ ] Cache is invalidated when employee schedule changes
- [ ] Domain events are inserted into `domain_events` table and published to BullMQ
- [ ] Availability query responds in < 200ms (cache miss), < 50ms (cache hit)
- [ ] Frontend Staff page allows schedule editing and time-off management

---

## Sprint 4 (Weeks 7-8): Appointments

### Backend Tasks

- [ ] **Appointments module**:
  - `GET /api/appointments` with all filters (location, employee, client, status, date range)
  - `POST /api/appointments` (with anti-double-booking, items snapshot, status history)
  - `GET /api/appointments/:id` (full detail with items + status history)
  - `PUT /api/appointments/:id` (notes update only)
  - `POST /api/appointments/:id/reschedule`
  - `POST /api/appointments/:id/cancel`
  - `POST /api/appointments/:id/complete`
  - Prisma transaction with Serializable isolation on create/reschedule
  - 409 response on exclusion constraint violation
  - Appointment items with price/duration snapshots
  - Status history tracking (from → to + timestamp + user)
  - Domain event emission on all status changes
  - Availability cache invalidation on create/cancel/reschedule
  - Audit logging on all mutations

### Frontend Tasks

- [ ] **Calendar page** (`/calendar`):
  - Day view: vertical time grid with employee columns
  - Week view: horizontal date columns
  - Appointment blocks with color, client name, service name, time
  - Click appointment to open detail drawer
  - Empty time slot click → create appointment flow
  - Location selector in header
  - Date navigation (prev/next day/week)
- [ ] **Appointment modal**:
  - Client selector (with search)
  - Service selector (multi-select)
  - Employee selector (auto-populated from availability)
  - Date/time picker with available slots grid
  - Notes field
  - Status badge + action buttons (confirm/cancel/complete/reschedule) permission-gated
- [ ] `useAppointments`, `useCreateAppointment`, `useRescheduleAppointment`, `useCancelAppointment` hooks

### Acceptance Criteria

- [ ] Appointments can be created with correct snapshot values
- [ ] Double booking is impossible: second conflicting POST returns 409
- [ ] Status flow works: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
- [ ] Cancel/no-show transitions work correctly
- [ ] Rescheduling invalidates both old and new date caches
- [ ] Appointment items carry price/duration snapshots independent of service changes
- [ ] Status history records every transition with timestamp and user
- [ ] Calendar shows appointments with correct colors and times
- [ ] Appointment modal allows creating bookings via availability picker
- [ ] All mutations create audit log entries

---

## Sprint 5 (Weeks 9-10): POS + Reports

### Backend Tasks

- [ ] **Payments module**:
  - `POST /api/payments` (with items, tip, discount, tax calculation)
  - `GET /api/payments` with filters (client, date range, pagination)
  - `GET /api/payments/:id` (with items)
  - Link payment to appointment (optional)
  - Payment items breakdown
  - Audit logging on payment creation
  - Domain event: `payment.completed`
- [ ] **Reports module**:
  - `GET /api/reports/revenue` (daily/weekly/monthly totals, by location)
  - `GET /api/reports/appointments` (count by status, by employee, by service)
  - `GET /api/reports/no-show-rate` (percentage, by employee, by period)
  - `GET /api/reports/top-services` (by revenue and by count)
  - `GET /api/reports/staff-productivity` (appointments per employee, revenue per employee)
  - All reports scoped to tenant + optional location + date range

### Frontend Tasks

- [ ] **POS page** (`/pos`):
  - Client search to start checkout
  - Item list (services, add/remove)
  - Payment method selector (Cash/Card/Transfer)
  - Tip amount input
  - Discount amount input
  - Total calculation display
  - Confirm payment button
  - Receipt summary post-payment
- [ ] **Reports page** (`/reports`):
  - Date range picker (preset: today/week/month/custom)
  - Revenue KPI cards (total, by method, by location)
  - Appointments by status chart (bar chart)
  - No-show rate gauge/percentage
  - Top services table
  - Staff productivity table
- [ ] `useCreatePayment` hook
- [ ] `useRevenueReport`, `useAppointmentReport` hooks

### Acceptance Criteria

- [ ] Payment can be created with correct total (subtotal + tip - discount + tax)
- [ ] Payment correctly linked to appointment
- [ ] Multiple payment items supported
- [ ] Revenue report shows correct totals for the selected date range
- [ ] No-show rate calculated correctly (no_show / total * 100)
- [ ] Reports respect tenant isolation (no cross-tenant data)
- [ ] POS page completes full checkout flow
- [ ] Reports page displays data with date range filtering

---

## Sprint 6 (Weeks 11-12): Polish + Public Booking

### Backend Tasks

- [ ] **Public booking endpoint**:
  - `GET /api/public/tenants/:slug` (tenant info for booking page)
  - `GET /api/public/tenants/:slug/services` (available services)
  - `GET /api/public/tenants/:slug/employees` (active employees)
  - `POST /api/public/tenants/:slug/availability` (query without auth)
  - `POST /api/public/tenants/:slug/appointments` (create appointment, create client if new)
  - Rate limiting on public endpoints (30/min per IP)
- [ ] Security hardening:
  - Rate limiting audit (all endpoints reviewed)
  - Input length bounds verified
  - UUID validation on all ID params
  - Pagination max perPage=100 enforced
- [ ] Performance testing:
  - Availability engine benchmark (target: < 200ms cache miss)
  - Appointment list with 1000+ records
- [ ] End-to-end API testing (critical flows)

### Frontend Tasks

- [ ] **Public booking page** (`/book/[tenantSlug]`):
  - Tenant branding (name, logo)
  - Service selector
  - Employee selector (optional, "any available")
  - Date picker → available slots grid
  - Client info form (name, email, phone)
  - Booking confirmation screen
  - Mobile responsive layout
- [ ] **Settings page** (`/settings/roles`):
  - Role list with permission count
  - Create custom role
  - Permission matrix editor (checkboxes grouped by module)
  - Assign role to user
- [ ] Global polish:
  - Loading skeletons on all data-fetching pages
  - Empty states with illustrations/CTAs
  - Error boundaries with retry button
  - Responsive design (mobile breakpoints)
  - 404 page
  - Confirmation dialogs for destructive actions
- [ ] Accessibility audit (keyboard navigation, ARIA labels, focus management)

### Acceptance Criteria

- [ ] Public booking page allows a client to book without authentication
- [ ] Public booking creates client if email not found, links if already exists
- [ ] Booking confirmation shown after successful appointment creation
- [ ] Mobile layout works on 375px viewport
- [ ] All loading states covered (no flickering or layout shifts)
- [ ] Destructive actions (cancel, delete) require confirmation dialog
- [ ] Availability query on public page responds within 500ms
- [ ] OWASP Top 10 checklist reviewed and documented
- [ ] All 11 documentation files up to date

---

## Definition of Done (All Sprints)

- Code reviewed and merged to main branch
- Unit tests written for service layer logic
- Integration tests for critical API endpoints
- No TypeScript errors (`tsc --noEmit` passes)
- ESLint passes with zero warnings
- API endpoints documented (request/response examples)
- Audit logging verified for all mutations
- Tenant isolation verified (cross-tenant test returns 404)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Availability engine performance | Medium | High | Redis caching + performance tests in Sprint 3 |
| Double booking edge case | Low | High | Database exclusion constraint (not application-level only) |
| Scope creep | High | Medium | Strict sprint boundaries, "DOES NOT INCLUDE" list enforced |
| DST bugs in availability | Medium | Medium | Dedicated DST test cases, use UTC internally |
| JWT security misconfiguration | Low | High | Security checklist (M_SECURITY.md) review before launch |
