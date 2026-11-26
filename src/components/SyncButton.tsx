import type { SyncStatus } from '../lib/sync';

const LABEL: Record<SyncStatus['state'], string> = {
  'no-setup': 'Google Drive not set up',
  off: 'Not backed up. Tap to connect Google Drive',
  idle: 'Backed up to Google Drive',
  syncing: 'Syncing…',
  offline: 'Offline. Changes are saved on this device',
  'needs-auth': 'Tap to continue syncing',
  error: 'Sync problem. Tap for details',
};

/** Small cloud in the top-right corner showing backup status. */
export default function SyncButton({ status, onClick }: { status: SyncStatus; onClick: () => void }) {
  const s = status.state;
  const tone = s === 'error' ? 'bad' : s === 'needs-auth' || s === 'off' || s === 'no-setup' ? 'warn' : s === 'offline' ? 'dim' : '';
  return (
    <button type="button" className={`cloud ${tone} ${s === 'syncing' ? 'spin' : ''}`} onClick={onClick} aria-label={LABEL[s]} title={LABEL[s]} data-no-autoauth>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.6 4.5 4.5 0 0 0 7 18.5z" />
        {s === 'idle' && !status.pending && <path d="m9.5 13.5 2 2 3.5-4" />}
        {(s === 'syncing' || (s === 'idle' && status.pending)) && <path d="M12 11v5m-2.2-2.2L12 16l2.2-2.2" />}
        {(s === 'off' || s === 'no-setup' || s === 'offline') && <path d="M4 4l16 16" />}
        {(s === 'needs-auth' || s === 'error') && <path d="M12 11v3m0 2.2v.1" />}
      </svg>
    </button>
  );
}
