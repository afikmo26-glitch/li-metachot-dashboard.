/**
 * Password recovery by a one-time code sent to the user's email (Resend) or phone (Twilio SMS).
 *
 *   POST /recover/start   { contact, lang }  -> { ok: true }           sends a 6-digit code, valid 10 minutes
 *   POST /recover/verify  { contact, code }  -> { ok: true | false }   5 wrong tries burn the code
 *
 * Codes live in the KV namespace bound as CODES, keyed by a hash of the contact, never stored in plain text.
 * The diary itself never reaches the server: a verified code only lets the app set a new local password.
 */

export interface RecoverEnv {
  CODES?: KVNamespace;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM?: string;
}

type Stored = { codeHash: string; exp: number; tries: number; sentAt: number };

const TTL_SECONDS = 600;
const RESEND_AFTER_MS = 60_000;
const MAX_TRIES = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

const TEXTS: Record<string, { subject: string; body: (code: string) => string }> = {
  he: { subject: 'קוד לשחזור הסיסמה — היומן שלי', body: (c) => `קוד השחזור שלך ל"היומן שלי": ${c}\nהקוד בתוקף ל-10 דקות. אם לא ביקשת אותו, אפשר להתעלם.` },
  en: { subject: 'Your password reset code — My Diary', body: (c) => `Your "My Diary" reset code: ${c}\nIt expires in 10 minutes. If you didn't ask for it, ignore this message.` },
  ar: { subject: 'رمز استعادة كلمة المرور — مذكراتي', body: (c) => `رمز الاستعادة في "مذكراتي": ${c}\nصالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.` },
};

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeContact(raw: unknown): { kind: 'email' | 'phone'; value: string } | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (EMAIL_RE.test(v)) return { kind: 'email', value: v.toLowerCase() };
  const phone = v.replace(/[\s()-]/g, '');
  if (PHONE_RE.test(phone)) return { kind: 'phone', value: phone };
  return null;
}

async function sendEmail(env: RecoverEnv, to: string, subject: string, text: string) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new Error('email not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`email failed ${res.status}`);
}

async function sendSms(env: RecoverEnv, to: string, text: string) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) throw new Error('sms not configured');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: text }),
  });
  if (!res.ok) throw new Error(`sms failed ${res.status}`);
}

/** Returns [status, body] for the recover routes. */
export async function handleRecover(path: string, body: Record<string, unknown>, env: RecoverEnv): Promise<[number, unknown]> {
  if (!env.CODES) return [501, { error: 'recovery not configured' }];
  const contact = normalizeContact(body.contact);
  if (!contact) return [400, { error: 'bad contact' }];
  const key = `rc:${await sha256(contact.value)}`;

  if (path === '/recover/start') {
    const prev = await env.CODES.get<Stored>(key, 'json');
    if (prev && Date.now() - prev.sentAt < RESEND_AFTER_MS) return [429, { error: 'wait a minute before asking again' }];
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    const texts = TEXTS[typeof body.lang === 'string' && body.lang in TEXTS ? body.lang : 'he'];
    try {
      if (contact.kind === 'email') await sendEmail(env, contact.value, texts.subject, texts.body(code));
      else await sendSms(env, contact.value, texts.body(code));
    } catch (err) {
      return [502, { error: err instanceof Error ? err.message : 'send failed' }];
    }
    const stored: Stored = { codeHash: await sha256(`${key}:${code}`), exp: Date.now() + TTL_SECONDS * 1000, tries: 0, sentAt: Date.now() };
    await env.CODES.put(key, JSON.stringify(stored), { expirationTtl: TTL_SECONDS });
    return [200, { ok: true }];
  }

  if (path === '/recover/verify') {
    const stored = await env.CODES.get<Stored>(key, 'json');
    if (!stored || stored.exp < Date.now()) return [200, { ok: false, reason: 'expired' }];
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if ((await sha256(`${key}:${code}`)) === stored.codeHash) {
      await env.CODES.delete(key);
      return [200, { ok: true }];
    }
    stored.tries += 1;
    if (stored.tries >= MAX_TRIES) await env.CODES.delete(key);
    else await env.CODES.put(key, JSON.stringify(stored), { expirationTtl: Math.max(60, Math.ceil((stored.exp - Date.now()) / 1000)) });
    return [200, { ok: false, reason: stored.tries >= MAX_TRIES ? 'too many tries' : 'wrong code' }];
  }

  return [404, { error: 'not found' }];
}
