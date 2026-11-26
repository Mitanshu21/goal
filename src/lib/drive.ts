/*
 * Google Drive access with no server: Google Identity Services gives the
 * browser a short-lived access token, and we call the Drive REST API directly.
 *
 * Scope is `drive.file`: the app can only see files it created itself,
 * nothing else in your Drive.
 */

const CLIENT_ID = ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim();
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY = 'gd_token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export class AuthError extends Error {}
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string; login_hint?: string }): void }
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(c: {
            client_id: string; scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type?: string; message?: string }) => void;
          }): TokenClient;
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

export const hasClientId = () => CLIENT_ID.length > 0;

let client: TokenClient | null = null;
let waiting: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;
let loading: Promise<void> | null = null;

export function loadGis(): Promise<void> {
  if (!CLIENT_ID) return Promise.reject(new Error('VITE_GOOGLE_CLIENT_ID is not set'));
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      try {
        client = window.google!.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: (r) => {
            const w = waiting; waiting = null;
            if (r.error || !r.access_token) return w?.reject(new AuthError(r.error_description || r.error || 'Google sign-in failed'));
            saveToken(r.access_token, r.expires_in ?? 3600);
            w?.resolve(r.access_token);
          },
          error_callback: (e) => {
            const w = waiting; waiting = null;
            w?.reject(new AuthError(e?.type === 'popup_closed' ? 'Sign-in window was closed' : e?.message || 'Google sign-in failed'));
          },
        });
        resolve();
      } catch (e) {
        reject(e as Error);
      }
    };
    s.onerror = () => { loading = null; reject(new Error('Could not load Google sign-in. Check your internet connection.')); };
    document.head.appendChild(s);
  });
  return loading;
}

export const gisReady = () => client !== null;

function saveToken(t: string, expiresIn: number) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ t, exp: Date.now() + expiresIn * 1000 }));
}

export function getToken(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') as { t: string; exp: number } | null;
    if (v && v.exp - 60_000 > Date.now()) return v.t;
  } catch { /* ignore */ }
  return null;
}

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Must be called straight from a tap/click, because Google opens a small window.
 * `chooseAccount` shows the account picker (first connect); otherwise Google
 * reuses your earlier consent and the window closes by itself.
 */
export function requestToken(chooseAccount: boolean, hint?: string | null): Promise<string> {
  if (!client) return Promise.reject(new AuthError('Google sign-in is still loading. Try again in a moment.'));
  return new Promise<string>((resolve, reject) => {
    waiting?.reject(new AuthError('Superseded'));
    waiting = { resolve, reject };
    client!.requestAccessToken({ prompt: chooseAccount ? 'select_account' : '', ...(hint ? { login_hint: hint } : {}) });
  });
}

export function signOut() {
  const t = getToken();
  if (t && window.google) window.google.accounts.oauth2.revoke(t, () => {});
  clearToken();
}

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  const t = getToken();
  if (!t) throw new AuthError('Not signed in');
  const r = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${t}` } });
  if (r.status === 401) { clearToken(); throw new AuthError('Google session expired'); }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    let msg = body;
    try { msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body; } catch { /* plain text */ }
    throw new HttpError(r.status, `Google Drive error ${r.status}: ${msg.slice(0, 160)}`);
  }
  return r;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function findByName(name: string, parent?: string, folder = false): Promise<string | null> {
  let q = `name='${esc(name)}' and trashed=false`;
  if (parent) q += ` and '${parent}' in parents`;
  if (folder) q += ` and mimeType='application/vnd.google-apps.folder'`;
  const r = await api(`${API}/files?q=${encodeURIComponent(q)}&spaces=drive&orderBy=modifiedTime%20desc&fields=files(id)`);
  const j = (await r.json()) as { files?: { id: string }[] };
  return j.files?.[0]?.id ?? null;
}

export async function ensureFolder(name: string, parent?: string): Promise<string> {
  const found = await findByName(name, parent, true);
  if (found) return found;
  const r = await api(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}) }),
  });
  return ((await r.json()) as { id: string }).id;
}

export async function readJson(id: string): Promise<unknown> {
  const r = await api(`${API}/files/${id}?alt=media`);
  return r.json();
}

export async function createJson(name: string, parent: string, obj: unknown): Promise<string> {
  const b = 'goalapp' + Math.random().toString(36).slice(2);
  const meta = { name, parents: [parent], mimeType: 'application/json' };
  const body =
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n--${b}--`;
  const r = await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body,
  });
  return ((await r.json()) as { id: string }).id;
}

export async function updateJson(id: string, obj: unknown): Promise<void> {
  await api(`${UPLOAD}/files/${id}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  });
}

export async function listChildren(parent: string): Promise<{ id: string; name: string }[]> {
  const q = `'${parent}' in parents and trashed=false`;
  const r = await api(`${API}/files?q=${encodeURIComponent(q)}&pageSize=200&fields=files(id,name)`);
  return ((await r.json()) as { files?: { id: string; name: string }[] }).files ?? [];
}

export async function deleteFile(id: string): Promise<void> {
  await api(`${API}/files/${id}`, { method: 'DELETE' });
}

export async function getUser(): Promise<{ displayName?: string; emailAddress?: string }> {
  const r = await api(`${API}/about?fields=user(displayName,emailAddress)`);
  return ((await r.json()) as { user?: { displayName?: string; emailAddress?: string } }).user ?? {};
}
