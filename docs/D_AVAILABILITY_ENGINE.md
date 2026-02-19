# Availability Engine

## Overview

The availability engine is the core algorithm that calculates available time slots for booking. It must be fast (cached), accurate (no double-bookings), and handle complex scenarios (multi-service, buffers, resources, time zones).

---

## Inputs

```typescript
interface AvailabilityQuery {
  tenantId: string;        // From JWT (injected by TenantInterceptor)
  locationId: string;      // Required
  serviceIds: string[];    // One or more services (concatenated bookings)
  employeeId?: string;     // Optional - if omitted, check all qualified employees
  startDate: string;       // ISO date: "2025-03-15"
  endDate: string;         // ISO date: "2025-03-21" (max 14 days)
  timezone: string;        // e.g., "America/Mexico_City"
}
```

## Output

```typescript
interface AvailabilityResult {
  data: {
    date: string;           // "2025-03-15"
    employees: {
      id: string;
      name: string;
      slots: {
        startTime: string;  // "09:00"
        endTime: string;    // "09:45"
      }[];
    }[];
  }[];
}
```

---

## Algorithm

### Step 1: Resolve Services

```
services = fetchServices(serviceIds)
totalDuration = sum(services.map(s => s.durationMinutes))
totalBufferBetween = (services.length - 1) * defaultBufferBetweenServices  // 0 for single service
totalRequired = totalDuration + totalBufferBetween
```

### Step 2: Resolve Employees

```
if (employeeId) {
  employees = [fetchEmployee(employeeId)]
  validate: employee offers ALL requested services
} else {
  employees = fetchEmployeesOfferingAllServices(serviceIds, locationId)
}
```

### Step 3: For Each Employee, For Each Date

```
for each employee in employees:
  for each date in dateRange:
    // Check cache first
    cacheKey = `avail:${tenantId}:${locationId}:${employee.id}:${date}`
    cached = redis.get(cacheKey)
    if (cached) return parse(cached)

    // Get schedule for this day of week
    schedule = getScheduleForDay(employee.id, date.dayOfWeek, date)
    if (!schedule || !schedule.isWorking) continue  // skip non-working days

    // Build working window
    windowStart = parseTime(schedule.startTime, date, timezone)  // e.g., 09:00
    windowEnd = parseTime(schedule.endTime, date, timezone)      // e.g., 18:00

    // Get occupied blocks
    appointments = fetchAppointments(employee.id, date, statuses: [PENDING, CONFIRMED, IN_PROGRESS])
    timeOffs = fetchTimeOff(employee.id, date)

    occupiedBlocks = []
    for each appt in appointments:
      blockStart = appt.startTime - employee.bufferBeforeMinutes
      blockEnd = appt.endTime + employee.bufferAfterMinutes
      occupiedBlocks.push({ start: blockStart, end: blockEnd })

    for each timeOff in timeOffs:
      occupiedBlocks.push({ start: timeOff.start, end: timeOff.end })

    // Sort and merge overlapping blocks
    occupiedBlocks = mergeOverlapping(sortByStart(occupiedBlocks))

    // Generate available slots
    slots = generateSlots(windowStart, windowEnd, occupiedBlocks, totalRequired, granularity=15)

    // Validate resource availability (if services require resources)
    if (servicesRequireResources):
      slots = filterByResourceAvailability(slots, serviceIds, date)

    // Cache result
    redis.set(cacheKey, JSON.stringify(slots), 'EX', 300)  // 5 min TTL
```

### Step 4: Slot Generation Algorithm

```
function generateSlots(windowStart, windowEnd, occupiedBlocks, duration, granularity):
  slots = []
  currentTime = windowStart

  while currentTime + duration <= windowEnd:
    slotEnd = currentTime + duration

    // Check if this slot overlaps any occupied block
    hasConflict = false
    for each block in occupiedBlocks:
      if (currentTime < block.end AND slotEnd > block.start):
        hasConflict = true
        // Jump to end of this block to skip ahead efficiently
        currentTime = roundUpToGranularity(block.end, granularity)
        break

    if (!hasConflict):
      slots.push({ startTime: format(currentTime), endTime: format(slotEnd) })
      currentTime += granularity  // advance by slot granularity (15 min)

  return slots
```

---

## Concurrency and Anti-Double-Booking

The system uses three layers of protection:

1. **Database level**: Exclusion constraint prevents overlapping appointments for the same employee at the PostgreSQL level. This is the ultimate guarantee.
2. **Application level**: When creating an appointment, wrap in a Prisma transaction with serializable isolation to prevent race conditions.
3. **Optimistic**: If the exclusion constraint is violated (concurrent request), the database throws an error which is caught and returned as HTTP 409 Conflict to the client.

```typescript
// In AppointmentsService.create():
await prisma.$transaction(async (tx) => {
  // Create appointment (exclusion constraint validates automatically)
  const appointment = await tx.appointment.create({ data: appointmentData });
  // Create items, status history, etc. within same transaction
  return appointment;
}, { isolationLevel: 'Serializable' });
```

---

## Caching Strategy

| Property | Value |
|---|---|
| Key pattern | `avail:{tenantId}:{locationId}:{employeeId}:{YYYY-MM-DD}` |
| TTL | 300 seconds (5 minutes) |
| Storage | Redis |
| Serialization | JSON |

### Cache Invalidation Events

| Event | Keys Invalidated |
|---|---|
| `appointment.created` | affected employee + date |
| `appointment.cancelled` | affected employee + date |
| `appointment.rescheduled` | old employee + old date, new employee + new date |
| `employee.schedule_changed` | employee + all affected dates |
| `employee.time_off_created` | employee + all dates in time-off range |
| `employee.time_off_deleted` | employee + all dates in time-off range |

Invalidation is performed by the BullMQ event consumer immediately after the domain event is processed.

---

## SQL Queries

### Fetch Occupied Blocks (Appointments)

```sql
-- Fetch appointments for an employee on a specific date
SELECT
  a.start_time,
  a.end_time,
  e.buffer_before_minutes,
  e.buffer_after_minutes
FROM appointments a
JOIN employees e ON e.id = a.employee_id
WHERE a.employee_id = $1
  AND a.tenant_id = $2
  AND a.start_time >= $3::timestamptz   -- day start in UTC
  AND a.start_time < $4::timestamptz    -- day end in UTC
  AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
ORDER BY a.start_time;
```

### Fetch Time-Off Blocks

```sql
-- Fetch time-off blocks overlapping a date
SELECT start_datetime, end_datetime
FROM employee_time_off
WHERE employee_id = $1
  AND start_datetime < $2::timestamptz  -- day end
  AND end_datetime > $3::timestamptz    -- day start
ORDER BY start_datetime;
```

### Fetch Employees Offering All Services

```sql
-- Employees who offer ALL requested services at a location
SELECT e.id, e.first_name, e.last_name, e.color
FROM employees e
WHERE e.location_id = $1
  AND e.tenant_id = $2
  AND e.is_active = TRUE
  AND (
    SELECT COUNT(DISTINCT es.service_id)
    FROM employee_services es
    WHERE es.employee_id = e.id
      AND es.service_id = ANY($3::uuid[])
  ) = array_length($3::uuid[], 1)
ORDER BY e.first_name;
```

---

## TypeScript Implementation (NestJS)

```typescript
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async queryAvailability(query: AvailabilityQueryDto, tenantId: string): Promise<AvailabilityResult> {
    const { locationId, serviceIds, employeeId, startDate, endDate, timezone } = query;

    // Step 1: Resolve total duration
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId, isActive: true },
    });
    if (services.length !== serviceIds.length) {
      throw new NotFoundException('One or more services not found');
    }
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);

    // Step 2: Resolve employees
    const employees = employeeId
      ? await this.resolveSpecificEmployee(employeeId, serviceIds, tenantId)
      : await this.resolveQualifiedEmployees(serviceIds, locationId, tenantId);

    // Step 3: Build date range
    const dates = this.buildDateRange(startDate, endDate);

    // Step 4: For each date + employee, compute slots
    const result: AvailabilityResult['data'] = [];

    for (const date of dates) {
      const dateEntry = { date, employees: [] as any[] };

      for (const employee of employees) {
        const cacheKey = `avail:${tenantId}:${locationId}:${employee.id}:${date}`;
        const cached = await this.redis.get(cacheKey);

        let slots: TimeSlot[];
        if (cached) {
          slots = JSON.parse(cached);
        } else {
          slots = await this.computeSlots(employee, date, totalDuration, timezone, tenantId);
          await this.redis.set(cacheKey, JSON.stringify(slots), 'EX', 300);
        }

        if (slots.length > 0) {
          dateEntry.employees.push({
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            slots,
          });
        }
      }

      if (dateEntry.employees.length > 0) {
        result.push(dateEntry);
      }
    }

    return { data: result };
  }

  private async computeSlots(
    employee: Employee,
    date: string,
    totalDuration: number,
    timezone: string,
    tenantId: string,
  ): Promise<TimeSlot[]> {
    const schedule = await this.getScheduleForDate(employee.id, date);
    if (!schedule || !schedule.isWorking) return [];

    const { windowStart, windowEnd } = this.buildWindow(schedule, date, timezone);
    const appointments = await this.fetchAppointments(employee.id, date, tenantId);
    const timeOffs = await this.fetchTimeOff(employee.id, date);

    const occupiedBlocks = this.buildOccupiedBlocks(appointments, timeOffs, employee);
    const merged = this.mergeOverlapping(occupiedBlocks);

    return this.generateSlots(windowStart, windowEnd, merged, totalDuration, 15);
  }

  private generateSlots(
    windowStart: Date,
    windowEnd: Date,
    occupied: Block[],
    duration: number,
    granularity: number,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let current = windowStart;
    const durationMs = duration * 60 * 1000;
    const granularityMs = granularity * 60 * 1000;

    while (current.getTime() + durationMs <= windowEnd.getTime()) {
      const slotEnd = new Date(current.getTime() + durationMs);
      const conflict = occupied.find(b => current < b.end && slotEnd > b.start);

      if (conflict) {
        current = this.roundUpToGranularity(conflict.end, granularity);
      } else {
        slots.push({
          startTime: this.formatTime(current),
          endTime: this.formatTime(slotEnd),
        });
        current = new Date(current.getTime() + granularityMs);
      }
    }

    return slots;
  }
}
```

---

## Edge Cases (Test Suite)

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Non-working day (schedule.isWorking = false) | Returns empty slots array |
| 2 | Full day available, no appointments | Returns all possible slots at 15-min intervals |
| 3 | Single appointment in middle of day | Splits available time into two windows |
| 4 | Buffer before service (employee.bufferBeforeMinutes = 15) | Slot cannot start within 15 min of next appointment |
| 5 | Buffer after service (employee.bufferAfterMinutes = 15) | Occupied block extends 15 min past appointment end |
| 6 | Employee time-off full day | Returns empty slots array |
| 7 | Employee time-off partial (morning only) | Returns only afternoon slots |
| 8 | Multi-service total 60 min | Only slots with 60 min continuous availability are returned |
| 9 | Back-to-back appointments fill the day | Returns empty slots array |
| 10 | Slot granularity 15 min | Slots appear at :00, :15, :30, :45 only |
| 11 | Multiple qualified employees | Returns slots grouped per employee |
| 12 | Appointment at exact schedule boundary | Last slot does not extend past closing time |
| 13 | DST spring forward (23-hour day) | Working window adjusted, no phantom slots |
| 14 | DST fall back (25-hour day) | Working window adjusted correctly |
| 15 | Cached result exists | Returns from Redis without any DB query |
| 16 | Required resource conflict | Filters out slots where required room/chair is occupied |

---

## Performance Targets

| Metric | Target |
|---|---|
| Availability query (cache hit) | < 50ms p99 |
| Availability query (cache miss, 1 employee, 7 days) | < 200ms p99 |
| Concurrent booking conflict detection | < 10ms (DB constraint) |
| Cache TTL | 300 seconds |
| Max date range per query | 14 days |
