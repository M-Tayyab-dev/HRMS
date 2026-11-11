import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  APP_URL: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  DATABASE_ADMIN_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  DATA_HMAC_SECRET: z.string().min(32, 'DATA_HMAC_SECRET must be at least 32 characters'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  STORAGE_DIR: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(10),
  SMTP_URL: z.string().optional().transform((v) => (v ? v : undefined)),
  MAIL_FROM: z.string().default('HRMS <no-reply@hrms.local>'),
  ENABLE_SCHEDULER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | undefined;

/** Fail fast on bad configuration: the process refuses to start with weak or missing secrets. */
export function config(): AppConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.COOKIE_SECURE) {
    throw new Error('COOKIE_SECURE must be true in production');
  }
  cached = parsed.data;
  return cached;
}
