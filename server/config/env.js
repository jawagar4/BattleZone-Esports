require('dotenv').config();
const { z } = require('zod');

const bool = (def = 'false') => z.enum(['true', 'false']).default(def).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  APP_NAME: z.string().default('BattleZone Esports'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.coerce.number().default(0),
  DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
  REQUIRE_EMAIL_VERIFICATION: bool('false'),
  REGISTRATION_HOLD_MINUTES: z.coerce.number().default(15),
  PLATFORM_FEE_PERCENT: z.coerce.number().default(0),
  TAX_PERCENT: z.coerce.number().default(0),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
  SCHEDULER_INTERVAL_SECONDS: z.coerce.number().default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('BattleZone Esports <no-reply@example.com>'),
  SEED_ADMIN_EMAIL: z.string().default('admin@battlezone.local'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe@12345'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const config = parsed.data;
config.isProd = config.NODE_ENV === 'production';
config.isTest = config.NODE_ENV === 'test';
module.exports = config;
