import type { Data, Task } from '../lib/types';
import { addDays, fmtTime, whenLabel } from '../lib/dates';
import { toggleTask, updateTask } from '../lib/store';
import type { ShowToast } from '../App';

interface Props {
  task: Task;
  data: Data;
  today: string;
  compact?: boolean; // inside a goal sheet: no goal name, no reschedule button
  onOpen?: () => void;
  toast?: ShowToast;
}

export default function TaskLine({ task, data, today, compact, onOpen, toast }: Props) {
  const late = !task.doneAt && task.due < today;
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
      {right && <span className="rt">{right}</span>}
      {late && !compact && (
        <button type="button" className="mv" onClick={() => updateTask(task.id, { due: addDays(today, 1) })}>Tomorrow</button>
      )}
    </div>
  );
}
