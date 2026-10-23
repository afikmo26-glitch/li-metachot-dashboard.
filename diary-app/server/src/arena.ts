import { data, Env, HttpError, sha256 } from './env';

/**
 * Pet Arena online: a national leaderboard and asynchronous duels against other players' saved fighters.
 * No account needed — each device keeps a random secret, and its public id is a hash of it.
 *
 *   PUT /arena/profile   { secret, card }      saves your fighter card and trophies -> { id, rank }
 *   GET /arena/opponent?t=<trophies>&id=<id>   a real player's card near your trophies -> { card } | { card: null }
 *   GET /arena/top?id=<id>                     the top 50 -> { rows: [...], me?: { rank, trophies } }
 *
 * KV: ar:p:<id> card, ar:top [{id, name, species, level, trophies}] (top 100), ar:b:<bucket> [ids] (matchmaking, 200 trophies a bucket)
 */

export type ArenaCard = {
  name: string;
  species: string;
  level: number;
  trophies: number;
  wins: number;
  equip: Record<string, { id: string; level: number }>;
  updatedAt?: string;
};
type TopRow = { id: string; name: string; species: string; level: number; trophies: number };

const ID_RE = /^[a-f0-9]{16}$/;
const NAME_RE = /^[\p{L}\p{N}_ .\-'׳"]{1,14}$/u;
const BUCKET = 200;
const TOP_SIZE = 100;

const pKey = (id: string) => `ar:p:${id}`;
const bKey = (t: number) => `ar:b:${Math.floor(Math.max(0, t) / BUCKET)}`;

export function cleanArenaCard(raw: unknown): ArenaCard | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  if (!NAME_RE.test(name)) return null;
  if (typeof c.species !== 'string' || !/^[A-Za-z_]{2,24}$/.test(c.species)) return null;
  const int = (v: unknown, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
  if (!int(c.level, 500) || !int(c.trophies, 20000) || !int(c.wins, 1_000_000)) return null;
  if (!c.equip || typeof c.equip !== 'object' || Array.isArray(c.equip)) return null;
  const equip: ArenaCard['equip'] = {};
  for (const [slot, v] of Object.entries(c.equip as Record<string, unknown>)) {
    if (!['weapon', 'armor', 'head', 'charm'].includes(slot)) return null;
    const it = v as Record<string, unknown>;
    if (!it || typeof it.id !== 'string' || !/^[A-Za-z0-9_]{2,32}$/.test(it.id) || !int(it.level, 50)) return null;
    equip[slot] = { id: it.id, level: it.level as number };
  }
  return { name, species: c.species, level: c.level as number, trophies: c.trophies as number, wins: c.wins as number, equip };
}

export async function arenaId(secret: unknown): Promise<string> {
  if (typeof secret !== 'string' || !/^[a-f0-9]{32,64}$/.test(secret)) throw new HttpError(400, { error: 'bad secret' });
  return (await sha256(`arena:${secret}`)).slice(0, 16);
}

export async function handleArena(method: string, url: URL, body: Record<string, unknown>, env: Env): Promise<[number, unknown]> {
  const kv = data(env);
  const path = url.pathname.replace(/\/+$/, '');

  if (method === 'PUT' && path === '/arena/profile') {
    const id = await arenaId(body.secret);
    const card = cleanArenaCard(body.card);
    if (!card) return [400, { error: 'bad card' }];
    const old = await kv.get<ArenaCard>(pKey(id), 'json');
    // trophies can only move a battle's worth at a time, so a tampered app can't jump to the top
    if (old) card.trophies = Math.max(old.trophies - 60, Math.min(old.trophies + 80, card.trophies));
    else card.trophies = Math.min(card.trophies, 200);
    card.updatedAt = new Date().toISOString();
    await kv.put(pKey(id), JSON.stringify(card));

    // matchmaking bucket: newest first, at most 50 ids
    const bk = bKey(card.trophies);
    const ids = ((await kv.get<string[]>(bk, 'json')) ?? []).filter((x) => x !== id);
    await kv.put(bk, JSON.stringify([id, ...ids].slice(0, 50)));
    if (old && bKey(old.trophies) !== bk) {
      const prev = ((await kv.get<string[]>(bKey(old.trophies), 'json')) ?? []).filter((x) => x !== id);
      await kv.put(bKey(old.trophies), JSON.stringify(prev));
    }

    // leaderboard
    const top = ((await kv.get<TopRow[]>('ar:top', 'json')) ?? []).filter((r) => r.id !== id);
    top.push({ id, name: card.name, species: card.species, level: card.level, trophies: card.trophies });
    top.sort((a, b) => b.trophies - a.trophies || b.level - a.level);
    await kv.put('ar:top', JSON.stringify(top.slice(0, TOP_SIZE)));
    const rank = top.findIndex((r) => r.id === id) + 1;
    return [200, { id, trophies: card.trophies, rank: rank > 0 ? rank : null }];
  }

  if (method === 'GET' && path === '/arena/opponent') {
    const t = Math.max(0, Math.min(20000, Number(url.searchParams.get('t')) || 0));
    const me = url.searchParams.get('id') ?? '';
    // look in your bucket first, then the ones around it
    for (const off of [0, -1, 1, -2, 2]) {
      const ids = ((await kv.get<string[]>(bKey(t + off * BUCKET), 'json')) ?? []).filter((x) => x !== me && ID_RE.test(x));
      if (!ids.length) continue;
      const pick = ids[Math.floor(Math.random() * Math.min(ids.length, 20))];
      const card = await kv.get<ArenaCard>(pKey(pick), 'json');
      if (card) return [200, { card }];
    }
    return [200, { card: null }];
  }

  if (method === 'GET' && path === '/arena/top') {
    const me = url.searchParams.get('id') ?? '';
    const top = (await kv.get<TopRow[]>('ar:top', 'json')) ?? [];
    const i = top.findIndex((r) => r.id === me);
    return [200, { rows: top.slice(0, 50).map((r) => ({ ...r, me: r.id === me })), ...(i >= 0 ? { me: { rank: i + 1, trophies: top[i].trophies } } : {}) }];
  }

  return [404, { error: 'not found' }];
}
