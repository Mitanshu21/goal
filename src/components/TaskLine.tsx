import type { Data, Task } from '../lib/types';
import { addDays, fmtTime, whenLabel } from '../lib/dates';
import { toggleTask, updateTask } from '../lib/store';
import type { ShowToast } from '../App';
import { isOverdue, useNowHM } from '../lib/clock';

const Clock = () => (
  <svg className="od" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 4.6V8l2.3 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

interface Props {
  task: Task;
  data: Data;
  today: string;
  compact?: boolean; // inside a goal sheet: no goal name, no reschedule button
  onOpen?: () => void;
  toast?: ShowToast;
}

export default function TaskLine({ task, data, today, compact, onOpen, toast }: Props) {
  const nowHM = useNowHM();
  const late = isOverdue(task, today, nowHM);
  const pastDay = late && task.due < today;
  const goal = task.goalId ? data.goals.find((g) => g.id === task.goalId && !g.deleted) : null;
  const right = [
    task.due !== today || compact ? whenLabel(task.due, today) : '',
    task.time ? fmtTime(task.time) : '',
    task.repeat ? '↻' : '',
  ].filter(Boolean).join(' · ');

  const tick = () => {
    const r = toggleTask(task.id);
    if (r.done && toast) {
      toast({
        text: `Done: ${task.title}${r.next ? ` · next ${whenLabel(r.next.due, today)}` : ''}`,
        undo: () => toggleTask(task.id),
      });
    }
  };

  return (
    <div className={`ln${late ? ' late' : ''}${task.doneAt ? ' done' : ''}`}>
      <button type="button" className="ck" onClick={tick} aria-label={`${task.doneAt ? 'Mark not done' : 'Mark done'}: ${task.title}`} />
      <button type="button" className="tx" onClick={onOpen} disabled={!onOpen}>
        {task.title}
        {goal && !compact && <small>{goal.title}</small>}
      </button>
      {(right || late) && <span className="rt">{late && <Clock />}{late && <span className="sr">Overdue: </span>}{right}</span>}
      {pastDay && !compact && (
        <button type="button" className="mv" onClick={() => updateTask(task.id, { due: addDays(today, 1) })}>Tomorrow</button>
      )}
    </div>
  );
}
