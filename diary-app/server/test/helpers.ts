// In-memory KV, a fake global fetch and a request helper for running the Worker in Node.
import worker, { type Env } from '../src/index';

export class MemoryKV {
  store = new Map<string, { value: string; exp?: number }>();
  async get(key: string, type?: string | { type?: string }) {
    const e = this.store.get(key);
    if (!e || (e.exp && e.exp < Date.now())) return null;
    const t = typeof type === 'string' ? type : type?.type;
    return t === 'json' ? JSON.parse(e.value) : e.value;
  }
  async put(key: string, value: string, opts?: { expirationTtl?: number }) {
    this.store.set(key, { value: String(value), exp: opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : undefined });
  }
  async delete(key: string) {
    this.store.delete(key);
  }
  async list(opts?: { prefix?: string }) {
    const keys = [...this.store.keys()].filter((k) => k.startsWith(opts?.prefix ?? '')).map((name) => ({ name }));
    return { keys, list_complete: true, cacheStatus: null };
  }
  keys(prefix = '') {
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }
}

export const APP_KEY = 'test-app-key';

export function makeEnv(extra: Partial<Env> = {}): Env & { DATA: MemoryKV } {
  return {
    APP_KEY,
    SESSION_SECRET: 'test-session-secret',
    DEV_CODES: '1',
    GOOGLE_CLIENT_IDS: 'web-client.apps.googleusercontent.com, android-client.apps.googleusercontent.com',
    APPLE_BUNDLE_ID: 'com.example.diary',
    GEMINI_API_KEY: 'gemini-test',
    DATA: new MemoryKV(),
    ...extra,
  } as Env & { DATA: MemoryKV };
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;
export const fetchCalls: string[] = [];
let handlers: Handler[] = [];
const realFetch = globalThis.fetch;

export function mockFetch(...h: Handler[]) {
  handlers = h;
  fetchCalls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    fetchCalls.push(url);
    for (const fn of handlers) {
      const r = await fn(url, init);
      if (r) return r;
    }
    throw new Error(`unmocked fetch ${url}`);
  }) as typeof fetch;
}
export const restoreFetch = () => (globalThis.fetch = realFetch);

export async function call(env: Env, method: string, path: string, body?: unknown, opts: { token?: string; ip?: string; appKey?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'cf-connecting-ip': opts.ip ?? '203.0.113.1' };
  if (opts.appKey !== null) headers['x-app-key'] = opts.appKey ?? APP_KEY;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await worker.fetch(new Request(`https://diary.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

/** Signs in by code (DEV_CODES) and returns the session token. */
export async function signIn(env: Env, contact = 'dana@example.com') {
  const start = await call(env, 'POST', '/auth/code/start', { contact });
  const res = await call(env, 'POST', '/auth/code/verify', { contact, code: start.body.devCode });
  return res.body as { token: string; uid: string; isNew: boolean };
}
