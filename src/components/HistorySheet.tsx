import { useMemo, useState } from 'react';
import type { Data, Task } from '../lib/types';
import { addDays, fmtLong, isoToKey, plainTime } from '../lib/dates';
import { plural } from '../lib/format';
import { restoreTask } from '../lib/store';
import Sheet from './Sheet';

const PAGE = 40;

/** When it left your list: the time it was deleted, or else the time it was done. */
const whenOf = (t: Task) => (t.deleted ? t.updatedAt : t.doneAt!);

/** Everything you've ticked off or deleted, newest first, grouped by day. */
export default function HistorySheet({ data, today, onClose }: { data: Data; today: string; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(
    () => data.tasks
      .filter((t) => (t.deleted ? !t.auto : t.doneAt))
      .sort((a, b) => whenOf(b).localeCompare(whenOf(a))),
    [data.tasks],
  );
  const done = all.filter((t) => !t.deleted);
  const week = done.filter((t) => isoToKey(t.doneAt!) > addDays(today, -7)).length;
  const month = done.filter((t) => isoToKey(t.doneAt!).slice(0, 7) === today.slice(0, 7)).length;

  const needle = q.trim().toLowerCase();
  const found = needle ? all.filter((t) => t.title.toLowerCase().includes(needle)) : all;
  const foundDone = found.filter((t) => !t.deleted);
  const shown = found.slice(0, limit);

  const groups: { day: string; items: Task[] }[] = [];
  for (const t of shown) {
    const day = isoToKey(whenOf(t));
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(t);
  }
  const dayName = (k: string) => (k === today ? 'Today' : k === addDays(today, -1) ? 'Yesterday' : fmtLong(k));
  const lastDone = (k: string) => (k === today || k === addDays(today, -1) ? dayName(k).toLowerCase() : `on ${fmtLong(k)}`);
  const goalName = (id: string | null) => (id ? data.goals.find((g) => g.id === id && !g.deleted)?.title : undefined);

  return (
    <Sheet label="History" onClose={onClose}>
      <h3>History</h3>
      <p className="sm">{plural(week, 'task')} done in the last 7 days · {month} this month</p>

      {all.length > 0 && (
        <input
          className="search"
          type="search"
          placeholder="Search, e.g. call dad"
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
          aria-label="Search history"
        />
      )}

      {all.length === 0 && <p className="say">Nothing here yet. Tasks you finish or delete show up here with the day it happened.</p>}
      {all.length > 0 && found.length === 0 && <p className="sm">Nothing matches “{q.trim()}”.</p>}
      {needle && foundDone.length > 0 && (
        <p className="sm">
          Done {plural(foundDone.length, 'time')} · last {lastDone(isoToKey(foundDone[0].doneAt!))}
        </p>
      )}

      <div className="hist-list">
        {groups.map((g) => (
          <section key={g.day}>
            <h4 className="lab"><span>{dayName(g.day)}</span><span>{g.items.length}</span></h4>
            {g.items.map((t) => (
              <div key={t.id} className={`ln ${t.deleted ? 'gone' : 'done'}`}>
                <span className="ck" aria-hidden />
                <span className="tx">
                  {t.title}
                  <small>{[t.deleted ? 'Deleted' : '', goalName(t.goalId)].filter(Boolean).join(' · ')}</small>
                </span>
                {t.deleted
                  ? <button type="button" className="restore" onClick={() => restoreTask(t.id)}>Restore</button>
                  : <span className="rt">{plainTime(t.doneAt!)}</span>}
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
