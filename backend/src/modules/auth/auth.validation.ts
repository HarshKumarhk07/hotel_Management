import { z } from 'zod';
import { PASSWORD_POLICY } from '@/constants';

const email = z.string().trim().toLowerCase().email('A valid email is required');

const password = z
  .string()
  .min(PASSWORD_POLICY.minLength, PASSWORD_POLICY.message)
  .regex(PASSWORD_POLICY.regex, PASSWORD_POLICY.message);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  email,
  password,
  phone: z.string().trim().min(6).max(20).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  /** Required only for SUPER_ADMIN / KITCHEN_OWNER accounts (extra gate). */
  secretCode: z.string().min(1).optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10, 'Invalid token'),
});

export const resendVerificationSchema = z.object({ email });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Invalid token'),
  password,
});

export const googleSchema = z.object({
  idToken: z.string().min(10, 'Google ID token is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const checkRoleSchema = z.object({
  email,
});
