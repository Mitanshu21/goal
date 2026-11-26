import type { Data, Goal, Task } from './types';
import { MON, addDays, daysInMonth, diffDays, dowMon, fmtDate, fromKey, isoToKey, monthKey, monthsBetween, weekStart } from './dates';
import { lakh, plural } from './format';

export type Tone = 'good' | 'warn' | 'bad';

export interface Info {
  tone: Tone;
  status: string;
  line: string; // one-line summary under the goal name
  fill: number; // 0–100, bar fill
  pace: number | null; // 0–100, where you should be by now
  // amount
  saved?: number; expected?: number; perMonth?: number; pct?: number; elapsed?: number;
  // limit
  used?: number; left?: number; allowed?: number; clean?: number; hist?: { label: string; value: number }[];
  // freq
  count?: number; week?: boolean[]; loggedToday?: boolean; weeks?: number[];
  // tasks
  linked?: Task[]; done?: number;
}

const live = <T extends { deleted?: boolean }>(a: T[]) => a.filter((x) => !x.deleted);
export const activeGoals = (d: Data) => live(d.goals).filter((g) => !g.completedAt);
export const goalLogs = (d: Data, id: string) => live(d.logs).filter((l) => l.goalId === id);

function elapsed(start: string, end: string, today: string) {
  const total = diffDays(start, end);
  return total <= 0 ? 1 : Math.min(1, Math.max(0, diffDays(start, today) / total));
}
function paceTone(pct: number, el: number): [Tone, string] {
  const d = pct - el * 100;
  return d >= 10 ? ['good', 'Ahead'] : d >= -5 ? ['good', 'On track'] : ['warn', 'Behind'];
}

export function goalInfo(g: Goal, d: Data, today: string): Info {
  const logs = goalLogs(d, g.id);

  if (g.kind === 'amount') {
    const saved = logs.reduce((s, l) => s + l.amount, 0);
    const end = g.end ?? today;
    const el = elapsed(g.start, end, today);
    const pct = g.target ? Math.min(100, Math.round((saved / g.target) * 100)) : 0;
    const perMonth = Math.ceil(Math.max(0, g.target - saved) / Math.max(1, monthsBetween(today, end)) / 100) * 100;
    const [tone, status]: [Tone, string] = saved >= g.target ? ['good', 'Reached'] : paceTone((saved / g.target) * 100, el);
    return { tone, status, fill: pct, pace: el * 100, line: `${lakh(saved)} of ${lakh(g.target)} · by ${fmtDate(end)}`, saved, expected: g.target * el, perMonth, pct, elapsed: el };
  }

  if (g.kind === 'limit') {
    const mk = monthKey(today);
    const used = logs.filter((l) => monthKey(isoToKey(l.at)) === mk).length;
    const allowed = (g.target * fromKey(today).getDate()) / daysInMonth(today);
    const last = logs.reduce<string | null>((m, l) => (!m || l.at > m ? l.at : m), null);
    const clean = Math.max(0, diffDays(isoToKey(last ?? g.createdAt), today));
    const tone: Tone = used > g.target ? 'bad' : used > allowed + 0.5 ? 'warn' : 'good';
    const status = used > g.target ? 'Over limit' : used > allowed + 0.5 ? 'Slow down' : 'On track';
    const startMonth = monthKey(g.start);
    const hist = [5, 4, 3, 2, 1, 0]
      .map((k) => {
        const dt = fromKey(today); dt.setDate(1); dt.setMonth(dt.getMonth() - k);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        return { key, label: MON[dt.getMonth()], value: logs.filter((l) => monthKey(isoToKey(l.at)) === key).length };
      })
      .filter((h) => h.key >= startMonth)
      .map(({ label, value }) => ({ label, value }));
    return {
      tone, status, fill: Math.min(100, (used / Math.max(1, g.target)) * 100), pace: (allowed / Math.max(1, g.target)) * 100,
      line: `${used} of ${g.target} this month${clean > 0 ? ` · ${plural(clean, 'day')} clean` : ''}`,
      used, left: g.target - used, allowed, clean, hist,
    };
  }

  if (g.kind === 'freq') {
    const ws = weekStart(today);
    const days = new Set(logs.map((l) => isoToKey(l.at)));
    const week = Array.from({ length: 7 }, (_, i) => days.has(addDays(ws, i)));
    const count = week.filter(Boolean).length;
    // Only count the days of this week since the goal existed.
    const counted = Math.min(dowMon(today), Math.max(0, diffDays(g.start, today))) + 1;
    const expected = Math.floor((g.target * counted) / 7);
    const firstWeek = weekStart(g.start);
    const weeks = Array.from({ length: 8 }, (_, k) => addDays(ws, -7 * (8 - k)))
      .filter((s) => s >= firstWeek)
      .map((s) => {
        let n = 0;
        for (let i = 0; i < 7; i++) if (days.has(addDays(s, i))) n++;
        return n;
      });
    const [tone, status]: [Tone, string] = count >= g.target ? ['good', 'Done this week'] : count >= expected ? ['good', 'On track'] : ['warn', 'Behind'];
    return { tone, status, fill: Math.min(100, (count / g.target) * 100), pace: null, line: `${count} of ${g.target} this week`, count, week, loggedToday: days.has(today), weeks };
  }

  const linked = live(d.tasks).filter((t) => t.goalId === g.id);
  const done = linked.filter((t) => t.doneAt).length;
  const pct = linked.length ? Math.round((done / linked.length) * 100) : 0;
  const end = g.end ?? today;
  const el = elapsed(g.start, end, today);
  const [tone, status]: [Tone, string] = !linked.length ? ['good', 'Add tasks'] : pct === 100 ? ['good', 'Ready to finish'] : paceTone(pct, el);
  return { tone, status, fill: pct, pace: el * 100, line: `${done} of ${linked.length} tasks · by ${fmtDate(end)}`, linked, done, pct, elapsed: el };
}

/** Goals finished this year and this quarter, plus how many are still due in each. */
export function goalStats(d: Data, today: string) {
  const year = today.slice(0, 4);
  const month = Number(today.slice(5, 7)) - 1;
  const quarter = Math.floor(month / 3);
  const inQ = (k: string) => k.startsWith(year) && Math.floor((Number(k.slice(5, 7)) - 1) / 3) === quarter;
  const goals = live(d.goals);
  const done = goals.filter((g) => g.completedAt && isoToKey(g.completedAt).startsWith(year));
  const active = goals.filter((g) => !g.completedAt);
  const qDone = done.filter((g) => inQ(isoToKey(g.completedAt!))).length;
  const yDue = active.filter((g) => g.end && g.end.startsWith(year));
  const qDue = active.filter((g) => g.end && inQ(g.end));
  const months = Array.from({ length: 12 }, (_, i) => done.filter((g) => Number(isoToKey(g.completedAt!).slice(5, 7)) - 1 === i).length);
  return { year: Number(year), quarter: quarter + 1, month, yDone: done.length, yTotal: done.length + yDue.length, qDone, qTotal: qDone + qDue.length, months, done, yDue };
}

export const rank: Record<Tone, number> = { bad: 0, warn: 1, good: 2 };
