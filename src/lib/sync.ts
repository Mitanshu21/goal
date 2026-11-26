import { useSyncExternalStore } from 'react';
import * as drive from './drive';
import * as cal from './calendar';
import { getData, replaceFromSync, setOnLocalChange, updateSettings } from './store';
import { mergeData, normalize, sameData } from './merge';
import { todayKey } from './dates';
import type { Data } from './types';

/*
 * Sync with Google Drive:
 *   My Drive / Goal App / goal-app-data.json      ← the live data, merged both ways
 *   My Drive / Goal App / Backups / backup-YYYY-MM-DD.json  ← one snapshot a day, last 30 kept
 *
 * Runs on start, 2.5 s after any change, when the app comes back to the
 * foreground, when the device goes back online, and every 5 minutes.
 */

export type SyncState = 'no-setup' | 'off' | 'idle' | 'syncing' | 'offline' | 'needs-auth' | 'error';
export interface SyncStatus {
  state: SyncState;
  connected: boolean;
  lastSync: string | null;
  user: string | null;
  message: string | null;
  pending: boolean; // local changes not yet uploaded
  /** Phone reminders: 'ask' = turned on, but this device still needs Google's OK. */
  calendar: 'off' | 'on' | 'ask' | 'error';
  calMessage: string | null;
}

const FILE = 'goal-app-data.json';
const LS = { connected: 'gd_connected', ids: 'gd_ids', last: 'gd_lastSync', backup: 'gd_lastBackup', user: 'gd_user' } as const;
const KEEP_BACKUPS = 30;

let status: SyncStatus = {
  state: 'off',
  connected: localStorage.getItem(LS.connected) === '1',
  lastSync: localStorage.getItem(LS.last),
  user: localStorage.getItem(LS.user),
  message: null,
  pending: false,
  calendar: 'off',
  calMessage: null,
};
const subs = new Set<() => void>();
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
const setStatus = (p: Partial<SyncStatus>) => { status = { ...status, ...p }; subs.forEach((f) => f()); };
export const useSync = () => useSyncExternalStore(subscribe, () => status);

interface Ids { folder?: string; file?: string | null; backups?: string }
const readIds = (): Ids => { try { return JSON.parse(localStorage.getItem(LS.ids) || '{}') as Ids; } catch { return {}; } };
const saveIds = (v: Ids) => localStorage.setItem(LS.ids, JSON.stringify(v));

let running = false;
let again = false;
let timer = 0;
let armed = false;
let autoFailed = false;

export async function syncNow(): Promise<void> {
  if (!drive.hasClientId()) return setStatus({ state: 'no-setup' });
  if (!status.connected) return setStatus({ state: 'off' });
  if (!navigator.onLine) return setStatus({ state: 'offline' });
  if (!drive.getToken()) { setStatus({ state: 'needs-auth' }); armGesture(); return; }
  if (running) { again = true; return; }

  running = true;
  setStatus({ state: 'syncing', message: null });
  try {
    await doSync();
    await calendarStep();
    const t = new Date().toISOString();
    localStorage.setItem(LS.last, t);
    setStatus({ state: 'idle', lastSync: t, pending: false });
  } catch (e) {
    if (e instanceof drive.AuthError) { setStatus({ state: 'needs-auth' }); armGesture(); }
    else setStatus({ state: navigator.onLine ? 'error' : 'offline', message: (e as Error).message });
  } finally {
    running = false;
    if (again) { again = false; void syncNow(); }
  }
}

async function doSync(retry = true): Promise<void> {
  const ids = readIds();
  if (!ids.folder) { ids.folder = await drive.ensureFolder('Goal App'); saveIds(ids); }
  if (ids.file === undefined || ids.file === null) { ids.file = await drive.findByName(FILE, ids.folder); saveIds(ids); }

  let remote: Data | null = null;
  if (ids.file) {
    try {
      remote = normalize(await drive.readJson(ids.file));
    } catch (e) {
      // File or folder was deleted in Drive: forget the ids and start again once.
      if (e instanceof drive.HttpError && e.status === 404 && retry) { saveIds({}); return doSync(false); }
      throw e;
    }
  }

  const local = getData();
  const merged = remote ? mergeData(local, remote) : local;
  if (!sameData(merged, local)) replaceFromSync(merged);

  if (!ids.file) { ids.file = await drive.createJson(FILE, ids.folder, merged); saveIds(ids); }
  else if (!remote || !sameData(merged, remote)) await drive.updateJson(ids.file, merged);

  await dailyBackup(ids, merged);
}

async function dailyBackup(ids: Ids, d: Data) {
  const today = todayKey();
  if (localStorage.getItem(LS.backup) === today) return;
  if (!ids.backups) { ids.backups = await drive.ensureFolder('Backups', ids.folder); saveIds(ids); }
  const name = `backup-${today}.json`;
  const existing = await drive.findByName(name, ids.backups);
  if (existing) await drive.updateJson(existing, d);
  else await drive.createJson(name, ids.backups, d);
  const old = (await drive.listChildren(ids.backups))
    .filter((f) => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(f.name))
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(KEEP_BACKUPS);
  for (const f of old) await drive.deleteFile(f.id).catch(() => {});
  localStorage.setItem(LS.backup, today);
}

async function calendarStep() {
  const s = getData().settings;
  drive.setWantCalendar(s.calendar);
  if (!s.calendar) { cal.forgetPushed(); return setStatus({ calendar: 'off', calMessage: null }); }
  if (!drive.hasCalendarScope()) return setStatus({ calendar: 'ask', calMessage: null });
  try {
    await cal.syncCalendar(getData(), todayKey());
    setStatus({ calendar: 'on', calMessage: null });
  } catch (e) {
    if (e instanceof drive.AuthError) throw e;
    if (e instanceof cal.CalendarGone) {
      updateSettings({ calendar: false, calendarId: null });
      return setStatus({ calendar: 'off', calMessage: 'The Goals calendar was deleted in Google Calendar, so reminders were turned off.' });
    }
    if (e instanceof drive.HttpError && e.status === 403) return setStatus({ calendar: 'ask', calMessage: null });
    setStatus({ calendar: 'error', calMessage: (e as Error).message });
  }
}

/** Call from a button tap: asks Google for calendar access and makes the Goals calendar. */
export function enableCalendar(): Promise<void> {
  drive.setWantCalendar(true);
  setStatus({ calMessage: null });
  return drive.requestToken(false, status.user)
    .then(async () => {
      if (!drive.hasCalendarScope()) throw new Error('Calendar access was not allowed, so reminders are still off.');
      const id = getData().settings.calendarId ?? (await cal.createCalendar());
      updateSettings({ calendar: true, calendarId: id });
      setStatus({ calendar: 'on' });
      await syncNow();
    })
    .catch((e: Error) => {
      drive.setWantCalendar(getData().settings.calendar);
      setStatus({ calendar: getData().settings.calendar ? 'ask' : 'off', calMessage: e.message });
    });
}

/** Turns reminders off everywhere and deletes the Goals calendar. */
export async function disableCalendar(): Promise<void> {
  const id = getData().settings.calendarId;
  updateSettings({ calendar: false, calendarId: null });
  drive.setWantCalendar(false);
  setStatus({ calendar: 'off', calMessage: null });
  cal.forgetPushed();
  if (id && drive.getToken() && drive.hasCalendarScope()) {
    await cal.deleteCalendar(id).catch((e: Error) => setStatus({ calMessage: `Could not delete the Goals calendar: ${e.message}` }));
  }
}

/**
 * Google tokens last about an hour and a web app can't refresh them in the
 * background. When one runs out we wait for your next tap anywhere in the app
 * and quietly ask Google for a new one (a small window may flash).
 */
function armGesture() {
  if (armed || autoFailed) return;
  if (!drive.gisReady()) {
    drive.loadGis().then(() => { if (status.state === 'needs-auth') armGesture(); }).catch(() => {});
    return;
  }
  armed = true;
  const onTap = (e: Event) => {
    if ((e.target as HTMLElement | null)?.closest?.('[data-no-autoauth]')) return;
    document.removeEventListener('click', onTap, true);
    armed = false;
    drive.requestToken(false, status.user)
      .then(() => syncNow())
      .catch(() => { autoFailed = true; setStatus({ state: 'needs-auth' }); });
  };
  document.addEventListener('click', onTap, true);
}

/** Call from a button tap. Connects the first time, re-confirms later. */
export function connectOrResume() {
  if (!drive.hasClientId()) return setStatus({ state: 'no-setup' });
  if (!drive.gisReady()) {
    setStatus({ state: 'error', message: 'Google sign-in is still loading. Try again in a moment.' });
    drive.loadGis().catch((e: Error) => setStatus({ state: 'error', message: e.message }));
    return;
  }
  const first = !status.connected;
  drive.requestToken(first, status.user)
    .then(async () => {
      autoFailed = false;
      localStorage.setItem(LS.connected, '1');
      setStatus({ connected: true, message: null });
      if (first || !status.user) {
        try {
          const u = await drive.getUser();
          const name = u.emailAddress || u.displayName || null;
          if (name) { localStorage.setItem(LS.user, name); setStatus({ user: name }); }
        } catch { /* not important */ }
      }
      await syncNow();
    })
    .catch((e: Error) => setStatus({ state: status.connected ? 'needs-auth' : 'off', message: e.message }));
}

export function disconnect() {
  drive.signOut();
  cal.forgetPushed();
  for (const k of [LS.connected, LS.ids, LS.user, LS.backup, LS.last]) localStorage.removeItem(k);
  setStatus({ connected: false, state: 'off', user: null, lastSync: null, message: null });
}

export function startSync() {
  const s = getData().settings;
  drive.setWantCalendar(s.calendar);
  if (s.calendar) setStatus({ calendar: drive.hasCalendarScope() ? 'on' : 'ask' });
  setOnLocalChange(() => {
    if (status.connected) setStatus({ pending: true });
    clearTimeout(timer);
    timer = window.setTimeout(() => void syncNow(), 2500);
  });
  if (!drive.hasClientId()) return setStatus({ state: 'no-setup' });
  drive.loadGis().catch(() => {});
  if (status.connected) void syncNow();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !status.connected) return;
    const last = status.lastSync ? Date.parse(status.lastSync) : 0;
    if (Date.now() - last > 60_000) void syncNow();
  });
  window.addEventListener('online', () => { if (status.connected) void syncNow(); });
  window.addEventListener('offline', () => { if (status.connected) setStatus({ state: 'offline' }); });
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && status.connected && drive.getToken()) void syncNow();
  }, 5 * 60_000);
}
