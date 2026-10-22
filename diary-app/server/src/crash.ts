import { clientIp, data, Env } from './env';
import { rateLimit } from './ratelimit';

/**
 * POST /crash { message, stack?, platform?, version?, at? } -> { ok }
 * Kept 30 days under crash:<ISO time>:<rand>. Read them with
 *   npx wrangler kv key list --binding DATA --prefix crash: --remote
 */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

export async function handleCrash(body: Record<string, unknown>, req: Request, env: Env): Promise<[number, unknown]> {
  const kv = data(env);
  const message = str(body.message, 500);
  if (!message) return [400, { error: 'no message' }];
  await rateLimit(env, 'crash', `ip:${clientIp(req)}`);
  const now = new Date().toISOString();
  const report = {
    message,
    stack: str(body.stack, 4000),
    platform: str(body.platform, 40),
    version: str(body.version, 40),
    at: str(body.at, 40),
    receivedAt: now,
  };
  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await kv.put(`crash:${now}:${rand}`, JSON.stringify(report), { expirationTtl: 30 * 86400 });
  return [200, { ok: true }];
}
