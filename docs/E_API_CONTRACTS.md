# API Contracts

## Conventions

- Base URL: `/api`
- All requests/responses use `Content-Type: application/json`
- Auth header: `Authorization: Bearer <accessToken>`
- Pagination default: `page=1`, `perPage=20`, max `perPage=100`
- All IDs are UUIDs
- Timestamps are ISO 8601 in UTC
- `[auth]` = requires valid JWT
- `[permission]` = requires specific permission via PermissionGuard

---

## Standard Response Envelopes

### Single Resource

```json
{
  "data": { }
}
```

### Paginated List

```json
{
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20,
    "totalPages": 5
  }
}
```

### Error

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

---

## Standard Error Codes

| Code | Meaning |
|---|---|
| 400 | Validation error (invalid input) |
| 401 | Unauthorized (missing or invalid JWT) |
| 403 | Forbidden (authenticated but missing permission) |
| 404 | Not found (entity does not exist OR cross-tenant access attempt) |
| 409 | Conflict (e.g., double-booking, duplicate email) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## Auth Endpoints

### POST /api/auth/login

Login with email and password.

**Auth**: None (public endpoint)

**Request**:
```json
{
  "email": "owner@salon.com",
  "password": "securePassword123"
}
```

**Response 200**:
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "a7f3d9c1-2b4e-4f6a-8c0d-1e2f3a4b5c6d",
    "user": {
      "id": "uuid",
      "email": "owner@salon.com",
      "firstName": "Maria",
      "lastName": "Garcia",
      "tenantId": "uuid"
    }
  }
}
```

**Errors**: 401 (invalid credentials), 429 (rate limited: 20/min per IP)

---

### POST /api/auth/refresh

Exchange a refresh token for a new access+refresh token pair. Old refresh token is revoked.

**Auth**: None

**Request**:
```json
{
  "refreshToken": "a7f3d9c1-2b4e-4f6a-8c0d-1e2f3a4b5c6d"
}
```

**Response 200**:
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "b8g4e0d2-3c5f-5g7b-9d1e-2f3g4b5d6e7f"
  }
}
```

**Errors**: 401 (invalid, expired, or already-revoked refresh token)

---

### POST /api/auth/logout

Revoke a refresh token.

**Auth**: [auth]

**Request**:
```json
{
  "refreshToken": "a7f3d9c1-2b4e-4f6a-8c0d-1e2f3a4b5c6d"
}
```

**Response 200**:
```json
{
  "data": { "success": true }
}
```

---

### GET /api/auth/me

Get current authenticated user profile and permissions.

**Auth**: [auth]

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "email": "owner@salon.com",
    "firstName": "Maria",
    "lastName": "Garcia",
    "tenantId": "uuid",
    "permissions": [
      "appointments.create",
      "appointments.read",
      "clients.create",
      "clients.read"
    ]
  }
}
```

---

## Tenants Endpoints

### POST /api/tenants (Onboarding)

Create a new tenant with owner account. Seeds default roles and permissions.

**Auth**: None (public endpoint)

**Request**:
```json
{
  "name": "Salon Elegance",
  "slug": "salon-elegance",
  "email": "contact@salonelegance.com",
  "timezone": "America/Mexico_City",
  "currency": "MXN",
  "owner": {
    "email": "owner@salonelegance.com",
    "password": "securePassword123",
    "firstName": "Maria",
    "lastName": "Garcia"
  }
}
```

**Response 201**:
```json
{
  "data": {
    "tenant": {
      "id": "uuid",
      "name": "Salon Elegance",
      "slug": "salon-elegance"
    },
    "user": {
      "id": "uuid",
      "email": "owner@salonelegance.com"
    },
    "accessToken": "eyJ...",
    "refreshToken": "uuid"
  }
}
```

**Errors**: 409 (slug already taken)

---

### GET /api/tenants/current

Get current tenant details.

**Auth**: [auth]

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Salon Elegance",
    "slug": "salon-elegance",
    "email": "contact@salonelegance.com",
    "timezone": "America/Mexico_City",
    "currency": "MXN",
    "logoUrl": null,
    "isActive": true,
    "createdAt": "2025-03-01T10:00:00Z"
  }
}
```

---

## Locations Endpoints

### POST /api/locations

**Auth**: [auth, locations.create]

**Request**:
```json
{
  "name": "Downtown Branch",
  "address": "123 Main St",
  "city": "Mexico City",
  "state": "CDMX",
  "country": "MX",
  "postalCode": "06600",
  "phone": "+52-55-1234-5678",
  "email": "downtown@salonelegance.com",
  "timezone": "America/Mexico_City"
}
```

**Response 201**: `{ "data": location }`

**Errors**: 400 (validation), 403 (missing permission)

---

### GET /api/locations

**Auth**: [auth, locations.read]

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Downtown Branch",
      "address": "123 Main St",
      "city": "Mexico City",
      "phone": "+52-55-1234-5678",
      "isActive": true
    }
  ]
}
```

---

### PUT /api/locations/:id

**Auth**: [auth, locations.update]

**Request**: partial location fields

**Response 200**: `{ "data": location }`

**Errors**: 404 (not found), 403 (missing permission)

---

### DELETE /api/locations/:id

**Auth**: [auth, locations.delete]

**Response 200**: `{ "data": { "success": true } }`

**Errors**: 404 (not found), 409 (has active appointments)

---

## RBAC Endpoints

### GET /api/permissions

Get all permissions grouped by module.

**Auth**: [auth]

**Response 200**:
```json
{
  "data": {
    "appointments": [
      { "id": "uuid", "name": "appointments.create", "description": "Create appointments" },
      { "id": "uuid", "name": "appointments.read", "description": "View appointments" }
    ],
    "clients": [
      { "id": "uuid", "name": "clients.create", "description": "Create clients" }
    ]
  }
}
```

---

### GET /api/roles

**Auth**: [auth, roles.read]

**Response 200**: `{ "data": role[] }` (includes permission count)

---

### POST /api/roles

**Auth**: [auth, roles.create]

**Request**:
```json
{
  "name": "Receptionist",
  "slug": "receptionist",
  "description": "Front desk operations",
  "permissionIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response 201**: `{ "data": role with permissions }`

**Errors**: 409 (slug already exists for tenant)

---

### PUT /api/roles/:id

**Auth**: [auth, roles.update]

**Request**: partial role fields + optional permissionIds

**Response 200**: `{ "data": role }`

**Errors**: 403 (cannot modify system roles)

---

### DELETE /api/roles/:id

**Auth**: [auth, roles.delete]

**Response 200**: `{ "data": { "success": true } }`

**Errors**: 403 (cannot delete system roles), 409 (role has assigned users)

---

### POST /api/user-roles

Assign a role to a user (optionally scoped to a location).

**Auth**: [auth, users.manage]

**Request**:
```json
{
  "userId": "uuid",
  "roleId": "uuid",
  "locationId": "uuid"
}
```

**Response 201**: `{ "data": userRole }`

---

### DELETE /api/user-roles/:id

**Auth**: [auth, users.manage]

**Response 200**: `{ "data": { "success": true } }`

---

## Clients Endpoints

### GET /api/clients

**Auth**: [auth, clients.read]

**Query Parameters**:

| Param | Type | Description |
|---|---|---|
| search | string | Full-text search on name, email, phone |
| page | int | Page number (default: 1) |
| perPage | int | Items per page (default: 20, max: 100) |
| sortBy | string | `firstName`, `lastName`, `createdAt` (default: `createdAt`) |
| sortOrder | string | `asc`, `desc` (default: `desc`) |

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "firstName": "Ana",
      "lastName": "Martinez",
      "email": "ana@example.com",
      "phone": "+52-55-9876-5432",
      "tags": [{ "id": "uuid", "name": "VIP", "color": "#FFD700" }],
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": { "total": 150, "page": 1, "perPage": 20, "totalPages": 8 }
}
```

---

### POST /api/clients

**Auth**: [auth, clients.create]

**Request**:
```json
{
  "firstName": "Ana",
  "lastName": "Martinez",
  "email": "ana@example.com",
  "phone": "+52-55-9876-5432",
  "gender": "female",
  "dateOfBirth": "1990-05-15",
  "notes": "Prefers morning appointments"
}
```

**Response 201**: `{ "data": client }`

**Errors**: 409 (email already registered for tenant)

---

### GET /api/clients/:id

**Auth**: [auth, clients.read]

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "firstName": "Ana",
    "lastName": "Martinez",
    "email": "ana@example.com",
    "phone": "+52-55-9876-5432",
    "gender": "female",
    "dateOfBirth": "1990-05-15",
    "notes": "Prefers morning appointments",
    "tags": [],
    "stats": {
      "totalAppointments": 12,
      "totalSpent": 3600.00,
      "lastVisit": "2025-02-10T14:00:00Z",
      "noShowCount": 1
    },
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### PUT /api/clients/:id

**Auth**: [auth, clients.update]

**Request**: partial client fields

**Response 200**: `{ "data": client }`

---

### DELETE /api/clients/:id

**Auth**: [auth, clients.delete]

Soft delete (sets `isActive = false`).

**Response 200**: `{ "data": { "success": true } }`

---

### POST /api/clients/:id/tags

**Auth**: [auth, clients.update]

**Request**: `{ "tagId": "uuid" }`

**Response 200**: `{ "data": client with tags }`

---

### DELETE /api/clients/:id/tags/:tagId

**Auth**: [auth, clients.update]

**Response 200**: `{ "data": client with tags }`

---

### GET /api/client-tags

**Auth**: [auth, clients.read]

**Response 200**: `{ "data": [{ "id": "uuid", "name": "VIP", "color": "#FFD700" }] }`

---

### POST /api/client-tags

**Auth**: [auth, clients.update]

**Request**: `{ "name": "VIP", "color": "#FFD700" }`

**Response 201**: `{ "data": tag }`

---

## Services Endpoints

### GET /api/services

**Auth**: [auth, services.read]

**Query Parameters**: `?isActive=true&category=hair&page=1&perPage=20`

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Haircut",
      "description": "Classic haircut",
      "durationMinutes": 45,
      "bufferBeforeMinutes": 0,
      "bufferAfterMinutes": 15,
      "price": 350.00,
      "currency": "MXN",
      "color": "#4CAF50",
      "category": "hair",
      "isActive": true
    }
  ],
  "meta": { "total": 25, "page": 1, "perPage": 20, "totalPages": 2 }
}
```

---

### POST /api/services

**Auth**: [auth, services.create]

**Request**:
```json
{
  "name": "Haircut",
  "description": "Classic haircut",
  "durationMinutes": 45,
  "bufferBeforeMinutes": 0,
  "bufferAfterMinutes": 15,
  "price": 350.00,
  "currency": "MXN",
  "color": "#4CAF50",
  "category": "hair"
}
```

**Response 201**: `{ "data": service }`

---

### PUT /api/services/:id

**Auth**: [auth, services.update]

**Request**: partial service fields

**Response 200**: `{ "data": service }`

**Note**: Price changes do NOT affect historical `appointment_items` (snapshot pattern).

---

### DELETE /api/services/:id

**Auth**: [auth, services.delete]

Soft delete (sets `isActive = false`).

**Response 200**: `{ "data": { "success": true } }`

---

## Employees Endpoints

### GET /api/employees

**Auth**: [auth, employees.read]

**Query Parameters**: `?locationId=uuid&isActive=true&page=1&perPage=20`

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "firstName": "Carlos",
      "lastName": "Lopez",
      "email": "carlos@salon.com",
      "phone": "+52-55-1111-2222",
      "locationId": "uuid",
      "color": "#E91E63",
      "isActive": true
    }
  ],
  "meta": { "total": 8, "page": 1, "perPage": 20, "totalPages": 1 }
}
```

---

### POST /api/employees

**Auth**: [auth, employees.create]

**Request**:
```json
{
  "firstName": "Carlos",
  "lastName": "Lopez",
  "email": "carlos@salon.com",
  "phone": "+52-55-1111-2222",
  "locationId": "uuid",
  "userId": "uuid",
  "color": "#E91E63",
  "bio": "Specialist in color treatments",
  "bufferBeforeMinutes": 0,
  "bufferAfterMinutes": 15
}
```

**Response 201**: `{ "data": employee }`

---

### PUT /api/employees/:id

**Auth**: [auth, employees.update]

**Response 200**: `{ "data": employee }`

---

### DELETE /api/employees/:id

**Auth**: [auth, employees.delete]

Soft delete.

**Response 200**: `{ "data": { "success": true } }`

---

### GET /api/employees/:id/schedules

**Auth**: [auth, employees.read]

**Response 200**:
```json
{
  "data": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "18:00", "isWorking": true },
    { "dayOfWeek": 2, "startTime": "09:00", "endTime": "18:00", "isWorking": true },
    { "dayOfWeek": 0, "startTime": "09:00", "endTime": "18:00", "isWorking": false }
  ]
}
```

---

### PUT /api/employees/:id/schedules

Replace all schedules for an employee.

**Auth**: [auth, employees.schedules.manage]

**Request**:
```json
{
  "schedules": [
    { "dayOfWeek": 0, "startTime": "09:00", "endTime": "18:00", "isWorking": false },
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "18:00", "isWorking": true },
    { "dayOfWeek": 2, "startTime": "09:00", "endTime": "18:00", "isWorking": true },
    { "dayOfWeek": 3, "startTime": "09:00", "endTime": "18:00", "isWorking": true },
    { "dayOfWeek": 4, "startTime": "09:00", "endTime": "18:00", "isWorking": true },
    { "dayOfWeek": 5, "startTime": "09:00", "endTime": "20:00", "isWorking": true },
    { "dayOfWeek": 6, "startTime": "10:00", "endTime": "16:00", "isWorking": true }
  ]
}
```

**Response 200**: `{ "data": schedule[] }`

---

### GET /api/employees/:id/time-off

**Auth**: [auth, employees.read]

**Query Parameters**: `?startDate=2025-03-01&endDate=2025-03-31`

**Response 200**: `{ "data": timeOff[] }`

---

### POST /api/employees/:id/time-off

**Auth**: [auth, employees.time_off.manage]

**Request**:
```json
{
  "startDatetime": "2025-03-15T00:00:00Z",
  "endDatetime": "2025-03-17T23:59:59Z",
  "reason": "Vacation",
  "isAllDay": true
}
```

**Response 201**: `{ "data": timeOff }`

---

### DELETE /api/employees/:id/time-off/:timeOffId

**Auth**: [auth, employees.time_off.manage]

**Response 200**: `{ "data": { "success": true } }`

---

### GET /api/employees/:id/services

**Auth**: [auth, employees.read]

**Response 200**: `{ "data": service[] }`

---

### POST /api/employees/:id/services

Replace all service assignments for an employee.

**Auth**: [auth, employees.update]

**Request**: `{ "serviceIds": ["uuid1", "uuid2"] }`

**Response 200**: `{ "data": service[] }`

---

## Resources Endpoints

### GET /api/resources

**Auth**: [auth, resources.read]

**Query Parameters**: `?locationId=uuid&type=room&isActive=true`

**Response 200**: `{ "data": resource[] }`

---

### POST /api/resources

**Auth**: [auth, resources.create]

**Request**:
```json
{
  "locationId": "uuid",
  "name": "Room A",
  "type": "room",
  "description": "Main treatment room"
}
```

**Response 201**: `{ "data": resource }`

---

### PUT /api/resources/:id

**Auth**: [auth, resources.update]

**Response 200**: `{ "data": resource }`

---

### DELETE /api/resources/:id

**Auth**: [auth, resources.delete]

**Response 200**: `{ "data": { "success": true } }`

---

## Availability Endpoints

### POST /api/availability/query

**Auth**: [auth, availability.read]

**Request**:
```json
{
  "locationId": "uuid",
  "serviceIds": ["uuid1"],
  "employeeId": "uuid",
  "startDate": "2025-03-15",
  "endDate": "2025-03-21",
  "timezone": "America/Mexico_City"
}
```

**Response 200**:
```json
{
  "data": [
    {
      "date": "2025-03-15",
      "employees": [
        {
          "id": "uuid",
          "name": "Carlos Lopez",
          "slots": [
            { "startTime": "09:00", "endTime": "09:45" },
            { "startTime": "09:15", "endTime": "10:00" },
            { "startTime": "10:30", "endTime": "11:15" }
          ]
        }
      ]
    }
  ]
}
```

**Errors**: 400 (invalid date range, max 14 days), 404 (employee not found)

---

## Appointments Endpoints

### GET /api/appointments

**Auth**: [auth, appointments.read]

**Query Parameters**:

| Param | Type | Description |
|---|---|---|
| locationId | UUID | Filter by location |
| employeeId | UUID | Filter by employee |
| clientId | UUID | Filter by client |
| status | string | Filter by status (PENDING, CONFIRMED, etc.) |
| startDate | ISO date | Range start |
| endDate | ISO date | Range end |
| page | int | Page number |
| perPage | int | Items per page |

**Response 200**: Paginated list of appointments with items and client info.

---

### POST /api/appointments

**Auth**: [auth, appointments.create]

**Request**:
```json
{
  "locationId": "uuid",
  "clientId": "uuid",
  "employeeId": "uuid",
  "serviceIds": ["uuid1"],
  "startTime": "2025-03-15T09:00:00Z",
  "notes": "Client prefers soft music",
  "source": "MANUAL"
}
```

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "status": "PENDING",
    "startTime": "2025-03-15T09:00:00Z",
    "endTime": "2025-03-15T09:45:00Z",
    "totalPrice": 350.00,
    "client": { "id": "uuid", "firstName": "Ana", "lastName": "Martinez" },
    "employee": { "id": "uuid", "firstName": "Carlos", "lastName": "Lopez" },
    "items": [
      {
        "id": "uuid",
        "nameSnapshot": "Haircut",
        "priceSnapshot": 350.00,
        "durationSnapshot": 45
      }
    ]
  }
}
```

**Errors**: 409 (double booking - employee already has overlapping appointment)

---

### GET /api/appointments/:id

**Auth**: [auth, appointments.read]

**Response 200**: Full appointment with items, statusHistory, client, employee.

---

### PUT /api/appointments/:id

Update mutable fields (notes only after creation).

**Auth**: [auth, appointments.update]

**Request**: `{ "notes": "Updated notes", "internalNotes": "Staff only note" }`

**Response 200**: `{ "data": appointment }`

---

### POST /api/appointments/:id/reschedule

**Auth**: [auth, appointments.reschedule]

**Request**:
```json
{
  "employeeId": "uuid",
  "startTime": "2025-03-16T10:00:00Z"
}
```

**Response 200**: `{ "data": appointment with new times }`

**Errors**: 409 (double booking at new time), 400 (appointment not in reschedulable status)

---

### POST /api/appointments/:id/cancel

**Auth**: [auth, appointments.cancel]

**Request**: `{ "reason": "Client requested cancellation" }`

**Response 200**: `{ "data": appointment with CANCELLED status }`

**Errors**: 400 (already completed or cancelled)

---

### POST /api/appointments/:id/complete

**Auth**: [auth, appointments.complete]

**Response 200**: `{ "data": appointment with COMPLETED status }`

**Errors**: 400 (not in IN_PROGRESS status)

---

## Payments Endpoints

### POST /api/payments

**Auth**: [auth, payments.create]

**Request**:
```json
{
  "appointmentId": "uuid",
  "clientId": "uuid",
  "locationId": "uuid",
  "items": [
    {
      "description": "Haircut",
      "quantity": 1,
      "unitPrice": 350.00,
      "itemType": "SERVICE"
    }
  ],
  "paymentMethod": "CARD",
  "tipAmount": 50.00,
  "discountAmount": 0
}
```

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "appointmentId": "uuid",
    "paymentMethod": "CARD",
    "subtotal": 350.00,
    "tipAmount": 50.00,
    "discountAmount": 0,
    "taxAmount": 0,
    "total": 400.00,
    "status": "COMPLETED",
    "items": [
      { "description": "Haircut", "quantity": 1, "unitPrice": 350.00, "totalPrice": 350.00, "itemType": "SERVICE" }
    ],
    "createdAt": "2025-03-15T10:00:00Z"
  }
}
```

---

### GET /api/payments

**Auth**: [auth, payments.read]

**Query Parameters**: `?clientId=uuid&startDate=2025-03-01&endDate=2025-03-31&page=1&perPage=20`

**Response 200**: Paginated list of payments.

---

### GET /api/payments/:id

**Auth**: [auth, payments.read]

**Response 200**: `{ "data": payment with items }`

---

## Audit Endpoints

### GET /api/audit

**Auth**: [auth, audit.read]

**Query Parameters**:

| Param | Type | Description |
|---|---|---|
| entityType | string | Filter by entity type (e.g., "appointment") |
| entityId | UUID | Filter by specific entity |
| userId | UUID | Filter by user who made the change |
| startDate | ISO date | Range start |
| endDate | ISO date | Range end |
| page | int | Page number |
| perPage | int | Items per page |

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "action": "appointment.cancelled",
      "entityType": "appointment",
      "entityId": "uuid",
      "beforeData": { "status": "CONFIRMED" },
      "afterData": { "status": "CANCELLED" },
      "ipAddress": "192.168.1.1",
      "createdAt": "2025-03-15T14:30:00Z"
    }
  ],
  "meta": { "total": 500, "page": 1, "perPage": 20, "totalPages": 25 }
}
```

---

## Health Endpoint

### GET /api/health

**Auth**: None (public)

**Response 200**:
```json
{
  "status": "ok",
  "timestamp": "2025-03-15T10:00:00Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "queue": "ok"
  },
  "version": "1.0.0"
}
```
