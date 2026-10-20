import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const COOKIE = 'finman_token';
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export interface TokenPayload { sub: string; username?: string; email?: string }

export const signToken = (p: TokenPayload) => jwt.sign(p, env.JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
export const verifyToken = (t: string) => jwt.verify(t, env.JWT_SECRET) as TokenPayload;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function publicUser(user: {
  _id: { toString(): string };
  username: string;
  email?: string | null;
  displayName?: string | null;
  currency?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date | null;
}) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email ?? null,
    displayName: user.displayName ?? '',
    currency: user.currency || 'INR',
    createdAt: user.createdAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

// COOKIE_SECURE=true only when the site is actually HTTPS. Plain HTTP (local Docker) must stay false
// or the browser drops the session cookie. Unset keeps the old production default.
const cookieSecure = process.env.COOKIE_SECURE === 'true'
  ? true
  : process.env.COOKIE_SECURE === 'false'
    ? false
    : process.env.NODE_ENV === 'production';

export const cookieOptions = {
  httpOnly: true,                                   // page scripts can't read it
  sameSite: 'lax' as const,
  secure: cookieSecure,
  maxAge: TOKEN_TTL_SECONDS * 1000,
  path: '/',
};

export function readCookie(header: string | undefined, name: string) {
  for (const part of header?.split(';') ?? []) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
