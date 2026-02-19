# Audit Log and Domain Events

## Overview

The platform uses two complementary append-only systems:

- **Audit Log** - Human-readable record of every mutation performed by users. Purpose: compliance, debugging, undo support.
- **Domain Events** - Machine-readable business events for internal integrations. Purpose: cache invalidation, automation triggers, future webhook dispatch.

Both tables are strictly append-only. No `UPDATE` or `DELETE` is ever issued against them.

---

## Audit Log

### Purpose

- Compliance: who changed what, when, and from where
- Debugging: trace unexpected state changes
- Undo capability: compare before/after snapshots to understand what changed
- Support: explain to a business owner why something looks different

### Schema

```sql
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),  -- NULL for system/automated actions
  action        VARCHAR(100) NOT NULL,       -- e.g., "appointment.created"
  entity_type   VARCHAR(100) NOT NULL,       -- e.g., "appointment"
  entity_id     UUID NOT NULL,
  before_data   JSONB,                       -- NULL on create actions
  after_data    JSONB,                       -- NULL on delete actions
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  metadata      JSONB,                       -- extra context (reason, source, etc.)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- CONSTRAINT: this table is append-only, no UPDATE or DELETE ever
);

CREATE INDEX idx_audit_tenant_time ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
```

### Action Naming Convention

Actions follow the pattern `{entity}.{verb}`:

| Action | Trigger |
|---|---|
| `appointment.created` | New appointment booked |
| `appointment.confirmed` | Status changed to CONFIRMED |
| `appointment.rescheduled` | Start time or employee changed |
| `appointment.cancelled` | Status changed to CANCELLED |
| `appointment.completed` | Status changed to COMPLETED |
| `appointment.no_show` | Status changed to NO_SHOW |
| `client.created` | New client profile created |
| `client.updated` | Client fields updated |
| `client.deleted` | Client soft-deleted |
| `client.tag_added` | Tag assigned to client |
| `client.tag_removed` | Tag removed from client |
| `payment.created` | Payment processed |
| `payment.refunded` | Payment refunded |
| `employee.created` | Employee profile created |
| `employee.updated` | Employee profile updated |
| `employee.schedule_changed` | Weekly schedule updated |
| `employee.time_off_created` | Time-off block added |
| `employee.time_off_deleted` | Time-off block removed |
| `service.created` | Service created |
| `service.updated` | Service updated |
| `service.deleted` | Service soft-deleted |
| `role.created` | Custom role created |
| `role.updated` | Role permissions changed |
| `user_role.assigned` | Role assigned to user |
| `user_role.removed` | Role removed from user |
| `tenant.updated` | Tenant settings changed |
| `location.created` | New location added |
| `location.updated` | Location details changed |

### AuditService Implementation

```typescript
// apps/api/src/modules/audit/audit.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: Record<string, any> | null;
  afterData?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    // Fire and forget - audit logging should not block the main operation
    // But we await to ensure it's in the same transaction context if needed
    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        beforeData: entry.beforeData ?? null,
        afterData: entry.afterData ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: entry.metadata ?? null,
      },
    });
  }
}
```

### Usage in Services

```typescript
// apps/api/src/modules/appointments/appointments.service.ts

async cancel(
  id: string,
  dto: CancelAppointmentDto,
  tenantId: string,
  userId: string,
  requestContext: { ip: string; userAgent: string },
): Promise<Appointment> {
  const before = await this.prisma.appointment.findUniqueOrThrow({
    where: { id, tenantId },
  });

  const after = await this.prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      updatedAt: new Date(),
    },
  });

  // Audit log - records before and after state
  await this.auditService.log({
    tenantId,
    userId,
    action: 'appointment.cancelled',
    entityType: 'appointment',
    entityId: id,
    beforeData: { status: before.status },
    afterData: { status: after.status },
    ipAddress: requestContext.ip,
    userAgent: requestContext.userAgent,
    metadata: { reason: dto.reason },
  });

  // Domain event - for cache invalidation and automation triggers
  await this.eventsService.emit({
    tenantId,
    eventName: 'appointment.cancelled',
    aggregateType: 'appointment',
    aggregateId: id,
    payload: { appointmentId: id, employeeId: after.employeeId, startTime: after.startTime },
    metadata: { userId, requestId: requestContext['requestId'] },
  });

  return after;
}
```

### Querying the Audit Log (API)

```typescript
// GET /api/audit
async findAll(
  query: AuditQueryDto,
  tenantId: string,
): Promise<PaginatedResult<AuditLog>> {
  const where: Prisma.AuditLogWhereInput = {
    tenantId,
    ...(query.entityType && { entityType: query.entityType }),
    ...(query.entityId && { entityId: query.entityId }),
    ...(query.userId && { userId: query.userId }),
    ...(query.startDate && { createdAt: { gte: new Date(query.startDate) } }),
    ...(query.endDate && {
      createdAt: { lte: new Date(query.endDate + 'T23:59:59Z') }
    }),
  };

  const [total, items] = await this.prisma.$transaction([
    this.prisma.auditLog.count({ where }),
    this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
  ]);

  return { data: items, meta: { total, page: query.page, perPage: query.perPage, totalPages: Math.ceil(total / query.perPage) } };
}
```

---

## Domain Events

### Purpose

- Cache invalidation (availability engine)
- Automation rule triggering
- Future: webhook dispatch to external systems
- Future: real-time updates via WebSockets
- Future: analytics/reporting pipeline

### Schema

```sql
CREATE TABLE domain_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_name      VARCHAR(100) NOT NULL,    -- e.g., "appointment.created"
  aggregate_type  VARCHAR(100) NOT NULL,    -- e.g., "appointment"
  aggregate_id    UUID NOT NULL,
  payload         JSONB NOT NULL,           -- event-specific data
  metadata        JSONB,                    -- requestId, userId, correlationId
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ               -- NULL until fully processed
  -- CONSTRAINT: this table is append-only, no UPDATE or DELETE ever
);

-- Index for the event consumer to find unprocessed events
CREATE INDEX idx_events_unprocessed ON domain_events(created_at ASC)
  WHERE processed_at IS NULL;

CREATE INDEX idx_events_tenant ON domain_events(tenant_id, created_at DESC);
CREATE INDEX idx_events_aggregate ON domain_events(aggregate_type, aggregate_id);
```

### EventsService Implementation

```typescript
// apps/api/src/modules/events/events.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export interface DomainEventPayload {
  tenantId: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('domain-events') private readonly queue: Queue,
  ) {}

  async emit(event: DomainEventPayload): Promise<void> {
    // 1. Persist to database (source of truth)
    const dbEvent = await this.prisma.domainEvent.create({
      data: {
        tenantId: event.tenantId,
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        metadata: event.metadata ?? {},
      },
    });

    // 2. Publish to BullMQ for async processing
    await this.queue.add(
      event.eventName,
      { eventId: dbEvent.id, ...event },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }
}
```

### Domain Event Consumer

```typescript
// apps/api/src/modules/events/events.consumer.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('domain-events')
export class EventsConsumer extends WorkerHost {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly automationsService: AutomationsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { eventId, eventName, tenantId, aggregateId, payload } = job.data;

    try {
      // 1. Cache invalidation (synchronous - must happen immediately)
      await this.handleCacheInvalidation(eventName, tenantId, payload);

      // 2. Automation rule evaluation (V1 - check if any rules match)
      await this.automationsService.evaluateRules(eventName, tenantId, payload);

      // 3. Mark event as processed
      await this.prisma.domainEvent.update({
        where: { id: eventId },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      // Job will be retried by BullMQ based on attempts config
      throw error;
    }
  }

  private async handleCacheInvalidation(
    eventName: string,
    tenantId: string,
    payload: Record<string, any>,
  ): Promise<void> {
    switch (eventName) {
      case 'appointment.created':
      case 'appointment.cancelled':
      case 'appointment.rescheduled':
        await this.availabilityService.invalidateCache(
          tenantId,
          payload.employeeId,
          payload.startTime,
        );
        if (payload.previousEmployeeId) {
          // For reschedules - also invalidate the old employee/date
          await this.availabilityService.invalidateCache(
            tenantId,
            payload.previousEmployeeId,
            payload.previousStartTime,
          );
        }
        break;

      case 'employee.schedule_changed':
        await this.availabilityService.invalidateEmployeeCache(
          tenantId,
          payload.employeeId,
        );
        break;

      case 'employee.time_off_created':
      case 'employee.time_off_deleted':
        await this.availabilityService.invalidateCacheRange(
          tenantId,
          payload.employeeId,
          payload.startDate,
          payload.endDate,
        );
        break;
    }
  }
}
```

---

## Full Event Flow

```
User Request
    │
    ▼
Controller
    │
    ▼
Service Method
    │
    ├──► Prisma transaction (business logic mutation)
    │         │
    │         ▼
    │    Data committed to PostgreSQL
    │
    ├──► AuditService.log() ──► INSERT into audit_log
    │    (synchronous, same request)
    │
    └──► EventsService.emit()
              │
              ├──► INSERT into domain_events (PostgreSQL)
              │
              └──► queue.add() ──► BullMQ (Redis)
                                        │
                                        ▼ (async, background worker)
                                   EventsConsumer.process()
                                        │
                                        ├──► Availability cache invalidation
                                        │
                                        ├──► Automation rule evaluation (V1)
                                        │
                                        ├──► Webhook dispatch (V1)
                                        │
                                        └──► UPDATE domain_events.processed_at
```

---

## Key Events Reference

| Event Name | Trigger | Cache Action | Automation |
|---|---|---|---|
| `appointment.created` | Appointment booked | Invalidate employee+date | Yes |
| `appointment.cancelled` | Appointment cancelled | Invalidate employee+date | Yes |
| `appointment.rescheduled` | Appointment moved | Invalidate old + new | Yes |
| `appointment.completed` | Status = COMPLETED | No cache impact | Yes |
| `appointment.no_show` | Status = NO_SHOW | No cache impact | Yes |
| `payment.completed` | Payment processed | No cache impact | Yes |
| `client.created` | New client | No cache impact | Yes |
| `client.tag_added` | Tag assigned | No cache impact | Yes |
| `employee.schedule_changed` | Schedule updated | Invalidate employee all dates | No |
| `employee.time_off_created` | Time-off added | Invalidate date range | No |
| `employee.time_off_deleted` | Time-off removed | Invalidate date range | No |

---

## Difference Between Audit Log and Domain Events

| Aspect | Audit Log | Domain Events |
|---|---|---|
| Audience | Humans (admins, support) | Systems (consumers, workers) |
| Content | Who/what/when with before+after | What happened with business context |
| Processing | None - just stored | Processed by BullMQ consumers |
| Retention | Forever (compliance) | Until processed + cleanup policy |
| Query pattern | By entity, user, date range | By unprocessed status |
| Format | Human-readable action names | Machine-readable event names |
| Mutation tracking | Full before/after JSONB diff | Event payload only |
