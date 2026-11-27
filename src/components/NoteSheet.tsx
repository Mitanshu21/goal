import { useCallback, useEffect, useRef, useState } from 'react';
import type { Data } from '../lib/types';
import { deleteNote, updateNote } from '../lib/store';
import { timeAgo } from '../lib/dates';
import Sheet from './Sheet';

interface Props { id: string; data: Data; isNew: boolean; onClose: () => void }

/** Full-height editor. Saves as you type; an empty note is discarded on close. */
export default function NoteSheet({ id, data, isNew, onClose }: Props) {
  const note = data.notes.find((n) => n.id === id);
  const [text, setText] = useState(note?.text ?? '');
  const [sure, setSure] = useState(false);
  const latest = useRef(text);
  const timer = useRef(0);
  latest.current = text;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    updateNote(id, latest.current);
  }, [id]);

  // Never lose the last few keystrokes, however the editor goes away.
  useEffect(() => flush, [flush]);

  const close = useCallback(() => {
    flush();
    if (!latest.current.trim()) deleteNote(id); // don't keep empty notes
    onClose();
  }, [flush, id, onClose]);

  const change = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => updateNote(id, v), 500);
  };

  const remove = () => {
    if (!sure) return setSure(true);
    flush(); // keep the latest text, so Undo brings it back whole
    deleteNote(id);
    onClose();
  };

  if (!note) return null;
  return (
    <Sheet label="Note" onClose={close}>
      <div className="note-sheet">
        <div className="shead">
          <span className="sm note-meta">{isNew && !text ? 'New note' : `Edited ${timeAgo(note.updatedAt)}`}</span>
          <button type="button" className="btn link done-btn" onClick={close}>Done</button>
        </div>
        <textarea
          className="note-text"
          value={text}
          onChange={(e) => change(e.target.value)}
          placeholder={'Title on the first line\nthen anything you like…'}
          autoFocus={isNew}
          aria-label="Note text"
        />
        <button type="button" className="btn danger" onClick={remove} onBlur={() => setSure(false)}>
          {sure ? 'Tap again to delete' : 'Delete note'}
        </button>
      </div>
    </Sheet>
  );
}
