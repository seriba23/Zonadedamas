# Data Model

## Entity Relationship Overview

```
Tenant ──1:N── Location
Tenant ──1:N── User ──1:1── Employee (optional)
Tenant ──1:N── Client ──N:M── ClientTag
Tenant ──1:N── Service ──1:N── ServiceAddon
Tenant ──1:N── Role ──N:M── Permission (via RolePermission)
User ──N:M── Role (via UserRole, scoped to tenant+location)
Employee ──N:M── Service (via EmployeeService)
Employee ──1:N── EmployeeSchedule
Employee ──1:N── EmployeeTimeOff
Service ──N:M── Resource (via ServiceResource)
Appointment ──1:N── AppointmentItem (snapshot)
Appointment ──1:N── AppointmentStatusHistory
Appointment ──0:N── Payment
Payment ──1:N── PaymentItem
```

---

## Key Design Decisions

### Multi-Tenant Isolation

Every table that stores business data has a `tenant_id` column. Application-level enforcement via NestJS guards ensures every query filters by `tenant_id`.

**Why not PostgreSQL RLS?**
- App-level enforcement is simpler to debug and test
- RLS adds overhead on every query
- RLS requires careful session variable management
- App-level gives us full control over tenant context
- RLS CAN be added as defense-in-depth in V1 as a secondary layer

### Snapshot Pattern (appointment_items)

When a client books an appointment, the service price and duration are copied into `appointment_items` as `price_snapshot` and `duration_snapshot`. This ensures:

- **Historical accuracy**: if the service price changes later, past appointments retain original pricing
- **Reporting accuracy**: revenue calculations use snapshot values
- **Audit trail**: we know exactly what was charged

### Anti-Double-Booking

PostgreSQL exclusion constraint using `btree_gist` extension:

```sql
ALTER TABLE appointments ADD CONSTRAINT no_employee_overlap
  EXCLUDE USING GIST (
    employee_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
```

This is a database-level guarantee that no two active appointments can overlap for the same employee.

### Index Strategy

Key indexes for performance:

| Index | Table | Purpose |
|---|---|---|
| `(employee_id, start_time, end_time)` | appointments | Fast overlap detection for availability queries |
| `(tenant_id)` | all tenant-scoped tables | Tenant isolation filter |
| `(tenant_id, location_id, start_time)` | appointments | Calendar view queries |
| `(tenant_id, email)` | clients | Client lookup by email |
| `(tenant_id, phone)` | clients | Client lookup by phone |
| `(tenant_id, created_at)` | audit_log | Audit log pagination |
| `(entity_type, entity_id)` | audit_log | Entity-specific audit trail |
| `(processed_at) WHERE NULL` | domain_events | Unprocessed event queue scan |

### Append-Only Tables

`audit_log` and `domain_events` are append-only. Application never issues `UPDATE` or `DELETE` on these tables. This ensures complete audit trail and event history.

---

## Full Entity List (28 tables)

1. `tenants`
2. `locations`
3. `users`
4. `refresh_tokens`
5. `roles`
6. `permissions`
7. `role_permissions`
8. `user_roles`
9. `clients`
10. `client_tags`
11. `client_tag_map`
12. `services`
13. `service_addons`
14. `employees`
15. `employee_services`
16. `employee_schedules`
17. `employee_time_off`
18. `resources`
19. `service_resources`
20. `appointments`
21. `appointment_items`
22. `appointment_status_history`
23. `payments`
24. `payment_items`
25. `audit_log`
26. `domain_events`
27. `automation_rules`
28. `notification_templates`

---

## Schema Definitions

### tenants

```sql
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL,
  timezone      VARCHAR(100) NOT NULL DEFAULT 'UTC',
  currency      CHAR(3) NOT NULL DEFAULT 'USD',
  logo_url      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### locations

```sql
CREATE TABLE locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  address       TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  country       VARCHAR(100),
  postal_code   VARCHAR(20),
  phone         VARCHAR(50),
  email         VARCHAR(255),
  timezone      VARCHAR(100),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_locations_tenant ON locations(tenant_id);
```

### users

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(50),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
```

### refresh_tokens

```sql
CREATE TABLE refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of the opaque token
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

### roles

```sql
CREATE TABLE roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system role
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) NOT NULL,
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);
```

### permissions

```sql
CREATE TABLE permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL UNIQUE,  -- e.g., "appointments.create"
  description   TEXT,
  module        VARCHAR(100) NOT NULL,         -- e.g., "appointments"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### role_permissions

```sql
CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

### user_roles

```sql
CREATE TABLE user_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id   UUID REFERENCES locations(id) ON DELETE CASCADE,  -- NULL = all locations
  assigned_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id, location_id)
);
```

### clients

```sql
CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  gender          VARCHAR(20),
  date_of_birth   DATE,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  communication_preferences JSONB NOT NULL DEFAULT '{"email": true, "sms": true, "whatsapp": false}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clients_tenant ON clients(tenant_id);
CREATE INDEX idx_clients_email ON clients(tenant_id, email);
CREATE INDEX idx_clients_phone ON clients(tenant_id, phone);
```

### client_tags

```sql
CREATE TABLE client_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7),  -- hex color e.g., "#FF5733"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);
```

### client_tag_map

```sql
CREATE TABLE client_tag_map (
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES client_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, tag_id)
);
```

### services

```sql
CREATE TABLE services (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  duration_minutes      INT NOT NULL,
  buffer_before_minutes INT NOT NULL DEFAULT 0,
  buffer_after_minutes  INT NOT NULL DEFAULT 0,
  price                 NUMERIC(10,2) NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'USD',
  color                 VARCHAR(7),
  category              VARCHAR(100),
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_services_tenant ON services(tenant_id);
```

### employees

```sql
CREATE TABLE employees (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id           UUID NOT NULL REFERENCES locations(id),
  user_id               UUID REFERENCES users(id),  -- linked user account (optional)
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100) NOT NULL,
  email                 VARCHAR(255),
  phone                 VARCHAR(50),
  color                 VARCHAR(7),
  bio                   TEXT,
  buffer_before_minutes INT NOT NULL DEFAULT 0,
  buffer_after_minutes  INT NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_location ON employees(location_id);
```

### employee_schedules

```sql
CREATE TABLE employee_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun, 6=Sat
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_working    BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(employee_id, day_of_week)
);
```

### employee_time_off

```sql
CREATE TABLE employee_time_off (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_datetime  TIMESTAMPTZ NOT NULL,
  end_datetime    TIMESTAMPTZ NOT NULL,
  reason          TEXT,
  is_all_day      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_time_off_employee ON employee_time_off(employee_id);
```

### employee_services

```sql
CREATE TABLE employee_services (
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  service_id    UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, service_id)
);
```

### resources

```sql
CREATE TABLE resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id   UUID NOT NULL REFERENCES locations(id),
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(100),  -- e.g., "room", "chair", "equipment"
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### service_resources

```sql
CREATE TABLE service_resources (
  service_id    UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  resource_id   UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, resource_id)
);
```

### appointments

```sql
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id     UUID NOT NULL REFERENCES locations(id),
  client_id       UUID NOT NULL REFERENCES clients(id),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW')),
  source          VARCHAR(50) NOT NULL DEFAULT 'MANUAL'
                    CHECK (source IN ('MANUAL','ONLINE','WALK_IN','PHONE')),
  notes           TEXT,
  internal_notes  TEXT,
  total_price     NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anti-double-booking exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT no_employee_overlap
  EXCLUDE USING GIST (
    employee_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

CREATE INDEX idx_appt_tenant ON appointments(tenant_id);
CREATE INDEX idx_appt_location ON appointments(tenant_id, location_id, start_time);
CREATE INDEX idx_appt_employee ON appointments(employee_id, start_time, end_time);
CREATE INDEX idx_appt_client ON appointments(client_id);
```

### appointment_items (snapshot)

```sql
CREATE TABLE appointment_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id        UUID REFERENCES services(id),
  name_snapshot     VARCHAR(255) NOT NULL,    -- service name at booking time
  price_snapshot    NUMERIC(10,2) NOT NULL,   -- price at booking time
  duration_snapshot INT NOT NULL,             -- duration (minutes) at booking time
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### appointment_status_history

```sql
CREATE TABLE appointment_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  from_status     VARCHAR(20),
  to_status       VARCHAR(20) NOT NULL,
  changed_by      UUID REFERENCES users(id),
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### payments

```sql
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id       UUID NOT NULL REFERENCES locations(id),
  appointment_id    UUID REFERENCES appointments(id),
  client_id         UUID NOT NULL REFERENCES clients(id),
  payment_method    VARCHAR(50) NOT NULL CHECK (payment_method IN ('CASH','CARD','TRANSFER','OTHER')),
  subtotal          NUMERIC(10,2) NOT NULL,
  tip_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
                      CHECK (status IN ('PENDING','COMPLETED','REFUNDED','PARTIAL_REFUND')),
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_appointment ON payments(appointment_id);
```

### payment_items

```sql
CREATE TABLE payment_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  description   VARCHAR(255) NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  unit_price    NUMERIC(10,2) NOT NULL,
  total_price   NUMERIC(10,2) NOT NULL,
  item_type     VARCHAR(50) NOT NULL CHECK (item_type IN ('SERVICE','PRODUCT','TIP','DISCOUNT','TAX')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### audit_log

```sql
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),  -- NULL for system actions
  action        VARCHAR(100) NOT NULL,       -- e.g., "appointment.created"
  entity_type   VARCHAR(100) NOT NULL,       -- e.g., "appointment"
  entity_id     UUID NOT NULL,
  before_data   JSONB,                       -- NULL on create
  after_data    JSONB,                       -- NULL on delete
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO UPDATE or DELETE ever issued on this table
);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

### domain_events

```sql
CREATE TABLE domain_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_name      VARCHAR(100) NOT NULL,   -- e.g., "appointment.created"
  aggregate_type  VARCHAR(100) NOT NULL,   -- e.g., "appointment"
  aggregate_id    UUID NOT NULL,
  payload         JSONB NOT NULL,
  metadata        JSONB,                   -- requestId, userId, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ              -- NULL until processed
  -- NO UPDATE or DELETE ever issued on this table
);
CREATE INDEX idx_events_unprocessed ON domain_events(created_at) WHERE processed_at IS NULL;
CREATE INDEX idx_events_tenant ON domain_events(tenant_id, created_at DESC);
```

### automation_rules

```sql
CREATE TABLE automation_rules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                    VARCHAR(255) NOT NULL,
  description             TEXT,
  trigger_type            VARCHAR(50) NOT NULL,   -- "event" | "cron"
  trigger_config          JSONB NOT NULL,         -- event name, cron expression, etc.
  condition_config        JSONB,                  -- conditions array with AND/OR logic
  action_type             VARCHAR(50) NOT NULL,   -- "send_email" | "send_sms" | etc.
  action_config           JSONB NOT NULL,         -- template id, recipients, etc.
  is_active               BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start       TIME,
  quiet_hours_end         TIME,
  rate_limit_per_client   INT,
  rate_limit_window_hours INT,
  last_triggered_at       TIMESTAMPTZ,
  execution_count         INT NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### notification_templates

```sql
CREATE TABLE notification_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  channel     VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL','SMS','WHATSAPP')),
  subject     VARCHAR(255),              -- for email only
  body        TEXT NOT NULL,             -- handlebars/mustache template
  variables   JSONB,                     -- documented available variables
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
