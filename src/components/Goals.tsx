import type { Data } from '../lib/types';
import { activeGoals, goalInfo, goalStats, rank } from '../lib/goals';
import { MON } from '../lib/dates';
import LogButton from './LogButton';

interface Props { data: Data; today: string; onOpenGoal: (id: string) => void; onNew: () => void; onYear: () => void }

export default function Goals({ data, today, onOpenGoal, onNew, onYear }: Props) {
  const s = goalStats(data, today);
  const list = activeGoals(data)
    .map((g) => ({ g, i: goalInfo(g, data, today) }))
    .sort((a, b) => rank[a.i.tone] - rank[b.i.tone] || a.g.createdAt.localeCompare(b.g.createdAt));

  return (
    <main className={`view goals ${list.length > 6 ? 'compact' : ''}`}>
      <button type="button" className="yr" onClick={onYear}>
        <span className="yl">
          <b>{s.yDone}</b> of {s.yTotal} done in {s.year} · <b>{s.qDone}</b> of {s.qTotal} this quarter
        </span>
        <span className="mo" aria-hidden="true">
          {MON.map((m, k) => (
            <span key={m} className={`${s.months[k] > 1 ? 'n2' : s.months[k] ? 'n1' : ''} ${k === s.month ? 'now' : k > s.month ? 'fut' : ''}`}>
              <i />{m[0]}
            </span>
          ))}
        </span>
      </button>

      {list.length === 0 && (
        <p className="empty">
          Add your first goal. It can be saving for a car, smoking at most 10 a month, going to the gym 4 times a week, or finishing something by a date.
        </p>
      )}

      {list.map(({ g, i }) => (
        <div
          key={g.id}
          className="gr"
          role="button"
          tabIndex={0}
          aria-label={`${g.title}: ${i.status}`}
          onClick={() => onOpenGoal(g.id)}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOpenGoal(g.id); } }}
        >
          <span className="gc">
            <span className="g1"><span className="gn">{g.title}</span><span className={`stt ${i.tone}`}>{i.status}</span></span>
            {g.kind === 'freq' ? (
              <span className="segt">{Array.from({ length: g.target }, (_, k) => <i key={k} className={k < (i.count ?? 0) ? 'on' : ''} />)}</span>
            ) : (
              <span className="trk">
                <i className={g.kind === 'limit' && i.tone !== 'good' ? i.tone : ''} style={{ width: `${i.fill}%` }} />
                {i.pace !== null && <u style={{ left: `calc(${Math.min(100, i.pace).toFixed(1)}% - 1px)` }} />}
              </span>
            )}
            <span className="g3">{i.line}</span>
          </span>
          {(g.kind === 'limit' || g.kind === 'freq') && <LogButton goal={g} info={i} />}
        </div>
      ))}

      <button type="button" className="newg" onClick={onNew}>+ New goal</button>
    </main>
  );
}
