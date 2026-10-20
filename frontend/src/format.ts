import { CURRENCIES, type CurrencyCode } from './types';

export function currencyOf(code: string | undefined) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

const symbolCache = new Map<string, string>();

export function moneySymbol(code: string) {
  const known = currencyOf(code);
  const hit = symbolCache.get(known.code);
  if (hit) return hit;
  const symbol = new Intl.NumberFormat(known.locale, {
    style: 'currency', currency: known.code, currencyDisplay: 'narrowSymbol',
  }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? known.code;
  symbolCache.set(known.code, symbol);
  return symbol;
}

export function fractionDigits(code: string) {
  const known = currencyOf(code);
  return new Intl.NumberFormat(known.locale, { style: 'currency', currency: known.code })
    .resolvedOptions().maximumFractionDigits ?? 2;
}

export function formatMoney(value: number, code: string) {
  const known = currencyOf(code);
  return new Intl.NumberFormat(known.locale, { style: 'currency', currency: known.code }).format(value);
}

export function formatMoneyCompact(value: number, code: string) {
  const known = currencyOf(code);
  return new Intl.NumberFormat(known.locale, {
    style: 'currency', currency: known.code, notation: 'compact', maximumFractionDigits: 1,
  }).format(value);
}

export function moneyParts(value: number, code: string) {
  const known = currencyOf(code);
  const digits = fractionDigits(code);
  return new Intl.NumberFormat(known.locale, {
    style: 'currency', currency: known.code, currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).formatToParts(Math.abs(value));
}

export const currencyOptions = [...CURRENCIES].sort((a, b) => {
  if (a.code === 'INR') return -1;
  if (b.code === 'INR') return 1;
  return a.name.localeCompare(b.name);
});

export type { CurrencyCode };

const ymd = (d: Date) => d.toLocaleDateString('en-CA');   // local YYYY-MM-DD, never the UTC date
export const todayStr = () => ymd(new Date());
export const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};

export const toDateInput = (iso: string) => ymd(new Date(iso));
export const toTimeInput = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
// noon when the time is blank keeps the entry on the right day if timezones get mixed up later
export const fromInputs = (date: string, time: string) => new Date(`${date}T${time || '12:00'}`).toISOString();

export const showDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
};

export const dayKey = (iso: string) => ymd(new Date(iso));
export const dayLabel = (key: string) => {
  if (key === todayStr()) return 'Today';
  if (key === daysAgoStr(1)) return 'Yesterday';
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
export const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export const shortDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
