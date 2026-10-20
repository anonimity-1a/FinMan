import { Router } from 'express';
import { z } from 'zod';
import { User, CURRENCY_CODES } from '../models/User.js';
import { HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { COOKIE, USERNAME_PATTERN, cookieOptions, hashPassword, publicUser, signToken, verifyPassword } from '../services/auth.js';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  username: z.string().trim().toLowerCase().optional(),
  login: z.string().trim().optional(),
  password: z.string().min(1).max(200),
}).refine((body) => Boolean(body.email || body.username || body.login), 'Enter your username');

const r = Router();

function sessionFor(user: { _id: { toString(): string }; username: string; email?: string | null }) {
  return signToken({
    sub: String(user._id),
    username: user.username,
    ...(user.email ? { email: user.email } : {}),
  });
}

r.post('/register', async (req, res) => {
  const body = z.object({
    username: z.string().trim().toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(200),
    displayName: z.string().trim().max(40).optional(),
  }).parse(req.body);
  if (!USERNAME_PATTERN.test(body.username)) {
    throw new HttpError(400, 'Username must be 3–24 letters, numbers, or underscores');
  }
  if (await User.exists({ username: body.username })) throw new HttpError(409, 'That username is taken');
  const user = await User.create({
    username: body.username,
    passwordHash: await hashPassword(body.password),
    displayName: body.displayName || body.username,
    lastLoginAt: new Date(),
  });
  res.cookie(COOKIE, sessionFor(user), cookieOptions);
  res.status(201).json(publicUser(user));
});

r.post('/login', async (req, res) => {
  const body = credentials.parse(req.body);
  const key = (body.login ?? body.username ?? body.email ?? '').toLowerCase();
  const user = await User.findOne({ $or: [{ username: key }, { email: key }] }).select('+passwordHash');
  // same message either way, so the endpoint doesn't reveal which accounts exist
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new HttpError(401, 'Wrong username or password');
  }
  user.lastLoginAt = new Date();
  await user.save();
  res.cookie(COOKIE, sessionFor(user), cookieOptions);
  res.json(publicUser(user));
});

r.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
});

r.get('/me', requireAuth, async (_req, res) => {
  const user = await User.findById(res.locals.user.sub);
  if (!user) throw new HttpError(401, 'Please sign in');
  res.json(publicUser(user));
});

r.patch('/me', requireAuth, async (req, res) => {
  const body = z.object({
    displayName: z.string().trim().max(40).optional(),
    currency: z.enum(CURRENCY_CODES).optional(),
  }).refine((b) => b.displayName !== undefined || b.currency !== undefined, 'Send a display name or a currency').parse(req.body);
  const update: { displayName?: string; currency?: string } = {};
  if (body.displayName !== undefined) update.displayName = body.displayName;
  if (body.currency) update.currency = body.currency;
  const user = await User.findByIdAndUpdate(
    res.locals.user.sub,
    update,
    { returnDocument: 'after', runValidators: true },
  );
  if (!user) throw new HttpError(401, 'Please sign in');
  res.json(publicUser(user));
});

r.post('/password', requireAuth, async (req, res) => {
  const body = z.object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
  }).parse(req.body);
  if (body.newPassword === body.currentPassword) throw new HttpError(400, 'Choose a different password');
  const user = await User.findById(res.locals.user.sub).select('+passwordHash');
  if (!user) throw new HttpError(401, 'Please sign in');
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Current password is wrong');
  }
  user.passwordHash = await hashPassword(body.newPassword);
  await user.save();
  res.status(204).end();
});

export default r;
