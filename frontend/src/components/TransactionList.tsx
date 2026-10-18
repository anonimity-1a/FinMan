import { Link } from 'react-router';
import Amount from './Amount';
import Icon from './Icon';
import { dayKey, dayLabel, timeLabel } from '../format';
import type { Transaction } from '../types';

interface Props {
  items: Transaction[];
  colors: Map<string, string>;
  deleting?: string | null;
  onDelete?: (t: Transaction) => void;
  grouped?: boolean;
}

function Row({ t, colors, deleting, onDelete }: { t: Transaction } & Omit<Props, 'items' | 'grouped'>) {
  const color = colors.get(t.category) ?? '#9ca3af';
  const title = t.merchant || t.description || t.category;
  return (
    <li className="tx">
      <span className="avatar" style={{ background: `${color}2e` }} aria-hidden="true">{title.charAt(0).toUpperCase()}</span>
      <div className="tx-main">
        <div className="tx-title" title={title}>
          <span>{title}</span>
          {t.aiParsed && <span className="chip ai-chip" title="Read by AI"><Icon name="sparkles" />AI</span>}
        </div>
        <div className="tx-meta">{t.category} · {t.paymentMethod} · {timeLabel(t.occurredAt)}</div>
      </div>
      <Amount value={t.amount} direction={t.direction} signed />
      {onDelete && (
        <div className="tx-actions">
          <Link className="button icon-btn" to={`/history/${t._id}/edit`} aria-label={`Edit ${title}`}><Icon name="pencil" size={16} /></Link>
          <button className="icon-btn danger-ghost" disabled={deleting === t._id} onClick={() => onDelete(t)} aria-label={`Delete ${title}`}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      )}
    </li>
  );
}

export default function TransactionList({ items, grouped = true, ...rest }: Props) {
  if (!grouped) {
    return <ul className="tx-list flat">{items.map((t) => <Row key={t._id} t={t} {...rest} />)}</ul>;
  }
  const days = new Map<string, Transaction[]>();
  for (const t of items) {
    const k = dayKey(t.occurredAt);
    days.set(k, [...(days.get(k) ?? []), t]);
  }
  return (
    <>
      {[...days].map(([day, txs]) => {
        const spent = txs.filter((t) => t.direction === 'debit').reduce((s, t) => s + t.amount, 0);
        return (
          <section key={day} className="tx-day" aria-label={dayLabel(day)}>
            <div className="tx-day-head">
              <h3>{dayLabel(day)}</h3>
              {spent > 0 && <span>Spent <Amount value={spent} /></span>}
            </div>
            <ul className="tx-list">{txs.map((t) => <Row key={t._id} t={t} {...rest} />)}</ul>
          </section>
        );
      })}
    </>
  );
}
