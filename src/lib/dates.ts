// All "day" values are local-time keys in the form YYYY-MM-DD.

export const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

export const todayKey = () => keyOf(new Date());
export const nowISO = () => new Date().toISOString();
export const isoToKey = (iso: string) => keyOf(new Date(iso));

export function addDays(k: string, n: number): string {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
}

/** Whole days from a to b (positive when b is later). */
export const diffDays = (a: string, b: string) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 864e5);

export const monthKey = (k: string) => k.slice(0, 7);

export function daysInMonth(k: string): number {
  const d = fromKey(k);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Monday = 0 … Sunday = 6 */
export const dowMon = (k: string) => (fromKey(k).getDay() + 6) % 7;

export const weekStart = (k: string) => addDays(k, -dowMon(k));

export function monthsBetween(a: string, b: string): number {
  const x = fromKey(a), y = fromKey(b);
  return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth());
}

/** Last day of a YYYY-MM month as a day key. */
export function endOfMonthKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return keyOf(new Date(y, m, 0));
}

export function fmtDate(k: string): string {
  const d = fromKey(k);
  return d.getFullYear() === new Date().getFullYear()
    ? `${d.getDate()} ${MON[d.getMonth()]}`
    : `${MON[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtLong(k: string): string {
  const d = fromKey(k);
  return `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

export function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${pad(m)} ${ap}` : `${h12} ${ap}`;
}

/** "Today", "Tomorrow", "Fri", "3d late", "12 Dec" … */
export function whenLabel(due: string, today: string): string {
  const o = diffDays(today, due);
  if (o < -1) return `${-o}d late`;
  if (o === -1) return 'Yesterday';
  if (o === 0) return 'Today';
  if (o === 1) return 'Tomorrow';
  if (o < 7) return DAY[fromKey(due).getDay()];
  return fmtDate(due);
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(isoToKey(iso));
}
