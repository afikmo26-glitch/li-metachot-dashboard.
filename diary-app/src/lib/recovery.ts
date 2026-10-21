import { SERVER } from '../config';
import { getLang, t } from '../i18n';
import { loadAiConfig } from './ai';

/** Password reset by a code sent to the email or phone the user gave at sign-up (server: server/src/recover.ts). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const TIMEOUT_MS = 20000;

/** "dana@x.com" → lower case; "050-123 4567" → "+972501234567"; anything else → null. */
export function normalizeContact(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (EMAIL_RE.test(v)) return v.toLowerCase();
  let phone = v.replace(/[\s()-]/g, '');
  if (/^0\d{8,9}$/.test(phone)) phone = `+972${phone.slice(1)}`; // Israeli local number
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  return PHONE_RE.test(phone) ? phone : null;
}

/** "d***@gmail.com" / "+97250•••4567", wrapped as left-to-right so it reads right inside Hebrew/Arabic text. */
export function maskContact(c: string): string {
  const ltr = (x: string) => `\u2066${x}\u2069`;
  if (c.includes('@')) {
    const [user, domain] = c.split('@');
    return ltr(`${user.slice(0, 1)}***@${domain}`);
  }
  return ltr(`${c.slice(0, 6)}•••${c.slice(-4)}`);
}

async function server(): Promise<{ url: string; appKey: string } | null> {
  const c = await loadAiConfig();
  if (c.url && c.appKey) return { url: c.url, appKey: c.appKey };
  return SERVER.url && SERVER.appKey ? SERVER : null;
}

export async function recoveryAvailable(): Promise<boolean> {
  return !!(await server());
}

async function post(path: string, body: unknown): Promise<{ ok?: boolean; reason?: string; error?: string }> {
  const s = await server();
  if (!s) throw new Error(t('שחזור בקוד יעבוד אחרי שהשרת של האפליקציה יוגדר'));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(s.url.replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-key': s.appKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) throw new Error(t('חכה דקה לפני שמבקשים קוד חדש'));
    if (res.status === 501) throw new Error(t('שחזור בקוד עוד לא הופעל בשרת'));
    if (!res.ok) throw new Error(t('לא הצלחתי לשלוח את הקוד. נסה שוב'));
    return data;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error(t('אין חיבור לאינטרנט'));
    throw e instanceof Error && e.message ? e : new Error(t('אין חיבור לאינטרנט'));
  } finally {
    clearTimeout(timer);
  }
}

export async function sendRecoveryCode(contact: string): Promise<void> {
  await post('/recover/start', { contact, lang: getLang() });
}

/** Resolves to null when the code is right, otherwise a message to show. */
export async function verifyRecoveryCode(contact: string, code: string): Promise<string | null> {
  const r = await post('/recover/verify', { contact, code });
  if (r.ok) return null;
  if (r.reason === 'expired') return t('הקוד פג תוקף. בקש קוד חדש');
  if (r.reason === 'too many tries') return t('יותר מדי ניסיונות. בקש קוד חדש');
  return t('הקוד שגוי');
}
