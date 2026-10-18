import type { Direction } from '../types';

const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

// ₹12,430.50 rendered with a quieter currency sign and paise, the way banking apps set money.
export default function Amount({ value, direction, signed = false, className = '' }: {
  value: number; direction?: Direction; signed?: boolean; className?: string;
}) {
  const abs = Math.abs(value);
  const rupees = Math.trunc(abs);
  const paise = Math.round((abs - rupees) * 100);
  const sign = signed ? (direction === 'credit' ? '+' : '−') : '';
  const label = `${signed ? (direction === 'credit' ? 'plus ' : 'minus ') : ''}₹${abs.toFixed(2)}`;
  return (
    <span className={`amount ${direction ?? ''} ${className}`} aria-label={label}>
      <span aria-hidden="true">
        {sign}<span className="cur">₹</span>{whole.format(rupees)}<span className="paise">.{String(paise).padStart(2, '0')}</span>
      </span>
    </span>
  );
}
