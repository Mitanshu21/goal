import { useState } from 'react';
import type { Data, Repeat } from '../lib/types';
import { addDays } from '../lib/dates';
import { repeatLabel } from '../lib/parse';
import { deleteTask, updateTask } from '../lib/store';
import { activeGoals } from '../lib/goals';
import Sheet from './Sheet';

export default function TaskSheet({ id, data, today, onClose }: { id: string; data: Data; today: string; onClose: () => void }) {
  const task = data.tasks.find((t) => t.id === id && !t.deleted);
  const [title, setTitle] = useState(task?.title ?? '');
  const [confirm, setConfirm] = useState(false);
  if (!task) return null;

  const saveTitle = () => { const t = title.trim(); if (t && t !== task.title) updateTask(id, { title: t }); };
  const done = () => { saveTitle(); onClose(); };
  const goals = activeGoals(data).filter((g) => g.kind === 'tasks');
  const quick: [string, string][] = [['Today', today], ['Tomorrow', addDays(today, 1)], ['Next week', addDays(today, 7)]];
  const repeats: [string, Repeat][] = [['Never', null], ['Daily', 'daily'], [repeatLabel('weekly', task.due), 'weekly']];

  return (
    <Sheet label="Edit task" onClose={done}>
      <h3>Edit task</h3>
      <label className="field">
        <span>Task</span>
        <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} />
      </label>

      <div className="field">
        <span>When</span>
        <div className="chips">
          {quick.map(([l, d]) => (
            <button key={l} type="button" className="chip" aria-pressed={task.due === d} onClick={() => updateTask(id, { due: d })}>{l}</button>
          ))}
        </div>
        <div className="two">
          <input id="task-date" type="date" aria-label="Date" value={task.due} onChange={(e) => e.target.value && updateTask(id, { due: e.target.value })} />
          <input id="task-time" type="time" aria-label="Time" value={task.time ?? ''} onChange={(e) => updateTask(id, { time: e.target.value || null })} />
        </div>
      </div>

      <div className="field">
        <span>Repeat</span>
        <div className="chips">
          {repeats.map(([l, r]) => (
            <button key={l} type="button" className="chip" aria-pressed={task.repeat === r} onClick={() => updateTask(id, { repeat: r })}>{l}</button>
          ))}
        </div>
      </div>

      {goals.length > 0 && (
        <label className="field">
          <span>Counts toward a goal</span>
          <select id="task-goal" value={task.goalId ?? ''} onChange={(e) => updateTask(id, { goalId: e.target.value || null })}>
            <option value="">No goal</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </label>
      )}

      <button type="button" className="btn" onClick={done}>Done</button>
      <button type="button" className="btn danger" onClick={() => { if (!confirm) return setConfirm(true); deleteTask(id); onClose(); }}>
        {confirm ? 'Tap again to delete' : 'Delete task'}
      </button>
    </Sheet>
  );
}
