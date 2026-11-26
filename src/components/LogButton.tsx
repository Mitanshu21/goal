import { useState } from 'react';
import type { Goal } from '../lib/types';
import type { Info } from '../lib/goals';
import { addLog, toggleToday } from '../lib/store';

/** The round + button that logs one cigarette / one gym day in a single tap. */
export default function LogButton({ goal, info }: { goal: Goal; info: Info }) {
  const [bump, setBump] = useState(0);
  const on = goal.kind === 'freq' && info.loggedToday;
  const tone = goal.kind === 'limit' && info.tone !== 'good' ? info.tone : '';
  const label = on ? `Undo today for ${goal.title}` : `Log one for ${goal.title}`;
  return (
    <button
      key={bump}
      type="button"
      className={`plusb ${on ? 'on' : tone} ${bump ? 'bump' : ''}`}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        if (goal.kind === 'freq') toggleToday(goal.id);
        else addLog(goal.id, 1);
        setBump((b) => b + 1);
      }}
    >
      {on ? '✓' : '+'}
    </button>
  );
}
