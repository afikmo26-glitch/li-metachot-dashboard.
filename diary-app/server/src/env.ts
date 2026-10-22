import type { RecoverEnv } from './recover';

/** Bindings and secrets of the Worker (see wrangler.toml). */
export interface Env extends RecoverEnv {
  /** KV for accounts, encrypted backups, pets, rate limits and crash reports */
  DATA?: KVNamespace;
  APP_KEY: string;
  /** Signs the app's session tokens; any long random string */
  SESSION_SECRET?: string;
  /** Comma separated OAuth client IDs that may sign in with Google (web + Android + iOS) */
  GOOGLE_CLIENT_IDS?: string;
  /** iOS bundle id, the audience of Sign in with Apple tokens (comma separated if several) */
  APPLE_BUNDLE_ID?: string;
  /** Claude is used for chat when this is set… */
  ANTHROPIC_API_KEY?: string;
  /** …otherwise Gemini. Transcription always uses Gemini. */
  GEMINI_API_KEY?: string;
  /** '1' returns login codes in the response, for testing without email / SMS */
  DEV_CODES?: string;
}

/** Thrown anywhere in a handler to answer with a JSON error. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.error ?? status));
  }
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-app-key, authorization',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });
}

export function data(env: Env): KVNamespace {
  if (!env.DATA) throw new HttpError(501, { error: 'storage not configured (bind a KV namespace as DATA)' });
  return env.DATA;
}

/** Codes may live in their own namespace (CODES, as before) or share DATA. */
export function codesKv(env: Env): KVNamespace {
  const kv = env.CODES ?? env.DATA;
  if (!kv) throw new HttpError(501, { error: 'storage not configured (bind a KV namespace as DATA)' });
  return kv;
}

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Short stable id for KV keys, so emails and phone numbers never appear in key names. */
export const uidKey = async (uid: string) => (await sha256(`uid:${uid}`)).slice(0, 40);

export const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') ?? 'unknown';

export const today = () => new Date().toISOString().slice(0, 10);
