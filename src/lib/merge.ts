import type { Base, Data, Settings } from './types';

const defaultSettings = (): Settings => ({ calendar: false, calendarId: null, updatedAt: '' });
export const emptyData = (): Data => ({ version: 1, tasks: [], goals: [], logs: [], notes: [], settings: defaultSettings() });

/** Accepts anything that looks like our file and returns clean Data. */
export function normalize(d: unknown): Data {
  const o = (d ?? {}) as Partial<Data>;
  const s = (o.settings ?? {}) as Partial<Settings>;
  return {
    version: 1,
    tasks: Array.isArray(o.tasks) ? o.tasks : [],
    goals: Array.isArray(o.goals) ? o.goals : [],
    logs: Array.isArray(o.logs) ? o.logs : [],
    notes: Array.isArray(o.notes) ? o.notes : [],
    settings: {
      calendar: s.calendar === true,
      calendarId: typeof s.calendarId === 'string' ? s.calendarId : null,
      updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : '',
    },
  };
}

/** Union by id; when both sides have a record, the one edited last wins. */
function mergeArr<T extends Base>(a: T[], b: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(x.id, x);
  for (const x of b) {
    const y = m.get(x.id);
    if (!y || x.updatedAt > y.updatedAt) m.set(x.id, x);
  }
  return [...m.values()].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
}

export const mergeData = (a: Data, b: Data): Data => ({
  version: 1,
  tasks: mergeArr(a.tasks, b.tasks),
  goals: mergeArr(a.goals, b.goals),
  logs: mergeArr(a.logs, b.logs),
  notes: mergeArr(a.notes, b.notes),
  settings: (b.settings?.updatedAt ?? '') > (a.settings?.updatedAt ?? '') ? b.settings : a.settings,
});

const canonical = (d: Data) => JSON.stringify(mergeData(d, emptyData()));
export const sameData = (a: Data, b: Data) => canonical(a) === canonical(b);
