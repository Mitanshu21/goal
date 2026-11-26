import { useState } from 'react';
import type { Data, Task } from '../lib/types';
import { activeGoals, goalInfo } from '../lib/goals';
import { isoToKey } from '../lib/dates';
import TaskLine from './TaskLine';
import LogButton from './LogButton';
import type { ShowToast } from '../App';

interface Props { data: Data; today: string; onOpenTask: (id: string) => void; toast: ShowToast }

const byTime = (a: Task, b: Task) =>
  a.due.localeCompare(b.due) || (a.time ?? '99').localeCompare(b.time ?? '99') || a.createdAt.localeCompare(b.createdAt);

export default function Today({ data, today, onOpenTask, toast }: Props) {
  const [showDone, setShowDone] = useState(false);
  const tasks = data.tasks.filter((t) => !t.deleted);
  const open = tasks.filter((t) => !t.doneAt).sort(byTime);
  const late = open.filter((t) => t.due < today);
  const now = open.filter((t) => t.due === today);
  const later = open.filter((t) => t.due > today);
  const doneToday = tasks.filter((t) => t.doneAt && isoToKey(t.doneAt) === today).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!));
  const quick = activeGoals(data).filter((g) => g.kind === 'limit' || g.kind === 'freq');

  const line = (t: Task) => <TaskLine key={t.id} task={t} data={data} today={today} onOpen={() => onOpenTask(t.id)} toast={toast} />;
  const group = (name: string, list: Task[], cls = '') =>
    list.length > 0 && (
      <section>
        <h2 className={`lab ${cls}`}><span>{name}</span><span>{list.length}</span></h2>
        {list.map(line)}
      </section>
    );

  return (
    <main className="view">
      {quick.length > 0 && (
        <div className="quick">
          {quick.map((g) => {
            const i = goalInfo(g, data, today);
            const n = g.kind === 'limit' ? i.used : i.count;
            return (
              <div className="q" key={g.id}>
                <span className="ql">
                  <span className="qn">{g.title}</span>
                  <b>{n}<small> / {g.target}</small></b>
                  {i.tone !== 'good' && <span className={i.tone}>{i.status}</span>}
                </span>
                <LogButton goal={g} info={i} />
              </div>
            );
          })}
        </div>
      )}

      {late.length + now.length === 0 && (
        <p className="empty">
          {tasks.length === 0 ? 'No tasks yet. Type one below, like “Call mom tomorrow 6pm”.' : 'Nothing left for today.'}
        </p>
      )}
      {group('Late', late, 'late')}
      {group('Today', now)}
      {group('Later', later)}

      {doneToday.length > 0 && (
        <>
          <button type="button" className="more" onClick={() => setShowDone((s) => !s)}>
            {showDone ? 'Hide' : 'Show'} {doneToday.length} done today
          </button>
          {showDone && doneToday.map(line)}
        </>
      )}
    </main>
  );
}
