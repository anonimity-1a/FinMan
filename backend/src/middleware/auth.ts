import type { RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import { COOKIE, readCookie, verifyToken } from '../services/auth.js';
import { HttpError } from './errorHandler.js';

export function currentUserId(res: Response) {
  const id = res.locals.user?.sub;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(401, 'Please sign in');
  return new mongoose.Types.ObjectId(String(id));
}

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
