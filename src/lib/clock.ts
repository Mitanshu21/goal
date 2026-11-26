import { useSyncExternalStore } from 'react';

/** Current time as "HH:mm", shared by every component and updated each minute. */
const hm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
let now = hm();
const subs = new Set<() => void>();
const tick = () => { const n = hm(); if (n !== now) { now = n; subs.forEach((f) => f()); } };
setInterval(tick, 15_000);
document.addEventListener('visibilitychange', tick);

export const useNowHM = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => now);

/** Open, and either from an earlier day or due today at a time that has passed. */
export const isOverdue = (t: { doneAt: string | null; due: string; time: string | null }, today: string, nowHM: string) =>
  !t.doneAt && (t.due < today || (t.due === today && t.time !== null && t.time <= nowHM));
