// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const AppointmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;

export type AppointmentStatus =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const AppointmentSource = {
  ONLINE: 'ONLINE',
  WALK_IN: 'WALK_IN',
  PHONE: 'PHONE',
  MANUAL: 'MANUAL',
} as const;

export type AppointmentSource =
  (typeof AppointmentSource)[keyof typeof AppointmentSource];

// ─── CORE TYPES ──────────────────────────────────────────────────────────────

export interface AppointmentItem {
  id: string;
  appointmentId: string;
  serviceId: string;
  employeeId: string;
  resourceId?: string | null;
  startTime: string;
  endTime: string;
  priceSnapshot: number;
  durationSnapshot: number;
  serviceNameSnapshot: string;
  notes?: string | null;
}

export interface AppointmentStatusHistory {
  id: string;
  appointmentId: string;
  fromStatus?: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  changedBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  tenantId: string;
  locationId: string;
  clientId: string;
  employeeId: string;
  status: AppointmentStatus;
  startTime: string;
  endTime: string;
  notes?: string | null;
  internalNotes?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  source: AppointmentSource;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: AppointmentItem[];
  statusHistory?: AppointmentStatusHistory[];
}

// ─── REQUEST / RESPONSE TYPES ────────────────────────────────────────────────

export interface CreateAppointmentRequest {
  locationId: string;
  clientId: string;
  employeeId: string;
  serviceIds: string[];
  startTime: string;
  notes?: string;
  source?: AppointmentSource;
}

export interface RescheduleRequest {
  employeeId?: string;
  startTime: string;
}

// ─── AVAILABILITY ────────────────────────────────────────────────────────────

export interface AvailabilityQuery {
  locationId: string;
  serviceIds: string[];
  employeeId?: string;
  startDate: string;
  endDate: string;
  timezone: string;
}

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
}

export interface AvailabilityResult {
  date: string;
  employees: Array<{
    id: string;
    name: string;
    slots: AvailabilitySlot[];
  }>;
}
