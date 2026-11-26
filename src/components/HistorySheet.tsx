import { useMemo, useState } from 'react';
import type { Data } from '../lib/types';
import { addDays, fmtLong, isoToKey, plainTime } from '../lib/dates';
import { plural } from '../lib/format';
import Sheet from './Sheet';

const PAGE = 40;

/** Everything you've ticked off, newest first, grouped by day. */
export default function HistorySheet({ data, today, onClose }: { data: Data; today: string; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const done = useMemo(
    () => data.tasks.filter((t) => !t.deleted && t.doneAt).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!)),
    [data.tasks],
  );
  const week = done.filter((t) => isoToKey(t.doneAt!) > addDays(today, -7)).length;
  const month = done.filter((t) => isoToKey(t.doneAt!).slice(0, 7) === today.slice(0, 7)).length;

  const needle = q.trim().toLowerCase();
  const found = needle ? done.filter((t) => t.title.toLowerCase().includes(needle)) : done;
  const shown = found.slice(0, limit);

  const groups: { day: string; items: typeof shown }[] = [];
  for (const t of shown) {
    const day = isoToKey(t.doneAt!);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(t);
  }
  const dayName = (k: string) => (k === today ? 'Today' : k === addDays(today, -1) ? 'Yesterday' : fmtLong(k));
  const lastDone = (k: string) => (k === today || k === addDays(today, -1) ? dayName(k).toLowerCase() : `on ${fmtLong(k)}`);
  const goalName = (id: string | null) => (id ? data.goals.find((g) => g.id === id && !g.deleted)?.title : undefined);

  return (
    <Sheet label="Done tasks" onClose={onClose}>
      <h3>Done</h3>
      <p className="sm">{plural(week, 'task')} in the last 7 days · {month} this month</p>

      {done.length > 0 && (
        <input
          className="search"
          type="search"
          placeholder="Search, e.g. call dad"
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
          aria-label="Search done tasks"
        />
      )}

      {done.length === 0 && <p className="say">Nothing ticked off yet. Tasks you finish show up here with the day you did them.</p>}
      {done.length > 0 && found.length === 0 && <p className="sm">No done task matches “{q.trim()}”.</p>}
      {needle && found.length > 0 && (
        <p className="sm">
          Done {plural(found.length, 'time')} · last {lastDone(isoToKey(found[0].doneAt!))}
        </p>
      )}

      <div className="hist-list">
        {groups.map((g) => (
          <section key={g.day}>
            <h4 className="lab"><span>{dayName(g.day)}</span><span>{g.items.length}</span></h4>
            {g.items.map((t) => (
              <div key={t.id} className="ln done">
                <span className="ck" aria-hidden />
                <span className="tx">
                  {t.title}
                  {goalName(t.goalId) && <small>{goalName(t.goalId)}</small>}
                </span>
                <span className="rt">{plainTime(t.doneAt!)}</span>
              </div>
            ))}
          </section>
        ))}
      </div>

      {found.length > limit && (
        <button type="button" className="btn soft" onClick={() => setLimit((n) => n + PAGE)}>Show older</button>
      )}
      <button type="button" className="btn link" onClick={onClose}>Close</button>
    </Sheet>
  );
}
