import { TZ } from '../config/env.js';
import { ParseLog } from '../models/ParseLog.js';
import { Transaction } from '../models/Transaction.js';

// '2026-10-05' to '2026-10-05' becomes [04 Oct 18:30Z, 05 Oct 18:30Z): exactly one IST day
export function istDayRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(`${to}T00:00:00+05:30`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

export async function dailySpending(from: string, to: string) {
  const { start, end } = istDayRange(from, to);
  const rows = await Transaction.aggregate<{ day: string; total: number; count: number }>([
    { $match: { direction: 'debit', occurredAt: { $gte: start, $lt: end } } },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: TZ } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
    } },
    { $project: { _id: 0, day: '$_id', total: { $round: ['$total', 2] }, count: 1 } },
  ]);

  // fill days with no spending so the chart shows gaps as zero bars
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; total: number; count: number }[] = [];
  for (const d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? { day, total: 0, count: 0 });
  }
  return out;
}

export function categoryBreakdown(from: string, to: string) {
  const { start, end } = istDayRange(from, to);
  return Transaction.aggregate([
    { $match: { direction: 'debit', occurredAt: { $gte: start, $lt: end } } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: 'name', as: 'cat' } },
    { $project: {
        _id: 0, category: '$_id', count: 1,
        total: { $round: ['$total', 2] },
        color: { $ifNull: [{ $first: '$cat.color' }, '#9ca3af'] },
    } },
    { $sort: { total: -1 } },
  ]);
}

interface Bucket { _id: string; total: number; count: number }
interface SummaryFacets {
  totals: Bucket[];
  byMethod: Bucket[];
  topMerchants: Bucket[];
  largest: { merchant: string; amount: number; category: string; occurredAt: Date }[];
  aiParsed: { count: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const bucket = (b: Bucket) => ({ name: b._id, total: round2(b.total), count: b.count });

// $facet runs several pipelines over one $match, so the whole month summary costs one round trip.
export async function periodSummary(from: string, to: string) {
  const { start, end } = istDayRange(from, to);
  const debit = { $match: { direction: 'debit' } };
  const [f] = await Transaction.aggregate<SummaryFacets>([
    { $match: { occurredAt: { $gte: start, $lt: end } } },
    { $facet: {
        totals: [{ $group: { _id: '$direction', total: { $sum: '$amount' }, count: { $sum: 1 } } }],
        byMethod: [debit, { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }],
        topMerchants: [
          debit, { $match: { merchant: { $ne: '' } } },
          { $group: { _id: '$merchant', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } }, { $limit: 5 },
        ],
        largest: [debit, { $sort: { amount: -1 } }, { $limit: 1 }, { $project: { _id: 0, merchant: 1, amount: 1, category: 1, occurredAt: 1 } }],
        aiParsed: [{ $match: { aiParsed: true } }, { $count: 'count' }],
    } },
  ]);

  const spent = f.totals.find((t) => t._id === 'debit');
  const received = f.totals.find((t) => t._id === 'credit');
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const count = f.totals.reduce((s, t) => s + t.count, 0);
  return {
    from, to, days,
    spent: round2(spent?.total ?? 0),
    received: round2(received?.total ?? 0),
    net: round2((received?.total ?? 0) - (spent?.total ?? 0)),
    count,
    avgPerDay: round2((spent?.total ?? 0) / days),
    aiParsedShare: count ? round2((f.aiParsed[0]?.count ?? 0) / count) : 0,
    byMethod: f.byMethod.map(bucket),
    topMerchants: f.topMerchants.map(bucket),
    largest: f.largest[0] ?? null,
  };
}

// Reads the TTL-managed parse log: only the last 30 days exist, by design.
export async function parserStats() {
  const rows = await ParseLog.aggregate<{ _id: string; runs: number; ok: number; avgMs: number }>([
    { $group: { _id: '$model', runs: { $sum: 1 }, ok: { $sum: { $cond: ['$ok', 1, 0] } }, avgMs: { $avg: '$ms' } } },
    { $sort: { runs: -1 } },
  ]);
  return rows.map((r) => ({ model: r._id, runs: r.runs, successRate: round2(r.ok / r.runs), avgMs: Math.round(r.avgMs) }));
}
