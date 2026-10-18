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

function demoTransactions(n: number) {
  const now = Date.now();
  const methods = [...PAYMENT_METHODS.filter((m) => m === 'UPI' || m === 'Card' || m === 'Cash')];
  return Array.from({ length: n }, () => {
    const paymentMethod = pick(methods);
    const credit = Math.random() < 0.1;
    return {
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

await Category.bulkWrite(
  DEFAULT_CATEGORIES.map((c) => ({ updateOne: { filter: { name: c.name }, update: { $set: c }, upsert: true } })),
);
console.log(`Upserted ${DEFAULT_CATEGORIES.length} categories`);

const i = process.argv.indexOf('--demo');
if (i !== -1) {
  const n = Number(process.argv[i + 1]) || 60;
  await Transaction.insertMany(demoTransactions(n));
  console.log(`Inserted ${n} demo transactions`);
}

const logins = [{ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }];
if (env.DEMO_EMAIL && env.DEMO_PASSWORD) logins.push({ email: env.DEMO_EMAIL, password: env.DEMO_PASSWORD });
for (const { email, password } of logins) {
  await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { passwordHash: await hashPassword(password) } },
    { upsert: true },
  );
  console.log(`Login user ready: ${email}`);
}

await Promise.all([Transaction.syncIndexes(), Category.syncIndexes(), User.syncIndexes(), ParseLog.syncIndexes()]);
await mongoose.disconnect();
