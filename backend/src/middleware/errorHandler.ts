import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function classify(err: any): [number, string] {
  if (err instanceof HttpError) return [err.status, err.message];
  if (err instanceof ZodError) return [400, 'Invalid input'];
  if (err instanceof mongoose.Error.ValidationError) return [400, err.message];
  if (err instanceof mongoose.Error.CastError) return [400, `Invalid ${err.path}`];
  if (err instanceof MulterError) return [400, err.message];
  if (err?.code === 11000) {
    if (err.keyPattern?.dedupeHash) return [409, 'This transaction was already saved'];
    if (err.keyPattern?.username) return [409, 'That username is taken'];
    if (err.keyPattern?.email) return [409, 'That email is already registered'];
    return [409, 'That already exists'];
  }
  return [500, 'Server error'];
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const [status, message] = classify(err);
  if (status === 500) console.error(err);
  res.status(status).json({ error: { message, details: err instanceof ZodError ? err.issues : undefined } });
};
