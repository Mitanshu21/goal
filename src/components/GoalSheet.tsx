import { useState, type FormEvent } from 'react';
import type { Data, Goal } from '../lib/types';
import { goalInfo, type Info } from '../lib/goals';
import { DAY, daysInMonth, dowMon, fmtDate, fromKey, diffDays, endOfMonthKey } from '../lib/dates';
import { inr, lakh, plural } from '../lib/format';
import { parseTask } from '../lib/parse';
import { addLog, addTask, completeGoal, deleteGoal, toggleToday, undoLastLog, updateGoal } from '../lib/store';
import Sheet from './Sheet';
import TaskLine from './TaskLine';
import type { ShowToast } from '../App';

interface Props { id: string; data: Data; today: string; onClose: () => void; toast: ShowToast }

export default function GoalSheet({ id, data, today, onClose, toast }: Props) {
  const g = data.goals.find((x) => x.id === id && !x.deleted);
  const [editing, setEditing] = useState(false);
  if (!g) return null;
  const i = goalInfo(g, data, today);

  const finish = () => {
    completeGoal(g.id);
    onClose();
    toast({ text: `Goal complete: ${g.title}`, undo: () => updateGoal(g.id, { completedAt: null }) });
  };

  return (
    <Sheet label={g.title} onClose={onClose}>
      <div className="shead">
        <h3>{g.title}</h3>
        <button type="button" className="btn link" onClick={() => setEditing((e) => !e)}>{editing ? 'Cancel' : 'Edit'}</button>
      </div>

      {editing ? (
        <EditGoal goal={g} onDone={() => setEditing(false)} onDeleted={() => { deleteGoal(g.id); onClose(); }} />
      ) : (
        <>
          {g.kind === 'amount' && <Amount g={g} i={i} />}
          {g.kind === 'limit' && <Limit g={g} i={i} today={today} />}
          {g.kind === 'freq' && <Freq g={g} i={i} today={today} />}
          {g.kind === 'tasks' && <Tasks g={g} i={i} data={data} today={today} toast={toast} />}
          <button type="button" className="btn soft" onClick={onClose}>Close</button>
          <button type="button" className="btn link" onClick={finish}>Mark goal as complete</button>
        </>
      )}
    </Sheet>
  );
}

const Status = ({ i }: { i: Info }) => <span className={`stt ${i.tone}`}>{i.status}</span>;

function Amount({ g, i }: { g: Goal; i: Info }) {
  const [custom, setCustom] = useState('');
  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(custom.replace(/[^\d.-]/g, ''));
    if (n) { addLog(g.id, n); setCustom(''); }
  };
  const behind = (i.expected ?? 0) - (i.saved ?? 0);
  return (
    <>
      <p className="sm">Save {inr(g.target)} by {fmtDate(g.end!)}</p>
      <div className="bignum"><b>{inr(i.saved ?? 0)}</b><Status i={i} /></div>
      <div className="trk big"><i style={{ width: `${i.fill}%` }} /><u style={{ left: `${(i.pace ?? 0).toFixed(1)}%` }} /></div>
      <div className="scale"><span>{i.pct}% saved</span><span>should be {lakh(i.expected ?? 0)} by now</span></div>
      {i.status !== 'Reached' && (
        <p className="say">
          {behind > 0 && i.tone !== 'good' && <>You're <b>{inr(behind)} behind</b>. </>}
          Save <b>{inr(i.perMonth ?? 0)} a month</b> to reach {lakh(g.target)} by {fmtDate(g.end!)}.
        </p>
      )}
      <div className="row2">
        {[1000, 5000, 10000].map((a) => <button key={a} type="button" className="btn soft" onClick={() => addLog(g.id, a)}>+ {lakh(a)}</button>)}
      </div>
      <form className="inlineadd" onSubmit={add}>
        <input id="custom-amount" inputMode="numeric" placeholder="Other amount, e.g. 25000 or -2000" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Other amount" />
        <button type="submit" className="btn" disabled={!custom.trim()}>Add</button>
      </form>
    </>
  );
}

function Limit({ g, i, today }: { g: Goal; i: Info; today: string }) {
  const used = i.used ?? 0;
  const max = Math.max(1, ...(i.hist ?? []).map((h) => h.value), g.target);
  const daysLeft = daysInMonth(today) - fromKey(today).getDate();
  return (
    <>
      <p className="sm">At most {g.target} a month · a new month starts on the 1st</p>
      <div className="bignum"><b>{used}<small> / {g.target}</small></b><Status i={i} /></div>
      <div className="slots" aria-label={`${used} of ${g.target} used`}>
        {Array.from({ length: Math.max(g.target, used) }, (_, k) => <i key={k} className={k < used ? (k >= g.target ? 'over' : 'used') : ''} />)}
      </div>
      <p className="say">
        {used > g.target
          ? <>You're <b>{used - g.target} over</b> this month. A fresh month starts soon.</>
          : <><b>{i.left} left</b> for the last {plural(daysLeft, 'day')} of this month.</>}
        {(i.clean ?? 0) > 0 && <> You've gone <b>{plural(i.clean!, 'day')}</b> without one.</>}
      </p>
      <button type="button" className="btn" onClick={() => addLog(g.id, 1)}>+ Log one</button>
      {used > 0 && <button type="button" className="btn link" onClick={() => undoLastLog(g.id)}>Undo last</button>}
      <div className="hist" aria-label="Per month" hidden={(i.hist ?? []).length < 2}>
        {(i.hist ?? []).map((h, k, a) => (
          <div key={h.label + k} className={k === a.length - 1 ? 'cur' : ''}>
            <span>{h.label}</span><i style={{ width: `${(h.value / max) * 100}%` }} /><span>{h.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Freq({ g, i, today }: { g: Goal; i: Info; today: string }) {
  const dow = dowMon(today);
  const count = i.count ?? 0;
  const hits = (i.weeks ?? []).filter((v) => v >= g.target).length;
  return (
    <>
      <p className="sm">{plural(g.target, 'time')} a week</p>
      <div className="bignum"><b>{count}<small> / {g.target}</small></b><Status i={i} /></div>
      <div className="wk">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => (
          <span key={k} className={k === dow ? 'td' : ''}>{d}<i className={i.week?.[k] ? 'on' : ''} /></span>
        ))}
      </div>
      <p className="say">
        {count >= g.target ? 'Target hit this week. Nice work.' : <><b>{g.target - count} more</b> this week. {plural(6 - dow, 'day')} left after today.</>}
      </p>
      <button type="button" className="btn" onClick={() => toggleToday(g.id)}>
        {i.loggedToday ? `Logged today (${DAY[fromKey(today).getDay()]}) · tap to undo` : 'Log today'}
      </button>
      {(i.weeks ?? []).length > 0 && (
        <div className="hits">
          <span>Past weeks</span>
          {(i.weeks ?? []).map((v, k) => <i key={k} className={v >= g.target ? 'on' : ''} title={`${v} times`} />)}
          <span>{hits} of {i.weeks!.length} hit</span>
        </div>
      )}
    </>
  );
}

function Tasks({ g, i, data, today, toast }: { g: Goal; i: Info; data: Data; today: string; toast: ShowToast }) {
  const [v, setV] = useState('');
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!v.trim()) return;
    const p = parseTask(v.trim(), today);
    addTask({ title: p.title || v.trim(), due: p.due ?? today, time: p.time, repeat: p.repeat, goalId: g.id });
    setV('');
  };
  const list = [...(i.linked ?? [])].sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || a.due.localeCompare(b.due));
  return (
    <>
      <p className="sm">Due {fmtDate(g.end!)} · {plural(Math.max(0, diffDays(today, g.end!)), 'day')} left</p>
      <div className="bignum"><b>{i.pct}%</b><Status i={i} /></div>
      <div className="trk big"><i style={{ width: `${i.fill}%` }} /><u style={{ left: `${(i.pace ?? 0).toFixed(1)}%` }} /></div>
      <div className="scale"><span>{i.done} of {i.linked?.length ?? 0} tasks</span><span>{Math.round((i.elapsed ?? 0) * 100)}% of time used</span></div>
      <div>{list.map((t) => <TaskLine key={t.id} task={t} data={data} today={today} compact toast={toast} />)}</div>
      <form className="inlineadd" onSubmit={add}>
        <input id="goal-task" placeholder="Add a task for this goal…" value={v} onChange={(e) => setV(e.target.value)} aria-label="Add a task for this goal" />
        <button type="submit" className="btn" disabled={!v.trim()}>Add</button>
      </form>
    </>
  );
}

function EditGoal({ goal, onDone, onDeleted }: { goal: Goal; onDone: () => void; onDeleted: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [target, setTarget] = useState(String(goal.target));
  const [end, setEnd] = useState(goal.end ?? '');
  const [confirm, setConfirm] = useState(false);
  const targetLabel = goal.kind === 'amount' ? 'Amount to save (₹)' : goal.kind === 'limit' ? 'At most, per month' : goal.kind === 'freq' ? 'Times per week' : null;
  const save = () => {
    const t = Number(target);
    updateGoal(goal.id, {
      title: title.trim() || goal.title,
      ...(targetLabel && t > 0 ? { target: goal.kind === 'freq' ? Math.min(7, Math.round(t)) : t } : {}),
      ...(end && (goal.kind === 'amount' || goal.kind === 'tasks') ? { end: goal.kind === 'amount' && end.length === 7 ? endOfMonthKey(end) : end } : {}),
    });
    onDone();
  };
  return (
    <>
      <label className="field"><span>Name</span><input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      {targetLabel && <label className="field"><span>{targetLabel}</span><input id="edit-target" type="number" min="1" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} /></label>}
      {goal.kind === 'amount' && <label className="field"><span>By</span><input id="edit-end" type="month" value={end.slice(0, 7)} onChange={(e) => setEnd(e.target.value)} /></label>}
      {goal.kind === 'tasks' && <label className="field"><span>Deadline</span><input id="edit-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>}
      <button type="button" className="btn" onClick={save}>Save</button>
      <button type="button" className="btn danger" onClick={() => (confirm ? onDeleted() : setConfirm(true))}>
        {confirm ? 'Tap again to delete this goal' : 'Delete goal'}
      </button>
    </>
  );
}
