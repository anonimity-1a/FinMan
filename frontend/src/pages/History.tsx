import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import Icon from '../components/Icon';
import TransactionList from '../components/TransactionList';
import { formatMoney, showDate } from '../format';
import { useCurrency } from '../currency';
import type { Category, Page, Transaction } from '../types';

const LIMIT = 20;

export default function History() {
  const currency = useCurrency();
  const [params, setParams] = useSearchParams();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(q);
  const [data, setData] = useState<Page<Transaction> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const colors = useMemo(() => new Map(categories.map((c) => [c.name, c.color])), [categories]);
  const filtered = Boolean(from || to || category || q);

  const update = useCallback((changes: Record<string, string>, resetPage = true) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k);
      if (resetPage) next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => { api.categories().then(setCategories).catch(() => {}); }, []);

  // debounce the search box by 300 ms
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => update({ q: search }), 300);
    return () => clearTimeout(t);
  }, [search, q, update]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query: Record<string, string> = { page: String(page), limit: String(LIMIT) };
      if (from) query.from = from;
      if (to) query.to = to;
      if (category) query.category = category;
      if (q) query.q = q;
      setData(await api.list(query));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, from, to, category, q]);

  useEffect(() => { load(); }, [load]);

  async function remove(t: Transaction) {
    if (!window.confirm(`Delete ${formatMoney(t.amount, currency)} at ${t.merchant || t.category} on ${showDate(t.occurredAt)}?`)) return;
    setDeleting(t._id);
    try {
      await api.remove(t._id);
      if (data && data.items.length === 1 && page > 1) update({ page: String(page - 1) }, false);
      else await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  const clear = () => { setSearch(''); setParams({}, { replace: true }); };
  const start = data ? (data.page - 1) * LIMIT + 1 : 0;
  const end = data ? start + data.items.length - 1 : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>{data ? `${data.total} ${filtered ? 'matching' : 'recorded'}` : 'Loading…'}</p>
        </div>
        <Link className="button primary head-cta" to="/add"><Icon name="plus" size={16} />New entry</Link>
      </div>

      <div className="filters">
        <div className="field search-field">
          <label htmlFor="h-q">Search</label>
          <div className="search">
            <Icon name="search" size={16} />
            <input id="h-q" type="search" placeholder="Merchant or description" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="field"><label htmlFor="h-cat">Category</label>
          <select id="h-cat" value={category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c._id}>{c.name}</option>)}
          </select></div>
        <div className="field"><label htmlFor="h-from">From</label>
          <input id="h-from" type="date" value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value })} /></div>
        <div className="field"><label htmlFor="h-to">To</label>
          <input id="h-to" type="date" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value })} /></div>
        <button className="ghost" onClick={clear} disabled={!filtered && !search}><Icon name="x" size={16} />Clear</button>
      </div>

      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 'var(--s4)' }}>
          <div>{error} <button className="link" onClick={load}>Retry</button></div>
        </div>
      )}

      {!data && loading && (
        <div className="stack" role="status" aria-label="Loading transactions">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        </div>
      )}

      {data && data.total === 0 && !loading && (
        <div className="card">
          {filtered ? (
            <div className="empty"><strong>Nothing matches these filters</strong><button onClick={clear}>Clear filters</button></div>
          ) : (
            <div className="empty"><strong>No transactions yet</strong><p>Paste your first bank SMS and FinMan will fill it in.</p>
              <Link className="button primary" to="/add">Add entry</Link></div>
          )}
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={`results${loading ? ' loading' : ''}`} aria-busy={loading}>
            <TransactionList items={data.items} colors={colors} deleting={deleting} onDelete={remove} />
          </div>
          <div className="pager">
            <span className="muted num">Showing {start}–{end} of {data.total}</span>
            <div className="actions">
              <button disabled={page <= 1 || loading} onClick={() => update({ page: String(page - 1) }, false)}><Icon name="left" size={16} />Prev</button>
              <button disabled={page >= data.pages || loading} onClick={() => update({ page: String(page + 1) }, false)}>Next<Icon name="right" size={16} /></button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
