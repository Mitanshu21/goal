import { useState } from 'react';
import type { GoalKind } from '../lib/types';
import { addDays, endOfMonthKey } from '../lib/dates';
import { addGoal } from '../lib/store';
import Sheet from './Sheet';

const KINDS: [GoalKind, string, string][] = [
  ['amount', 'Save money', 'Car, house, trip'],
  ['limit', 'Stay under', 'Smoke ≤ 10 a month'],
  ['freq', 'Do it often', 'Gym 4× a week'],
  ['tasks', 'Finish by a date', 'Course, project'],
];

export default function NewGoalSheet({ today, onClose, onCreated }: { today: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GoalKind>('amount');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [month, setMonth] = useState(addDays(today, 365).slice(0, 7));
  const [date, setDate] = useState(addDays(today, 30));
  const [error, setError] = useState('');

  const create = () => {
    const title = name.trim();
    const n = Number(target);
    if (!title) return setError('Give your goal a name.');
    if (kind !== 'tasks' && !(n > 0)) return setError(kind === 'amount' ? 'Enter the amount you want to save.' : 'Enter a number.');
    if (kind === 'amount' && (!month || endOfMonthKey(month) <= today)) return setError('Pick a month in the future.');
    if (kind === 'tasks' && (!date || date < today)) return setError('Pick a deadline from today on.');
    addGoal(
      {
        title,
        kind,
        target: kind === 'freq' ? Math.min(7, Math.round(n)) : kind === 'tasks' ? 0 : n,
        end: kind === 'amount' ? endOfMonthKey(month) : kind === 'tasks' ? date : null,
      },
      kind === 'amount' ? Number(saved) || 0 : 0,
    );
    onCreated();
  };

  return (
    <Sheet label="New goal" onClose={onClose}>
      <h3>New goal</h3>
      <label className="field">
        <span>Goal</span>
        <input id="goal-name" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="e.g. Buy a car" />
      </label>
      <div className="field">
        <span>What kind?</span>
        <div className="kinds">
          {KINDS.map(([k, b, s]) => (
            <button key={k} type="button" className="kind" aria-pressed={kind === k} onClick={() => { setKind(k); setTarget(''); setError(''); }}>
              <b>{b}</b><span>{s}</span>
            </button>
          ))}
        </div>
      </div>

      {kind === 'amount' && (
        <>
          <label className="field"><span>Amount to save (₹)</span><input id="goal-target" type="number" min="1" inputMode="numeric" placeholder="400000" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          <div className="two">
            <label className="field"><span>Already saved (₹)</span><input id="goal-saved" type="number" min="0" inputMode="numeric" placeholder="0" value={saved} onChange={(e) => setSaved(e.target.value)} /></label>
            <label className="field"><span>By</span><input id="goal-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
          </div>
        </>
      )}
      {kind === 'limit' && (
        <label className="field"><span>At most</span>
          <span className="inl"><input id="goal-target" type="number" min="1" inputMode="numeric" placeholder="10" value={target} onChange={(e) => setTarget(e.target.value)} /> per month</span>
        </label>
      )}
      {kind === 'freq' && (
        <label className="field"><span>How often</span>
          <span className="inl"><input id="goal-target" type="number" min="1" max="7" inputMode="numeric" placeholder="4" value={target} onChange={(e) => setTarget(e.target.value)} /> times a week</span>
        </label>
      )}
      {kind === 'tasks' && (
        <>
          <label className="field"><span>Deadline</span><input id="goal-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <p className="sm">After creating it, add tasks to this goal from its page or when you edit a task.</p>
        </>
      )}

      {error && <p className="err" role="alert">{error}</p>}
      <button type="button" className="btn" onClick={create}>Create goal</button>
      <button type="button" className="btn link" onClick={onClose}>Cancel</button>
    </Sheet>
  );
}
