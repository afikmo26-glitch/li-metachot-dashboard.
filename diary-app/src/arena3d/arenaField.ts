import * as THREE from 'three';
import type { Box, Game, Pad } from './brawlGame';
import { toonRamp } from './toon';

/**
 * "מכרה אבני החן" — the crystal mine court of "זירת הכאוס", built once from primitives: an oval of mine-stone
 * wall with timber shoring and tunnel mouths, red canyon cliffs and a mine headframe outside, a mound of
 * crystals with a floating gem in the middle ringed by rails, and the cover pieces of the layout.
 * Repeated pieces are instanced, so the whole court stays a few dozen draw calls.
 */

// a fixed seed: the court looks the same every fight
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Faceted look for rocks, leaves and crystals: split the faces so each gets its own normal. */
function facet<T extends THREE.BufferGeometry>(geo: T) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

const toon = (color: string, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra });

type Item = { p: [number, number, number]; r?: number; rx?: number; rz?: number; s: [number, number, number]; c?: string };

/** One instanced mesh from a list of placements. */
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[]) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  items.forEach((it, i) => {
    q.setFromEuler(e.set(it.rx ?? 0, it.r ?? 0, it.rz ?? 0));
    m.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s));
    mesh.setMatrixAt(i, m);
    if (it.c) mesh.setColorAt(i, new THREE.Color(it.c));
  });
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export type ArenaField = { group: THREE.Group; gem: THREE.Object3D; glow: THREE.Object3D; pads: THREE.Object3D[] };

const MINE_STONE = ['#A9A3BC', '#9C96B0', '#B7B1C8', '#8E88A3', '#C3BED2'];
const CANYON = ['#D2663C', '#C4552F', '#E07A45', '#B9502E', '#E58B52'];
const CANYON_TOP = ['#EFA466', '#F2B072', '#E8955A'];
const LEAF = ['#4FA83A', '#62BA45', '#3F9532', '#76C653'];
const WOOD = '#8B5A2B';
const WOOD_DARK = '#5E3A1A';

/** Points every `step` along a rounded rectangle (half sizes hx, hz, corner radius rc), with the outward direction. */
function roundedPath(hx: number, hz: number, rc: number, step: number) {
  const pts: { x: number; z: number; nx: number; nz: number }[] = [];
  const seg = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) pts.push({ x: ax + ((bx - ax) * (i + 0.5)) / n, z: az + ((bz - az) * (i + 0.5)) / n, nx, nz });
  };
  const arc = (cx: number, cz: number, a0: number) => {
    const n = Math.max(2, Math.round((rc * Math.PI) / 2 / step));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5) / n) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * rc, z: cz + Math.sin(a) * rc, nx: Math.cos(a), nz: Math.sin(a) });
    }
  };
  const ix = hx - rc;
  const iz = hz - rc;
  seg(-ix, -hz, ix, -hz, 0, -1);
  arc(ix, -iz, -Math.PI / 2);
  seg(hx, -iz, hx, iz, 1, 0);
  arc(ix, iz, 0);
  seg(ix, hz, -ix, hz, 0, 1);
  arc(-ix, iz, Math.PI / 2);
  seg(-hx, iz, -hx, -iz, -1, 0);
  arc(-ix, -iz, Math.PI);
  return pts;
}

export function buildArena(game: Game, groundTex: THREE.Texture): ArenaField {
  const rnd = seeded(20261024);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rnd() * list.length)];
  const g = new THREE.Group();
  const HX = game.hx;
  const HZ = game.hz;
  const RC = game.round;

  // the painted court, and the canyon floor beyond the wall
  const court = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), new THREE.MeshToonMaterial({ map: groundTex, gradientMap: toonRamp() }));
  court.rotation.x = -Math.PI / 2;
  g.add(court);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), toon('#D9874F'));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  g.add(outer);

  // --- the wall: rough mine stones around a rounded oval, a lighter course on top, timber shoring here and there
  const stones: Item[] = [];
  const tops: Item[] = [];
  const posts: Item[] = [];
  const beams: Item[] = [];
  const path = roundedPath(HX + 0.5, HZ + 0.5, RC + 0.5, 0.95);
  // tunnel mouths: where the wall opens onto a dark mine shaft (indices into the path)
  const tunnelAt = new Set<number>();
  const nearest = (x: number, z: number) => path.reduce((best, p, i) => (Math.hypot(p.x - x, p.z - z) < Math.hypot(path[best].x - x, path[best].z - z) ? i : best), 0);
  for (const [x, z] of [
    [0, -HZ - 0.5],
    [-HX - 0.5, -3.5],
    [HX + 0.5, 3.5],
    [-HX + 1.5, HZ - 0.3],
    [HX - 1.5, HZ - 0.3],
  ])
    tunnelAt.add(nearest(x, z));
  path.forEach((p, i) => {
    const ang = Math.atan2(p.nx, p.nz);
    if (tunnelAt.has(i)) {
      // timber frame and a black shaft behind it
      const tx = -p.nz;
      const tz = p.nx;
      for (const sgn of [-1, 1]) posts.push({ p: [p.x + tx * 0.62 * sgn, 1.0, p.z + tz * 0.62 * sgn], r: ang, s: [0.26, 2.0, 0.26], c: WOOD });
      beams.push({ p: [p.x, 2.05, p.z], r: ang, s: [1.7, 0.28, 0.32], c: WOOD });
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.85, 1.2), new THREE.MeshBasicMaterial({ color: '#160E14' }));
      shaft.position.set(p.x + p.nx * 0.55, 0.92, p.z + p.nz * 0.55);
      shaft.rotation.y = ang;
      g.add(shaft);
      // rough rock around the mouth so it reads as dug into the cliff
      const hood = new THREE.Mesh(facet(new THREE.DodecahedronGeometry(1.25, 0)), toon(pick(MINE_STONE)));
      hood.position.set(p.x + p.nx * 1.1, 1.6, p.z + p.nz * 1.1);
      hood.scale.set(1.3, 1.1, 0.9);
      hood.rotation.y = ang;
      g.add(hood);
      return;
    }
    const h = 1.05 + rnd() * 0.35;
    stones.push({ p: [p.x, h / 2, p.z], r: ang + (rnd() - 0.5) * 0.12, s: [1.0, h, 0.95], c: pick(MINE_STONE) });
    tops.push({ p: [p.x + (rnd() - 0.5) * 0.1, h + 0.1, p.z], r: ang + (rnd() - 0.5) * 0.3, s: [0.9, 0.22, 0.85], c: '#CFCADD' });
    if (i % 7 === 3) {
      // shoring: two posts and a crossbeam against the inside of the wall
      posts.push({ p: [p.x - p.nx * 0.55, 0.95, p.z - p.nz * 0.55], r: ang, s: [0.22, 1.9, 0.22], c: WOOD });
      beams.push({ p: [p.x - p.nx * 0.55, 1.78, p.z - p.nz * 0.55], r: ang, s: [1.4, 0.2, 0.24], c: WOOD_DARK });
    }
  });
  const unit = new THREE.BoxGeometry(1, 1, 1);
  g.add(instanced(facet(new THREE.BoxGeometry(1, 1, 1)), toon('#FFFFFF'), stones));
  g.add(instanced(unit, toon('#FFFFFF'), tops));
  g.add(instanced(unit, toon('#FFFFFF'), posts));
  g.add(instanced(unit, toon('#FFFFFF'), beams));

  // --- the canyon outside: stacked red mesas, layered and flat-topped, low in front of the camera
  const mesa: Item[] = [];
  const mesaTop: Item[] = [];
  for (let i = 0; i < 120; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 1.6 + Math.pow(rnd(), 0.7) * 14;
    const x = Math.cos(a) * (HX + d) * 1.1;
    const z = Math.sin(a) * (HZ + d);
    const front = z > HZ && Math.abs(x) < HX + 7;
    const w = 1.8 + rnd() * 2.6;
    const tall = front ? 0.5 + rnd() * 0.7 : 1.5 + rnd() * (d > 5 ? 5 : 2.5);
    let y = 0;
    const layers = front ? 1 : 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < layers; k++) {
      const lh = tall / layers;
      const lw = w * (1 - k * 0.18);
      mesa.push({ p: [x + (rnd() - 0.5) * 0.4, y + lh / 2, z + (rnd() - 0.5) * 0.4], r: rnd() * 6, s: [lw, lh, lw * (0.7 + rnd() * 0.4)], c: pick(CANYON) });
      y += lh;
    }
    mesaTop.push({ p: [x, y + 0.08, z], r: rnd() * 6, s: [w * 0.8, 0.16, w * 0.65], c: pick(CANYON_TOP) });
  }
  g.add(instanced(facet(new THREE.BoxGeometry(1, 1, 1)), toon('#FFFFFF'), mesa));
  g.add(instanced(unit, toon('#FFFFFF'), mesaTop));

  // palms and cacti on the canyon floor
  const trunks: Item[] = [];
  const fronds: Item[] = [];
  const cacti: Item[] = [];
  const spot = (minD: number) => {
    for (;;) {
      const a = rnd() * Math.PI * 2;
      const d = minD + rnd() * 9;
      const x = Math.cos(a) * (HX + d);
      const z = Math.sin(a) * (HZ + d);
      if (!(z > HZ && Math.abs(x) < HX + 7)) return [x, z] as const;
    }
  };
  for (let i = 0; i < 14; i++) {
    const [x, z] = spot(2.5);
    const h = 3 + rnd() * 2;
    const lean = (rnd() - 0.5) * 0.4;
    for (let k = 0; k < 5; k++) trunks.push({ p: [x + lean * k * 0.5, (k + 0.5) * (h / 5), z], rz: lean * 0.3, s: [0.32 - k * 0.03, h / 5, 0.32 - k * 0.03], c: k % 2 ? '#8A6239' : '#A0743F' });
    for (let k = 0; k < 7; k++) {
      const fa = (k / 7) * Math.PI * 2 + rnd();
      fronds.push({ p: [x + lean * 2.5 + Math.cos(fa) * 0.9, h + 0.1, z + Math.sin(fa) * 0.9], r: -fa, rz: -0.5, s: [1.9, 0.08, 0.5], c: pick(LEAF) });
    }
  }
  for (let i = 0; i < 18; i++) {
    const [x, z] = spot(1.4);
    const h = 0.8 + rnd() * 0.9;
    cacti.push({ p: [x, h / 2, z], s: [0.32, h, 0.32], c: '#3E8E3A' });
    cacti.push({ p: [x + 0.28, h * 0.55, z], s: [0.18, h * 0.45, 0.18], c: '#4FA24A' });
  }
  g.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 7), toon('#FFFFFF'), trunks));
  g.add(instanced(facet(new THREE.BoxGeometry(1, 1, 1)), toon('#FFFFFF'), fronds));
  g.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), toon('#FFFFFF'), cacti));

  // a mine headframe over the far wall, and carts of ore by the tunnels
  for (const sx of [-1, 1]) g.add(headframe(sx * (HX - 1.5), -HZ - 3.2));
  for (const [x, z, r] of [
    [-HX - 2.0, -5.5, 0.3],
    [HX + 2.0, 5.5, -0.4],
    [2.6, -HZ - 2.4, 1.4],
  ])
    g.add(cart(x, z, r));

  // --- rails ringing the crystal mound
  g.add(railLoop(3.0, 3.4));

  // --- cover pieces, the mound, the jump pads
  let gem: THREE.Object3D = new THREE.Group();
  let glow: THREE.Object3D = new THREE.Group();
  for (const b of game.boxes) {
    const piece = coverPiece(b, rnd);
    g.add(piece.group);
    if (piece.gem) gem = piece.gem;
    if (piece.glow) glow = piece.glow;
  }
  const pads = game.pads.map((p) => {
    const pad = jumpPad(p);
    g.add(pad);
    return pad;
  });
  return { group: g, gem, glow, pads };
}

/** Two rails on sleepers following an ellipse around the mound. */
function railLoop(rx: number, rz: number) {
  const grp = new THREE.Group();
  const sleepers: Item[] = [];
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const z = Math.sin(a) * rz;
    // tangent of the ellipse, so the sleepers lie across it
    const tx = -Math.sin(a) * rx;
    const tz = Math.cos(a) * rz;
    sleepers.push({ p: [x, 0.04, z], r: Math.atan2(tx, tz) + Math.PI / 2, s: [0.75, 0.08, 0.16], c: i % 3 ? WOOD : WOOD_DARK });
  }
  grp.add(instanced(new THREE.BoxGeometry(1, 1, 1), toon('#FFFFFF'), sleepers));
  const railMat = toon('#7C7F92');
  for (const off of [-0.25, 0.25]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * (rx + off), 0.11, Math.sin(a) * (rz + off)));
    }
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, 0.045, 5, true), railMat));
  }
  return grp;
}

/** The lattice tower that winds the lift over a shaft. */
function headframe(x: number, z: number) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  const mat = toon('#5B5F73');
  const H = 6;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, H, 0.18), mat);
      leg.position.set(sx * 0.9, H / 2, sz * 0.9);
      leg.rotation.set(-sz * 0.05, 0, sx * 0.05);
      grp.add(leg);
    }
  for (let k = 1; k < 6; k++) {
    for (const [w, d, ox, oz] of [
      [1.8, 0.1, 0, 0.9],
      [1.8, 0.1, 0, -0.9],
      [0.1, 1.8, 0.9, 0],
      [0.1, 1.8, -0.9, 0],
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), mat);
      bar.position.set(ox, k, oz);
      grp.add(bar);
    }
    const brace = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.08), mat);
    brace.position.set(0, k - 0.5, 0.9);
    brace.rotation.z = k % 2 ? 0.45 : -0.45;
    grp.add(brace);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 6, 16), toon('#3D3F4D'));
  wheel.position.set(0, H + 0.4, 0);
  grp.add(wheel);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 2.2), toon(WOOD));
  roof.position.y = H;
  grp.add(roof);
  return grp;
}

/** A mine cart heaped with glowing ore. */
function cart(x: number, z: number, r: number) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = r;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.7, 4, 1), toon('#6D6A7C'));
  body.rotation.y = Math.PI / 4;
  body.scale.set(1, 1, 0.75);
  body.position.y = 0.6;
  grp.add(body);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.85), toon(WOOD));
  rim.position.y = 0.97;
  grp.add(rim);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 10), toon('#2F2F3A'));
      w.rotation.x = Math.PI / 2;
      w.position.set(sx * 0.38, 0.17, sz * 0.38);
      grp.add(w);
    }
  const ore = toon('#7DD3FC', { emissive: '#0E5A82' });
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(facet(new THREE.OctahedronGeometry(0.2, 0)), ore);
    c.position.set((i % 2) * 0.3 - 0.15, 1.05, Math.floor(i / 2) * 0.25 - 0.12);
    c.rotation.set(i, i * 2, 0);
    grp.add(c);
  }
  return grp;
}

/** A green spring pad with an arrow showing where it throws you. */
function jumpPad(p: Pad) {
  const grp = new THREE.Group();
  grp.position.set(p.x, 0, p.z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.2, 1.35), toon('#15803D'));
  base.position.y = 0.1;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 1.15), toon('#4ADE80', { emissive: '#14532D' }));
  top.position.y = 0.24;
  grp.add(base, top);
  const arrow = new THREE.Group();
  arrow.rotation.y = Math.atan2(p.tx - p.x, p.tz - p.z);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.42);
  shape.lineTo(0.34, 0.02);
  shape.lineTo(0.14, 0.02);
  shape.lineTo(0.14, -0.36);
  shape.lineTo(-0.14, -0.36);
  shape.lineTo(-0.14, 0.02);
  shape.lineTo(-0.34, 0.02);
  shape.closePath();
  const head = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: '#F0FDF4', side: THREE.DoubleSide }));
  // lie flat with the tip pointing along +z, which the group's turn aims at the landing spot
  head.rotation.x = Math.PI / 2;
  head.position.y = 0.29;
  arrow.add(head);
  grp.add(arrow);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 4, 1), new THREE.MeshBasicMaterial({ color: '#BBF7D0', transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  ring.position.y = 0.3;
  ring.name = 'pulse';
  grp.add(ring);
  return grp;
}

function coverPiece(b: Box, rnd: () => number): { group: THREE.Group; gem?: THREE.Object3D; glow?: THREE.Object3D } {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rnd() * list.length)];
  const grp = new THREE.Group();
  grp.position.set(b.x, 0, b.z);
  if (b.kind === 'crate') {
    // a row of planked crates with dark frames and iron corners
    const n = Math.max(1, Math.round(b.w / b.d));
    const cw = b.w / n;
    for (let i = 0; i < n; i++) grp.add(crate(-b.w / 2 + cw * (i + 0.5), cw, b.d, 1.05, i % 2 === 1));
  } else if (b.kind === 'rock') {
    const mats = [toon('#C9643C'), toon('#DB7A4B'), toon('#B85634')];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const r = 0.55 + rnd() * 0.25;
      const m = new THREE.Mesh(facet(new THREE.DodecahedronGeometry(r, 0)), mats[i % 3]);
      m.position.set((rnd() - 0.5) * (b.w - r), r * 0.7, -b.d / 2 + ((i + 0.5) / n) * b.d);
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      m.scale.y = 0.85;
      grp.add(m);
    }
    const cap = new THREE.Mesh(facet(new THREE.DodecahedronGeometry(0.5, 0)), toon('#F0A06A'));
    cap.position.set(0, 1.05, 0);
    cap.scale.set(1, 0.45, 1.3);
    grp.add(cap);
  } else if (b.kind === 'barrel') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.95, 12), toon('#A0652F'));
    body.position.y = 0.48;
    grp.add(body);
    for (const y of [0.18, 0.78]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.035, 5, 16), toon('#3D3A44'));
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = y;
      grp.add(hoop);
    }
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 12), toon(WOOD_DARK));
    lid.position.y = 0.96;
    grp.add(lid);
  } else if (b.kind === 'mound') {
    // the heart of the mine: layered rock, crystal clusters on its flanks and a gem floating over it
    const tiers: [number, number, number, string][] = [
      [1.75, 0.45, 0.22, '#C9683D'],
      [1.35, 0.45, 0.62, '#DB8550'],
      [0.85, 0.4, 1.0, '#E9A268'],
    ];
    for (const [r, h, y, c] of tiers) {
      const t = new THREE.Mesh(facet(new THREE.CylinderGeometry(r * 0.88, r, h, 9)), toon(c));
      t.position.y = y;
      t.scale.z = b.d / b.w;
      t.rotation.y = rnd();
      grp.add(t);
    }
    // gold-and-rose rubble on top, like a treasure heap
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(facet(new THREE.DodecahedronGeometry(0.22 + rnd() * 0.15, 0)), toon(pick(['#F7C948', '#F4A3B4', '#E9A268'])));
      const a = rnd() * Math.PI * 2;
      r.position.set(Math.cos(a) * 0.65, 1.25, Math.sin(a) * 0.75);
      grp.add(r);
    }
    const crystal = toon('#93E1FF', { emissive: '#1E7FB8' });
    const crystalDeep = toon('#5CC8F5', { emissive: '#0F5E8C' });
    for (const [cx, cz] of [
      [-1.3, -1.25],
      [1.3, -1.2],
      [-1.25, 1.3],
      [1.35, 1.25],
    ]) {
      for (let i = 0; i < 6; i++) {
        const h = 0.4 + rnd() * 0.55;
        const c = new THREE.Mesh(facet(new THREE.ConeGeometry(0.13 + rnd() * 0.08, h, 5)), i % 2 ? crystal : crystalDeep);
        c.position.set(cx + (rnd() - 0.5) * 0.6, h / 2 + 0.05, cz + (rnd() - 0.5) * 0.6);
        c.rotation.set((rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7);
        grp.add(c);
      }
    }
    const gem = new THREE.Group();
    gem.position.y = 2.2;
    const gemMat = toon('#B565F5', { emissive: '#5B1A9E' });
    const facetMat = toon('#D9A6FF', { emissive: '#7B3AC0' });
    const mid = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 6)), gemMat);
    const up = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.34, 0.62, 0.3, 6)), facetMat);
    up.position.y = 0.36;
    const down = new THREE.Mesh(facet(new THREE.ConeGeometry(0.62, 0.55, 6)), gemMat);
    down.rotation.x = Math.PI;
    down.position.y = -0.48;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
    shine.position.set(-0.2, 0.32, 0.38);
    gem.add(mid, up, down, shine);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 14), new THREE.MeshBasicMaterial({ color: '#C084FC', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.y = 2.2;
    grp.add(gem, glow);
    return { group: grp, gem, glow };
  } else {
    // tall grass you can hide in
    const n = Math.max(3, Math.round((b.w * b.d) / 0.8));
    for (let i = 0; i < n; i++) {
      const r = 0.5 + rnd() * 0.3;
      const m = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(r, 1)), toon(pick(LEAF)));
      m.position.set((rnd() - 0.5) * (b.w - r), 0.45 + rnd() * 0.3, (rnd() - 0.5) * (b.d - r));
      m.scale.y = 1.15;
      grp.add(m);
    }
    for (let i = 0; i < n * 3; i++) {
      const blade = new THREE.Mesh(facet(new THREE.ConeGeometry(0.08, 0.7 + rnd() * 0.4, 4)), toon(pick(['#8ED65B', '#A6E06E', '#6CC04A'])));
      blade.position.set((rnd() - 0.5) * b.w, 1.0 + rnd() * 0.2, (rnd() - 0.5) * b.d);
      blade.rotation.set((rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6);
      grp.add(blade);
    }
  }
  return { group: grp };
}

/** One planked crate: a body, a dark frame round its edges, a brace across the front, iron corners. */
function crate(x: number, w: number, d: number, h: number, light: boolean) {
  const grp = new THREE.Group();
  grp.position.x = x;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.94, d * 0.94), toon(light ? '#F0B24A' : '#E59F3A'));
  body.position.y = h / 2;
  grp.add(body);
  const frame = toon('#9A5B22');
  const t = 0.12;
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(t, h, t), frame);
    post.position.set((sx * (w - t)) / 2, h / 2, (sz * (d - t)) / 2);
    grp.add(post);
  }
  for (const y of [t / 2, h - t / 2]) {
    for (const sz of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, t, t), frame);
      rail.position.set(0, y, (sz * (d - t)) / 2);
      grp.add(rail);
    }
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(t, t, d), frame);
      rail.position.set((sx * (w - t)) / 2, y, 0);
      grp.add(rail);
    }
  }
  for (const sz of [-1, 1]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(w, h) * 0.82, t * 0.8, 0.04), frame);
    brace.position.set(0, h / 2, (sz * d) / 2);
    brace.rotation.z = Math.atan2(h, w) * sz;
    grp.add(brace);
  }
  return grp;
}
