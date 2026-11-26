import type { Repeat } from './types';
import { addDays, fromKey, fmtTime, whenLabel, DAY } from './dates';

export interface Parsed {
  title: string;
  due: string | null; // YYYY-MM-DD, null when no day was mentioned
  time: string | null; // HH:mm
  repeat: Repeat;
}

const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Reads days, times and repeats out of a typed task, e.g.
 *   "Call mom tomorrow 6pm"     → Call mom · tomorrow · 18:00
 *   "Text Sam friday at 7:30pm" → Text Sam · next Friday · 19:30
 *   "Call dad every sunday"     → Call dad · next Sunday · weekly
 */
export function parseTask(input: string, today: string): Parsed {
  let s = ` ${input} `;
  // `as` keeps TypeScript from narrowing these to null (they are set inside callbacks)
  let due = null as string | null;
  let time = null as string | null;
  let repeat = null as Repeat;
  const todayDow = fromKey(today).getDay();
  const nextDow = (k: number) => addDays(today, ((k - todayDow + 7) % 7) || 7);

  s = s.replace(/\s(every\s?day|daily)\b/i, () => { repeat = 'daily'; return ' '; });
  s = s.replace(/\severy\s(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i, (_m, d: string) => {
    const k = WD.indexOf(d.toLowerCase());
    repeat = 'weekly';
    due = k === todayDow ? today : nextDow(k);
    return ' ';
  });
  s = s.replace(/\s(every\s?week|weekly)\b/i, () => { repeat = 'weekly'; return ' '; });

  s = s.replace(/\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i, (_m, h: string, m: string | undefined, ap: string) => {
    let hh = Number(h) % 12;
    if (ap.toLowerCase() === 'pm') hh += 12;
    time = `${String(hh).padStart(2, '0')}:${m ?? '00'}`;
    return ' ';
  });
  s = s.replace(/\s(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)\b/, (_m, h: string, m: string) => {
    time = `${h.padStart(2, '0')}:${m}`;
    return ' ';
  });

  s = s.replace(/\s(today|tonight)\b/i, (_m, w: string) => {
    due = today;
    if (/tonight/i.test(w) && !time) time = '20:00';
    return ' ';
  });
  s = s.replace(/\s(tomorrow|tmrw|tmr)\b/i, () => { due = addDays(today, 1); return ' '; });
  s = s.replace(/\snext\sweek\b/i, () => { due = addDays(today, 7); return ' '; });
  // A weekday is a date ("Text Sam friday"), unless it is the topic ("Text Sam about Saturday").
  s = s.replace(/(\s\S+)?\s(?:on\s)?(sun|mon|tue|wed|thu|fri|sat)(?:day|sday|nesday|rsday|urday)?\b/i, (m, prev: string | undefined, d: string) => {
    if (prev && /^\s(about|for|re|regarding|of|from|since|last)$/i.test(prev)) return m;
    due = nextDow(WD.indexOf(d.toLowerCase()));
    return prev ? `${prev} ` : ' ';
  });

  if (repeat && due === null) due = today;
  const title = s.replace(/\s+/g, ' ').trim();
  return { title, due, time, repeat };
}

export function repeatLabel(repeat: Repeat, due: string): string {
  if (repeat === 'daily') return 'Daily';
  if (repeat === 'weekly') return `Every ${DAY[fromKey(due).getDay()]}`;
  return '';
}

/** Little chips shown above the input while typing. */
export function parsedChips(input: string, today: string): string[] {
  if (!input.trim()) return [];
  const p = parseTask(input, today);
  const due = p.due ?? today;
  return [whenLabel(due, today), p.time ? fmtTime(p.time) : '', p.repeat ? '↻ ' + repeatLabel(p.repeat, due) : ''].filter(Boolean);
}
