import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { GOOGLE, SERVER } from '../config';
import { t } from '../i18n';
import { loadAiConfig } from './ai';
import { b64, decryptFromStorage, deriveKey, encryptForStorage, open, randomBytes, seal } from './crypto';
import type { BackupData } from './store';

/**
 * The diary in the cloud, end-to-end encrypted.
 * - Sign in once (Google, Apple, or a code by email / SMS); the server keeps you signed in for 180 days.
 * - Everything is locked on the phone with a key made from the diary password before it is uploaded,
 *   so the server (and we) only ever hold ciphertext. On a new phone: sign in + the diary password = everything back.
 * - Photos and voice recordings stay on the phone for now.
 */

const KEY = 'diary.cloud.v1';
const SEALED = 'enc1:';

/** The server stores plain base64: the local "enc1:" marker is dropped on upload and put back on download. */
const toBlob = (key: Uint8Array, text: string) => seal(key, text).slice(SEALED.length);
const fromBlob = (key: Uint8Array, blob: string) => open(key, SEALED + blob);

export type CloudProvider = 'google' | 'apple' | 'email' | 'phone';
export type CloudSession = {
  token: string;
  uid: string;
  provider: CloudProvider;
  /** What to show: the email, phone or Google name */
  label: string;
  /** Encryption key for the cloud copy (base64) and its salt; set once the diary password is known */
  key?: string;
  salt?: string;
  version?: number;
  lastSync?: string;
};

export class CloudError extends Error {
  constructor(
    message: string,
    public status = 0,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let cached: CloudSession | null | undefined;

export async function loadSession(): Promise<CloudSession | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cached = raw ? (JSON.parse(await decryptFromStorage(raw)) as CloudSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

async function saveSession(s: CloudSession | null) {
  cached = s;
  if (s) await AsyncStorage.setItem(KEY, await encryptForStorage(JSON.stringify(s)));
  else await AsyncStorage.removeItem(KEY);
}

async function server(): Promise<{ url: string; appKey: string } | null> {
  const c = await loadAiConfig();
  if (c.url && c.appKey) return { url: c.url.replace(/\/$/, ''), appKey: c.appKey };
  return SERVER.url && SERVER.appKey ? { url: SERVER.url.replace(/\/$/, ''), appKey: SERVER.appKey } : null;
}

export const cloudConfigured = async () => !!(await server());
export const googleAvailable = () => Platform.OS !== 'web' && !!GOOGLE.webClientId;
export const appleAvailable = () => Platform.OS === 'ios';

async function api<T>(path: string, opts: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const srv = await server();
  if (!srv) throw new CloudError(t('השרת עוד לא מחובר לאפליקציה'));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(`${srv.url}${path}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: {
        'content-type': 'application/json',
        'x-app-key': srv.appKey,
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new CloudError(t('אין חיבור לאינטרנט'));
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      res.status === 429 ? t('יותר מדי ניסיונות. נסה שוב מאוחר יותר') : res.status === 401 ? t('צריך להתחבר מחדש') : (data.error as string) || t('שגיאה {code}', { code: res.status });
    throw new CloudError(msg, res.status, data);
  }
  return data as T;
}

type AuthResult = { token: string; uid: string; email?: string; name?: string; isNew?: boolean };

async function finishSignIn(r: AuthResult, provider: CloudProvider, label: string): Promise<CloudSession> {
  const prev = await loadSession();
  const s: CloudSession = { token: r.token, uid: r.uid, provider, label, ...(prev?.uid === r.uid ? { key: prev.key, salt: prev.salt, version: prev.version } : {}) };
  await saveSession(s);
  return s;
}

// ---- Sign in ----

/** Sends a 6-digit code to an email or phone (already normalized). Returns a dev code when the server runs in test mode. */
export async function startCode(contact: string): Promise<string | undefined> {
  const r = await api<{ ok: boolean; devCode?: string }>('/auth/code/start', { body: { contact } });
  return r.devCode;
}

export async function verifyCode(contact: string, code: string): Promise<CloudSession> {
  try {
    const r = await api<AuthResult>('/auth/code/verify', { body: { contact, code } });
    return finishSignIn(r, contact.includes('@') ? 'email' : 'phone', contact);
  } catch (e) {
    if (e instanceof CloudError && (e.status === 400 || e.status === 401 || e.status === 403)) throw new CloudError(t('הקוד שגוי או שפג תוקפו'), e.status);
    throw e;
  }
}

export async function signInWithGoogle(): Promise<CloudSession | null> {
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: GOOGLE.webClientId, iosClientId: GOOGLE.iosClientId || undefined });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res) || !res.data.idToken) return null;
  const r = await api<AuthResult>('/auth/google', { body: { idToken: res.data.idToken } });
  return finishSignIn(r, 'google', r.email || res.data.user.email || r.name || 'Google');
}

export async function signInWithApple(): Promise<CloudSession | null> {
  const Apple = await import('expo-apple-authentication');
  try {
    const cred = await Apple.signInAsync({ requestedScopes: [Apple.AppleAuthenticationScope.EMAIL] });
    if (!cred.identityToken) return null;
    const r = await api<AuthResult>('/auth/apple', { body: { identityToken: cred.identityToken } });
    return finishSignIn(r, 'apple', cred.email || 'Apple');
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

export async function signOut() {
  if (Platform.OS !== 'web') {
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {
      // not signed in with Google
    }
  }
  await saveSession(null);
}

/** Deletes the cloud copy and the account on the server, then signs out. The diary on this phone stays. */
export async function deleteCloudAccount() {
  const s = await loadSession();
  if (s) await api('/account', { method: 'DELETE', token: s.token });
  await signOut();
}

// ---- Encryption key ----

/** Makes the cloud key from the diary password (keeps the salt already in the cloud, if any). */
export async function setCloudPassword(password: string, newSalt = false): Promise<void> {
  const s = await loadSession();
  if (!s) return;
  let salt = newSalt ? undefined : s.salt;
  if (!salt) {
    const meta = newSalt ? null : await api<{ exists: boolean; salt?: string }>('/sync/meta', { token: s.token }).catch(() => null);
    salt = meta?.salt ?? b64.encode(randomBytes(16));
  }
  const key = await deriveKey(password, b64.decode(salt));
  await saveSession({ ...s, key: b64.encode(key), salt });
}

export type CloudMeta = { exists: boolean; updatedAt?: string; size?: number; salt?: string; version?: number };

export async function cloudMeta(): Promise<CloudMeta | null> {
  const s = await loadSession();
  return s ? api<CloudMeta>('/sync/meta', { token: s.token }) : null;
}

// ---- Backup / restore ----

const LISTS = ['entries', 'people', 'events', 'followUps', 'goals', 'workplaces', 'shifts', 'savingsGoals', 'savingsTx', 'exams', 'homework', 'studySessions'] as const;

/** Two copies written on different phones: keep everything from both (this phone wins on the same id). */
export function mergeBackups(local: BackupData, remote: BackupData): BackupData {
  const out = { ...remote, ...local } as BackupData & Record<string, unknown>;
  for (const k of LISTS) {
    const l = ((local as Record<string, unknown>)[k] as { id: string }[] | undefined) ?? [];
    const r = ((remote as Record<string, unknown>)[k] as { id: string }[] | undefined) ?? [];
    const ids = new Set(l.map((x) => x.id));
    (out as Record<string, unknown>)[k] = [...l, ...r.filter((x) => !ids.has(x.id))];
  }
  out.game = { ...remote.game, ...local.game, xp: Math.max(local.game?.xp ?? 0, remote.game?.xp ?? 0) };
  if (local.pet || remote.pet) out.pet = { ...remote.pet!, ...local.pet!, careXp: Math.max(local.pet?.careXp ?? 0, remote.pet?.careXp ?? 0) };
  return out;
}

let uploading: Promise<void> | null = null;

/** Encrypts and uploads the whole diary. If another phone uploaded in between, merges both first. */
export async function backupNow(data: BackupData): Promise<{ at: string } | null> {
  const s = await loadSession();
  if (!s?.key || !s.salt) return null;
  if (uploading) await uploading.catch(() => {});
  let done: () => void = () => {};
  uploading = new Promise((r) => (done = r));
  try {
    const key = b64.decode(s.key);
    const put = (d: BackupData, baseVersion?: number) =>
      api<{ ok: boolean; version: number }>('/sync', { method: 'PUT', token: s.token, body: { blob: toBlob(key, JSON.stringify(d)), salt: s.salt, updatedAt: new Date().toISOString(), baseVersion } });
    let res: { version: number };
    try {
      res = await put(data, s.version);
    } catch (e) {
      if (!(e instanceof CloudError) || e.status !== 409) throw e;
      const remote = await downloadWithKey(key);
      res = await put(remote ? mergeBackups(data, remote) : data, e.data.version as number);
    }
    const at = new Date().toISOString();
    await saveSession({ ...s, version: res.version, lastSync: at });
    return { at };
  } finally {
    done();
    uploading = null;
  }
}

async function downloadWithKey(key: Uint8Array): Promise<BackupData | null> {
  const s = await loadSession();
  if (!s) return null;
  const r = await api<{ blob: string }>('/sync', { token: s.token }).catch((e) => {
    if (e instanceof CloudError && e.status === 404) return null;
    throw e;
  });
  return r ? (JSON.parse(fromBlob(key, r.blob)) as BackupData) : null;
}

/** On a new phone: downloads the cloud copy and opens it with the diary password. */
export async function restoreFromCloud(password: string): Promise<BackupData> {
  const s = await loadSession();
  if (!s) throw new CloudError(t('צריך להתחבר מחדש'));
  const r = await api<{ blob: string; salt: string; version: number }>('/sync', { token: s.token });
  const key = await deriveKey(password, b64.decode(r.salt));
  let data: BackupData;
  try {
    data = JSON.parse(fromBlob(key, r.blob));
  } catch {
    throw new CloudError(t('הסיסמה לא מתאימה לגיבוי'));
  }
  await saveSession({ ...s, key: b64.encode(key), salt: r.salt, version: r.version, lastSync: new Date().toISOString() });
  return data;
}

/** Crash reports (no diary content): message, stack, platform and app version. */
export async function reportCrash(message: string, stack?: string) {
  try {
    await api('/crash', { body: { message: message.slice(0, 500), stack: stack?.slice(0, 4000), platform: Platform.OS, version: '1.0.0', at: new Date().toISOString() } });
  } catch {
    // never let reporting a crash cause another one
  }
}

// ---- Pet visits ----

export type PetCard = { name: string; species: string; wear: Record<string, string | undefined>; level: number; stage: string };

export async function publishPet(card: PetCard): Promise<string | null> {
  const s = await loadSession();
  if (!s) return null;
  const r = await api<{ code: string }>('/pet', { method: 'PUT', token: s.token, body: { card } });
  return r.code;
}

export async function myPetInfo(): Promise<{ code?: string; hearts: number } | null> {
  const s = await loadSession();
  return s ? api('/pet', { token: s.token }) : null;
}

export const visitPet = (code: string) => api<{ card: PetCard; hearts: number }>(`/pet/${encodeURIComponent(code.trim().toUpperCase())}`);

export async function sendHeart(code: string): Promise<{ hearts: number; already?: boolean }> {
  const s = await loadSession();
  if (!s) throw new CloudError(t('צריך להתחבר כדי לשלוח לב'));
  return api(`/pet/${encodeURIComponent(code.trim().toUpperCase())}/heart`, { method: 'POST', token: s.token, body: {} });
}
