# Automations Engine (IF/THEN)

## Overview

The automations engine allows tenants to define business rules that execute automatically when specific events occur or on a schedule. Rules follow an IF/THEN pattern:

- **IF** a trigger fires AND conditions are met
- **THEN** execute an action

**MVP Status**: Tables and CRUD API are created in MVP. Execution engine is activated in V1.

---

## Data Model

```sql
automation_rules:
  id                      UUID PRIMARY KEY
  tenant_id               UUID NOT NULL
  name                    VARCHAR(255) NOT NULL
  description             TEXT
  trigger_type            VARCHAR(50) NOT NULL    -- 'event' | 'cron'
  trigger_config          JSONB NOT NULL          -- see trigger types below
  condition_config        JSONB                   -- see condition examples below (nullable = no conditions)
  action_type             VARCHAR(50) NOT NULL    -- see action types below
  action_config           JSONB NOT NULL          -- action-specific config
  is_active               BOOLEAN DEFAULT FALSE
  quiet_hours_start       TIME                    -- e.g., "22:00"
  quiet_hours_end         TIME                    -- e.g., "08:00"
  rate_limit_per_client   INT                     -- max executions per client in window
  rate_limit_window_hours INT                     -- window duration in hours
  last_triggered_at       TIMESTAMPTZ
  execution_count         INT DEFAULT 0
  created_at              TIMESTAMPTZ
  updated_at              TIMESTAMPTZ
```

---

## Trigger Types

### Event-Based Triggers

These fire immediately when the corresponding domain event is emitted.

| Trigger Name | When It Fires |
|---|---|
| `appointment_created` | A new appointment is booked |
| `appointment_confirmed` | An appointment status changes to CONFIRMED |
| `appointment_cancelled` | An appointment is cancelled |
| `appointment_completed` | An appointment is marked completed |
| `appointment_no_show` | An appointment is marked as NO_SHOW |
| `payment_completed` | A payment is successfully processed |
| `client_created` | A new client profile is created |
| `client_tag_added` | A tag is added to a client |

### Time-Based Triggers (Cron)

These are evaluated by a scheduled cron job that runs every minute.

| Trigger Name | Schedule | Description |
|---|---|---|
| `appointment_reminder_24h` | Every minute | Fires for appointments starting in ~24 hours |
| `appointment_reminder_1h` | Every minute | Fires for appointments starting in ~1 hour |
| `follow_up_after_visit` | Every minute | Fires X hours after appointment completion |
| `client_birthday` | Daily at 08:00 | Fires on client's birthday |
| `client_inactive_30_days` | Daily at 09:00 | Fires if client has no appointment in 30 days |

### Trigger Config Examples

```json
// Event-based
{
  "eventName": "appointment_created"
}

// Cron - reminder
{
  "type": "appointment_reminder_24h",
  "lookAheadHours": 24,
  "windowMinutes": 30
}

// Cron - follow-up
{
  "type": "follow_up_after_visit",
  "delayHours": 2
}

// Cron - birthday
{
  "type": "client_birthday",
  "sendAtTime": "09:00"
}
```

---

## Condition System

Conditions are evaluated against the trigger context (appointment, client, payment, etc.).

### Condition Structure

```json
{
  "logic": "AND",
  "conditions": [
    {
      "field": "client.tags",
      "operator": "contains",
      "value": "VIP"
    },
    {
      "field": "service.category",
      "operator": "equals",
      "value": "hair"
    }
  ]
}
```

### Supported Operators

| Operator | Description | Example |
|---|---|---|
| `equals` | Exact match | `status equals CONFIRMED` |
| `not_equals` | Does not match | `source not_equals WALK_IN` |
| `contains` | Array contains value | `client.tags contains VIP` |
| `not_contains` | Array does not contain | `client.tags not_contains BLOCKED` |
| `greater_than` | Numeric comparison | `appointment.totalPrice greater_than 500` |
| `less_than` | Numeric comparison | `appointment.totalPrice less_than 100` |
| `is_null` | Field is null/empty | `client.email is_null` |
| `is_not_null` | Field has value | `client.email is_not_null` |
| `in` | Value is in list | `appointment.source in [ONLINE, PHONE]` |
| `not_in` | Value not in list | `appointment.status not_in [CANCELLED, NO_SHOW]` |

### Available Context Fields

#### Appointment Context
```
appointment.id
appointment.status
appointment.source          (MANUAL, ONLINE, WALK_IN, PHONE)
appointment.totalPrice
appointment.startTime
appointment.notes
client.id
client.firstName
client.lastName
client.email
client.phone
client.tags                 (array of tag names)
client.totalAppointments
employee.id
employee.firstName
employee.lastName
service.id
service.name
service.category
service.price
location.id
location.name
```

#### Payment Context
```
payment.id
payment.total
payment.paymentMethod
payment.tipAmount
client.*                    (same as above)
```

---

## Action Types

| Action | Description | Config Required |
|---|---|---|
| `send_email` | Send email via configured provider | templateId, recipientField |
| `send_sms` | Send SMS message | templateId, recipientField |
| `send_whatsapp` | Send WhatsApp message | templateId, recipientField |
| `add_client_tag` | Add a tag to the client | tagId |
| `remove_client_tag` | Remove a tag from the client | tagId |
| `create_internal_note` | Add internal note to appointment | noteText |
| `call_webhook` | POST to external URL | url, headers, bodyTemplate |

### Action Config Examples

```json
// send_email
{
  "templateId": "uuid-of-notification-template",
  "recipientField": "client.email",
  "subject": "Your appointment is confirmed"
}

// send_sms
{
  "templateId": "uuid-of-sms-template",
  "recipientField": "client.phone"
}

// add_client_tag
{
  "tagId": "uuid-of-vip-tag"
}

// create_internal_note
{
  "noteText": "Client is VIP - prepare welcome gift"
}

// call_webhook
{
  "url": "https://hooks.slack.com/services/xxx/yyy/zzz",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "bodyTemplate": "{\"text\": \"New appointment for {{client.firstName}} {{client.lastName}}\"}"
}
```

---

## 10 Real-World Examples

### 1. Appointment Confirmation Email

```json
{
  "name": "Appointment Confirmation",
  "triggerType": "event",
  "triggerConfig": { "eventName": "appointment_created" },
  "conditionConfig": null,
  "actionType": "send_email",
  "actionConfig": {
    "templateId": "confirmation-template-uuid",
    "recipientField": "client.email"
  }
}
```

### 2. 24-Hour SMS Reminder

```json
{
  "name": "24h Appointment Reminder",
  "triggerType": "cron",
  "triggerConfig": { "type": "appointment_reminder_24h", "lookAheadHours": 24, "windowMinutes": 30 },
  "conditionConfig": null,
  "actionType": "send_sms",
  "actionConfig": {
    "templateId": "reminder-sms-uuid",
    "recipientField": "client.phone"
  },
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00",
  "rateLimitPerClient": 1,
  "rateLimitWindowHours": 20
}
```

### 3. No-Show Follow-Up Email

```json
{
  "name": "No-Show Apology + Rebook",
  "triggerType": "event",
  "triggerConfig": { "eventName": "appointment_no_show" },
  "conditionConfig": null,
  "actionType": "send_email",
  "actionConfig": {
    "templateId": "no-show-followup-uuid",
    "recipientField": "client.email"
  }
}
```

### 4. Birthday Greeting with Discount

```json
{
  "name": "Birthday Greeting",
  "triggerType": "cron",
  "triggerConfig": { "type": "client_birthday", "sendAtTime": "09:00" },
  "conditionConfig": {
    "logic": "AND",
    "conditions": [{ "field": "client.email", "operator": "is_not_null" }]
  },
  "actionType": "send_email",
  "actionConfig": {
    "templateId": "birthday-email-uuid",
    "recipientField": "client.email"
  },
  "rateLimitPerClient": 1,
  "rateLimitWindowHours": 8760
}
```

### 5. Win-Back Campaign (30-Day Inactive)

```json
{
  "name": "Win-Back Inactive Clients",
  "triggerType": "cron",
  "triggerConfig": { "type": "client_inactive_30_days" },
  "conditionConfig": {
    "logic": "AND",
    "conditions": [{ "field": "client.email", "operator": "is_not_null" }]
  },
  "actionType": "send_email",
  "actionConfig": {
    "templateId": "win-back-email-uuid",
    "recipientField": "client.email"
  },
  "rateLimitPerClient": 1,
  "rateLimitWindowHours": 720
}
```

### 6. VIP Internal Note on Booking

```json
{
  "name": "VIP Welcome Prep",
  "triggerType": "event",
  "triggerConfig": { "eventName": "appointment_created" },
  "conditionConfig": {
    "logic": "AND",
    "conditions": [{ "field": "client.tags", "operator": "contains", "value": "VIP" }]
  },
  "actionType": "create_internal_note",
  "actionConfig": {
    "noteText": "VIP client - prepare welcome drink and complimentary service upgrade if available"
  }
}
```

### 7. New Client Welcome Email

```json
{
  "name": "New Client Welcome",
  "triggerType": "event",
  "triggerConfig": { "eventName": "client_created" },
  "conditionConfig": {
    "logic": "AND",
    "conditions": [{ "field": "client.email", "operator": "is_not_null" }]
  },
  "actionType": "send_email",
  "actionConfig": {
    "templateId": "welcome-email-uuid",
    "recipientField": "client.email"
  }
}
```

### 8. Payment Receipt Email

```json
{
  "name": "Payment Receipt",
  "triggerType": "event",
  "triggerConfig": { "eventName": "payment_completed" },
  "conditionConfig": {
    "logic": "AND",
    "conditions": [{ "field": "client.email", "operator": "is_not_null" }]
  },
  "actionType": "send_email",
  "actionConfig": {
    "templateId": "receipt-email-uuid",
    "recipientField": "client.email"
  }
}
```

### 9. Review Request (2 Hours After Completion)

```json
{
  "name": "Post-Visit Review Request",
  "triggerType": "cron",
  "triggerConfig": { "type": "follow_up_after_visit", "delayHours": 2 },
  "conditionConfig": {
    "logic": "AND",
    "conditions": [
      { "field": "appointment.status", "operator": "equals", "value": "COMPLETED" },
      { "field": "client.email", "operator": "is_not_null" }
    ]
  },
  "actionType": "send_email",
  "actionConfig": {
    "templateId": "review-request-uuid",
    "recipientField": "client.email"
  },
  "rateLimitPerClient": 1,
  "rateLimitWindowHours": 168
}
```

### 10. New Appointment Slack Notification

```json
{
  "name": "Slack: New Online Booking",
  "triggerType": "event",
  "triggerConfig": { "eventName": "appointment_created" },
  "conditionConfig": {
    "logic": "AND",
    "conditions": [{ "field": "appointment.source", "operator": "equals", "value": "ONLINE" }]
  },
  "actionType": "call_webhook",
  "actionConfig": {
    "url": "https://hooks.slack.com/services/xxx/yyy/zzz",
    "method": "POST",
    "headers": { "Content-Type": "application/json" },
    "bodyTemplate": "{\"text\": \"New online booking: {{client.firstName}} {{client.lastName}} - {{service.name}} at {{appointment.startTime}}\"}"
  }
}
```

---

## Execution Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Trigger Layer                           │
│                                                          │
│  Event Bus ──────────────────────────► Event Consumer   │
│  (domain events)                       checks rules      │
│                                                          │
│  Cron Scheduler ─────────────────────► Cron Consumer   │
│  (every minute)                        checks rules      │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  Rule Evaluation                         │
│                                                          │
│  1. Find matching active rules for trigger               │
│  2. Evaluate conditions against context                  │
│  3. Check anti-spam guards (rate limit, quiet hours)     │
│  4. Enqueue action jobs in BullMQ                        │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  Action Execution                        │
│                                                          │
│  ActionWorker picks up job from BullMQ queue            │
│  ├── send_email → EmailProvider (SendGrid/Resend)       │
│  ├── send_sms → SMSProvider (Twilio/Vonage)             │
│  ├── add_client_tag → ClientsService                    │
│  ├── create_internal_note → AppointmentsService         │
│  └── call_webhook → HTTP POST to external URL           │
│                                                          │
│  Log execution to automation_executions table           │
└──────────────────────────────────────────────────────────┘
```

---

## Anti-Spam Protections

| Protection | Mechanism |
|---|---|
| Quiet Hours | Rule has `quiet_hours_start`/`end`. Actions deferred until window opens. |
| Rate Limiting | `rate_limit_per_client` max executions within `rate_limit_window_hours`. Checked against execution log. |
| Client Opt-Out | `client.communication_preferences` checked before sending any communication. |
| Tenant Limits | Max 100 automation executions per hour per tenant (platform-level guard). |
| Idempotency | Track `(rule_id, trigger_event_id)` in execution log to prevent duplicate runs from retry. |
| Execution Log | All executions logged with status, error, and duration for debugging. |

---

## Condition Evaluation (TypeScript)

```typescript
// apps/api/src/modules/automations/condition-evaluator.service.ts
@Injectable()
export class ConditionEvaluatorService {

  evaluate(conditionConfig: ConditionConfig | null, context: Record<string, any>): boolean {
    if (!conditionConfig) return true; // no conditions = always matches

    const { logic, conditions } = conditionConfig;
    const results = conditions.map(c => this.evaluateCondition(c, context));

    return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
  }

  private evaluateCondition(condition: Condition, context: Record<string, any>): boolean {
    const value = this.getNestedValue(context, condition.field);

    switch (condition.operator) {
      case 'equals':       return value === condition.value;
      case 'not_equals':   return value !== condition.value;
      case 'contains':     return Array.isArray(value) && value.includes(condition.value);
      case 'not_contains': return Array.isArray(value) && !value.includes(condition.value);
      case 'greater_than': return Number(value) > Number(condition.value);
      case 'less_than':    return Number(value) < Number(condition.value);
      case 'is_null':      return value === null || value === undefined || value === '';
      case 'is_not_null':  return value !== null && value !== undefined && value !== '';
      case 'in':           return (condition.value as string[]).includes(value);
      case 'not_in':       return !(condition.value as string[]).includes(value);
      default:             return false;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
```
