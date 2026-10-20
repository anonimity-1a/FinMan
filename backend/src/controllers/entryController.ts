import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { currentUserId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { istDayRange, todayIst } from '../services/analytics.js';
import { listQuery, transactionInput } from '../validation/transaction.js';

async function assertCategory(name: string) {
  if (!(await Category.exists({ name }))) throw new HttpError(400, 'Unknown category');
}

const hashInput = (raw: string) =>
  createHash('sha256').update(raw.trim().replace(/\s+/g, ' ').toLowerCase()).digest('hex');

const owned = (res: Response) => ({ userId: currentUserId(res) });

export async function createEntry(req: Request, res: Response) {
  const data = transactionInput.parse(req.body);
  await assertCategory(data.category);
  const dedupeHash = data.rawInput?.trim() ? hashInput(data.rawInput) : undefined;
  const doc = await Transaction.create({ ...data, dedupeHash, ...owned(res) });
  res.status(201).json(doc);
}

export async function listEntries(req: Request, res: Response) {
  const { page, limit, from, to, category, q } = listQuery.parse(req.query);
  const filter: Record<string, unknown> = owned(res);
  if (from || to) {
    const { start, end } = istDayRange(from ?? '1970-01-01', to ?? todayIst());
    filter.occurredAt = { $gte: start, $lt: end };
  }
  if (category) filter.category = category;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ merchant: re }, { description: re }];
  }
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ occurredAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Transaction.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}

export async function getEntry(req: Request, res: Response) {
  const doc = await Transaction.findOne({ _id: req.params.id, ...owned(res) }).lean();
  if (!doc) throw new HttpError(404, 'Transaction not found');
  res.json(doc);
}

export async function updateEntry(req: Request, res: Response) {
  const data = transactionInput.parse(req.body);
  await assertCategory(data.category);
  const doc = await Transaction.findOneAndUpdate({ _id: req.params.id, ...owned(res) }, data, { returnDocument: 'after', runValidators: true });
  if (!doc) throw new HttpError(404, 'Transaction not found');
  res.json(doc);
}

export async function deleteEntry(req: Request, res: Response) {
  const doc = await Transaction.findOneAndDelete({ _id: req.params.id, ...owned(res) });
  if (!doc) throw new HttpError(404, 'Transaction not found');
  res.status(204).end();
}
