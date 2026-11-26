import { useState, type FormEvent } from 'react';
import { parseTask, parsedChips } from '../lib/parse';
import { addTask } from '../lib/store';

/** The always-there input at the bottom of Today. */
export default function Composer({ today }: { today: string }) {
  const [v, setV] = useState('');
  const chips = parsedChips(v, today);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const raw = v.trim();
    if (!raw) return;
    const p = parseTask(raw, today);
    const title = p.title || raw;
    addTask({ title: title.charAt(0).toUpperCase() + title.slice(1), due: p.due ?? today, time: p.time, repeat: p.repeat });
    setV('');
  };

  return (
    <form className="composer" onSubmit={submit} autoComplete="off">
      <div className="hintl" aria-live="polite">
        {chips.length ? chips.map((c) => <span key={c}>{c}</span>) : 'Try “Call mom tomorrow 6pm” or “… every sunday”'}
      </div>
      <div className="cbox">
        <input
          id="new-task"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Add a task…"
          aria-label="Add a task"
          enterKeyHint="done"
        />
        <button className="send" type="submit" aria-label="Add task" disabled={!v.trim()}>↑</button>
      </div>
    </form>
  );
}
