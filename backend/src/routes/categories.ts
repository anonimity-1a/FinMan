import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { HttpError } from '../middleware/errorHandler.js';

const name = z.string().trim().min(1).max(40);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #f97316');
const createBody = z.object({ name, color });
const patchBody = z.object({ name: name.optional(), color: color.optional() })
  .refine((b) => b.name || b.color, 'Send a new name or color');

const r = Router();

// Categories with how many transactions use each one
r.get('/', async (_req, res) => {
  const [cats, usage] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Transaction.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const used = new Map(usage.map((u) => [u._id, u.count]));
  res.json(cats.map((c) => ({ ...c, transactionCount: used.get(c.name) ?? 0 })));
});

r.post('/', async (req, res) => {
  const doc = await Category.create(createBody.parse(req.body));
  res.status(201).json(doc);
});

// Renaming touches two collections: the category itself and every transaction that copied its name.
// A multi-document transaction makes both changes land together or not at all.
r.patch('/:name', async (req, res) => {
  const body = patchBody.parse(req.body);
  const oldName = String(req.params.name);
  const session = await mongoose.startSession();
  let transactionsUpdated = 0;
  let result: unknown;
  try {
    await session.withTransaction(async () => {
      const cat = await Category.findOne({ name: oldName }).session(session);
      if (!cat) throw new HttpError(404, 'Category not found');
      if (body.name && body.name !== oldName) {
        if (await Category.exists({ name: body.name }).session(session)) {
          throw new HttpError(409, 'A category with that name already exists');
        }
        const upd = await Transaction.updateMany({ category: oldName }, { $set: { category: body.name } }, { session });
        transactionsUpdated = upd.modifiedCount;
        cat.name = body.name;
      }
      if (body.color) cat.color = body.color;
      await cat.save({ session });
      result = cat.toObject();
    });
  } finally {
    await session.endSession();
  }
  res.json({ category: result, transactionsUpdated });
});

r.delete('/:name', async (req, res) => {
  const catName = String(req.params.name);
  const inUse = await Transaction.countDocuments({ category: catName });
  if (inUse > 0) throw new HttpError(409, `${inUse} transactions use this category. Rename it or move them first`);
  const doc = await Category.findOneAndDelete({ name: catName });
  if (!doc) throw new HttpError(404, 'Category not found');
  res.status(204).end();
});

export default r;
