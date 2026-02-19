import { z } from 'zod';
import { uuidSchema } from './common';

const paymentItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  itemType: z.enum(['SERVICE', 'PRODUCT', 'OTHER'], {
    errorMap: () => ({ message: 'Item type must be SERVICE, PRODUCT, or OTHER' }),
  }),
});

export const createPaymentSchema = z.object({
  appointmentId: uuidSchema.optional(),
  clientId: uuidSchema,
  locationId: uuidSchema,
  items: z
    .array(paymentItemSchema)
    .min(1, 'At least one payment item is required'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER'], {
    errorMap: () => ({
      message: 'Payment method must be CASH, CARD, TRANSFER, or OTHER',
    }),
  }),
  tipAmount: z.number().min(0, 'Tip amount cannot be negative').default(0),
  discountAmount: z
    .number()
    .min(0, 'Discount amount cannot be negative')
    .default(0),
});

export type CreatePaymentSchema = z.infer<typeof createPaymentSchema>;
