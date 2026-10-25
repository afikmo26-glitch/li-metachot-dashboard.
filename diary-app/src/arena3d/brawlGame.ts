/**
 * "זירת הכאוס": a top-down arena brawl. You run around with a joystick, shoot at the nearest enemy and
 * fire a super once it's charged; waves of bots come at you. Pure game logic — the scene draws it and the
 * screen reads it for the HUD.
 */

export type Team = 0 | 1;
export type ActorAnim = 'idle' | 'run' | 'attack' | 'special' | 'hit' | 'death' | 'win' | 'jump' | 'dance';

export type Actor = {
  id: number;
  team: Team;
  /** model id (MODELS3D) */
  model: string;
  name: string;
  color: string;
  x: number;
  z: number;
  /** facing, radians around Y (0 = towards +z) */
  rot: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  reload: number;
  cooldown: number;
  anim: ActorAnim;
  /** bumps when an animation should restart */
  animId: number;
  /** seconds left in a one-shot animation */
  busy: number;
  flash: number;
  alive: boolean;
  boss?: boolean;
  /** fire, water, nature, earth, storm or shadow: picks the look of the super */
  element?: string;
  /** height off the ground (only while flying off a jump pad) */
  y: number;
  /** a jump pad flight in progress: from, to, and how far along (0..1) */
  jump?: { fx: number; fz: number; tx: number; tz: number; t: number; dur: number };
};

export type Shot = { id: number; team: Team; x: number; z: number; vx: number; vz: number; life: number; dmg: number; color: string; big: boolean };
export type Fx = { id: number; kind: 'spark' | 'ring' | 'nova'; x: number; z: number; color: string; t: number; life: number; size: number };
/**
 * The big effects (superFx.ts): a super in its element's look, the rune circle under it, and the burst of rocks
 * when someone falls. `rot` aims the fire; `pts` are where the lightning lands.
 */
export type BigFx = { id: number; kind: 'super' | 'runes' | 'rocks' | 'dash' | 'notes'; element: string; x: number; z: number; rot: number; t: number; life: number; size: number; pts: { x: number; z: number }[] };

export type Box = { x: number; z: number; w: number; d: number; kind: 'crate' | 'rock' | 'bush' | 'mound' | 'barrel' };
/** A jump pad: step on it and you're flung to (tx, tz). */
export type Pad = { x: number; z: number; tx: number; tz: number };

export type Game = {
  t: number;
  /** the court's half width (x) and half length (z): tall, to suit a phone held upright */
  hx: number;
  hz: number;
  boxes: Box[];
  pads: Pad[];
  /** corner radius of the court's rounded wall */
  round: number;
  player: Actor;
  enemies: Actor[];
  shots: Shot[];
  fx: Fx[];
  big: BigFx[];
  wave: number;
  waves: number;
  /** 0..1: fills with hits, the super fires at 1 */
  charge: number;
  /** seconds until the dash and the shield can be used again, and how long the shield has left */
  dashCd: number;
  shieldCd: number;
  shieldT: number;
  /** a dash in progress: its direction and the time left */
  dash?: { dx: number; dz: number; t: number };
  shake: number;
  over: boolean;
  won: boolean;
  kills: number;
  nextWaveAt: number;
};

export type Input = { mx: number; mz: number; fire: boolean; superFire: boolean; dash?: boolean; shield?: boolean; dance?: boolean };

export type Spawn = { model: string; name: string; color: string; hp: number; dmg: number; boss?: boolean; element?: string };

let nextId = 1;
const SHOT_SPEED = 15;
const SHOT_RANGE = 9.5;
const R = 0.6; // body radius

export function createGame(player: Spawn, waves: Spawn[][]): Game {
  // the crystal mine: a mound of crystals in the middle ringed by rails, crates and rocks for cover, tall grass
  // to hide in, and jump pads that fling you across. The floor art (assets/sim3d/ground_arena.jpg) is painted
  // for exactly this layout; blue (you) starts at the bottom, red at the top.
  const boxes: Box[] = [
    { x: 0, z: 0, w: 3.2, d: 3.6, kind: 'mound' },
    { x: -3.4, z: -6.6, w: 2.4, d: 1.1, kind: 'crate' },
    { x: 3.4, z: -6.6, w: 2.4, d: 1.1, kind: 'crate' },
    { x: -3.4, z: 6.6, w: 2.4, d: 1.1, kind: 'crate' },
    { x: 3.4, z: 6.6, w: 2.4, d: 1.1, kind: 'crate' },
    { x: -5.2, z: 0, w: 1.3, d: 2.2, kind: 'rock' },
    { x: 5.2, z: 0, w: 1.3, d: 2.2, kind: 'rock' },
    { x: -1.9, z: -9.0, w: 0.8, d: 0.8, kind: 'barrel' },
    { x: 1.9, z: 9.0, w: 0.8, d: 0.8, kind: 'barrel' },
    { x: -6.6, z: 3.2, w: 1.6, d: 2.6, kind: 'bush' },
    { x: 6.6, z: -3.2, w: 1.6, d: 2.6, kind: 'bush' },
    { x: -5.6, z: -9.3, w: 2.4, d: 1.4, kind: 'bush' },
    { x: 5.6, z: 9.3, w: 2.4, d: 1.4, kind: 'bush' },
    { x: 6.4, z: 5.4, w: 1.4, d: 1.4, kind: 'bush' },
    { x: -6.4, z: -5.4, w: 1.4, d: 1.4, kind: 'bush' },
  ];
  const pads: Pad[] = [
    { x: -6.3, z: 6.6, tx: -6.2, tz: -2.2 },
    { x: 6.3, z: -6.6, tx: 6.2, tz: 2.2 },
    { x: 0, z: 4.9, tx: 0, tz: -3.1 },
    { x: 0, z: -4.9, tx: 0, tz: 3.1 },
  ];
  const g: Game = {
    t: 0,
    hx: 8.5,
    hz: 12.5,
    boxes,
    pads,
    round: 4,
    player: actor(0, player, 0, 9.5),
    enemies: [],
    shots: [],
    fx: [],
    big: [],
    wave: 0,
    waves: waves.length,
    charge: 0,
    dashCd: 0,
    shieldCd: 0,
    shieldT: 0,
    shake: 0,
    over: false,
    won: false,
    kills: 0,
    nextWaveAt: 1.2,
  };
  (g as Game & { plan: Spawn[][] }).plan = waves;
  return g;
}

function actor(team: Team, s: Spawn, x: number, z: number): Actor {
  return {
    id: nextId++,
    team,
    model: s.model,
    name: s.name,
    color: s.color,
    x,
    z,
    rot: team === 0 ? Math.PI : 0,
    hp: s.hp,
    maxHp: s.hp,
    dmg: s.dmg,
    speed: team === 0 ? 5.5 : s.boss ? 2.4 : 3.1,
    reload: team === 0 ? 0.42 : s.boss ? 1.1 : 1.5,
    cooldown: 1 + Math.random(),
    anim: 'idle',
    animId: 0,
    busy: 0,
    flash: 0,
    alive: true,
    boss: s.boss,
    element: s.element,
    y: 0,
  };
}

function bigFx(g: Game, kind: BigFx['kind'], x: number, z: number, life: number, more: Partial<BigFx> = {}) {
  g.big.push({ id: nextId++, kind, element: '', x, z, rot: 0, t: 0, life, size: 1, pts: [], ...more });
}

function setAnim(a: Actor, anim: ActorAnim, busy = 0) {
  if (a.anim === anim && busy === 0) return;
  a.anim = anim;
  a.animId++;
  a.busy = busy;
}

function blocked(g: Game, x: number, z: number, r = R) {
  // the wall is a rounded rectangle
  const ox = Math.max(0, Math.abs(x) - (g.hx - g.round));
  const oz = Math.max(0, Math.abs(z) - (g.hz - g.round));
  if (Math.abs(x) > g.hx - r || Math.abs(z) > g.hz - r || Math.hypot(ox, oz) > g.round - r) return true;
  for (const b of g.boxes) {
    if (b.kind === 'bush') continue; // bushes hide you, they don't block
    if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return true;
  }
  return false;
}

function move(g: Game, a: Actor, dx: number, dz: number) {
  // slide along walls: try both axes, then each on its own
  if (!blocked(g, a.x + dx, a.z + dz)) {
    a.x += dx;
    a.z += dz;
  } else if (!blocked(g, a.x + dx, a.z)) a.x += dx;
  else if (!blocked(g, a.x, a.z + dz)) a.z += dz;
}

function fire(g: Game, a: Actor, tx: number, tz: number, big = false) {
  const dx = tx - a.x;
  const dz = tz - a.z;
  const len = Math.hypot(dx, dz) || 1;
  a.rot = Math.atan2(dx, dz);
  g.shots.push({ id: nextId++, team: a.team, x: a.x + (dx / len) * 0.7, z: a.z + (dz / len) * 0.7, vx: (dx / len) * SHOT_SPEED, vz: (dz / len) * SHOT_SPEED, life: SHOT_RANGE / SHOT_SPEED, dmg: a.dmg * (big ? 1.6 : 1), color: a.color, big });
  setAnim(a, 'attack', 0.32);
}

export const DASH_CD = 3;
export const SHIELD_CD = 8;
const SHIELD_TIME = 2.5;

function hit(g: Game, a: Actor, dmg: number, color: string) {
  if (!a.alive) return;
  // the shield takes three quarters of every blow
  if (a === g.player && g.shieldT > 0) {
    dmg = Math.round(dmg * 0.25);
    color = '#67E8F9';
  }
  a.hp = Math.max(0, a.hp - dmg);
  a.flash = 1;
  g.fx.push({ id: nextId++, kind: 'spark', x: a.x, z: a.z, color, t: 0, life: 0.4, size: 1 });
  if (a.hp <= 0) {
    a.alive = false;
    setAnim(a, 'death', 99);
    g.fx.push({ id: nextId++, kind: 'ring', x: a.x, z: a.z, color, t: 0, life: 0.6, size: 2.2 });
    bigFx(g, 'rocks', a.x, a.z, 0.9, { size: a.boss ? 1.8 : 1 });
    if (a.team === 1) g.kills++;
  } else if (a.busy <= 0) setAnim(a, 'hit', 0.25);
}

const nearest = (from: Actor, list: Actor[]) => {
  let best: Actor | null = null;
  let bd = Infinity;
  for (const e of list) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - from.x, e.z - from.z);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return { e: best, d: bd };
};

/** Advances the brawl by `dt` seconds. */
export function step(g: Game, dt: number, input: Input) {
  if (g.over) return;
  g.t += dt;
  g.shake = Math.max(0, g.shake - dt * 3);
  const p = g.player;
  const plan = (g as Game & { plan: Spawn[][] }).plan;

  // waves
  if (g.enemies.every((e) => !e.alive) && g.t >= g.nextWaveAt) {
    if (g.wave >= plan.length) {
      g.over = true;
      g.won = true;
      setAnim(p, 'win', 99);
      return;
    }
    const spots: [number, number][] = [[0, -10.3], [-5.5, -10.6], [5.5, -10.6], [-7.2, -3], [7.2, -3]];
    g.enemies = plan[g.wave].map((s, i) => actor(1, s, spots[i % spots.length][0], spots[i % spots.length][1]));
    g.wave++;
    g.nextWaveAt = Infinity;
  }
  if (g.enemies.length && g.enemies.every((e) => !e.alive) && g.nextWaveAt === Infinity) g.nextWaveAt = g.t + 1.8;

  // player
  for (const a of [p, ...g.enemies]) {
    if (a.jump) {
      // flying: an arc from the pad to its landing spot, nothing else happens meanwhile
      const j = a.jump;
      j.t = Math.min(1, j.t + dt / j.dur);
      a.x = j.fx + (j.tx - j.fx) * j.t;
      a.z = j.fz + (j.tz - j.fz) * j.t;
      a.y = Math.sin(j.t * Math.PI) * 3.2;
      if (j.t >= 1) {
        a.jump = undefined;
        a.y = 0;
        g.fx.push({ id: nextId++, kind: 'ring', x: a.x, z: a.z, color: '#FDE68A', t: 0, life: 0.45, size: 1.6 });
        if (a === p) g.shake = Math.max(g.shake, 0.4);
      }
    } else if (a.alive) {
      const pad = g.pads.find((q) => Math.abs(q.x - a.x) < 0.75 && Math.abs(q.z - a.z) < 0.75);
      if (pad) {
        a.jump = { fx: a.x, fz: a.z, tx: pad.tx, tz: pad.tz, t: 0, dur: 0.8 };
        a.rot = Math.atan2(pad.tx - a.x, pad.tz - a.z);
        setAnim(a, 'jump', 0.8);
        g.fx.push({ id: nextId++, kind: 'ring', x: pad.x, z: pad.z, color: '#4ADE80', t: 0, life: 0.5, size: 1.4 });
      }
    }
    a.busy = Math.max(0, a.busy - dt);
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.flash = Math.max(0, a.flash - dt * 4);
  }
  g.dashCd = Math.max(0, g.dashCd - dt);
  g.shieldCd = Math.max(0, g.shieldCd - dt);
  g.shieldT = Math.max(0, g.shieldT - dt);
  if (p.alive && !p.jump) {
    const len = Math.hypot(input.mx, input.mz);
    // dash: a short burst the way you're steering (or facing), with a puff of dust
    if (input.dash && g.dashCd <= 0) {
      const dx = len > 0.15 ? input.mx / len : Math.sin(p.rot);
      const dz = len > 0.15 ? input.mz / len : Math.cos(p.rot);
      g.dash = { dx, dz, t: 0.2 };
      g.dashCd = DASH_CD;
      p.rot = Math.atan2(dx, dz);
      bigFx(g, 'dash', p.x, p.z, 0.55, { rot: p.rot });
    }
    if (input.shield && g.shieldCd <= 0) {
      g.shieldT = SHIELD_TIME;
      g.shieldCd = SHIELD_CD;
    }
    if (input.dance && p.busy <= 0) {
      setAnim(p, 'dance', 2);
      bigFx(g, 'notes', p.x, p.z, 2);
    }
    if (p.anim === 'dance' && len > 0.15) p.busy = 0; // moving ends the dance
    if (g.dash) {
      move(g, p, g.dash.dx * 16 * dt, g.dash.dz * 16 * dt);
      g.dash.t -= dt;
      if (g.dash.t <= 0) g.dash = undefined;
    } else if (len > 0.15) {
      const k = Math.min(1, len);
      move(g, p, (input.mx / len) * p.speed * k * dt, (input.mz / len) * p.speed * k * dt);
      if (p.busy <= 0) p.rot = Math.atan2(input.mx, input.mz);
      if (p.busy <= 0) setAnim(p, 'run');
    } else if (p.busy <= 0) setAnim(p, 'idle');
    if (input.fire && p.cooldown <= 0) {
      const { e, d } = nearest(p, g.enemies);
      if (e && d < SHOT_RANGE + 1) fire(g, p, e.x, e.z);
      else fire(g, p, p.x + Math.sin(p.rot) * 5, p.z + Math.cos(p.rot) * 5);
      p.cooldown = p.reload;
    }
    if (input.superFire && g.charge >= 1) {
      g.charge = 0;
      g.shake = 1;
      // turn to the nearest foe, so the fire pours at someone
      const { e: aim } = nearest(p, g.enemies);
      if (aim) p.rot = Math.atan2(aim.x - p.x, aim.z - p.z);
      setAnim(p, 'special', 0.7);
      g.fx.push({ id: nextId++, kind: 'nova', x: p.x, z: p.z, color: p.color, t: 0, life: 0.7, size: 5 });
      const inReach = g.enemies.filter((e) => e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 5);
      // lightning lands on whoever is in reach, or around you when no one is
      const pts = inReach.length ? inReach.map((e) => ({ x: e.x, z: e.z })) : [0, 1, 2].map((i) => ({ x: p.x + Math.cos(i * 2.1) * 2.5, z: p.z + Math.sin(i * 2.1) * 2.5 }));
      bigFx(g, 'runes', p.x, p.z, 1.4, { size: 2.6 });
      bigFx(g, 'super', p.x, p.z, 1.3, { element: p.element ?? 'fire', rot: p.rot, pts });
      for (const e of inReach) hit(g, e, p.dmg * 3.2, p.color);
    }
  }

  // enemies: close in, then stop and shoot; keep a little apart from each other
  for (const e of g.enemies) {
    if (!e.alive || !p.alive || e.jump) continue;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz);
    const want = e.boss ? 4 : 5.5;
    let mx = 0;
    let mz = 0;
    if (d > want) {
      mx = dx / d;
      mz = dz / d;
    } else if (d < want - 2) {
      mx = -dx / d;
      mz = -dz / d;
    }
    for (const o of g.enemies) {
      if (o === e || !o.alive) continue;
      const od = Math.hypot(e.x - o.x, e.z - o.z);
      if (od < 1.6 && od > 0) {
        mx += ((e.x - o.x) / od) * 0.8;
        mz += ((e.z - o.z) / od) * 0.8;
      }
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 0.1 && e.busy <= 0) {
      move(g, e, (mx / ml) * e.speed * dt, (mz / ml) * e.speed * dt);
      e.rot = Math.atan2(mx, mz);
      setAnim(e, 'run');
    } else if (e.busy <= 0) {
      e.rot = Math.atan2(dx, dz);
      setAnim(e, 'idle');
    }
    if (d < SHOT_RANGE && e.cooldown <= 0) {
      // aim where you're heading, a little
      fire(g, e, p.x + input.mx * 0.6, p.z + input.mz * 0.6, !!e.boss);
      e.cooldown = e.reload * (0.8 + Math.random() * 0.5);
    }
  }

  // shots
  for (const s of g.shots) {
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    s.life -= dt;
    if (blocked(g, s.x, s.z, 0.1)) s.life = 0;
    const targets = s.team === 0 ? g.enemies : [p];
    for (const a of targets) {
      if (s.life > 0 && a.alive && !a.jump && Math.hypot(a.x - s.x, a.z - s.z) < R + (s.big ? 0.35 : 0.2)) {
        hit(g, a, s.dmg, s.color);
        s.life = 0;
        if (s.team === 0) g.charge = Math.min(1, g.charge + 0.2);
        else g.shake = Math.max(g.shake, 0.35);
      }
    }
    if (s.life <= 0) g.fx.push({ id: nextId++, kind: 'spark', x: s.x, z: s.z, color: s.color, t: 0, life: 0.25, size: 0.6 });
  }
  g.shots = g.shots.filter((s) => s.life > 0);
  for (const f of g.fx) f.t += dt;
  g.fx = g.fx.filter((f) => f.t < f.life).slice(-40);
  for (const f of g.big) f.t += dt;
  g.big = g.big.filter((f) => f.t < f.life).slice(-10);

  if (!p.alive) {
    g.over = true;
    g.won = false;
    for (const e of g.enemies) if (e.alive) setAnim(e, 'win', 99);
  }
}
