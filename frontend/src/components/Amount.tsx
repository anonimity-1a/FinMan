import type { Direction } from '../types';
import { useCurrency } from '../currency';
import { formatMoney, moneyParts } from '../format';

// 12,430.50 with a quieter currency sign and minor units, the way banking apps set money.
export default function Amount({ value, direction, signed = false, className = '' }: {
  value: number; direction?: Direction; signed?: boolean; className?: string;
}) {
  const code = useCurrency();
  const abs = Math.abs(value);
  const sign = signed ? (direction === 'credit' ? '+' : '−') : '';
  const spoken = formatMoney(abs, code);
  const label = `${signed ? (direction === 'credit' ? 'plus ' : 'minus ') : ''}${spoken}`;
  return (
    <span className={`amount ${direction ?? ''} ${className}`} aria-label={label}>
      <span aria-hidden="true">
        {sign}
        {moneyParts(abs, code).map((part, i) => {
          if (part.type === 'currency') return <span key={i} className="cur">{part.value}</span>;
          if (part.type === 'decimal' || part.type === 'fraction') return <span key={i} className="paise">{part.value}</span>;
          return <span key={i}>{part.value}</span>;
        })}
      </span>
    </span>
  );
}
