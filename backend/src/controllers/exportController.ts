import type { Request, Response } from 'express';
import { TZ } from '../config/env.js';
import { Transaction } from '../models/Transaction.js';
import { istDayRange, todayIst } from '../services/analytics.js';
import { csvRow } from '../services/csv.js';
import { optionalRangeQuery } from '../validation/transaction.js';

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });

async function load(query: unknown) {
  const { from, to } = optionalRangeQuery.parse(query);
  const filter: Record<string, unknown> = {};
  if (from || to) {
    const { start, end } = istDayRange(from ?? '1970-01-01', to ?? todayIst());
    filter.occurredAt = { $gte: start, $lt: end };
  }
  return Transaction.find(filter).sort({ occurredAt: -1 }).select('-__v -dedupeHash').lean();
}

export async function exportJson(req: Request, res: Response) {
  const docs = await load(req.query);
  res.attachment(`finman-${todayIst()}.json`);
  res.json(docs);
}

export async function exportCsv(req: Request, res: Response) {
  const docs = await load(req.query);
  const rows = [
    csvRow(['Date (IST)', 'Amount', 'Type', 'Merchant', 'Category', 'Payment method', 'Description', 'Source', 'AI parsed', 'Details']),
    ...docs.map((d) =>
      csvRow([dateFmt.format(d.occurredAt), d.amount, d.direction, d.merchant, d.category, d.paymentMethod, d.description, d.source, d.aiParsed, d.details]),
    ),
  ];
  res.attachment(`finman-${todayIst()}.csv`);
  res.type('text/csv').send('﻿' + rows.join('\r\n'));
}
