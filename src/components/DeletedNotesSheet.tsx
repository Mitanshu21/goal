import type { Data } from '../lib/types';
import { fmtLong, isoToKey } from '../lib/dates';
import { restoreNote } from '../lib/store';
import { splitNote } from './Notes';
import Sheet from './Sheet';

/** Every note you've deleted, newest first. Nothing is ever erased. */
export default function DeletedNotesSheet({ data, onClose }: { data: Data; onClose: () => void }) {
  const notes = data.notes
    .filter((n) => n.deleted && n.text.trim())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <Sheet label="Deleted notes" onClose={onClose}>
      <h3>Deleted notes</h3>
      <p className="sm">Kept forever. Restore one to put it back in your notes.</p>
      {notes.length === 0 && <p className="say">No deleted notes.</p>}
      <div className="nlist">
        {notes.map((n) => {
          const { title, body } = splitNote(n.text);
          return (
            <div key={n.id} className="nt gone">
              <span className="nt-d">
                Deleted {fmtLong(isoToKey(n.updatedAt))}
                <button type="button" className="restore" onClick={() => restoreNote(n.id)}>Restore</button>
              </span>
              <span className="nt-x"><b>{title}</b>{body && `\n${body}`}</span>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn link" onClick={onClose}>Close</button>
    </Sheet>
  );
}
