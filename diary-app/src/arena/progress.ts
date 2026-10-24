import { elementBonus, HAS_3D, ITEMS, itemDef, MAX_ITEM_LEVEL, MAX_LEVEL, MoveId, Rarity, RARITIES, RARITY, SPECIES, SpeciesId, STAGES_PER_WORLD, Stats, WORLDS } from './data';

/** One owned item: which item, its upgrade level, a unique id. */
export type OwnedItem = { uid: string; id: string; level: number };

export type Fighter = {
  species: SpeciesId;
  name: string;
  level: number;
  /** cosmetic skin id (see SKINS) */
  skin?: string;
  /** map enemies only: below 1 makes early stages gentler */
  handicap?: number;
  equip: Partial<Record<'weapon' | 'armor' | 'head' | 'charm', OwnedItem>>;
};

// ---- Levels 1–500 ----

/** XP needed to go from `level` to `level + 1`. Early levels come fast, later ones take real play. */
export const xpToNext = (level: number) => Math.round(30 + level * 10 + Math.pow(level, 1.5) * 0.5);

/** Adds XP, returning the new level, the leftover XP and how many levels were gained. */
export function addXp(level: number, xp: number, gain: number) {
  let l = level;
  let x = xp + gain;
  let ups = 0;
  while (l < MAX_LEVEL && x >= xpToNext(l)) {
    x -= xpToNext(l);
    l++;
    ups++;
  }
  if (l >= MAX_LEVEL) x = 0;
  return { level: l, xp: x, ups };
}

// ---- Stats ----

/** Percent per bonus point, per stat (item numbers in data.ts are points). */
const PCT: Record<keyof Stats, number> = { hp: 0.6, atk: 1.5, def: 1.5, spd: 1 };

/** An item's bonus as whole percents of the fighter's own stats — so gear matters the same at level 5 and 450. */
export function itemBonus(o: OwnedItem): Partial<Stats> {
  const d = itemDef(o.id);
  if (!d) return {};
  const k = RARITY[d.rarity].mult * (1 + (o.level - 1) * 0.03);
  const out: Partial<Stats> = {};
  for (const [s, v] of Object.entries(d.bonus) as [keyof Stats, number][]) out[s] = Math.round(v * PCT[s] * k);
  return out;
}

export function statsOf(f: Fighter): Stats {
  const b = SPECIES[f.species].base;
  const g = 1 + (f.level - 1) * 0.05;
  const pct: Stats = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const o of Object.values(f.equip)) {
    if (!o) continue;
    const bonus = itemBonus(o);
    for (const k of Object.keys(pct) as (keyof Stats)[]) pct[k] += bonus[k] ?? 0;
  }
  return {
    hp: Math.round(b.hp * g * (1 + pct.hp / 100)),
    atk: Math.round(b.atk * g * (1 + pct.atk / 100)),
    def: Math.round(b.def * g * (1 + pct.def / 100)),
    spd: Math.round(b.spd * (1 + (f.level - 1) * 0.002) * (1 + pct.spd / 100)),
  };
}

/** A single "power" number for cards and matchmaking. */
export const powerOf = (f: Fighter) => {
  const s = statsOf(f);
  return Math.round(s.hp * 0.6 + s.atk * 6 + s.def * 4 + s.spd * 5);
};

/** The fighter's battle cards: its signature move, plus a move from each item that has one, plus a basic bite. */
export function deckOf(f: Fighter): MoveId[] {
  const moves: MoveId[] = [SPECIES[f.species].signature];
  for (const o of Object.values(f.equip)) {
    const m = o && itemDef(o.id)?.move;
    if (m && !moves.includes(m)) moves.push(m);
  }
  for (const extra of ['bite', 'shield', 'heal', 'rage'] as MoveId[]) if (moves.length < 4 && !moves.includes(extra)) moves.push(extra);
  return moves.slice(0, 4);
}

// ---- Worlds and stages ----

export const worldOfStage = (stage: number) => WORLDS[Math.min(WORLDS.length - 1, Math.floor((stage - 1) / STAGES_PER_WORLD))];
export const stageInWorld = (stage: number) => ((stage - 1) % STAGES_PER_WORLD) + 1;
export const isBoss = (stage: number) => stageInWorld(stage) % 10 === 0;
export const isWorldBoss = (stage: number) => stageInWorld(stage) === STAGES_PER_WORLD;

/** Enemy level for a map stage: 250 stages climb from level 1 to about 400; ranked play takes you on to 500. */
export const stageLevel = (stage: number) => Math.max(1, Math.round(1 + (stage - 1) * 1.6));

/** How hard the opponent plays its cards on a stage (0.3 at the start, 0.85 at the end). */
export const stageSkill = (stage: number) => Math.min(0.8, 0.3 + (stage / 250) * 0.45 + (isBoss(stage) ? 0.05 : 0));

/** Early stages are gentler: a first-time player should win the first world while learning. */
export const stageHandicap = (stage: number) => (stage <= 3 ? 0.7 : stage <= 10 ? 0.8 : stage <= 50 ? 0.88 : 0.9) * (isWorldBoss(stage) ? 1 : isBoss(stage) ? 1.04 : 1);

function seeded(n: number) {
  let s = n * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const ITEMS_BY_RARITY = (r: Rarity) => ITEMS.filter((i) => i.rarity === r);

/** The rarity an item drop rolls at a given stage (better drops deeper in the map). */
export function rollRarity(stage: number, rnd = Math.random, luck = 0): Rarity {
  const t = Math.min(1, stage / 250) + luck;
  const r = rnd();
  if (r < 0.01 + t * 0.04) return 'mythic';
  if (r < 0.05 + t * 0.12) return 'legendary';
  if (r < 0.18 + t * 0.22) return 'epic';
  if (r < 0.45 + t * 0.2) return 'rare';
  return 'common';
}

export function rollItem(stage: number, rnd = Math.random, luck = 0): OwnedItem {
  const pool = ITEMS_BY_RARITY(rollRarity(stage, rnd, luck));
  const d = pool[Math.floor(rnd() * pool.length)] ?? ITEMS[0];
  return { uid: `${Date.now().toString(36)}${Math.floor(rnd() * 1e6).toString(36)}`, id: d.id, level: 1 };
}

/** The enemy for a map stage: species from the world's list (the boss on boss stages), level and gear by depth. */
export function enemyForStage(stage: number): Fighter {
  const w = worldOfStage(stage);
  const rnd = seeded(stage);
  const species = isBoss(stage) ? (isWorldBoss(stage) ? w.boss : w.enemies[Math.floor(rnd() * w.enemies.length)]) : w.enemies[Math.floor(rnd() * w.enemies.length)];
  const level = stageLevel(stage);
  const equip: Fighter['equip'] = {};
  const gear = Math.min(4, Math.floor(stage / 40) + (isBoss(stage) && stage > 10 ? 1 : 0));
  const slots = ['weapon', 'armor', 'charm', 'head'] as const;
  for (let i = 0; i < gear; i++) {
    const slot = slots[i];
    const pool = ITEMS.filter((it) => it.slot === slot && RARITIES.indexOf(it.rarity) <= Math.min(4, Math.floor(stage / 50)));
    if (!pool.length) continue;
    const d = pool[Math.floor(rnd() * pool.length)];
    equip[slot] = { uid: `e${stage}${i}`, id: d.id, level: Math.min(MAX_ITEM_LEVEL, 1 + Math.floor(stage / 6)) };
  }
  return { species, name: SPECIES[species].name, level, equip, handicap: stageHandicap(stage) };
}

/** Rewards for winning a stage (stars 1–3). First clears pay more. */
export function stageRewards(stage: number, stars: number, firstClear: boolean) {
  const base = 20 + stage * 6;
  return {
    coins: Math.round(base * (0.6 + stars * 0.2) * (firstClear ? 1.5 : 0.5)),
    xp: Math.round((40 + stage * 25) * (0.7 + stars * 0.15) * (firstClear ? 1 : 0.4)),
    gems: firstClear && isBoss(stage) ? (isWorldBoss(stage) ? 50 : 10) : 0,
    chest: firstClear && isBoss(stage),
  };
}

// ---- Upgrades ----

export const upgradeCost = (o: OwnedItem) => {
  const d = itemDef(o.id);
  const r = d ? RARITIES.indexOf(d.rarity) + 1 : 1;
  return Math.round((40 + o.level * 35 + Math.pow(o.level, 1.8) * 4) * (0.8 + r * 0.25));
};

// ---- Chests ----

export type ChestKind = 'wood' | 'silver' | 'gold' | 'magic';
export const CHESTS: Record<ChestKind, { name: string; items: number; luck: number; coins: number; gems: number; color: string; cost: number }> = {
  wood: { name: 'תיבת עץ', items: 1, luck: 0, coins: 60, gems: 0, color: '#B45309', cost: 0 },
  silver: { name: 'תיבת כסף', items: 2, luck: 0.05, coins: 150, gems: 2, color: '#94A3B8', cost: 30 },
  gold: { name: 'תיבת זהב', items: 3, luck: 0.12, coins: 400, gems: 5, color: '#F59E0B', cost: 80 },
  magic: { name: 'תיבת קסם', items: 4, luck: 0.25, coins: 900, gems: 12, color: '#C026D3', cost: 200 },
};

export function openChest(kind: ChestKind, stage: number) {
  const c = CHESTS[kind];
  const items = Array.from({ length: c.items }, () => rollItem(Math.max(stage, 10), Math.random, c.luck));
  return { items, coins: Math.round(c.coins * (1 + stage / 60)), gems: c.gems };
}

// ---- Ranked ----

/** Trophy change for a ranked battle: more for beating someone stronger. */
export function trophyDelta(win: boolean, mine: number, theirs: number) {
  const diff = Math.max(-400, Math.min(400, theirs - mine));
  return win ? Math.round(30 + diff / 25) : -Math.round(Math.max(8, 20 - diff / 40));
}

/** A bot opponent close to the player's trophies and level, for offline ranked play. */
export function botOpponent(trophies: number, level: number) {
  const pool = HAS_3D;
  const sp = pool[Math.floor(Math.random() * pool.length)];
  const lvl = Math.max(1, Math.round(level + (Math.random() * 6 - 3)));
  const stage = Math.max(1, Math.round(lvl / 1.9));
  const f = enemyForStage(stage);
  const names = ['נועה_הדרקונית', 'איתי_הדוב', 'מאיה_קסם', 'רון_ברק', 'שירה_אש', 'עומר_צל', 'דניאל_צ׳י', 'ליה_קשת', 'יואב_הגדול', 'תמר_מזל', 'גל_הסערה', 'אורי_הקרח'];
  return {
    fighter: { ...f, species: sp, name: SPECIES[sp].name, level: lvl },
    player: names[Math.floor(Math.random() * names.length)],
    trophies: Math.max(0, Math.round(trophies + (Math.random() * 160 - 80))),
  };
}

export { elementBonus };
