export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface EmployeeSchedule {
  id: string;
  employeeId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  isWorking: boolean;
  effectiveFrom: string;
  effectiveUntil?: string | null;
}

export interface EmployeeTimeOff {
  id: string;
  employeeId: string;
  startDatetime: string;
  endDatetime: string;
  reason?: string | null;
  isAllDay: boolean;
  createdAt: string;
}

export interface Employee {
  id: string;
  tenantId: string;
  userId?: string | null;
  locationId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  color: string;
  bio?: string | null;
  isActive: boolean;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  schedules?: EmployeeSchedule[];
  timeOffs?: EmployeeTimeOff[];
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  locationId: string;
  userId?: string;
  color?: string;
  bio?: string;
}

export type UpdateEmployeeRequest = Partial<CreateEmployeeRequest>;

export interface ScheduleInput {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

export interface TimeOffInput {
  startDatetime: string;
  endDatetime: string;
  reason?: string;
  isAllDay?: boolean;
}
