import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadLocal } from './lib/store';
import { startSync } from './lib/sync';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';

loadLocal().then(startSync);

// When a new version is deployed, switch to it right away instead of on the
// next-but-one launch. Data is saved on every change, so a reload loses nothing.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine) void reg.update(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    window.setInterval(check, 30 * 60_000);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
