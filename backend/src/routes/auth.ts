import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { COOKIE, cookieOptions, signToken, verifyPassword } from '../services/auth.js';

const credentials = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

const r = Router();

r.post('/login', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const user = await User.findOne({ email });
  // same message either way, so the endpoint doesn't reveal which emails exist
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, 'Wrong email or password');
  user.lastLoginAt = new Date();
  await user.save();
  res.cookie(COOKIE, signToken({ sub: String(user._id), email: user.email }), cookieOptions);
  res.json({ email: user.email });
});

r.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
});

r.get('/me', requireAuth, (_req, res) => {
  res.json({ email: res.locals.user.email });
});

export default r;
