import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginSchema = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().uuid('Refresh token must be a valid UUID'),
});

export type RefreshSchema = z.infer<typeof refreshSchema>;
