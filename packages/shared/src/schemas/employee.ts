import { z } from 'zod';
import { uuidSchema } from './common';

const DAY_OF_WEEK_VALUES = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export const createEmployeeSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be at most 100 characters'),
  email: z.string().email('Must be a valid email address').optional(),
  phone: z
    .string()
    .max(20, 'Phone must be at most 20 characters')
    .optional(),
  locationId: uuidSchema,
  userId: uuidSchema.optional(),
  color: z.string().default('#6366f1'),
  bio: z
    .string()
    .max(500, 'Bio must be at most 500 characters')
    .optional(),
});

export type CreateEmployeeSchema = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type UpdateEmployeeSchema = z.infer<typeof updateEmployeeSchema>;

const scheduleItemSchema = z.object({
  dayOfWeek: z.enum(DAY_OF_WEEK_VALUES, {
    errorMap: () => ({ message: 'Invalid day of week' }),
  }),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'startTime must be in HH:mm format'),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'endTime must be in HH:mm format'),
  isWorking: z.boolean(),
});

export const scheduleSchema = z.object({
  schedules: z
    .array(scheduleItemSchema)
    .min(1, 'At least one schedule entry is required'),
});

export type ScheduleSchema = z.infer<typeof scheduleSchema>;

export const timeOffSchema = z.object({
  startDatetime: z.string().datetime({ message: 'startDatetime must be a valid ISO datetime' }),
  endDatetime: z.string().datetime({ message: 'endDatetime must be a valid ISO datetime' }),
  reason: z
    .string()
    .max(255, 'Reason must be at most 255 characters')
    .optional(),
  isAllDay: z.boolean().default(false),
});

export type TimeOffSchema = z.infer<typeof timeOffSchema>;
