import { api, HttpError } from './drive';
import type { Data, Task } from './types';

/*
 * Phone reminders through Google Calendar. The app keeps its own "Goals"
 * calendar and adds one event for every open task that has a time, with a
 * pop-up reminder at that time. Your phone's Calendar app does the alerting.
 *
 * Event ids are derived from task ids, so every device writes the same event
 * and nothing is ever duplicated. Ticking or deleting a task removes its event.
 */

const CAL = 'https://www.googleapis.com/calendar/v3';
const PUSHED = 'cal_pushed';
const MAX_PER_RUN = 60;

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const pad = (n: number) => String(n).padStart(2, '0');

/** Calendar ids may only use 0-9 and a-v, so hex-encode the task id. */
const eventId = (taskId: string) =>
  'goals' + [...new TextEncoder().encode(taskId)].map((b) => b.toString(16).padStart(2, '0')).join('');

const sig = (t: Task) => JSON.stringify([t.title, t.due, t.time]);

interface Pushed { cal: string | null; map: Record<string, string> }
function readPushed(): Pushed {
  try { return JSON.parse(localStorage.getItem(PUSHED) || '') as Pushed; } catch { return { cal: null, map: {} }; }
}
const savePushed = (p: Pushed) => localStorage.setItem(PUSHED, JSON.stringify(p));
export const forgetPushed = () => localStorage.removeItem(PUSHED);

function body(t: Task) {
  const [y, m, d] = t.due.split('-').map(Number);
  const [hh, mm] = t.time!.split(':').map(Number);
  const end = new Date(y, m - 1, d, hh, mm + 15);
  const local = (x: Date) =>
    `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}:00`;
  return {
    id: eventId(t.id),
    status: 'confirmed',
    summary: t.title,
    description: 'From your Goals app. Tick the task in the app and this reminder goes away.',
    start: { dateTime: `${t.due}T${t.time}:00`, timeZone: tz() },
    end: { dateTime: local(end), timeZone: tz() },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    transparency: 'transparent', // don't show you as busy
  };
}

export async function createCalendar(): Promise<string> {
  const r = await api(`${CAL}/calendars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Goals', description: 'Reminders for timed tasks from the Goals app.', timeZone: tz() }),
  });
  return ((await r.json()) as { id: string }).id;
}

export async function deleteCalendar(id: string): Promise<void> {
  await api(`${CAL}/calendars/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((e) => {
    if (!(e instanceof HttpError && (e.status === 404 || e.status === 410))) throw e;
  });
  forgetPushed();
}

async function upsert(cal: string, t: Task) {
  const b = body(t);
  const base = `${CAL}/calendars/${encodeURIComponent(cal)}/events`;
  try {
    await api(`${base}/${b.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 404)) throw e;
    await api(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  }
}

async function remove(cal: string, taskId: string) {
  await api(`${CAL}/calendars/${encodeURIComponent(cal)}/events/${eventId(taskId)}`, { method: 'DELETE' }).catch((e) => {
    if (!(e instanceof HttpError && (e.status === 404 || e.status === 410))) throw e;
  });
}

/** Thrown when the Goals calendar no longer exists (deleted in Google Calendar). */
export class CalendarGone extends Error {}

/** Makes the Goals calendar match your open timed tasks. */
export async function syncCalendar(d: Data, today: string): Promise<void> {
  const cal = d.settings.calendarId;
  if (!d.settings.calendar || !cal) { forgetPushed(); return; }

  let pushed = readPushed();
  if (pushed.cal !== cal) pushed = { cal, map: {} };

  const want = new Map<string, Task>();
  for (const t of d.tasks) {
    if (t.deleted || t.doneAt || !t.time) continue;
    if (t.due >= today || pushed.map[t.id]) want.set(t.id, t);
  }

  let ops = 0;
  try {
    for (const [id, t] of want) {
      if (pushed.map[id] === sig(t)) continue;
      if (ops++ >= MAX_PER_RUN) break;
      await upsert(cal, t);
      pushed.map[id] = sig(t);
    }
    for (const id of Object.keys(pushed.map)) {
      if (want.has(id)) continue;
      if (ops++ >= MAX_PER_RUN) break;
      await remove(cal, id);
      delete pushed.map[id];
    }
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) { forgetPushed(); throw new CalendarGone('The Goals calendar was deleted'); }
    throw e;
  } finally {
    savePushed(pushed);
  }
}
