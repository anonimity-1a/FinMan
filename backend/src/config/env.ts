import { z } from 'zod';

try { process.loadEnvFile(); } catch { /* no .env in production; the host injects vars */ }

// A copied .env leaves optional keys as "". Zod's .optional() only skips undefined.
const blank = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

export const env = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().startsWith('mongodb'),
  MONGODB_DB: z.string().default('finman'),
  // Blank is allowed: SMS entry then uses the regex fallback. A set token must be a real hf_ key.
  HF_TOKEN: z.preprocess(blank, z.string().startsWith('hf_').optional()),
  HF_MODEL: z.preprocess(blank, z.string().min(1).optional()),
  HF_VISION_MODEL: z.preprocess(blank, z.string().optional()),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  // optional second login for demos and the viva
  DEMO_EMAIL: z.preprocess(blank, z.string().email().optional()),
  DEMO_PASSWORD: z.preprocess(blank, z.string().min(6).optional()),
}).parse(process.env);

export const TZ = 'Asia/Kolkata';
