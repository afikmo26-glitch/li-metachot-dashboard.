import { elementBonus, MOVES, MoveId, SPECIES } from './data';
import { deckOf, Fighter, statsOf } from './progress';

/**
 * The duel itself. You hit by tapping the screen (fast taps build a combo and fill energy); the opponent
 * hits on its own, faster on harder stages. Both sides spend energy on their four move cards. Stop tapping
 * and you lose. Pure logic — the screen calls `tick` every frame and draws whatever `events` came out.
 */

export type Side = 0 | 1; // 0 = player (bottom), 1 = opponent (top)

export type Combatant = {
  fighter: Fighter;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  energy: number;
  deck: MoveId[];
  swing: number; // seconds until the next automatic hit
  burnUntil: number;
  burnDps: number;
  freezeUntil: number;
  stunUntil: number;
  rageUntil: number;
  /** after a stun or freeze wears off you can't be locked again straight away */
  ccImmuneUntil: number;
  /** healing has a cooldown so a fight can't be stalled forever */
  healReadyAt: number;
  shield: boolean;
  /** player only: tap cooldown, and the running combo of quick taps */
  tapReadyAt: number;
  lastTap: number;
  combo: number;
};

export type BattleEvent =
  | { id: number; kind: 'hit'; side: Side; amount: number; crit: boolean; strong: boolean; move?: MoveId; tap?: boolean; combo?: number }
  | { id: number; kind: 'move'; side: Side; move: MoveId }
  | { id: number; kind: 'heal'; side: Side; amount: number }
  | { id: number; kind: 'blocked'; side: Side }
  | { id: number; kind: 'burn'; side: Side; amount: number };

export type Battle = {
  t: number;
  limit: number;
  c: [Combatant, Combatant];
  events: BattleEvent[];
  over: boolean;
  winner?: Side;
  /** opponent AI: how often it thinks about playing a card */
  aiClock: number;
  aiSkill: number;
};

export const MAX_ENERGY = 10;
const ENERGY_PER_SEC = 0.6;

function combatant(f: Fighter): Combatant {
  const s = statsOf(f);
  const k = f.handicap ?? 1;
  return {
    fighter: f,
    maxHp: Math.round(s.hp * 16 * k), // battles last ~30–50 s
    hp: Math.round(s.hp * 16 * k),
    atk: Math.round(s.atk * k),
    def: s.def,
    spd: s.spd,
    energy: 4,
    deck: deckOf(f),
    swing: 1.2,
    burnUntil: 0,
    burnDps: 0,
    freezeUntil: 0,
    stunUntil: 0,
    rageUntil: 0,
    ccImmuneUntil: 0,
    healReadyAt: 0,
    shield: false,
    tapReadyAt: 0,
    lastTap: -9,
    combo: 0,
  };
}

export function newBattle(player: Fighter, enemy: Fighter, aiSkill = 0.6, limit = 90): Battle {
  return { t: 0, limit, c: [combatant(player), combatant(enemy)], events: [], over: false, aiClock: 1.5, aiSkill };
}

let nextId = 1;
const swingTime = (c: Combatant) => Math.max(0.75, 2.1 - c.spd * 0.045);

function damage(b: Battle, from: Side, power: number, move?: MoveId, tapCombo?: number) {
  const a = b.c[from];
  const d = b.c[from === 0 ? 1 : 0];
  const target: Side = from === 0 ? 1 : 0;
  if (d.shield) {
    d.shield = false;
    b.events.push({ id: nextId++, kind: 'blocked', side: target });
    return 0;
  }
  const m = move ? MOVES[move] : undefined;
  const el = m?.element ?? SPECIES[a.fighter.species].element;
  const bonus = elementBonus(el, SPECIES[d.fighter.species].element);
  const rage = b.t < a.rageUntil ? 1.5 : 1;
  const def = move === 'shadowClaw' ? d.def * 0.5 : d.def;
  // every 10th hit of a combo is a guaranteed crit
  const crit = tapCombo ? tapCombo % 10 === 0 : Math.random() < 0.08;
  const raw = a.atk * power * bonus * rage * (crit ? 1.6 : 1) * (0.9 + Math.random() * 0.2);
  // attack against defence as a ratio, so a battle takes about as long at level 5 as at level 450
  const amount = Math.max(1, Math.round(raw * (a.atk / (a.atk + def)) * 5));
  d.hp = Math.max(0, d.hp - amount);
  b.events.push({ id: nextId++, kind: 'hit', side: target, amount, crit, strong: bonus > 1, move, tap: tapCombo !== undefined, combo: tapCombo });
  return amount;
}

export const TAP_COOLDOWN = 0.2;
const TAP_POWER = 0.2;
const COMBO_WINDOW = 0.7;

/** The player taps: a quick hit. Taps in a row build a combo (more damage, more energy). */
export function tap(b: Battle): boolean {
  const c = b.c[0];
  if (b.over || b.t < c.tapReadyAt || b.t < c.freezeUntil || b.t < c.stunUntil) return false;
  c.combo = b.t - c.lastTap <= COMBO_WINDOW ? c.combo + 1 : 1;
  c.lastTap = b.t;
  c.tapReadyAt = b.t + TAP_COOLDOWN;
  c.energy = Math.min(MAX_ENERGY, c.energy + 0.12);
  damage(b, 0, TAP_POWER * (1 + Math.min(c.combo, 20) * 0.015), undefined, c.combo);
  check(b);
  return true;
}

/** Plays a card if the side can afford it. Returns false when it can't. */
export function play(b: Battle, side: Side, move: MoveId): boolean {
  const c = b.c[side];
  const m = MOVES[move];
  if (b.over || c.energy < m.cost || !c.deck.includes(move)) return false;
  if (m.effect === 'heal' && b.t < c.healReadyAt) return false;
  c.energy -= m.cost;
  b.events.push({ id: nextId++, kind: 'move', side, move });
  const foe = b.c[side === 0 ? 1 : 0];
  if (m.power > 0) {
    const dealt = damage(b, side, m.power, move);
    if (dealt > 0) {
      if (m.effect === 'burn') {
        foe.burnUntil = b.t + 4;
        foe.burnDps = c.atk * 0.9;
      }
      if ((m.effect === 'freeze' || m.effect === 'stun') && b.t >= foe.ccImmuneUntil) {
        const len = m.effect === 'freeze' ? 2 : 1.2;
        if (m.effect === 'freeze') foe.freezeUntil = b.t + len;
        else foe.stunUntil = b.t + len;
        foe.ccImmuneUntil = b.t + len + 2.5;
      }
      if (m.effect === 'drain') {
        const h = Math.round(dealt * 0.3);
        c.hp = Math.min(c.maxHp, c.hp + h);
        b.events.push({ id: nextId++, kind: 'heal', side, amount: h });
      }
    }
  }
  if (m.effect === 'shield') c.shield = true;
  if (m.effect === 'heal') {
    c.healReadyAt = b.t + 10;
    const h = Math.round(c.maxHp * 0.22);
    c.hp = Math.min(c.maxHp, c.hp + h);
    b.events.push({ id: nextId++, kind: 'heal', side, amount: h });
  }
  if (m.effect === 'rage') c.rageUntil = b.t + 5;
  check(b);
  return true;
}

function check(b: Battle) {
  if (b.over) return;
  const [p, e] = b.c;
  if (p.hp <= 0 || e.hp <= 0) {
    b.over = true;
    b.winner = e.hp <= 0 ? 0 : 1;
  } else if (b.t >= b.limit) {
    b.over = true;
    b.winner = p.hp / p.maxHp >= e.hp / e.maxHp ? 0 : 1;
  }
}

/** Advances the battle by `dt` seconds. */
export function tick(b: Battle, dt: number) {
  if (b.over) return;
  b.t += dt;
  for (const side of [0, 1] as Side[]) {
    const c = b.c[side];
    c.energy = Math.min(MAX_ENERGY, c.energy + dt * ENERGY_PER_SEC);
    if (b.t < c.burnUntil) {
      const amt = c.burnDps * dt;
      c.hp = Math.max(0, c.hp - amt);
      if (Math.random() < dt * 1.5) b.events.push({ id: nextId++, kind: 'burn', side, amount: Math.round(c.burnDps) });
    }
    if (side === 0 && b.t - c.lastTap > COMBO_WINDOW) c.combo = 0;
    const busy = b.t < c.freezeUntil || b.t < c.stunUntil;
    // the opponent swings on its own (faster with skill); the player hits by tapping
    if (!busy && side === 1) {
      c.swing -= dt;
      if (c.swing <= 0) {
        c.swing = swingTime(c) * (1.15 - b.aiSkill * 0.45);
        damage(b, side, 1.6);
      }
    }
  }
  // Opponent AI: every so often, play the best affordable card (smarter AIs save up for big ones)
  b.aiClock -= dt;
  if (b.aiClock <= 0) {
    b.aiClock = 0.8 + Math.random() * (1.6 - b.aiSkill);
    const me = b.c[1];
    const affordable = me.deck.filter((m) => MOVES[m].cost <= me.energy && (m !== 'heal' || b.t >= me.healReadyAt));
    if (affordable.length) {
      const wantsHeal = me.hp / me.maxHp < 0.35 && affordable.includes('heal');
      const pick = wantsHeal ? 'heal' : affordable.sort((x, y) => MOVES[y].cost - MOVES[x].cost)[Math.random() < b.aiSkill ? 0 : affordable.length - 1];
      if (!(pick === 'heal' && me.hp / me.maxHp > 0.7)) play(b, 1, pick);
    }
  }
  check(b);
}

/** Pulls the events out for the screen to animate. */
export function drain(b: Battle): BattleEvent[] {
  const e = b.events;
  b.events = [];
  return e;
}

export const starsOf = (b: Battle) => {
  if (b.winner !== 0) return 0;
  const r = b.c[0].hp / b.c[0].maxHp;
  return r > 0.66 ? 3 : r > 0.33 ? 2 : 1;
};
