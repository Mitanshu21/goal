import { useRef } from 'react';
import { connectOrResume, disconnect, syncNow, type SyncStatus } from '../lib/sync';
import { getData, importData } from '../lib/store';
import { timeAgo, todayKey } from '../lib/dates';
import Sheet from './Sheet';
import type { ShowToast } from '../App';

export default function SyncSheet({ status, onClose, toast }: { status: SyncStatus; onClose: () => void; toast: ShowToast }) {
  const file = useRef<HTMLInputElement>(null);
  const s = status.state;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `goal-app-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (f: File) => {
    try {
      importData(JSON.parse(await f.text()));
      toast({ text: 'Backup imported and merged' });
    } catch {
      toast({ text: 'That file is not a valid backup' });
    }
  };

  const text: Record<SyncStatus['state'], string> = {
    'no-setup': 'Google Drive is not set up for this copy of the app yet. Add VITE_GOOGLE_CLIENT_ID (see README) and redeploy.',
    off: 'Your data is saved on this device only. Connect Google Drive to back it up automatically and use it on your phone and computer.',
    idle: status.pending ? 'Saving your latest changes…' : `Backed up${status.lastSync ? ' ' + timeAgo(status.lastSync) : ''}.`,
    syncing: 'Syncing with Google Drive…',
    offline: "You're offline. Everything is saved on this device and will sync when you're back online.",
    'needs-auth': 'Google needs a quick confirmation to keep syncing. Your changes are safe on this device.',
    error: status.message || 'Something went wrong while syncing.',
  };

  return (
    <Sheet label="Backup and sync" onClose={onClose}>
      <h3>Backup & sync</h3>
      {status.user && status.connected && <p className="sm">Google Drive · {status.user}</p>}
      <p className={`say ${s === 'error' ? 'bad' : ''}`}>{text[s]}</p>

      {s !== 'no-setup' && !status.connected && (
        <button type="button" className="btn" onClick={connectOrResume} data-no-autoauth>Connect Google Drive</button>
      )}
      {status.connected && (s === 'needs-auth' || s === 'error') && (
        <button type="button" className="btn" onClick={connectOrResume} data-no-autoauth>Continue syncing</button>
      )}
      {status.connected && (s === 'idle' || s === 'offline') && (
        <button type="button" className="btn soft" onClick={() => void syncNow()} disabled={s === 'offline'}>Sync now</button>
      )}

      {status.connected && (
        <p className="sm">
          Files are in My Drive › <b>Goal App</b>: <code>goal-app-data.json</code> plus a daily copy in <b>Backups</b> (the last 30 days are kept). The app can only see files it created.
        </p>
      )}

      <h4 className="lab"><span>Manual backup</span></h4>
      <div className="row2">
        <button type="button" className="btn soft" onClick={exportJson}>Export file</button>
        <button type="button" className="btn soft" onClick={() => file.current?.click()}>Import file</button>
      </div>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />

      {status.connected && (
        <button type="button" className="btn danger" onClick={() => { disconnect(); toast({ text: 'Disconnected. Data stays on this device.' }); }}>
          Disconnect Google Drive
        </button>
      )}
      <button type="button" className="btn link" onClick={onClose}>Close</button>
    </Sheet>
  );
}
