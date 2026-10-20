import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDb } from '../config/db.js';
import { Category } from '../models/Category.js';
import { ParseLog } from '../models/ParseLog.js';
import { Transaction, PAYMENT_METHODS } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { hashPassword } from '../services/auth.js';

const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#f97316' },
  { name: 'Groceries', color: '#84cc16' },
  { name: 'Transport', color: '#0ea5e9' },
  { name: 'Shopping', color: '#ec4899' },
  { name: 'Bills & Utilities', color: '#eab308' },
  { name: 'Entertainment', color: '#a855f7' },
  { name: 'Health', color: '#ef4444' },
  { name: 'Education', color: '#14b8a6' },
  { name: 'Rent', color: '#64748b' },
  { name: 'Travel', color: '#06b6d4' },
  { name: 'Transfers', color: '#6366f1' },
  { name: 'Other', color: '#9ca3af' },
];

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

function demoTransactions(n: number, userId: unknown) {
  const now = Date.now();
  const methods = [...PAYMENT_METHODS.filter((m) => m === 'UPI' || m === 'Card' || m === 'Cash')];
  return Array.from({ length: n }, () => {
    const paymentMethod = pick(methods);
    const credit = Math.random() < 0.1;
    return {
      userId,
      amount: Math.round((50 + Math.random() * 1950) * 100) / 100,
      direction: credit ? 'credit' : 'debit',
      merchant: pick(['Swiggy', 'Zomato', 'Ramesh Auto', 'BigBasket', 'Amazon', 'Uber', 'Apollo Pharmacy', 'Netflix']),
      occurredAt: new Date(now - Math.random() * 30 * 86_400_000),
      description: `[demo] ${pick(['Food order', 'Cab ride', 'Groceries', 'Subscription', 'Medicine'])}`,
      category: pick(DEFAULT_CATEGORIES).name,
      paymentMethod,
      source: 'manual',
      aiParsed: false,
      details: paymentMethod === 'UPI' ? { upiRef: String(Math.floor(1e11 + Math.random() * 9e11)) } : {},
    };
  });
}

await connectDb();

function usernameFromEmail(email: string) {
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  return local.length >= 3 ? local : 'admin';
}

async function upsertLogin(email: string, password: string, preferred: string) {
  const emailNorm = email.toLowerCase();
  const taken = await User.findOne({ username: preferred, email: { $ne: emailNorm } }).select('email');
  const username = taken ? `${preferred.slice(0, 22)}2` : preferred;
  if (taken) console.warn(`Username ${preferred} is taken; ${emailNorm} will use ${username}`);
  const doc = await User.findOneAndUpdate(
    { email: emailNorm },
    {
      $set: { passwordHash: await hashPassword(password), email: emailNorm, username },
      $setOnInsert: { displayName: username },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  console.log(`Login user ready: ${username} (${emailNorm})`);
  return doc;
}

const admin = await upsertLogin(env.ADMIN_EMAIL, env.ADMIN_PASSWORD, env.ADMIN_USERNAME ?? usernameFromEmail(env.ADMIN_EMAIL));
if (!admin) throw new Error('Could not create the admin login');
// Rows from before accounts had no owner. They belonged to the single shared login, which is now admin.
const adopted = await Transaction.updateMany(
  { $or: [{ userId: { $exists: false } }, { userId: null }] },
  { $set: { userId: admin._id } },
);
if (adopted.modifiedCount) console.log(`Attached ${adopted.modifiedCount} existing transactions to ${admin.username}`);
if (env.DEMO_EMAIL && env.DEMO_PASSWORD) {
  await upsertLogin(env.DEMO_EMAIL, env.DEMO_PASSWORD, usernameFromEmail(env.DEMO_EMAIL));
}

const i = process.argv.indexOf('--demo');
if (i !== -1) {
  const n = Number(process.argv[i + 1]) || 60;
  await Transaction.insertMany(demoTransactions(n, admin._id));
  console.log(`Inserted ${n} demo transactions`);
}

await Category.bulkWrite(
  DEFAULT_CATEGORIES.map((c) => ({ updateOne: { filter: { name: c.name }, update: { $set: c }, upsert: true } })),
);
console.log(`Upserted ${DEFAULT_CATEGORIES.length} categories`);

await Promise.all([Transaction.syncIndexes(), Category.syncIndexes(), User.syncIndexes(), ParseLog.syncIndexes()]);
await mongoose.disconnect();
