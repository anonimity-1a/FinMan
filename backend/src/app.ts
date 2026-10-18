import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import auth from './routes/auth.js';
import entries from './routes/entries.js';
import parser from './routes/parser.js';
import analytics from './routes/analytics.js';
import categories from './routes/categories.js';
import exportRoutes from './routes/export.js';

const limit = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs, limit: max, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json({ error: { message } }); },
  });

export const app = express();
// One reverse proxy (the Compose nginx). A numeric hop count, so clients cannot spoof the rate-limit IP.
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Port 4000 is only the API; point anyone who opens it in a browser to the right place.
app.get('/', (_req, res) => {
  res.json({ name: 'FinMan API', health: '/api/health', app: 'Open the web app (Vite) instead: http://localhost:5173' });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});
app.use('/api/auth/login', limit(15 * 60_000, 10, 'Too many sign-in attempts. Wait 15 minutes and try again'));
app.use('/api/auth', auth);

// everything below needs a signed-in user
app.use('/api', requireAuth);
app.use('/api/entries', entries);
app.use('/api/parse', limit(60_000, 20, 'Too many parse requests. Wait a minute and try again'), parser);
app.use('/api/analytics', analytics);
app.use('/api/categories', categories);
app.use('/api/export', exportRoutes);

app.use('/api', (_req, res) => { res.status(404).json({ error: { message: 'Not found' } }); });
app.use(errorHandler);
