// Shows what the indexes buy. Seeds a separate database with N transactions, runs the History query and the
// analytics $match with the index, then drops that index (and hides the rest) and runs them again as a collection scan.
// Usage: npm run explain -- 5000
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Transaction } from '../models/Transaction.js';

const N = Number(process.argv[2]) || 5000;
await mongoose.connect(env.MONGODB_URI, { dbName: `${env.MONGODB_DB}_explain` });
await Transaction.deleteMany({});
await Transaction.syncIndexes();

const cats = ['Food', 'Groceries', 'Transport', 'Shopping', 'Bills & Utilities', 'Health', 'Rent', 'Other'];
const now = Date.now();
await Transaction.insertMany(Array.from({ length: N }, (_, i) => ({
  amount: 50 + (i % 40) * 37.5,
  direction: i % 10 === 0 ? 'credit' : 'debit',
  occurredAt: new Date(now - (i / N) * 365 * 86_400_000),
  category: cats[i % cats.length],
  source: 'manual',
  merchant: `Merchant ${i % 60}`,
})));

const monthAgo = new Date(now - 30 * 86_400_000);
const queries = {
  'History: one category, newest first, page 1': {
    index: 'category_1_occurredAt_-1',
    run: () => Transaction.find({ category: 'Food' }).sort({ occurredAt: -1 }).limit(20),
  },
  'Analytics $match: debits in the last 30 days': {
    index: 'direction_1_occurredAt_-1',
    run: () => Transaction.find({ direction: 'debit', occurredAt: { $gte: monthAgo } }),
  },
};

function summarise(plan: any) {
  const s = plan.executionStats;
  const stages = JSON.stringify(plan.queryPlanner.winningPlan).match(/"stage":"[A-Z_]+"/g)?.map((x) => x.slice(9, -1)) ?? [];
  return { stages: [...new Set(stages)].join(' > '), nReturned: s.nReturned, keysExamined: s.totalKeysExamined, docsExamined: s.totalDocsExamined, ms: s.executionTimeMillis };
}

console.log(`\n${N} transactions in ${env.MONGODB_DB}_explain\n`);
for (const [label, q] of Object.entries(queries)) {
  const withIndex = summarise(await q.run().explain('executionStats'));
  await Transaction.collection.dropIndex(q.index).catch(() => {});
  const others = (await Transaction.collection.indexes()).map((i) => i.name).filter((n) => n && n !== '_id_');
  // hide every remaining secondary index so the planner has to scan
  for (const name of others) await mongoose.connection.db!.command({ collMod: 'transactions', index: { name, hidden: true } });
  const withoutIndex = summarise(await q.run().explain('executionStats'));
  for (const name of others) await mongoose.connection.db!.command({ collMod: 'transactions', index: { name, hidden: false } });
  await Transaction.syncIndexes();
  console.log(label);
  console.table({ 'with index': withIndex, 'without index': withoutIndex });
}

await mongoose.connection.db!.dropDatabase();
await mongoose.disconnect();
