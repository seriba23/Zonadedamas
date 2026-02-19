import { z } from 'zod';
import { uuidSchema } from './common';

export const createAppointmentSchema = z.object({
  locationId: uuidSchema,
  clientId: uuidSchema,
  employeeId: uuidSchema,
  serviceIds: z
    .array(z.string().uuid('Each service ID must be a valid UUID'))
    .min(1, 'At least one service is required'),
  startTime: z.string().datetime({ message: 'startTime must be a valid ISO datetime' }),
  notes: z
    .string()
    .max(1000, 'Notes must be at most 1000 characters')
    .optional(),
  source: z
    .enum(['ONLINE', 'WALK_IN', 'PHONE', 'MANUAL'])
    .default('MANUAL'),
});

export type CreateAppointmentSchema = z.infer<typeof createAppointmentSchema>;

export const rescheduleSchema = z.object({
  employeeId: uuidSchema.optional(),
  startTime: z.string().datetime({ message: 'startTime must be a valid ISO datetime' }),
});

export type RescheduleSchema = z.infer<typeof rescheduleSchema>;

export const availabilityQuerySchema = z.object({
  locationId: uuidSchema,
  serviceIds: z
    .array(z.string().uuid('Each service ID must be a valid UUID'))
    .min(1, 'At least one service is required'),
  employeeId: uuidSchema.optional(),
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
  timezone: z.string().min(1, 'timezone is required'),
});

export type AvailabilityQuerySchema = z.infer<typeof availabilityQuerySchema>;
