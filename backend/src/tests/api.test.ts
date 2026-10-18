// End-to-end API tests against a throwaway MongoDB replica set (transactions need one).
// Hugging Face is faked by intercepting fetch, so these tests never spend inference credits.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
Object.assign(process.env, {
  MONGODB_URI: rs.getUri(),
  MONGODB_DB: 'finman_test',
  HF_TOKEN: 'hf_test_token',
  HF_MODEL: 'test/text-model',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  ADMIN_EMAIL: 'tester@finman.local',
  ADMIN_PASSWORD: 'test-password-123',
});

const { default: mongoose } = await import('mongoose');
const { connectDb } = await import('../config/db.js');
const { app } = await import('../app.js');
const { Category } = await import('../models/Category.js');
const { Transaction } = await import('../models/Transaction.js');
const { ParseLog } = await import('../models/ParseLog.js');
const { User } = await import('../models/User.js');
const { hashPassword } = await import('../services/auth.js');

// ---- fake Hugging Face ----
type HfMode = { kind: 'json'; body: unknown } | { kind: 'text'; body: string } | { kind: 'status'; status: number };
let hf: HfMode = { kind: 'status', status: 500 };
let hfCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (!String(input).startsWith('https://router.huggingface.co')) return realFetch(input, init);
  hfCalls++;
  if (hf.kind === 'status') return new Response('{}', { status: hf.status });
  const content = hf.kind === 'json' ? JSON.stringify(hf.body) : hf.body;
  return Response.json({ choices: [{ message: { content } }] });
};

// ---- HTTP helper ----
let server: Server;
let base = '';
let cookie = '';
async function call(method: string, path: string, body?: unknown, auth = true) {
  const res = await realFetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch { /* CSV and empty bodies stay text */ }
  return { status: res.status, body: json, headers: res.headers };
}

const entry = (over: Record<string, unknown> = {}) => ({
  amount: 100, occurredAt: '2026-03-10T12:00:00+05:30', category: 'Food', merchant: 'Test Cafe', paymentMethod: 'UPI', ...over,
});

before(async () => {
  await connectDb();
  await Promise.all([Transaction.init(), Category.init(), ParseLog.init(), User.init()]);
  await Category.insertMany([
    { name: 'Food', color: '#f97316' }, { name: 'Transport', color: '#0ea5e9' },
    { name: 'Rent', color: '#64748b' }, { name: 'Transfers', color: '#6366f1' }, { name: 'Other', color: '#9ca3af' },
  ]);
  await User.create({ email: process.env.ADMIN_EMAIL, passwordHash: await hashPassword(process.env.ADMIN_PASSWORD!) });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await rs.stop();
});

describe('authentication', () => {
  test('protected routes reject requests without a session', async () => {
    assert.equal((await call('GET', '/entries', undefined, false)).status, 401);
  });

  test('wrong password is rejected without revealing which part was wrong', async () => {
    const r = await call('POST', '/auth/login', { email: process.env.ADMIN_EMAIL, password: 'nope' }, false);
    assert.equal(r.status, 401);
    assert.equal(r.body.error.message, 'Wrong email or password');
  });

  test('login sets an httpOnly session cookie that unlocks the API', async () => {
    const r = await call('POST', '/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }, false);
    assert.equal(r.status, 200);
    const set = r.headers.get('set-cookie') ?? '';
    assert.match(set, /finman_token=/);
    assert.match(set, /HttpOnly/i);
    cookie = set.split(';')[0];
    assert.equal((await call('GET', '/auth/me')).body.email, process.env.ADMIN_EMAIL);
  });

  test('a tampered token is rejected', async () => {
    const good = cookie;
    cookie = `${good.slice(0, -4)}AAAA`;
    assert.equal((await call('GET', '/entries')).status, 401);
    cookie = good;
  });
});

describe('entries CRUD', () => {
  let id = '';

  test('create stores the entry, rounds the amount and returns 201', async () => {
    const r = await call('POST', '/entries', entry({ amount: 12.345, merchant: 'Ramesh Auto', category: 'Transport' }));
    assert.equal(r.status, 201);
    assert.equal(r.body.amount, 12.35);
    id = r.body._id;
    const saved = await Transaction.findById(id).lean();
    assert.equal(saved?.merchant, 'Ramesh Auto');
  });

  test('read by id and list with filters, search and pagination', async () => {
    assert.equal((await call('GET', `/entries/${id}`)).body.merchant, 'Ramesh Auto');
    const list = await call('GET', '/entries?category=Transport&q=ramesh&limit=5');
    assert.equal(list.status, 200);
    assert.equal(list.body.total, 1);
    assert.equal(list.body.pages, 1);
    assert.equal((await call('GET', '/entries?q=(')).status, 200, 'regex characters are escaped');
  });

  test('update replaces the document and validates it', async () => {
    const r = await call('PUT', `/entries/${id}`, entry({ amount: 150, merchant: 'Ramesh Auto', category: 'Transport' }));
    assert.equal(r.status, 200);
    assert.equal(r.body.amount, 150);
    assert.equal((await call('PUT', `/entries/${id}`, entry({ amount: -1 }))).status, 400);
  });

  test('delete removes it; later reads are 404', async () => {
    assert.equal((await call('DELETE', `/entries/${id}`)).status, 204);
    assert.equal((await call('GET', `/entries/${id}`)).status, 404);
    assert.equal((await call('DELETE', `/entries/${id}`)).status, 404);
  });

  test('malformed ids are 400, unknown ids are 404', async () => {
    assert.equal((await call('GET', '/entries/123')).status, 400);
    assert.equal((await call('GET', '/entries/000000000000000000000000')).status, 404);
  });
});

describe('input validation', () => {
  for (const [label, body] of [
    ['negative amount', entry({ amount: -5 })],
    ['zero amount', entry({ amount: 0 })],
    ['future date', entry({ occurredAt: '2030-01-01' })],
    ['unknown category', entry({ category: 'Nope' })],
    ['bad payment method', entry({ paymentMethod: 'Bitcoin' })],
  ] as const) {
    test(`rejects ${label}`, async () => {
      assert.equal((await call('POST', '/entries', body)).status, 400);
    });
  }
});

describe('duplicate detection (partial unique index)', () => {
  const sms = 'Rs.850.00 debited from A/c XX4521 on 23-08-26 to VPA swiggy@icici (UPI Ref No 523614789012)';

  test('the same message cannot be saved twice, even with different spacing or case', async () => {
    assert.equal((await call('POST', '/entries', entry({ rawInput: sms, source: 'sms' }))).status, 201);
    const again = await call('POST', '/entries', entry({ rawInput: `  ${sms.toUpperCase()}  `, source: 'sms' }));
    assert.equal(again.status, 409);
    assert.equal(again.body.error.message, 'This transaction was already saved');
  });

  test('manual entries without raw text are never treated as duplicates', async () => {
    assert.equal((await call('POST', '/entries', entry())).status, 201);
    assert.equal((await call('POST', '/entries', entry())).status, 201);
  });
});

describe('analytics aggregations', () => {
  before(async () => {
    await Transaction.insertMany([
      // IST boundaries: 23:59 on 4 Jan and 00:01 on 5 Jan must land on different days
      { amount: 100, direction: 'debit', occurredAt: new Date('2025-01-04T23:59:00+05:30'), category: 'Food', source: 'manual', merchant: 'A', paymentMethod: 'UPI' },
      { amount: 200, direction: 'debit', occurredAt: new Date('2025-01-05T00:01:00+05:30'), category: 'Food', source: 'manual', merchant: 'B', paymentMethod: 'Card' },
      { amount: 350, direction: 'debit', occurredAt: new Date('2025-01-06T10:00:00+05:30'), category: 'Transport', source: 'manual', merchant: 'B', paymentMethod: 'Card' },
      { amount: 5000, direction: 'credit', occurredAt: new Date('2025-01-06T11:00:00+05:30'), category: 'Transfers', source: 'manual', merchant: 'Employer', paymentMethod: 'NetBanking' },
    ]);
  });

  test('daily totals group by IST day, fill empty days and ignore credits', async () => {
    const r = await call('GET', '/analytics/daily?from=2025-01-03&to=2025-01-06');
    assert.deepEqual(r.body.map((d: any) => [d.day, d.total]), [
      ['2025-01-03', 0], ['2025-01-04', 100], ['2025-01-05', 200], ['2025-01-06', 350],
    ]);
  });

  test('category totals ($group + $lookup) add up to the daily totals', async () => {
    const cats = (await call('GET', '/analytics/categories?from=2025-01-01&to=2025-01-31')).body;
    const daily = (await call('GET', '/analytics/daily?from=2025-01-01&to=2025-01-31')).body;
    const sum = (xs: { total: number }[]) => xs.reduce((s, x) => s + x.total, 0);
    assert.equal(sum(cats), sum(daily));
    assert.equal(cats[0].category, 'Transport');
    assert.equal(cats[0].color, '#0ea5e9', 'colour comes from the categories collection');
  });

  test('$facet summary returns totals, merchants and methods in one query', async () => {
    const s = (await call('GET', '/analytics/summary?from=2025-01-01&to=2025-01-31')).body;
    assert.equal(s.spent, 650);
    assert.equal(s.received, 5000);
    assert.equal(s.net, 4350);
    assert.equal(s.count, 4);
    assert.deepEqual(s.topMerchants[0], { name: 'B', total: 550, count: 2 });
    assert.equal(s.byMethod[0].name, 'Card');
    assert.equal(s.largest.amount, 350);
  });

  test('ranges over a year are refused', async () => {
    assert.equal((await call('GET', '/analytics/daily?from=2024-01-01&to=2025-12-31')).status, 400);
  });

  test('the analytics query is served by the compound index, not a collection scan', async () => {
    const plan = await Transaction.find({ direction: 'debit', occurredAt: { $gte: new Date('2025-01-01'), $lt: new Date('2025-02-01') } })
      .explain('executionStats') as any;
    const text = JSON.stringify(plan.queryPlanner.winningPlan);
    assert.match(text, /IXSCAN/);
    assert.match(text, /direction_1_occurredAt_-1/);
    assert.ok(plan.executionStats.totalDocsExamined <= plan.executionStats.nReturned + 1);
  });
});

describe('category rename (multi-document transaction)', () => {
  test('renaming updates the category and every transaction that copied its name', async () => {
    await Transaction.create([
      { amount: 9000, occurredAt: new Date('2025-02-01'), category: 'Rent', source: 'manual' },
      { amount: 9000, occurredAt: new Date('2025-03-01'), category: 'Rent', source: 'manual' },
    ]);
    const r = await call('PATCH', '/categories/Rent', { name: 'Housing' });
    assert.equal(r.status, 200);
    assert.equal(r.body.transactionsUpdated, 2);
    assert.equal(await Transaction.countDocuments({ category: 'Rent' }), 0);
    assert.equal(await Transaction.countDocuments({ category: 'Housing' }), 2);
  });

  test('a rename that collides is rolled back: nothing changes in either collection', async () => {
    const r = await call('PATCH', '/categories/Housing', { name: 'Food' });
    assert.equal(r.status, 409);
    assert.equal(await Transaction.countDocuments({ category: 'Housing' }), 2);
    assert.ok(await Category.exists({ name: 'Housing' }));
  });

  test('a category in use cannot be deleted; an unused one can', async () => {
    assert.equal((await call('DELETE', '/categories/Housing')).status, 409);
    assert.equal((await call('POST', '/categories', { name: 'Temp', color: '#123456' })).status, 201);
    assert.equal((await call('POST', '/categories', { name: 'Temp', color: '#123456' })).status, 409);
    assert.equal((await call('DELETE', '/categories/Temp')).status, 204);
  });
});

describe('AI parser', () => {
  const sms = 'Rs.850.00 debited from A/c XX4521 on 23-08-26 to VPA swiggy@icici (UPI Ref No 523614789012)';

  test('a good model reply fills the fields and writes a TTL-managed log row', async () => {
    hf = { kind: 'json', body: {
      isTransaction: true, amount: 850, direction: 'debit', merchant: 'Swiggy', date: '2026-08-23', time: null,
      description: 'Food order', category: 'Food', paymentMethod: 'UPI', details: { upiRef: '523614789012' },
    } };
    const before = await ParseLog.countDocuments();
    const r = await call('POST', '/parse', { text: sms });
    assert.equal(r.status, 200);
    assert.equal(r.body.fields.amount, 850);
    assert.equal(r.body.fields.category, 'Food');
    assert.ok(r.body.aiFilled.includes('merchant'));
    assert.deepEqual(r.body.warnings, []);

    for (let i = 0; i < 20 && (await ParseLog.countDocuments()) === before; i++) await new Promise((res) => setTimeout(res, 25));
    assert.equal(await ParseLog.countDocuments(), before + 1);
    const ttl = (await ParseLog.collection.indexes()).find((ix) => ix.expireAfterSeconds !== undefined);
    assert.equal(ttl?.expireAfterSeconds, 30 * 86_400);
  });

  test('a category the model invents is dropped instead of saved', async () => {
    hf = { kind: 'json', body: { isTransaction: true, amount: 50, category: 'Snacks' } };
    const r = await call('POST', '/parse', { text: 'Rs 50 paid' });
    assert.equal(r.body.fields.category, null);
    assert.ok(r.body.missing.includes('category'));
  });

  test('garbage replies get one retry, then fall back to the regex amount', async () => {
    hf = { kind: 'text', body: 'Sure! Here is what I found: amount is 850' };
    hfCalls = 0;
    const r = await call('POST', '/parse', { text: sms });
    assert.equal(r.status, 200);
    assert.equal(hfCalls, 2);
    assert.equal(r.body.fields.amount, 850);
    assert.equal(r.body.fields.direction, 'debit');
    assert.equal(r.body.aiFilled.length, 0);
    assert.ok(r.body.warnings.length > 0);
  });

  test('a rejected token is reported as a readable warning, not an error', async () => {
    hf = { kind: 'status', status: 401 };
    const r = await call('POST', '/parse', { text: sms });
    assert.equal(r.status, 200);
    assert.equal(r.body.warnings[0], 'Hugging Face rejected the token');
  });

  test('OTP messages are recognised as not a transaction', async () => {
    hf = { kind: 'json', body: { isTransaction: false } };
    const r = await call('POST', '/parse', { text: '482913 is your OTP for login.' });
    assert.equal(r.body.isTransaction, false);
  });

  test('parser stats read the log by model', async () => {
    const stats = (await call('GET', '/analytics/parser')).body;
    assert.equal(stats[0].model, 'test/text-model');
    assert.ok(stats[0].runs >= 4);
  });
});

describe('export', () => {
  test('CSV has a byte-order mark, the header row and formula escaping', async () => {
    await call('POST', '/entries', entry({ merchant: '=HYPERLINK("x")', occurredAt: '2026-03-11T12:00:00+05:30' }));
    const r = await call('GET', '/export/csv');
    assert.equal(r.status, 200);
    // fetch's text() strips a BOM, so check the raw bytes
    const raw = new Uint8Array(await (await realFetch(`${base}/api/export/csv`, { headers: { Cookie: cookie } })).arrayBuffer());
    assert.deepEqual([...raw.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.ok(String(r.body).startsWith('Date (IST),Amount,Type,Merchant'));
    assert.match(String(r.body), /"'=HYPERLINK\(""x""\)"/);
    assert.match(r.headers.get('content-disposition') ?? '', /attachment; filename="finman-/);
  });
});
