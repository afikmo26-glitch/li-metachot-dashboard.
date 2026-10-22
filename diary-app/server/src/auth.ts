import { normalizeContact, sendEmail, sendSms } from './recover';
import { codesKv, data, Env, HttpError, sha256, uidKey } from './env';
import { signSession, verifyIdToken, verifySession } from './jwt';

/**
 * Sign-in. Every method ends with the same long-lived session token (HS256, 180 days).
 *
 *   POST /auth/code/start   { contact, lang? }  -> { ok, devCode? }   6-digit code by email / SMS
 *   POST /auth/code/verify  { contact, code }   -> { token, uid, isNew }          uid 'e:<email>' | 'p:<phone>'
 *   POST /auth/google       { idToken }         -> { token, uid, email, name, isNew }   uid 'g:<sub>'
 *   POST /auth/apple        { identityToken }   -> { token, uid, email?, isNew }  uid 'a:<sub>'
 *   POST /auth/refresh      (auth)              -> { token }
 */

const CODE_TTL = 600;
const MAX_TRIES = 5;
const MAX_SENDS_PER_HOUR = 5;

type StoredCode = { codeHash: string; exp: number; tries: number };

const TEXTS: Record<string, { subject: string; body: (code: string) => string }> = {
  he: { subject: 'קוד הכניסה שלך — היומן שלי', body: (c) => `קוד הכניסה שלך ל"היומן שלי": ${c}\nהקוד בתוקף ל-10 דקות. אם לא ביקשת אותו, אפשר להתעלם.` },
  en: { subject: 'Your sign-in code — My Diary', body: (c) => `Your "My Diary" sign-in code: ${c}\nIt expires in 10 minutes. If you didn't ask for it, ignore this message.` },
  ar: { subject: 'رمز الدخول — مذكراتي', body: (c) => `رمز الدخول إلى "مذكراتي": ${c}\nصالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.` },
};

function secret(env: Env): string {
  if (!env.SESSION_SECRET) throw new HttpError(501, { error: 'sign-in not configured (SESSION_SECRET)' });
  return env.SESSION_SECRET;
}

/** The signed-in uid, or null when there is no (valid) bearer token. */
export async function sessionUid(req: Request, env: Env): Promise<string | null> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  if (!m || !env.SESSION_SECRET) return null;
  return verifySession(env.SESSION_SECRET, m[1].trim());
}

export async function requireUser(req: Request, env: Env): Promise<string> {
  secret(env);
  const uid = await sessionUid(req, env);
  if (!uid) throw new HttpError(401, { error: 'sign in required' });
  return uid;
}

/** New = nothing backed up yet, so the app knows whether to offer a restore. */
async function signedIn(env: Env, uid: string) {
  const isNew = !(await data(env).get(`sync:meta:${await uidKey(uid)}`));
  return { token: await signSession(secret(env), uid), uid, isNew };
}

const csv = (s?: string) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export async function handleAuth(path: string, body: Record<string, unknown>, req: Request, env: Env): Promise<[number, unknown]> {
  if (path === '/auth/code/start' || path === '/auth/code/verify') {
    secret(env);
    const contact = normalizeContact(body.contact);
    if (!contact) return [400, { error: 'bad contact' }];
    const kv = codesKv(env);
    const h = await sha256(contact.value);
    const key = `ac:${h}`;

    if (path === '/auth/code/start') {
      const sendsKey = `acs:${h}`;
      const hour = Date.now() - 3600_000;
      const sends = ((await kv.get<number[]>(sendsKey, 'json')) ?? []).filter((t) => t > hour);
      if (sends.length >= MAX_SENDS_PER_HOUR) return [429, { error: 'too many codes, try again later' }];

      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
      const dev = env.DEV_CODES === '1';
      const texts = TEXTS[typeof body.lang === 'string' && body.lang in TEXTS ? body.lang : 'he'];
      const canSend = contact.kind === 'email' ? !!(env.RESEND_API_KEY && env.MAIL_FROM) : !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
      if (canSend) {
        try {
          if (contact.kind === 'email') await sendEmail(env, contact.value, texts.subject, texts.body(code));
          else await sendSms(env, contact.value, texts.body(code));
        } catch (err) {
          if (!dev) return [502, { error: err instanceof Error ? err.message : 'send failed' }];
        }
      } else if (!dev) {
        return [501, { error: `${contact.kind === 'email' ? 'email' : 'sms'} not configured` }];
      }

      sends.push(Date.now());
      await kv.put(sendsKey, JSON.stringify(sends), { expirationTtl: 3600 });
      const stored: StoredCode = { codeHash: await sha256(`${key}:${code}`), exp: Date.now() + CODE_TTL * 1000, tries: 0 };
      await kv.put(key, JSON.stringify(stored), { expirationTtl: CODE_TTL });
      return [200, dev ? { ok: true, devCode: code } : { ok: true }];
    }

    const stored = await kv.get<StoredCode>(key, 'json');
    if (!stored || stored.exp < Date.now()) return [400, { error: 'code expired' }];
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if ((await sha256(`${key}:${code}`)) !== stored.codeHash) {
      stored.tries += 1;
      if (stored.tries >= MAX_TRIES) {
        await kv.delete(key);
        return [400, { error: 'too many tries' }];
      }
      await kv.put(key, JSON.stringify(stored), { expirationTtl: Math.max(60, Math.ceil((stored.exp - Date.now()) / 1000)) });
      return [400, { error: 'wrong code', triesLeft: MAX_TRIES - stored.tries }];
    }
    await kv.delete(key);
    return [200, await signedIn(env, `${contact.kind === 'email' ? 'e' : 'p'}:${contact.value}`)];
  }

  if (path === '/auth/google' || path === '/auth/apple') {
    secret(env);
    const google = path === '/auth/google';
    const token = google ? body.idToken : body.identityToken;
    if (typeof token !== 'string' || !token) return [400, { error: 'missing token' }];
    const audiences = csv(google ? env.GOOGLE_CLIENT_IDS : env.APPLE_BUNDLE_ID);
    if (!audiences.length) return [501, { error: `${google ? 'Google' : 'Apple'} sign-in not configured` }];
    let claims: Record<string, unknown>;
    try {
      claims = await verifyIdToken(
        token,
        google
          ? { jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs', issuers: ['accounts.google.com', 'https://accounts.google.com'], audiences }
          : { jwksUrl: 'https://appleid.apple.com/auth/keys', issuers: ['https://appleid.apple.com'], audiences },
      );
    } catch (err) {
      return [401, { error: 'invalid token', reason: err instanceof Error ? err.message : '' }];
    }
    const res = await signedIn(env, `${google ? 'g' : 'a'}:${claims.sub}`);
    const email = typeof claims.email === 'string' ? claims.email : undefined;
    if (google) return [200, { ...res, email: email ?? null, name: typeof claims.name === 'string' ? claims.name : null }];
    return [200, email ? { ...res, email } : res];
  }

  if (path === '/auth/refresh') {
    const uid = await requireUser(req, env);
    return [200, { token: await signSession(secret(env), uid) }];
  }

  return [404, { error: 'not found' }];
}
