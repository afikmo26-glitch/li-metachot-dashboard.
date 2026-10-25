import * as THREE from 'three';
import type { BigFx, Game } from './brawlGame';

/**
 * The big effects of "זירת הכאוס", after the owner's effects clip: each element's super has its own look (a
 * stream of fire, ice shards out of the floor, green rings, flying rocks, lightning, a purple vortex), a golden
 * rune circle lights up under whoever fires one, and a fallen enemy bursts into rocks. Everything is built once
 * here and only moved, shown and faded while the fight runs, so nothing is created mid-fight.
 */

const glow = (color: string, opacity = 1, blending: THREE.Blending = THREE.AdditiveBlending) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending, toneMapped: false });
const solid = (color: string) => new THREE.MeshLambertMaterial({ color, transparent: true });
const flat = (m: THREE.Mesh) => {
  m.rotation.x = -Math.PI / 2;
  return m;
};
// cheap repeatable noise, so a bolt keeps its zigzag between flickers
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const fade = (m: THREE.Mesh, o: number) => {
  (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, Math.min(1, o));
};

type Rig = { root: THREE.Group; update: (f: BigFx) => void };

/** The golden circle of runes: two rings and twelve glyphs, spinning in and fading out. */
function runes(): Rig {
  const root = new THREE.Group();
  const outer = flat(new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), glow('#FCD34D')));
  const inner = flat(new THREE.Mesh(new THREE.RingGeometry(0.62, 0.66, 48), glow('#FDE68A')));
  const fill = flat(new THREE.Mesh(new THREE.CircleGeometry(1, 48), glow('#F59E0B', 0.18)));
  const spin = new THREE.Group();
  const glyphGeo = new THREE.PlaneGeometry(0.05, 0.16);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // each glyph is a stroke and a crossbar at a different slant
    const g = new THREE.Group();
    const stroke = flat(new THREE.Mesh(glyphGeo, glow('#FEF3C7')));
    const bar = flat(new THREE.Mesh(glyphGeo, glow('#FEF3C7')));
    bar.rotation.z = Math.PI / 2 + (i % 3) * 0.5;
    bar.scale.y = 0.7;
    g.add(stroke, bar);
    g.position.set(Math.cos(a) * 0.795, 0, Math.sin(a) * 0.795);
    g.rotation.y = -a;
    spin.add(g);
  }
  root.add(fill, outer, inner, spin);
  return {
    root,
    update(f) {
      const k = f.t / f.life;
      const grow = Math.min(1, k * 5);
      const alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      root.position.set(f.x, 0.06, f.z);
      root.scale.setScalar(f.size * (0.4 + 0.6 * grow));
      spin.rotation.y = f.t * 1.4;
      inner.rotation.z = -f.t * 2;
      fade(outer, alpha);
      fade(inner, alpha * 0.9);
      fade(fill, alpha * 0.18);
      spin.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) fade(o as THREE.Mesh, alpha * (0.6 + 0.4 * Math.sin(f.t * 12 + o.id)));
      });
    },
  };
}

/** Fire: puffs of flame pour out ahead, growing and cooling from yellow to red. */
function fire(): Rig {
  const root = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  // plain blending: added light washes out to white on the bright sand
  const puffs = Array.from({ length: 22 }, () => {
    const m = new THREE.Mesh(geo, glow('#FDE047', 1, THREE.NormalBlending));
    root.add(m);
    return m;
  });
  const hot = new THREE.Color('#FDE047');
  const mid = new THREE.Color('#F97316');
  const cool = new THREE.Color('#B91C1C');
  const c = new THREE.Color();
  return {
    root,
    update(f) {
      root.position.set(f.x, 0, f.z);
      root.rotation.y = f.rot;
      puffs.forEach((m, i) => {
        const born = (i / puffs.length) * 0.55;
        const u = (f.t - born) / 0.6; // each puff lives 0.6 s
        m.visible = u > 0 && u < 1;
        if (!m.visible) return;
        const side = (rnd(i) - 0.5) * 2;
        m.position.set(side * u * 1.4, 0.9 + u * 0.5 + rnd(i + 9) * 0.3, 0.6 + u * 6.2);
        m.scale.setScalar(0.35 + u * 1.3);
        c.copy(u < 0.4 ? hot : mid).lerp(u < 0.4 ? mid : cool, u < 0.4 ? u / 0.4 : (u - 0.4) / 0.6);
        (m.material as THREE.MeshBasicMaterial).color.copy(c);
        fade(m, 1 - u * u);
      });
    },
  };
}

/** Water: ice shards shoot up out of the floor in a widening ring, with a splash ring under them. */
function ice(): Rig {
  const root = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.22, 1.5, 5);
  const shards = Array.from({ length: 16 }, (_, i) => {
    const m = new THREE.Mesh(geo, glow(i % 3 ? '#38BDF8' : '#BAE6FD', 1, THREE.NormalBlending));
    root.add(m);
    return m;
  });
  const splash = flat(new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), glow('#38BDF8')));
  root.add(splash);
  return {
    root,
    update(f) {
      const k = f.t / f.life;
      root.position.set(f.x, 0, f.z);
      shards.forEach((m, i) => {
        const a = (i / shards.length) * Math.PI * 2 + rnd(i) * 0.3;
        const ring = 1 + (i % 2) * 0.9;
        const u = Math.min(1, Math.max(0, (f.t - (i % 2) * 0.12) / 0.25));
        const r = ring + k * 2.6;
        m.position.set(Math.cos(a) * r, -0.8 + u * 1.3 - Math.max(0, k - 0.7) * 2.5, Math.sin(a) * r);
        // tilt outward, like they burst from the middle
        m.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        m.scale.set(1, 0.6 + rnd(i + 3) * 0.8, 1);
        fade(m, k < 0.7 ? 0.95 : 0.95 * (1 - (k - 0.7) / 0.3));
      });
      splash.scale.setScalar(0.5 + k * 5);
      fade(splash, 0.8 * (1 - k));
    },
  };
}

/** Nature: three green rings whirl around the fighter and rise, shedding leaves. */
function vines(): Rig {
  const root = new THREE.Group();
  const rings = Array.from({ length: 3 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 40), glow(i === 1 ? '#84CC16' : '#16A34A', 1, THREE.NormalBlending));
    root.add(m);
    return m;
  });
  const leafGeo = new THREE.PlaneGeometry(0.22, 0.12);
  const leaves = Array.from({ length: 14 }, (_, i) => {
    const m = new THREE.Mesh(leafGeo, glow(i % 2 ? '#4ADE80' : '#15803D', 1, THREE.NormalBlending));
    (m.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
    root.add(m);
    return m;
  });
  return {
    root,
    update(f) {
      const k = f.t / f.life;
      const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      root.position.set(f.x, 0, f.z);
      rings.forEach((m, i) => {
        m.position.y = 0.3 + i * 0.55 + k * 0.8;
        m.rotation.set(Math.PI / 2 + Math.sin(f.t * 5 + i * 2) * 0.35, f.t * (4 + i), Math.cos(f.t * 4 + i) * 0.35);
        m.scale.setScalar(0.8 + i * 0.15 + k * (1.4 + i * 0.4));
        fade(m, alpha);
      });
      leaves.forEach((m, i) => {
        const a = (i / leaves.length) * Math.PI * 2 + f.t * 3;
        const r = 0.6 + k * 4.2 * (0.6 + rnd(i) * 0.4);
        m.position.set(Math.cos(a) * r, 0.5 + rnd(i + 5) * 1.6 + k, Math.sin(a) * r);
        m.rotation.set(f.t * 6 + i, f.t * 4, i);
        fade(m, alpha);
      });
    },
  };
}

/** Earth (and a fallen enemy): rocks fly out on arcs and tumble, with a ring of dust. */
function rocks(count: number, dust: string): Rig {
  const root = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(0.34, 0);
  const stones = Array.from({ length: count }, (_, i) => {
    const m = new THREE.Mesh(geo, solid(i % 3 ? '#7C4A2D' : '#A8754F'));
    root.add(m);
    return m;
  });
  const ember = Array.from({ length: Math.ceil(count / 2) }, () => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), glow('#FDBA74'));
    root.add(m);
    return m;
  });
  const ring = flat(new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 36), glow(dust, 0.6)));
  root.add(ring);
  return {
    root,
    update(f) {
      const k = f.t / f.life;
      root.position.set(f.x, 0, f.z);
      const s = f.size;
      stones.forEach((m, i) => {
        const a = (i / stones.length) * Math.PI * 2 + rnd(i) * 0.6;
        const v = (2.5 + rnd(i + 1) * 3) * s;
        const up = (4 + rnd(i + 2) * 4) * Math.sqrt(s);
        const t = f.t;
        m.position.set(Math.cos(a) * v * t, Math.max(0.1, 0.5 + up * t - 9 * t * t), Math.sin(a) * v * t);
        m.rotation.set(t * 9 + i, t * 7, t * 5);
        m.scale.setScalar((0.6 + rnd(i + 4) * 1.1) * Math.sqrt(s));
        (m.material as THREE.MeshLambertMaterial).opacity = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      });
      ember.forEach((m, i) => {
        const a = rnd(i + 20) * Math.PI * 2;
        const r = (1 + rnd(i + 21) * 2.5) * s * k;
        m.position.set(Math.cos(a) * r, 0.4 + rnd(i + 22) * 1.8 * k * s, Math.sin(a) * r);
        fade(m, 1 - k);
      });
      ring.scale.setScalar(0.3 + k * 2.6 * s);
      fade(ring, 0.6 * (1 - k));
    },
  };
}

/** Storm: a zigzag bolt drops onto each enemy in reach, flickering, with a flash where it lands. */
function lightning(): Rig {
  const root = new THREE.Group();
  const SEG = 7;
  const segGeo = new THREE.BoxGeometry(0.09, 1, 0.09);
  const bolts = Array.from({ length: 5 }, () => {
    const g = new THREE.Group();
    const segs = Array.from({ length: SEG }, (_, j) => {
      const m = new THREE.Mesh(segGeo, glow(j % 2 ? '#FEF9C3' : '#FDE047'));
      g.add(m);
      return m;
    });
    const flash = flat(new THREE.Mesh(new THREE.CircleGeometry(1, 28), glow('#FACC15', 0.6)));
    g.add(flash);
    root.add(g);
    return { g, segs, flash };
  });
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    root,
    update(f) {
      const k = f.t / f.life;
      const flick = Math.floor(f.t * 18);
      bolts.forEach((bolt, i) => {
        const p = f.pts[i];
        bolt.g.visible = !!p;
        if (!p) return;
        const on = (flick + i) % 3 !== 0 && k < 0.85;
        bolt.g.position.set(p.x, 0, p.z);
        bolt.segs.forEach((m, j) => {
          // points from high up to the ground, jittered sideways
          const y0 = 9 * (1 - j / SEG);
          const y1 = 9 * (1 - (j + 1) / SEG);
          const jit = (n: number) => (j === 0 && n === 0 ? 0 : (rnd(flick * 31 + i * 7 + j + n) - 0.5) * 1.1);
          a.set(jit(0), y0, jit(0.5));
          b.set(j + 1 === SEG ? 0 : jit(1), y1, j + 1 === SEG ? 0 : jit(1.5));
          m.position.copy(a).add(b).multiplyScalar(0.5);
          m.scale.y = a.distanceTo(b);
          m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
          m.visible = on;
          fade(m, 1);
        });
        bolt.flash.position.y = 0.05;
        bolt.flash.scale.setScalar(0.6 + k * 1.6);
        fade(bolt.flash, on ? 0.7 * (1 - k) : 0.2 * (1 - k));
      });
    },
  };
}

/** Shadow: three purple arms spiral in around the fighter over a dark ring. */
function vortex(): Rig {
  const root = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.16, 8, 6);
  const motes = Array.from({ length: 36 }, (_, i) => {
    const m = new THREE.Mesh(geo, glow(i % 4 ? '#A855F7' : '#E9D5FF'));
    root.add(m);
    return m;
  });
  const ring = flat(new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), glow('#7C3AED', 0.7)));
  const core = flat(new THREE.Mesh(new THREE.CircleGeometry(1, 40), glow('#4C1D95', 0.35)));
  root.add(core, ring);
  return {
    root,
    update(f) {
      const k = f.t / f.life;
      const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      root.position.set(f.x, 0, f.z);
      motes.forEach((m, i) => {
        const arm = i % 3;
        const along = Math.floor(i / 3) / 12;
        const r = (0.5 + along * 4) * (1.15 - k * 0.6);
        const a = arm * ((Math.PI * 2) / 3) + along * 4 - f.t * 7;
        m.position.set(Math.cos(a) * r, 0.25 + along * 1.4 + Math.sin(f.t * 8 + i) * 0.1, Math.sin(a) * r);
        m.scale.setScalar(1.3 - along * 0.7);
        fade(m, alpha);
      });
      ring.scale.setScalar(4.6 - k * 2);
      ring.rotation.z = f.t * 3;
      fade(ring, 0.7 * alpha);
      core.scale.setScalar(4.2 - k * 2);
      fade(core, 0.35 * alpha);
    },
  };
}

/** Builds every rig once; `update` lays the game's live big effects onto them each frame. */
export function buildSuperFx() {
  const group = new THREE.Group();
  const pools: Record<string, Rig[]> = {
    runes: [runes(), runes()],
    fire: [fire()],
    water: [ice()],
    nature: [vines()],
    earth: [rocks(18, '#D6A77A')],
    storm: [lightning()],
    shadow: [vortex()],
    rocks: [rocks(9, '#C08457'), rocks(9, '#C08457'), rocks(9, '#C08457'), rocks(9, '#C08457')],
  };
  for (const list of Object.values(pools)) for (const r of list) group.add(r.root);
  return {
    group,
    update(game: Game) {
      const used: Record<string, number> = {};
      for (const list of Object.values(pools)) for (const r of list) r.root.visible = false;
      for (const f of game.big) {
        const key = f.kind === 'super' ? f.element : f.kind;
        const list = pools[key] ?? pools.earth;
        const i = used[key] ?? 0;
        if (i >= list.length) continue;
        used[key] = i + 1;
        list[i].root.visible = true;
        list[i].update(f);
      }
    },
  };
}
