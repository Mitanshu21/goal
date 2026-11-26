import { useSyncExternalStore } from 'react';
import { get, set } from 'idb-keyval';
import type { Data, Goal, GoalKind, Log, Repeat, Task } from './types';
import { addDays, diffDays, isoToKey, nowISO, todayKey } from './dates';
import { emptyData, mergeData, normalize } from './merge';

/*
 * Local-first store. Everything is kept in memory, written to IndexedDB on
 * every change, and the sync module is told so it can push to Google Drive.
 */

const KEY = 'goal-app-data';
let data: Data = emptyData();
let loaded = false;
const subs = new Set<() => void>();
let onLocalChange: (() => void) | null = null;

export const setOnLocalChange = (fn: () => void) => { onLocalChange = fn; };
export const getData = () => data;
export const isLoaded = () => loaded;
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
const emit = () => subs.forEach((f) => f());
export const useData = () => useSyncExternalStore(subscribe, getData);
export const useLoaded = () => useSyncExternalStore(subscribe, isLoaded);

function commit(next: Data, local = true) {
  data = next;
  set(KEY, next).catch((e) => console.error('Could not save locally', e));
  emit();
  if (local) onLocalChange?.();
}

/** Drop tombstones older than 90 days so the file doesn't grow forever. */
function purge(d: Data): Data {
  const cut = new Date(Date.now() - 90 * 864e5).toISOString();
  const keep = <T extends { deleted?: boolean; updatedAt: string }>(a: T[]) => a.filter((x) => !x.deleted || x.updatedAt > cut);
  return { ...d, tasks: keep(d.tasks), goals: keep(d.goals), logs: keep(d.logs) };
}

export async function loadLocal() {
  try {
    const d = await get(KEY);
    if (d) data = purge(normalize(d));
  } catch (e) {
    console.error('Could not read local data', e);
  }
  loaded = true;
  emit();
}

export const replaceFromSync = (d: Data) => commit(d, false);
export const importData = (d: unknown) => commit(mergeData(data, normalize(d)));

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const stamp = () => { const t = nowISO(); return { createdAt: t, updatedAt: t }; };
function patchIn<T extends { id: string; updatedAt: string }>(arr: T[], id: string, p: Partial<T>): T[] {
  const t = nowISO();
  return arr.map((x) => (x.id === id ? { ...x, ...p, updatedAt: t } : x));
}

// ---------- tasks ----------

export function addTask(t: { title: string; due: string; time?: string | null; repeat?: Repeat; goalId?: string | null }): Task {
  const task: Task = {
    id: uid(), ...stamp(), title: t.title, due: t.due, time: t.time ?? null, repeat: t.repeat ?? null,
    goalId: t.goalId ?? null, doneAt: null, nextId: null,
  };
  commit({ ...data, tasks: [...data.tasks, task] });
  return task;
}

export const updateTask = (id: string, p: Partial<Task>) => commit({ ...data, tasks: patchIn(data.tasks, id, p) });
export const deleteTask = (id: string) => updateTask(id, { deleted: true });

/** Ticks or unticks a task. Ticking a repeating task creates the next one. */
export function toggleTask(id: string): { done: boolean; next: Task | null } {
  const t = data.tasks.find((x) => x.id === id);
  if (!t) return { done: false, next: null };
  const now = nowISO();

  if (!t.doneAt) {
    let tasks = data.tasks;
    let next: Task | null = null;
    if (t.repeat && !t.nextId) {
      const step = t.repeat === 'daily' ? 1 : 7;
      const today = todayKey();
      let due = addDays(t.due, step);
      while (diffDays(today, due) <= 0) due = addDays(due, step);
      next = { id: uid(), ...stamp(), title: t.title, due, time: t.time, repeat: t.repeat, goalId: t.goalId, doneAt: null, nextId: null };
      tasks = [...tasks, next];
    }
    tasks = tasks.map((x) => (x.id === id ? { ...x, doneAt: now, nextId: next?.id ?? x.nextId, updatedAt: now } : x));
    commit({ ...data, tasks });
    return { done: true, next };
  }

  let tasks = data.tasks.map((x) => (x.id === id ? { ...x, doneAt: null, nextId: null, updatedAt: now } : x));
  if (t.nextId) tasks = tasks.map((x) => (x.id === t.nextId && !x.doneAt ? { ...x, deleted: true, updatedAt: now } : x));
  commit({ ...data, tasks });
  return { done: false, next: null };
}

// ---------- goals ----------

export function addGoal(g: { title: string; kind: GoalKind; target: number; end: string | null }, alreadySaved = 0): Goal {
  const goal: Goal = { id: uid(), ...stamp(), title: g.title, kind: g.kind, target: g.target, start: todayKey(), end: g.end, completedAt: null };
  let logs = data.logs;
  if (alreadySaved > 0) logs = [...logs, { id: uid(), ...stamp(), goalId: goal.id, at: nowISO(), amount: alreadySaved }];
  commit({ ...data, goals: [...data.goals, goal], logs });
  return goal;
}

export const updateGoal = (id: string, p: Partial<Goal>) => commit({ ...data, goals: patchIn(data.goals, id, p) });
export const completeGoal = (id: string) => updateGoal(id, { completedAt: nowISO() });
export const reopenGoal = (id: string) => updateGoal(id, { completedAt: null });
export const deleteGoal = (id: string) => updateGoal(id, { deleted: true });

// ---------- logs ----------

export function addLog(goalId: string, amount = 1) {
  const l: Log = { id: uid(), ...stamp(), goalId, at: nowISO(), amount };
  commit({ ...data, logs: [...data.logs, l] });
}

export function undoLastLog(goalId: string) {
  const last = data.logs.filter((l) => l.goalId === goalId && !l.deleted).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  if (last) commit({ ...data, logs: patchIn(data.logs, last.id, { deleted: true }) });
}

/** For "do it often" goals: one tap logs today, the next tap removes it. */
export function toggleToday(goalId: string) {
  const today = todayKey();
  const mine = data.logs.filter((l) => l.goalId === goalId && !l.deleted && isoToKey(l.at) === today);
  if (!mine.length) return addLog(goalId, 1);
  let logs = data.logs;
  for (const l of mine) logs = patchIn(logs, l.id, { deleted: true });
  commit({ ...data, logs });
}
