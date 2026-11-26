import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadLocal } from './lib/store';
import { startSync } from './lib/sync';
import './styles.css';

loadLocal().then(startSync);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
