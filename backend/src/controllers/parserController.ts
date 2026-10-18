import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { parseBillImage, parseTransactionText } from '../services/aiParser.js';

const body = z.object({
  text: z.string().trim().min(1).max(5000),
  source: z.enum(['sms', 'text']).default('sms'),
});

const ALLOWED_FILES = ['image/jpeg', 'image/png', 'image/webp', 'text/plain'];

export async function parseText(req: Request, res: Response) {
  const { text, source } = body.parse(req.body);
  const result = await parseTransactionText(text);
  res.json({ ...result, source });
}

export async function parseFile(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw new HttpError(400, 'No file uploaded');
  if (!ALLOWED_FILES.includes(file.mimetype)) {
    throw new HttpError(400, 'Unsupported file type. Upload a JPG, PNG, WebP or text file');
  }

  if (file.mimetype === 'text/plain') {
    const text = file.buffer.toString('utf8').trim().slice(0, 5000);
    if (!text) throw new HttpError(400, 'The text file is empty');
    const result = await parseTransactionText(text);
    res.json({ ...result, source: 'bill' });
    return;
  }

  const result = await parseBillImage(file.buffer, file.mimetype, file.originalname);
  res.json({ ...result, source: 'bill' });
}
