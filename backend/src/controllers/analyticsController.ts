import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { categoryBreakdown, dailySpending, parserStats, periodSummary } from '../services/analytics.js';
import { rangeQuery } from '../validation/transaction.js';

function parseRange(query: unknown) {
  const { from, to } = rangeQuery.parse(query);
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  if (days > 366) throw new HttpError(400, 'Range is limited to 366 days');
  return { from, to };
}

export async function daily(req: Request, res: Response) {
  const { from, to } = parseRange(req.query);
  res.json(await dailySpending(from, to));
}

export async function categories(req: Request, res: Response) {
  const { from, to } = parseRange(req.query);
  res.json(await categoryBreakdown(from, to));
}

export async function summary(req: Request, res: Response) {
  const { from, to } = parseRange(req.query);
  res.json(await periodSummary(from, to));
}

export async function parser(_req: Request, res: Response) {
  res.json(await parserStats());
}
