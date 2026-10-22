import { data, Env, uidKey } from './env';

/**
 * End-to-end encrypted backup. The app encrypts the diary with a key derived from the user's
 * password (+ salt) before upload, so this server only ever stores ciphertext it cannot read.
 *
 *   GET  /sync/meta  -> { exists, updatedAt?, size?, salt?, version? }
 *   GET  /sync       -> { blob, salt, updatedAt, version } | 404
 *   PUT  /sync       { blob, salt, updatedAt, baseVersion? } -> { ok, version } | 409 { version, updatedAt } | 413
 *
 * KV: sync:meta:<id> (small, read often) and sync:blob:<id> (the ciphertext).
 * KV is not transactional, so baseVersion guards against stale devices, not perfect races.
 */

export const MAX_BLOB = 20 * 1024 * 1024;
const B64_RE = /^[A-Za-z0-9+/_-]*={0,2}$/;

type Meta = { updatedAt: string; size: number; salt: string; version: number };

export const metaKey = (k: string) => `sync:meta:${k}`;
export const blobKey = (k: string) => `sync:blob:${k}`;

export async function handleSync(method: string, path: string, body: Record<string, unknown>, uid: string, env: Env): Promise<[number, unknown]> {
  const kv = data(env);
  const k = await uidKey(uid);
  const meta = await kv.get<Meta>(metaKey(k), 'json');

  if (method === 'GET' && path === '/sync/meta') {
    return [200, meta ? { exists: true, ...meta } : { exists: false }];
  }

  if (method === 'GET' && path === '/sync') {
    if (!meta) return [404, { error: 'no backup' }];
    const blob = await kv.get(blobKey(k));
    if (blob === null) return [404, { error: 'no backup' }];
    return [200, { blob, salt: meta.salt, updatedAt: meta.updatedAt, version: meta.version }];
  }

  if (method === 'PUT' && path === '/sync') {
    const { blob, salt, updatedAt, baseVersion } = body;
    if (typeof blob !== 'string' || !blob) return [400, { error: 'bad blob' }];
    if (blob.length > MAX_BLOB) return [413, { error: 'backup too large' }];
    if (!B64_RE.test(blob)) return [400, { error: 'blob must be base64' }];
    if (typeof salt !== 'string' || !salt || salt.length > 256) return [400, { error: 'bad salt' }];
    if (typeof updatedAt !== 'string' || updatedAt.length > 40 || Number.isNaN(Date.parse(updatedAt))) return [400, { error: 'bad updatedAt' }];
    if (baseVersion !== undefined && baseVersion !== null && typeof baseVersion !== 'number') return [400, { error: 'bad baseVersion' }];

    const current = meta?.version ?? 0;
    if (typeof baseVersion === 'number' && baseVersion !== current) return [409, { version: current, updatedAt: meta?.updatedAt ?? null }];

    const next: Meta = { updatedAt, size: blob.length, salt, version: current + 1 };
    await kv.put(blobKey(k), blob);
    await kv.put(metaKey(k), JSON.stringify(next));
    return [200, { ok: true, version: next.version }];
  }

  return [404, { error: 'not found' }];
}
