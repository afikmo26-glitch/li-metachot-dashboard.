import { data, Env, today, uidKey } from './env';

/**
 * Friends visit each other's pet by a short code.
 *
 *   PUT  /pet              (auth) { card: { name, species, wear, level, stage } } -> { code }
 *   GET  /pet              (auth) -> { code?, hearts, lastHeartAt? }
 *   GET  /pet/:code        -> { card, hearts } | 404
 *   POST /pet/:code/heart  (auth) -> { ok, hearts, already? }   once a day per friend, not your own
 *
 * KV: pet:u:<id> { code, card, hearts, lastHeartAt }, pet:c:<code> -> <id>, heart:<code>:<sender id>:<date>
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-Z0-9]{6}$/;

export type PetCard = { name: string; species: string; wear: Record<string, string>; level: number; stage: string };
type PetRecord = { code: string; card?: PetCard; hearts: number; lastHeartAt?: string };

const short = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

export function cleanCard(raw: unknown): PetCard | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  if (!name || [...name].length > 16) return null;
  if (!short(c.species, 24) || !short(c.stage, 24)) return null;
  if (typeof c.level !== 'number' || !Number.isInteger(c.level) || c.level < 0 || c.level > 1000) return null;
  if (!c.wear || typeof c.wear !== 'object' || Array.isArray(c.wear)) return null;
  const entries = Object.entries(c.wear as Record<string, unknown>);
  if (entries.length > 16) return null;
  const wear: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (k.length > 24 || !short(v, 32)) return null;
    wear[k] = v;
  }
  return { name, species: c.species, wear, level: c.level, stage: c.stage };
}

const newCode = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => ALPHABET[b % ALPHABET.length]).join('');

export const petKey = (k: string) => `pet:u:${k}`;
export const codeKey = (code: string) => `pet:c:${code}`;

export async function deletePet(env: Env, k: string) {
  const kv = data(env);
  const rec = await kv.get<PetRecord>(petKey(k), 'json');
  if (rec?.code) await kv.delete(codeKey(rec.code));
  await kv.delete(petKey(k));
}

export async function handlePet(method: string, path: string, body: Record<string, unknown>, uid: string | null, env: Env): Promise<[number, unknown] | null> {
  const kv = data(env);

  if (path === '/pet') {
    if (!uid) return null; // caller answers 401
    const k = await uidKey(uid);
    const rec = await kv.get<PetRecord>(petKey(k), 'json');
    if (method === 'GET') {
      return [200, rec ? { code: rec.code, hearts: rec.hearts, ...(rec.lastHeartAt ? { lastHeartAt: rec.lastHeartAt } : {}) } : { hearts: 0 }];
    }
    if (method === 'PUT') {
      const card = cleanCard(body.card);
      if (!card) return [400, { error: 'bad card' }];
      let code = rec?.code;
      for (let i = 0; !code && i < 8; i++) {
        const c = newCode();
        if (!(await kv.get(codeKey(c)))) code = c;
      }
      if (!code) return [503, { error: 'try again' }];
      if (!rec) await kv.put(codeKey(code), k);
      await kv.put(petKey(k), JSON.stringify({ ...rec, code, card, hearts: rec?.hearts ?? 0 } satisfies PetRecord));
      return [200, { code }];
    }
    return [404, { error: 'not found' }];
  }

  const m = /^\/pet\/([A-Za-z0-9]+)(\/heart)?$/.exec(path);
  if (!m) return [404, { error: 'not found' }];
  const code = m[1].toUpperCase();
  const heart = !!m[2];
  if ((heart && method !== 'POST') || (!heart && method !== 'GET')) return [404, { error: 'not found' }];
  if (heart && !uid) return null;

  const owner = CODE_RE.test(code) ? await kv.get(codeKey(code)) : null;
  const rec = owner ? await kv.get<PetRecord>(petKey(owner), 'json') : null;
  if (!owner || !rec?.card) return [404, { error: 'no such pet' }];

  if (!heart) return [200, { card: rec.card, hearts: rec.hearts }];

  const sender = await uidKey(uid!);
  if (sender === owner) return [400, { error: "can't heart your own pet" }];
  const onceKey = `heart:${code}:${sender}:${today()}`;
  if (await kv.get(onceKey)) return [200, { ok: true, hearts: rec.hearts, already: true }];
  await kv.put(onceKey, '1', { expirationTtl: 2 * 86400 });
  rec.hearts += 1;
  rec.lastHeartAt = new Date().toISOString();
  await kv.put(petKey(owner), JSON.stringify(rec));
  return [200, { ok: true, hearts: rec.hearts }];
}
