import { handleChat, handleTranscribe } from './ai';
import { handleArena } from './arena';
import { handleAuth, requireUser, sessionUid } from './auth';
import { handleCrash } from './crash';
import { clientIp, CORS, data, Env, HttpError, json, uidKey } from './env';
import { deletePet, handlePet } from './pet';
import { rateLimit } from './ratelimit';
import { handleRecover } from './recover';
import { blobKey, handleSync, metaKey } from './sync';

export type { Env } from './env';

/**
 * Server for the diary app (Cloudflare Worker). API keys stay here as secrets and never ship in the app.
 *
 *   POST /auth/*               sign in with a code, Google or Apple (auth.ts)
 *   GET|PUT /sync, /sync/meta  end-to-end encrypted backup (sync.ts)
 *   DELETE /account            wipes everything stored for the user
 *   POST /chat, /summarize, /transcribe   AI with daily limits (ai.ts)
 *   POST /crash                crash reports (crash.ts)
 *   /pet…                      visiting friends' pets (pet.ts)
 *   POST /recover/*            password reset codes by email / SMS (recover.ts)
 *   /arena/…                   Pet Arena leaderboard and online opponents (arena.ts)
 *
 * Every request must carry the header `x-app-key: <APP_KEY>`; user routes also `authorization: Bearer <token>`.
 */

type Body = Record<string, unknown>;

async function readBody(req: Request): Promise<Body> {
  if (req.method === 'GET' || req.method === 'DELETE') return {};
  const text = await req.text();
  if (!text) return {};
  try {
    const b = JSON.parse(text);
    if (b && typeof b === 'object' && !Array.isArray(b)) return b;
  } catch {
    // fall through
  }
  throw new HttpError(400, { error: 'bad json' });
}

async function route(req: Request, env: Env): Promise<[number, unknown]> {
  const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
  const method = req.method;
  const body = await readBody(req);

  if (method === 'POST' && path.startsWith('/recover/')) {
    return handleRecover(path, body, { ...env, CODES: env.CODES ?? env.DATA });
  }

  if (method === 'POST' && path.startsWith('/auth/')) return handleAuth(path, body, req, env);

  if (path === '/sync' || path === '/sync/meta') {
    return handleSync(method, path, body, await requireUser(req, env), env);
  }

  if (method === 'DELETE' && path === '/account') {
    const uid = await requireUser(req, env);
    const k = await uidKey(uid);
    const kv = data(env);
    await Promise.all([kv.delete(metaKey(k)), kv.delete(blobKey(k)), deletePet(env, k)]);
    return [200, { ok: true }];
  }

  if (method === 'POST' && (path === '/chat' || path === '/summarize' || path === '/transcribe')) {
    // signed-in users are counted per account, everyone else per IP
    const uid = await sessionUid(req, env);
    const who = uid ? `u:${await uidKey(uid)}` : `ip:${clientIp(req)}`;
    if (path === '/transcribe') {
      await rateLimit(env, 'transcribe', who);
      return handleTranscribe(body, env);
    }
    await rateLimit(env, 'ai', who);
    return handleChat(path, body, env);
  }

  if (method === 'POST' && path === '/crash') return handleCrash(body, req, env);

  if (path.startsWith('/arena/')) {
    await rateLimit(env, 'arena', `ip:${clientIp(req)}`);
    return handleArena(method, new URL(req.url), body, env);
  }

  if (path === '/pet' || path.startsWith('/pet/')) {
    const uid = await sessionUid(req, env);
    const res = await handlePet(method, path, body, uid, env);
    if (res) return res;
    await requireUser(req, env); // throws the right 401 / 501
    return [401, { error: 'sign in required' }];
  }

  return [404, { error: 'not found' }];
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.APP_KEY || req.headers.get('x-app-key') !== env.APP_KEY) return json({ error: 'unauthorized' }, 401);
    try {
      const [status, body] = await route(req, env);
      return json(body, status);
    } catch (err) {
      if (err instanceof HttpError) return json(err.body, err.status);
      console.error(err);
      return json({ error: 'server error' }, 500);
    }
  },
};
