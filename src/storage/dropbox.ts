import { db } from './db';
import { buildBackup, backupFileName, restoreBackup } from './exchange';

/**
 * Optional Dropbox backup with OAuth 2.0 PKCE. No client secret is used: the App Key is public.
 * The redirect step is skipped: Dropbox shows the authorization code and the user pastes it back,
 * so the same flow works in the browser, in Tauri and in the Android WebView.
 */
const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const RPC_URL = 'https://api.dropboxapi.com/2';
const CONTENT_URL = 'https://content.dropboxapi.com/2';
const FOLDER = '/MeshMaps';
/** Single-request upload limit of the Dropbox API (upload sessions are not implemented). */
const MAX_UPLOAD_BYTES = 150 * 1024 * 1024;
const VERIFIER_KEY = 'mm-dbx-verifier';
const APP_KEY_PREF = 'dropboxAppKey';
const REFRESH_PREF = 'dropboxRefreshToken';

let access: { token: string; expiresAt: number } | null = null;

export interface DropboxBackup {
  name: string;
  path: string;
  size: number;
  modified: string;
}

async function pref(key: string): Promise<string | null> {
  return (await db.prefs.get(key))?.value ?? null;
}

async function setPref(key: string, value: string | null): Promise<void> {
  await db.prefs.put({ key, value });
}

export async function getAppKey(): Promise<string | null> {
  return pref(APP_KEY_PREF);
}

export async function setAppKey(key: string): Promise<void> {
  const clean = key.trim();
  if (!/^[a-z0-9]{8,30}$/i.test(clean)) throw new Error('App Key выглядит неверно. Скопируйте его из консоли Dropbox.');
  await setPref(APP_KEY_PREF, clean);
}

/** Forgets the App Key (and any tokens that belong to it). */
export async function forgetAppKey(): Promise<void> {
  access = null;
  await setPref(REFRESH_PREF, null);
  await setPref(APP_KEY_PREF, null);
}

export async function isConnected(): Promise<boolean> {
  return !!(await pref(REFRESH_PREF));
}

export async function disconnect(): Promise<void> {
  access = null;
  await setPref(REFRESH_PREF, null);
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RFC 7636 verifier: 64 characters from the unreserved set. */
function randomVerifier(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

async function challengeFor(verifier: string): Promise<string> {
  if (!crypto.subtle) throw new Error('Для входа в Dropbox нужно защищённое соединение (https или localhost).');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Returns the Dropbox authorization URL; the verifier is kept for the code exchange. */
export async function beginLogin(): Promise<string> {
  const key = await getAppKey();
  if (!key) throw new Error('Сначала введите App Key из консоли Dropbox.');
  const verifier = randomVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await challengeFor(verifier);
  const params = new URLSearchParams({
    client_id: key,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as { error_description?: string; error?: string } & {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Dropbox отклонил запрос (HTTP ${res.status})`);
  }
  return json;
}

/** Exchanges the code the user copied from Dropbox for tokens. */
export async function finishLogin(code: string): Promise<void> {
  const key = await getAppKey();
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!key || !verifier) throw new Error('Сначала нажмите «Подключить Dropbox» и скопируйте код.');
  const json = await tokenRequest(
    new URLSearchParams({
      code: code.trim(),
      grant_type: 'authorization_code',
      client_id: key,
      code_verifier: verifier,
    }),
  );
  if (!json.refresh_token) throw new Error('Dropbox не выдал долгосрочный доступ. Повторите вход.');
  await setPref(REFRESH_PREF, json.refresh_token);
  access = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
  sessionStorage.removeItem(VERIFIER_KEY);
}

async function accessToken(): Promise<string> {
  if (access && access.expiresAt > Date.now()) return access.token;
  const refresh = await pref(REFRESH_PREF);
  const key = await getAppKey();
  if (!refresh || !key) throw new Error('Dropbox не подключён.');
  const json = await tokenRequest(
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: key }),
  );
  access = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
  return access.token;
}

function apiError(status: number, text: string): Error {
  try {
    const j = JSON.parse(text) as { error_summary?: string };
    if (j.error_summary) return new Error(`Dropbox: ${j.error_summary}`);
  } catch {
    /* not JSON */
  }
  return new Error(`Dropbox ответил ошибкой HTTP ${status}`);
}

async function rpc<T>(path: string, body: unknown): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${RPC_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw apiError(res.status, await res.text());
  return (await res.json()) as T;
}

/** Uploads bytes to /MeshMaps/<name>, overwriting a file with the same name. */
export async function uploadFile(name: string, bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Бэкап больше 150 МБ. Уменьшите объём (например, удалите часть фото) и повторите.');
  }
  const token = await accessToken();
  const path = `${FOLDER}/${name}`;
  const res = await fetch(`${CONTENT_URL}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true }),
    },
    body: bytes as BodyInit,
  });
  if (!res.ok) throw apiError(res.status, await res.text());
  return path;
}

export async function backupToDropbox(): Promise<string> {
  const bytes = await buildBackup();
  return uploadFile(backupFileName(), bytes);
}

/** Lists MeshMaps backups, newest first. An absent folder means no backups yet. */
export async function listBackups(): Promise<DropboxBackup[]> {
  let data: { entries: { '.tag': string; name: string; path_display?: string; size?: number; server_modified?: string }[] };
  try {
    data = await rpc('/files/list_folder', { path: FOLDER });
  } catch (err) {
    if (err instanceof Error && /not_found/.test(err.message)) return [];
    throw err;
  }
  return data.entries
    .filter((e) => e['.tag'] === 'file' && e.name.endsWith('.zip'))
    .map((e) => ({
      name: e.name,
      path: e.path_display ?? `${FOLDER}/${e.name}`,
      size: e.size ?? 0,
      modified: e.server_modified ?? '',
    }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** Downloads a backup and restores it as new layers and features (nothing is overwritten). */
export async function restoreFromDropbox(backup: DropboxBackup): Promise<number> {
  const token = await accessToken();
  const res = await fetch(`${CONTENT_URL}/files/download`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: backup.path }) },
  });
  if (!res.ok) throw apiError(res.status, await res.text());
  const file = new File([await res.blob()], backup.name, { type: 'application/zip' });
  return restoreBackup(file);
}
