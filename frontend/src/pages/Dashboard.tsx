import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import Amount from '../components/Amount';
import CategoryBars from '../components/charts/CategoryBars';
import CategoryPieChart from '../components/charts/CategoryPieChart';
import SpendingOverTimeChart from '../components/charts/SpendingOverTimeChart';
import ExportButtons from '../components/ExportButtons';
import MonthInsights from '../components/MonthInsights';
import TransactionList from '../components/TransactionList';
import { daysAgoStr, monthBounds, monthName, todayStr } from '../format';
import type { Category, CategoryPoint, DailyPoint, Page, Summary, Transaction } from '../types';

interface Slot<T> { data: T | null; error: string; loading: boolean }

// One request per panel, so a failure in one never blanks the page.
function useSlot<T>(fetcher: () => Promise<T>, deps: unknown[]): [Slot<T>, () => void] {
  const [slot, setSlot] = useState<Slot<T>>({ data: null, error: '', loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setSlot((s) => ({ ...s, loading: true, error: '' }));
    fetcher().then(
      (data) => live && setSlot({ data, error: '', loading: false }),
      (e: Error) => live && setSlot({ data: null, error: e.message, loading: false }),
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return [slot, () => setTick((t) => t + 1)];
}

function SlotBody({ slot, retry, height = 160, children }: { slot: Slot<unknown>; retry: () => void; height?: number; children: ReactNode }) {
  if (slot.error) {
    return <div className="banner error" role="alert"><div>{slot.error} <button className="link" onClick={retry}>Retry</button></div></div>;
  }
  if (slot.loading && !slot.data) return <div className="skeleton" style={{ height }} role="status" aria-label="Loading" />;
  return <>{children}</>;
}

const RANGES = [7, 30, 90] as const;

export default function Dashboard() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [categories, setCategories] = useState<Category[]>([]);

  const [today, retryToday] = useSlot<CategoryPoint[]>(() => api.byCategory(todayStr(), todayStr()), []);
  const [months, retryMonth] = useSlot<CategoryPoint[]>(() => {
    const { from, to } = monthBounds(month);
    return api.byCategory(from, to);
  }, [month]);
  const [summary, retrySummary] = useSlot<Summary>(() => {
    const { from, to } = monthBounds(month);
    return api.summary(from, to);
  }, [month]);
  const [daily, retryDaily] = useSlot<DailyPoint[]>(() => api.daily(daysAgoStr(range - 1), todayStr()), [range]);
  const [recent, retryRecent] = useSlot<Page<Transaction>>(() => api.list({ limit: '6' }), []);

  useEffect(() => { api.categories().then(setCategories).catch(() => {}); }, []);
  const colors = useMemo(() => new Map(categories.map((c) => [c.name, c.color])), [categories]);

  const stats = useMemo(() => {
    const d = daily.data ?? [];
    const total = d.reduce((s, x) => s + x.total, 0);
    const count = d.reduce((s, x) => s + x.count, 0);
    const peak = d.reduce<DailyPoint | null>((m, x) => (!m || x.total > m.total ? x : m), null);
    return { total, count, avg: d.length ? total / d.length : 0, peak };
  }, [daily.data]);
  const todayTotal = (today.data ?? []).reduce((s, x) => s + x.total, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <ExportButtons />
      </div>

      <div className="stack">
        <section className="statement" aria-label="Spending summary">
          <div>
            <div className="statement-label"><span className="dot" />Spent in the last {range} days</div>
            {daily.data ? <Amount value={stats.total} className="big-amount" /> : <div className="big-amount" style={{ opacity: 0.4 }}>₹—</div>}
            <dl className="statement-facts">
              <div><dt>Today</dt><dd><Amount value={todayTotal} /></dd></div>
              <div><dt>Daily average</dt><dd><Amount value={stats.avg} /></dd></div>
              <div><dt>Transactions</dt><dd className="num">{stats.count}</dd></div>
              <div><dt>Biggest day</dt><dd>{stats.peak && stats.peak.total > 0 ? <Amount value={stats.peak.total} /> : '—'}</dd></div>
            </dl>
          </div>
          <div className="statement-chart">
            <div className="top">
              <div className="segmented" role="group" aria-label="Range">
                {RANGES.map((r) => (
                  <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}D</button>
                ))}
              </div>
            </div>
            {daily.error ? (
              <div className="banner error" role="alert"><div>{daily.error} <button className="link" onClick={retryDaily}>Retry</button></div></div>
            ) : daily.data ? <SpendingOverTimeChart data={daily.data} /> : <div className="empty-chart">Loading…</div>}
          </div>
        </section>

        <div className="grid-2">
          <section className="card">
            <div className="card-head"><h2>Today by category</h2><span className="sub">{todayStr().split('-').reverse().join('/')}</span></div>
            <SlotBody slot={today} retry={retryToday}>
              <CategoryBars data={today.data ?? []} empty="Nothing spent today yet." />
            </SlotBody>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Where it went · {monthName(month)}</h2>
              <input type="month" aria-label="Month" value={month} max={todayStr().slice(0, 7)} style={{ width: 'auto', height: '2rem' }}
                onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </div>
            <SlotBody slot={months} retry={retryMonth} height={200}>
              <CategoryPieChart data={months.data ?? []} />
            </SlotBody>
          </section>
        </div>

        <section className="card">
          <div className="card-head"><h2>{monthName(month)} at a glance</h2><span className="sub">Change the month above</span></div>
          <SlotBody slot={summary} retry={retrySummary}>
            {summary.data && <MonthInsights s={summary.data} />}
          </SlotBody>
        </section>

        <section className="card">
          <div className="card-head"><h2>Recent transactions</h2><Link to="/history">View all</Link></div>
          <SlotBody slot={recent} retry={retryRecent}>
            {recent.data && recent.data.items.length > 0 ? (
              <TransactionList items={recent.data.items} colors={colors} grouped={false} />
            ) : (
              <div className="empty"><p>No transactions yet.</p><Link className="button primary" to="/add">Add your first entry</Link></div>
            )}
          </SlotBody>
        </section>
      </div>
    </>
  );
}
