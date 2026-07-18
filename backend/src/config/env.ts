import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Centralised, validated environment configuration.
 *
 * The process refuses to boot if required variables are missing or malformed,
 * which prevents an entire class of "works on my machine" production incidents.
 */
const csv = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default('/api/v1'),

  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  CORS_ORIGINS: csv.default('http://localhost:3000'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be >= 32 chars'),

  ADMIN_SECRET_CODE: z.string().min(6, 'ADMIN_SECRET_CODE must be >= 6 chars'),
  KITCHEN_SECRET_CODE: z.string().min(6, 'KITCHEN_SECRET_CODE must be >= 6 chars'),

  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ACCOUNT_LOCK_MINUTES: z.coerce.number().int().positive().default(2),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default('Hotel Kitchen'),
  EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@example.com'),
  SECURITY_ALERT_EMAIL: z.string().email().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Error monitoring (no-op when unset).
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // Data retention — TTL on high-volume collections so they don't grow forever.
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  NOTIFICATION_RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  // Optional HTTP Basic auth to expose Swagger in production.
  SWAGGER_USER: z.string().optional(),
  SWAGGER_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDev = env.NODE_ENV === 'development';

export type Env = typeof env;
