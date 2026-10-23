import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '../lib/crypto';
import { SERVER } from '../config';
import { itemDef, SPECIES, SpeciesId } from './data';
import { Fighter } from './progress';
import type { ArenaState } from './state';

/**
 * Pet Arena online: publishes your fighter card and trophies, fetches real players to duel (their saved
 * fighters, played by the AI) and the national leaderboard. Everything fails soft — offline, the game uses bots.
 */

const SECRET_KEY = 'diary.arena.secret';
let cached: { secret: string; id: string } | null = null;

const srv = () => (SERVER.url && SERVER.appKey ? { url: SERVER.url.replace(/\/$/, ''), key: SERVER.appKey } : null);

const sha256hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));

async function me() {
  if (cached) return cached;
  let secret = await AsyncStorage.getItem(SECRET_KEY).catch(() => null);
  if (!secret) {
    secret = bytesToHex(randomBytes(24));
    await AsyncStorage.setItem(SECRET_KEY, secret).catch(() => {});
  }
  cached = { secret, id: sha256hex(`arena:${secret}`).slice(0, 16) };
  return cached;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const s = srv();
  if (!s) throw new Error('offline');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${s.url}${path}`, { method, signal: ctrl.signal, headers: { 'content-type': 'application/json', 'x-app-key': s.key }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** Name shown on the leaderboard: letters, digits and a few signs only, 14 at most. */
export const cleanName = (n: string) => n.replace(/[^\p{L}\p{N}_ .\-'׳"]/gu, '').trim().slice(0, 14) || 'שחקן';

export async function publish(s: ArenaState) {
  if (!s.fighter) return;
  const { secret } = await me();
  const equip = Object.fromEntries(Object.entries(s.fighter.equip).filter(([, o]) => o).map(([slot, o]) => [slot, { id: o!.id, level: o!.level }]));
  return req<{ id: string; trophies: number; rank: number | null }>('PUT', '/arena/profile', {
    secret,
    card: { name: cleanName(s.fighter.name), species: s.fighter.species, level: s.fighter.level, trophies: s.trophies, wins: s.wins, equip },
  });
}

type Card = { name: string; species: string; level: number; trophies: number; equip: Record<string, { id: string; level: number }> };

/** A real player's fighter near your trophies, or null when there's nobody (or no internet). */
export async function findOpponent(trophies: number): Promise<{ fighter: Fighter; player: string; trophies: number } | null> {
  try {
    const { id } = await me();
    const r = await req<{ card: Card | null }>('GET', `/arena/opponent?t=${trophies}&id=${id}`);
    const c = r.card;
    if (!c || !(c.species in SPECIES)) return null;
    const equip: Fighter['equip'] = {};
    for (const [slot, o] of Object.entries(c.equip)) if (itemDef(o.id)) equip[slot as keyof Fighter['equip']] = { uid: `opp-${slot}`, id: o.id, level: o.level };
    return { fighter: { species: c.species as SpeciesId, name: SPECIES[c.species as SpeciesId].name, level: c.level, equip }, player: c.name, trophies: c.trophies };
  } catch {
    return null;
  }
}

export type TopRow = { id: string; name: string; species: string; level: number; trophies: number; me?: boolean };

export async function fetchTop(): Promise<TopRow[]> {
  const { id } = await me();
  const r = await req<{ rows: TopRow[] }>('GET', `/arena/top?id=${id}`);
  return r.rows;
}
