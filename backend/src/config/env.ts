import { z } from 'zod';

try { process.loadEnvFile(); } catch { /* no .env in production; the host injects vars */ }

export const env = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().startsWith('mongodb'),
  MONGODB_DB: z.string().default('finman'),
  HF_TOKEN: z.string().startsWith('hf_'),
  HF_MODEL: z.string(),
  HF_VISION_MODEL: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  // optional second login for demos and the viva
  DEMO_EMAIL: z.string().email().optional(),
  DEMO_PASSWORD: z.string().min(6).optional(),
}).parse(process.env);

export const TZ = 'Asia/Kolkata';
