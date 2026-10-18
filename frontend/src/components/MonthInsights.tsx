import Amount from './Amount';
import { showDate } from '../format';
import type { Summary } from '../types';

// Rendered from one $facet query: totals, merchants, methods and the largest spend arrive together.
export default function MonthInsights({ s }: { s: Summary }) {
  if (s.count === 0) return <div className="empty"><p>No entries in this month yet.</p></div>;
  const maxMethod = Math.max(...s.byMethod.map((m) => m.total), 1);
  return (
    <>
      <div className="insights">
        <div>
          <h3>Money flow</h3>
          <div className="flow">
            <div><span>Money in</span><Amount value={s.received} direction="credit" /></div>
            <div><span>Money out</span><Amount value={s.spent} /></div>
            <div className="net"><span>Net</span><Amount value={s.net} direction={s.net >= 0 ? 'credit' : 'debit'} signed /></div>
          </div>
        </div>
        <div>
          <h3>Top merchants</h3>
          {s.topMerchants.length ? (
            <ol className="rank">
              {s.topMerchants.map((m) => <li key={m.name}><span>{m.name}</span><Amount value={m.total} /></li>)}
            </ol>
          ) : <p className="hint">No named merchants yet.</p>}
        </div>
        <div>
          <h3>How you paid</h3>
          <ul className="cat-list">
            {s.byMethod.map((m) => (
              <li key={m.name} className="cat-row">
                <span className="name">{m.name}<span className="hint">· {m.count}</span></span>
                <Amount value={m.total} />
                <span className="bar" aria-hidden="true"><span style={{ width: `${(m.total / maxMethod) * 100}%`, background: 'var(--primary)' }} /></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="callout">
        {s.count} entries · <Amount value={s.avgPerDay} /> a day on average
        {s.largest && <> · biggest spend <Amount value={s.largest.amount} /> at {s.largest.merchant || s.largest.category} on {showDate(s.largest.occurredAt).split(',')[0]}</>}
        {s.aiParsedShare > 0 && <> · {Math.round(s.aiParsedShare * 100)}% read by AI</>}
      </p>
    </>
  );
}
