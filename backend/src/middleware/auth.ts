import type { RequestHandler } from 'express';
import { COOKIE, readCookie, verifyToken } from '../services/auth.js';
import { HttpError } from './errorHandler.js';

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = readCookie(req.headers.cookie, COOKIE);
  if (!token) return next(new HttpError(401, 'Please sign in'));
  try {
    res.locals.user = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Your session expired. Sign in again'));
  }
};
