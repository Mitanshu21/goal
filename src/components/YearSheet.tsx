import type { Data } from '../lib/types';
import { goalStats } from '../lib/goals';
import { MON, fmtDate, fmtLong, isoToKey } from '../lib/dates';
import { reopenGoal, restoreGoal } from '../lib/store';
import Sheet from './Sheet';

export default function YearSheet({ data, today, onClose }: { data: Data; today: string; onClose: () => void }) {
  const s = goalStats(data, today);
  const done = [...s.done].sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const deleted = data.goals.filter((g) => g.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const inQ = (iso: string) => Math.floor(new Date(iso).getMonth() / 3) + 1 === s.quarter;
  return (
    <Sheet label={`${s.year}`} onClose={onClose}>
      <h3>{s.year}</h3>
      <p className="sm">{s.yDone} of {s.yTotal} goals done this year · {s.qDone} of {s.qTotal} in Q{s.quarter}</p>
      <h4 className="lab"><span>Completed</span><span>{done.length}</span></h4>
      {done.length === 0 && <p className="sm">No goals finished yet this year. Mark a goal complete from its page.</p>}
      {done.map((g) => (
        <div key={g.id} className="cg">
          <span>{g.title}</span>
          <span>
            {MON[new Date(g.completedAt!).getMonth()]}{inQ(g.completedAt!) ? ` · Q${s.quarter}` : ''}
            <button type="button" className="btn link tiny" onClick={() => reopenGoal(g.id)} title={`Reopen ${g.title}`}>Reopen</button>
          </span>
        </div>
      ))}
      {s.yDue.length > 0 && (
        <>
          <h4 className="lab"><span>Still to finish this year</span><span>{s.yDue.length}</span></h4>
          {s.yDue.map((g) => <div key={g.id} className="cg"><span>{g.title}</span><span>due {fmtDate(g.end!)}</span></div>)}
        </>
      )}
      {deleted.length > 0 && (
        <>
          <h4 className="lab"><span>Deleted goals</span><span>{deleted.length}</span></h4>
          {deleted.map((g) => (
            <div key={g.id} className="cg gone">
              <span>{g.title}</span>
              <span>
                deleted {fmtLong(isoToKey(g.updatedAt))}
                <button type="button" className="btn link tiny" onClick={() => restoreGoal(g.id)} title={`Restore ${g.title}`}>Restore</button>
              </span>
            </div>
          ))}
        </>
      )}
      <button type="button" className="btn soft" onClick={onClose}>Close</button>
    </Sheet>
  );
}
