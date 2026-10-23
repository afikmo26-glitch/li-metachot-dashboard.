import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { itemDef, MAX_ITEM_LEVEL, normSpecies, skinDef, Slot, SPECIES, SpeciesId, TOTAL_STAGES } from './data';
import { addXp, ChestKind, CHESTS, Fighter, openChest, OwnedItem, stageRewards, trophyDelta, upgradeCost } from './progress';

const KEY = 'diary.arena.v1';

export type ArenaState = {
  v: 1;
  fighter: Fighter | null;
  xp: number;
  coins: number;
  gems: number;
  trophies: number;
  best: number;
  /** highest stage unlocked on the map */
  stage: number;
  stars: Record<number, number>;
  inventory: OwnedItem[];
  chests: ChestKind[];
  /** creatures that joined you (from bosses and chests); up to 3 stand guard */
  guards: SpeciesId[];
  wins: number;
  losses: number;
  /** day key of the last diary bonus */
  diaryBonusDay?: string;
  /** battles left with double XP */
  boost: number;
  /** skins bought (ids from SKINS) */
  skins: string[];
};

const EMPTY: ArenaState = { v: 1, fighter: null, xp: 0, coins: 150, gems: 10, trophies: 0, best: 0, stage: 1, stars: {}, inventory: [], chests: ['wood'], guards: [], wins: 0, losses: 0, boost: 0, skins: [] };

type Ctx = {
  ready: boolean;
  s: ArenaState;
  choose: (species: SpeciesId, name: string) => void;
  equip: (uid: string) => void;
  unequip: (slot: Slot) => void;
  upgrade: (uid: string) => boolean;
  sell: (uid: string) => number;
  winStage: (stage: number, stars: number) => ReturnType<typeof stageRewards> & { levelUps: number; newGuard?: SpeciesId };
  loseStage: () => void;
  ranked: (win: boolean, theirTrophies: number) => { delta: number; coins: number; xp: number; levelUps: number };
  open: (index: number) => ReturnType<typeof openChest>;
  buyChest: (kind: ChestKind) => boolean;
  claimDiaryBonus: (dayKey: string) => boolean;
  toggleGuard: (sp: SpeciesId) => void;
  buySkin: (id: string) => boolean;
  wearSkin: (id: string | undefined) => void;
  reset: () => void;
};

const ArenaCtx = createContext<Ctx | null>(null);

export function ArenaProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<ArenaState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setS(migrate({ ...EMPTY, ...JSON.parse(raw) })))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((fn: (p: ArenaState) => ArenaState) => {
    setS((p) => {
      const n = fn(p);
      AsyncStorage.setItem(KEY, JSON.stringify(n)).catch(() => {});
      return n;
    });
  }, []);

  const gainXp = (p: ArenaState, xp: number) => {
    if (!p.fighter) return { p, ups: 0 };
    const r = addXp(p.fighter.level, p.xp, xp * (p.boost > 0 ? 2 : 1));
    return { p: { ...p, xp: r.xp, boost: Math.max(0, p.boost - 1), fighter: { ...p.fighter, level: r.level } }, ups: r.ups };
  };

  const ctx = useMemo<Ctx>(
    () => ({
      ready,
      s,
      choose: (species, name) =>
        update((p) => {
          const starter: OwnedItem = { uid: 'start-dagger', id: 'Dagger', level: 1 };
          return { ...p, fighter: { species, name: name || SPECIES[species].name, level: 1, equip: { weapon: starter } } };
        }),
      equip: (uid) =>
        update((p) => {
          const it = p.inventory.find((i) => i.uid === uid);
          const d = it && itemDef(it.id);
          if (!it || !d || !p.fighter) return p;
          const old = p.fighter.equip[d.slot];
          const inv = p.inventory.filter((i) => i.uid !== uid);
          if (old) inv.push(old);
          return { ...p, inventory: inv, fighter: { ...p.fighter, equip: { ...p.fighter.equip, [d.slot]: it } } };
        }),
      unequip: (slot) =>
        update((p) => {
          const it = p.fighter?.equip[slot];
          if (!it || !p.fighter) return p;
          const equip = { ...p.fighter.equip };
          delete equip[slot];
          return { ...p, inventory: [...p.inventory, it], fighter: { ...p.fighter, equip } };
        }),
      upgrade: (uid) => {
        let ok = false;
        update((p) => {
          const bump = (o: OwnedItem) => ({ ...o, level: o.level + 1 });
          const all = [...p.inventory, ...Object.values(p.fighter?.equip ?? {}).filter(Boolean)] as OwnedItem[];
          const it = all.find((i) => i.uid === uid);
          if (!it || it.level >= MAX_ITEM_LEVEL) return p;
          const cost = upgradeCost(it);
          if (p.coins < cost) return p;
          ok = true;
          const equip = Object.fromEntries(Object.entries(p.fighter?.equip ?? {}).map(([k, o]) => [k, o && o.uid === uid ? bump(o) : o]));
          return { ...p, coins: p.coins - cost, inventory: p.inventory.map((i) => (i.uid === uid ? bump(i) : i)), fighter: p.fighter ? { ...p.fighter, equip } : p.fighter };
        });
        return ok;
      },
      sell: (uid) => {
        let got = 0;
        update((p) => {
          const it = p.inventory.find((i) => i.uid === uid);
          if (!it) return p;
          got = Math.round(upgradeCost(it) * 0.4);
          return { ...p, coins: p.coins + got, inventory: p.inventory.filter((i) => i.uid !== uid) };
        });
        return got;
      },
      winStage: (stage, stars) => {
        const first = !s.stars[stage];
        const r = stageRewards(stage, stars, first);
        let levelUps = 0;
        let newGuard: SpeciesId | undefined;
        update((p0) => {
          const g = gainXp(p0, r.xp);
          levelUps = g.ups;
          const p = g.p;
          const enemySp = r.chest ? (p.guards.length < 21 ? bossGuard(stage, p.guards) : undefined) : undefined;
          newGuard = enemySp;
          return {
            ...p,
            coins: p.coins + r.coins,
            gems: p.gems + r.gems,
            stars: { ...p.stars, [stage]: Math.max(p.stars[stage] ?? 0, stars) },
            stage: Math.min(TOTAL_STAGES, Math.max(p.stage, stage + 1)),
            chests: r.chest ? [...p.chests, (stage % 50 === 0 ? 'magic' : 'gold') as ChestKind].slice(-8) : stars === 3 && first && Math.random() < 0.35 ? [...p.chests, 'wood' as ChestKind].slice(-8) : p.chests,
            guards: enemySp ? [...p.guards, enemySp] : p.guards,
            wins: p.wins + 1,
          };
        });
        return { ...r, levelUps, newGuard };
      },
      loseStage: () => update((p) => ({ ...p, losses: p.losses + 1 })),
      ranked: (win, theirs) => {
        const delta = trophyDelta(win, s.trophies, theirs);
        const coins = win ? 40 + Math.round(s.trophies / 40) : 10;
        const xp = win ? 60 + (s.fighter?.level ?? 1) * 4 : 20;
        let levelUps = 0;
        update((p0) => {
          const g = gainXp(p0, xp);
          levelUps = g.ups;
          const p = g.p;
          const trophies = Math.max(0, p.trophies + delta);
          return { ...p, trophies, best: Math.max(p.best, trophies), coins: p.coins + coins, wins: p.wins + (win ? 1 : 0), losses: p.losses + (win ? 0 : 1), chests: win && Math.random() < 0.3 ? [...p.chests, 'silver' as ChestKind].slice(-8) : p.chests };
        });
        return { delta, coins, xp, levelUps };
      },
      open: (index) => {
        const kind = s.chests[index] ?? 'wood';
        const res = openChest(kind, s.stage);
        update((p) => ({ ...p, chests: p.chests.filter((_, i) => i !== index), inventory: [...p.inventory, ...res.items], coins: p.coins + res.coins, gems: p.gems + res.gems }));
        return res;
      },
      buyChest: (kind) => {
        const cost = CHESTS[kind].cost;
        if (s.gems < cost) return false;
        update((p) => ({ ...p, gems: p.gems - cost, chests: [...p.chests, kind].slice(-8) }));
        return true;
      },
      claimDiaryBonus: (day) => {
        if (s.diaryBonusDay === day) return false;
        update((p) => ({ ...p, diaryBonusDay: day, boost: p.boost + 3, chests: [...p.chests, 'silver' as ChestKind].slice(-8) }));
        return true;
      },
      toggleGuard: (sp) =>
        update((p) => {
          // the first three guards in the list stand guard; tapping moves a creature to the front or back
          const rest = p.guards.filter((g) => g !== sp);
          const idx = p.guards.indexOf(sp);
          return { ...p, guards: idx >= 0 && idx < 3 ? [...rest, sp] : [sp, ...rest] };
        }),
      buySkin: (id) => {
        const k = skinDef(id);
        if (!k || s.skins.includes(id) || s.gems < k.price) return false;
        update((p) => ({ ...p, gems: p.gems - k.price, skins: [...p.skins, id], fighter: p.fighter && p.fighter.species === k.species ? { ...p.fighter, skin: id } : p.fighter }));
        return true;
      },
      wearSkin: (id) => update((p) => (p.fighter && (!id || (p.skins.includes(id) && skinDef(id)?.species === p.fighter.species)) ? { ...p, fighter: { ...p.fighter, skin: id } } : p)),
      reset: () => update(() => EMPTY),
    }),
    [ready, s, update],
  );

  return <ArenaCtx.Provider value={ctx}>{children}</ArenaCtx.Provider>;
}

/** A boss stage gives you a creature from that world that you don't have yet. */
function bossGuard(stage: number, have: SpeciesId[]): SpeciesId | undefined {
  const all = Object.keys(SPECIES) as SpeciesId[];
  const left = all.filter((x) => !have.includes(x));
  return left.length ? left[(stage * 7) % left.length] : undefined;
}

export function useArena(): Ctx {
  const c = useContext(ArenaCtx);
  if (!c) throw new Error('useArena must be used inside ArenaProvider');
  return c;
}

/** Saves from the first version used other fighter ids; map them onto the new roster. */
function migrate(p: ArenaState): ArenaState {
  return {
    ...p,
    skins: p.skins ?? [],
    fighter: p.fighter ? { ...p.fighter, species: normSpecies(p.fighter.species) } : null,
    guards: [...new Set((p.guards ?? []).map(normSpecies))],
  };
}
