import { useState } from 'react';
import type { Data, Note } from '../lib/types';
import { timeAgo } from '../lib/dates';

interface Props { data: Data; onOpen: (id: string) => void; onNew: () => void }

/** First non-empty line is the title; the rest keeps its line breaks. */
export function splitNote(text: string): { title: string; body: string } {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.trim());
  if (i < 0) return { title: '', body: '' };
  return { title: lines[i].trim(), body: lines.slice(i + 1).join('\n').replace(/^\s*\n|\s+$/g, '') };
}

export default function Notes({ data, onOpen, onNew }: Props) {
  const [q, setQ] = useState('');
  const notes = data.notes
    .filter((n) => !n.deleted && n.text.trim())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const needle = q.trim().toLowerCase();
  const shown = needle ? notes.filter((n) => n.text.toLowerCase().includes(needle)) : notes;

  const row = (n: Note) => {
    const { title, body } = splitNote(n.text);
    return (
      <button key={n.id} type="button" className="nt" onClick={() => onOpen(n.id)}>
        <span className="nt-d">{timeAgo(n.updatedAt)}</span>
        {/* Shown in full up to 5 lines; longer notes end with "…" */}
        <span className="nt-x"><b>{title}</b>{body && `\n${body}`}</span>
      </button>
    );
  };

  return (
    <main className="view notes">
      {notes.length > 4 && (
        <input
          className="search"
          type="search"
          placeholder="Search notes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search notes"
        />
      )}
      {notes.length === 0 && <p className="empty">No notes yet. Jot down anything: ideas, things to remember, what someone told you.</p>}
      {notes.length > 0 && shown.length === 0 && <p className="empty">No note matches “{q.trim()}”.</p>}
      <div className="nlist">{shown.map(row)}</div>
      <button type="button" className="newg newn" onClick={onNew}>+ New note</button>
    </main>
  );
}
