import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson, aiResult, regexFallback } from '../services/aiParser.js';
import { csvCell } from '../services/csv.js';
import { istDayRange } from '../services/analytics.js';

test('extractJson handles code fences and trailing prose', () => {
  assert.deepEqual(extractJson('```json\n{"amount": 5}\n```\nDone!'), { amount: 5 });
});

test('aiResult keeps good fields when one is bad', () => {
  const r = aiResult.parse({ amount: '850', date: '23/08/2026', category: 'Food' });
  assert.equal(r.amount, 850);
  assert.equal(r.date, null);
  assert.equal(r.isTransaction, true);
});

test('csvCell escapes quotes, commas and formulas', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
});

test('istDayRange covers exactly one IST day', () => {
  const { start, end } = istDayRange('2026-10-05', '2026-10-05');
  assert.equal(start.toISOString(), '2026-10-04T18:30:00.000Z');
  assert.equal(end.toISOString(), '2026-10-05T18:30:00.000Z');
});

test('regexFallback finds amount and direction', () => {
  assert.deepEqual(regexFallback('INR 2,499.00 spent on card'), { amount: 2499, direction: 'debit' });
  assert.deepEqual(regexFallback('Rs.45,000.00 credited to your A/c'), { amount: 45000, direction: 'credit' });
});
