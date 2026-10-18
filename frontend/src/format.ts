export const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

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
