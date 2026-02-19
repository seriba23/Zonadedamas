import { z } from 'zod';
import { paginationSchema } from './common';

export const createClientSchema = z.object({
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
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  notes: z
    .string()
    .max(1000, 'Notes must be at most 1000 characters')
    .optional(),
});

export type CreateClientSchema = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();

export type UpdateClientSchema = z.infer<typeof updateClientSchema>;

export const clientSearchSchema = paginationSchema.extend({
  search: z.string().optional(),
});

export type ClientSearchSchema = z.infer<typeof clientSearchSchema>;
