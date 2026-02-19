import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  durationMinutes: z
    .number()
    .int('Duration must be an integer')
    .min(5, 'Duration must be at least 5 minutes')
    .max(480, 'Duration must be at most 480 minutes'),
  bufferBeforeMinutes: z
    .number()
    .int('Buffer must be an integer')
    .min(0, 'Buffer cannot be negative')
    .max(60, 'Buffer must be at most 60 minutes')
    .default(0),
  bufferAfterMinutes: z
    .number()
    .int('Buffer must be an integer')
    .min(0, 'Buffer cannot be negative')
    .max(60, 'Buffer must be at most 60 minutes')
    .default(0),
  price: z.number().min(0, 'Price cannot be negative'),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .default('USD'),
  color: z.string().default('#6366f1'),
  category: z
    .string()
    .max(50, 'Category must be at most 50 characters')
    .optional(),
});

export type CreateServiceSchema = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();

export type UpdateServiceSchema = z.infer<typeof updateServiceSchema>;
