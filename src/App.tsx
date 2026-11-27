import { useCallback, useEffect, useRef, useState } from 'react';
import { useData, useLoaded } from './lib/store';
import { useSync } from './lib/sync';
import { activeGoals, goalInfo } from './lib/goals';
import { fmtLong, isoToKey, todayKey } from './lib/dates';
import Today from './components/Today';
import Goals from './components/Goals';
import Composer from './components/Composer';
import SyncButton from './components/SyncButton';
import TaskSheet from './components/TaskSheet';
import GoalSheet from './components/GoalSheet';
import NewGoalSheet from './components/NewGoalSheet';
import YearSheet from './components/YearSheet';
import SyncSheet from './components/SyncSheet';
import HistorySheet from './components/HistorySheet';
import Notes from './components/Notes';
import NoteSheet from './components/NoteSheet';
import DeletedNotesSheet from './components/DeletedNotesSheet';
import { addNote } from './lib/store';

export type Tab = 'today' | 'goals' | 'notes';
const TABS: Tab[] = ['today', 'goals', 'notes'];
export type SheetState =
  | { type: 'task'; id: string }
  | { type: 'goal'; id: string }
  | { type: 'new' }
  | { type: 'year' }
  | { type: 'sync' }
  | { type: 'history' }
  | { type: 'note'; id: string; isNew: boolean }
  | { type: 'deletedNotes' }
  | null;
export interface ToastMsg { text: string; undo?: () => void }
export type ShowToast = (t: ToastMsg) => void;

/** Today's date key, refreshed after midnight and when the app is reopened. */
function useToday() {
  const [t, setT] = useState(todayKey);
  useEffect(() => {
    const check = () => setT((prev) => (prev === todayKey() ? prev : todayKey()));
    const id = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check); };
  }, []);
  return t;
}

export default function App() {
  const data = useData();
  const loaded = useLoaded();
  const sync = useSync();
  const today = useToday();
  const [tab, setTabState] = useState<Tab>(() => {
    const t = localStorage.getItem('tab') as Tab | null;
    return t && TABS.includes(t) ? t : 'today';
  });
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const toastTimer = useRef(0);

  const [slide, setSlide] = useState<'from-right' | 'from-left' | null>(null);
  const setTab = (t: Tab) => {
    if (t === tab) return;
    setSlide(TABS.indexOf(t) > TABS.indexOf(tab) ? 'from-right' : 'from-left');
    setTabState(t);
    localStorage.setItem('tab', t);
  };

  // Swipe left/right anywhere on the page to switch between Today and Goals.
  const appRef = useRef<HTMLDivElement>(null);
  const swipeState = useRef({ tab, sheetOpen: false });
  swipeState.current = { tab, sheetOpen: sheet !== null };
  const setTabRef = useRef(setTab);
  setTabRef.current = setTab;
  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (e.touches.length !== 1 || swipeState.current.sheetOpen || target.closest('input, textarea, select, .composer, [data-no-swipe]')) {
        start = null;
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      const quick = Date.now() - start.t < 700;
      start = null;
      if (!quick || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const next = TABS[TABS.indexOf(swipeState.current.tab) + (dx < 0 ? 1 : -1)];
      if (next) setTabRef.current(next);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); };
  }, []);
  const showToast = useCallback<ShowToast>((t) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);
  const close = useCallback(() => setSheet(null), []);

  const tasks = data.tasks.filter((t) => !t.deleted);
  const left = tasks.filter((t) => !t.doneAt && t.due <= today).length;
  const doneToday = tasks.filter((t) => t.doneAt && isoToKey(t.doneAt) === today).length;
  const goals = activeGoals(data);
  const off = goals.filter((g) => goalInfo(g, data, today).tone !== 'good').length;

  const noteCount = data.notes.filter((n) => !n.deleted && n.text.trim()).length;
  const sub = tab === 'today'
    ? `${fmtLong(today)} · ${left} left · ${doneToday} done`
    : tab === 'notes'
      ? noteCount ? `${noteCount} note${noteCount === 1 ? '' : 's'}` : 'No notes yet'
      : goals.length ? `${goals.length - off} on track · ${off} need${off === 1 ? 's' : ''} attention` : 'No goals yet';

  return (
    <div className="app" ref={appRef} data-slide={slide ?? undefined}>
      <header className="hdr">
        <div className="hrow">
          <nav className="sw" role="tablist" aria-label="Sections">
            <button type="button" role="tab" aria-selected={tab === 'today'} onClick={() => setTab('today')}>Today</button>
            <button type="button" role="tab" aria-selected={tab === 'goals'} onClick={() => setTab('goals')}>
              Goals{off > 0 && <i className="dot" aria-label={`${off} need attention`} />}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'notes'} onClick={() => setTab('notes')}>Notes</button>
          </nav>
          <SyncButton status={sync} onClick={() => setSheet({ type: 'sync' })} />
        </div>
        <div className="sub">{loaded ? sub : ' '}</div>
      </header>

      {tab === 'notes' && (
        <Notes
          data={data}
          onOpen={(id) => setSheet({ type: 'note', id, isNew: false })}
          onNew={() => setSheet({ type: 'note', id: addNote().id, isNew: true })}
          onDeleted={() => setSheet({ type: 'deletedNotes' })}
        />
      )}
      {tab === 'notes' ? null : tab === 'today'
        ? <Today data={data} today={today} onOpenTask={(id) => setSheet({ type: 'task', id })} onHistory={() => setSheet({ type: 'history' })} toast={showToast} />
        : <Goals data={data} today={today} onOpenGoal={(id) => setSheet({ type: 'goal', id })} onNew={() => setSheet({ type: 'new' })} onYear={() => setSheet({ type: 'year' })} />}

      {tab === 'today' && <Composer today={today} />}

      {sheet?.type === 'task' && <TaskSheet id={sheet.id} data={data} today={today} onClose={close} />}
      {sheet?.type === 'goal' && <GoalSheet id={sheet.id} data={data} today={today} onClose={close} toast={showToast} />}
      {sheet?.type === 'new' && <NewGoalSheet today={today} onClose={close} onCreated={() => { close(); setTab('goals'); }} />}
      {sheet?.type === 'year' && <YearSheet data={data} today={today} onClose={close} />}
      {sheet?.type === 'note' && <NoteSheet key={sheet.id} id={sheet.id} isNew={sheet.isNew} data={data} onClose={close} />}
      {sheet?.type === 'deletedNotes' && <DeletedNotesSheet data={data} onClose={close} />}
      {sheet?.type === 'history' && <HistorySheet data={data} today={today} onClose={close} />}
      {sheet?.type === 'sync' && <SyncSheet status={sync} onClose={close} toast={showToast} />}

      {toast && (
        <div className={`toast ${tab === 'today' && !sheet ? 'up' : ''}`} role="status">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" onClick={() => { toast.undo!(); setToast(null); }}>Undo</button>}
        </div>
      )}
    </div>
  );
}
