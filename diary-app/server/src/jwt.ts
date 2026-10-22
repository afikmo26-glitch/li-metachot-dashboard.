/**
 * JWTs with WebCrypto only.
 *   - session tokens: HS256 signed with SESSION_SECRET, { uid, iat, exp }
 *   - Google / Apple ID tokens: RS256, checked against the provider's published keys (cached)
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? enc.encode(bytes) : bytes;
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

type Parts = { header: Record<string, unknown>; payload: Record<string, unknown>; signed: Uint8Array; sig: Uint8Array };

function split(token: string): Parts | null {
  const p = token.split('.');
  if (p.length !== 3) return null;
  try {
    return {
      header: JSON.parse(dec.decode(b64urlDecode(p[0]))),
      payload: JSON.parse(dec.decode(b64urlDecode(p[1]))),
      signed: enc.encode(`${p[0]}.${p[1]}`),
      sig: b64urlDecode(p[2]),
    };
  } catch {
    return null;
  }
}

// ── session tokens ──

export const SESSION_DAYS = 180;
const hmacKeys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string) {
  let k = hmacKeys.get(secret);
  if (!k) {
    k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    hmacKeys.set(secret, k);
  }
  return k;
}

export async function signSession(secret: string, uid: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const head = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64urlEncode(JSON.stringify({ uid, iat: now, exp: now + SESSION_DAYS * 86400 }));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** The uid inside a valid, unexpired session token, or null. */
export async function verifySession(secret: string, token: string): Promise<string | null> {
  const t = split(token);
  if (!t || t.header.alg !== 'HS256') return null;
  if (!(await crypto.subtle.verify('HMAC', await hmacKey(secret), t.sig, t.signed))) return null;
  const { uid, exp } = t.payload;
  if (typeof uid !== 'string' || typeof exp !== 'number' || exp < Date.now() / 1000) return null;
  return uid;
}

// ── provider ID tokens (RS256) ──

type Jwk = JsonWebKey & { kid?: string };
type KeySet = { keys: Map<string, CryptoKey>; until: number };
const jwksCache = new Map<string, KeySet>();

async function loadJwks(url: string): Promise<KeySet> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== 'RSA' || !jwk.kid) continue;
    const { kid, ...rest } = jwk;
    keys.set(kid, await crypto.subtle.importKey('jwk', { kty: rest.kty, n: rest.n, e: rest.e }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
  }
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  const set = { keys, until: Date.now() + Math.min(Math.max(maxAge, 300), 86400) * 1000 };
  jwksCache.set(url, set);
  return set;
}

async function jwksKey(url: string, kid: string): Promise<CryptoKey | undefined> {
  let set = jwksCache.get(url);
  if (!set || set.until < Date.now()) set = await loadJwks(url);
  // keys rotate: an unknown kid means it is time to refetch (once)
  if (!set.keys.has(kid)) set = await loadJwks(url);
  return set.keys.get(kid);
}

/** For tests: forget cached provider keys. */
export const clearJwksCache = () => jwksCache.clear();

export type IdCheck = { jwksUrl: string; issuers: string[]; audiences: string[] };

/** Verifies a provider ID token and returns its claims, or throws with a short reason. */
export async function verifyIdToken(token: string, check: IdCheck): Promise<Record<string, unknown>> {
  const t = split(token);
  if (!t) throw new Error('malformed token');
  if (t.header.alg !== 'RS256' || typeof t.header.kid !== 'string') throw new Error('bad token header');
  const key = await jwksKey(check.jwksUrl, t.header.kid);
  if (!key) throw new Error('unknown signing key');
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, t.sig, t.signed))) throw new Error('bad signature');
  const c = t.payload;
  const now = Date.now() / 1000;
  if (typeof c.iss !== 'string' || !check.issuers.includes(c.iss)) throw new Error('bad issuer');
  const auds = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!auds.some((a) => typeof a === 'string' && check.audiences.includes(a))) throw new Error('bad audience');
  if (typeof c.exp !== 'number' || c.exp < now - 60) throw new Error('token expired');
  if (typeof c.iat === 'number' && c.iat > now + 300) throw new Error('token from the future');
  if (typeof c.sub !== 'string' || !c.sub) throw new Error('no subject');
  return c;
}
