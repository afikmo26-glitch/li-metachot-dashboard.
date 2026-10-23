import { Env, HttpError, today } from './env';

/**
 * Daily counters in KV: rl:<bucket>:<who>:<date>. Good enough to stop abuse,
 * not exact (KV has no atomic increment, parallel requests can slip through).
 */

export const LIMITS = { ai: 300, transcribe: 40, crash: 50, arena: 1500 } as const;
export type Bucket = keyof typeof LIMITS;

export async function rateLimit(env: Env, bucket: Bucket, who: string): Promise<void> {
  const kv = env.DATA ?? env.CODES;
  if (!kv) return; // no storage bound: nothing to count with
  const key = `rl:${bucket}:${who}:${today()}`;
  const n = Number((await kv.get(key)) ?? 0);
  if (n >= LIMITS[bucket]) throw new HttpError(429, { error: 'rate_limited' });
  await kv.put(key, String(n + 1), { expirationTtl: 2 * 86400 });
}
