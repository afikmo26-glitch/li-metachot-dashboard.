import * as THREE from 'three';
import type { Box, Game } from './brawlGame';
import { toonRamp } from './toon';

/**
 * The temple court of "זירת הכאוס", built once from primitives: a carved stone wall with pillars and corner
 * braziers, jungle all around (so the camera never shows empty sky), and the cover pieces of the layout.
 * Repeated pieces are instanced so the whole arena stays a few dozen draw calls.
 */

// a fixed seed: the arena looks the same every fight
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Faceted look for leaves and rocks: split the faces so each one gets its own normal. */
function facet<T extends THREE.BufferGeometry>(geo: T) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

const toon = (color: string, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra });

/** One instanced mesh from a list of [position, rotationY, scale, color]. */
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: { p: [number, number, number]; r?: number; s: [number, number, number]; c?: string }[]) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  items.forEach((it, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.r ?? 0);
    m.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s));
    mesh.setMatrixAt(i, m);
    if (it.c) mesh.setColorAt(i, new THREE.Color(it.c));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export type Flame = { mesh: THREE.Object3D; phase: number };
export type ArenaField = { group: THREE.Group; flames: Flame[]; orb: THREE.Object3D; halo: THREE.Object3D };

const STONE = ['#C9B48E', '#BFA982', '#D4C29C', '#B59F78'];
const LEAF = ['#2E8B3E', '#3FA34D', '#257A36', '#4DB35A', '#1F6B30'];

export function buildArena(game: Game, groundTex: THREE.Texture): ArenaField {
  const rnd = seeded(20261024);
  const g = new THREE.Group();
  const HX = game.hx;
  const HZ = game.hz;
  const flames: Flame[] = [];

  // the painted court, and the jungle floor reaching past the walls
  const court = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), new THREE.MeshToonMaterial({ map: groundTex, gradientMap: toonRamp() }));
  court.rotation.x = -Math.PI / 2;
  g.add(court);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), toon('#2D6B33'));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  g.add(outer);

  // --- the wall: dressed blocks, a capstone course, pillars every few metres, braziers on the corner towers
  const blocks: Parameters<typeof instanced>[2] = [];
  const caps: Parameters<typeof instanced>[2] = [];
  const pillars: Parameters<typeof instanced>[2] = [];
  const bands: Parameters<typeof instanced>[2] = [];
  const WX = HX + 0.45; // wall centre lines
  const WZ = HZ + 0.45;
  const sides: { along: 'x' | 'z'; fixed: number; len: number }[] = [
    { along: 'x', fixed: -WZ, len: HX },
    { along: 'x', fixed: WZ, len: HX },
    { along: 'z', fixed: -WX, len: HZ },
    { along: 'z', fixed: WX, len: HZ },
  ];
  for (const side of sides) {
    const n = Math.round(side.len * 2);
    const step = (side.len * 2) / n;
    for (let i = 0; i < n; i++) {
      const c = -side.len + step * (i + 0.5);
      const h = 0.95 + rnd() * 0.12;
      const pos = (y: number): [number, number, number] => (side.along === 'x' ? [c, y, side.fixed] : [side.fixed, y, c]);
      const size = (a: number, y: number, b: number): [number, number, number] => (side.along === 'x' ? [a, y, b] : [b, y, a]);
      blocks.push({ p: pos(h / 2), s: size(step * 0.97, h, 0.9), c: STONE[Math.floor(rnd() * STONE.length)] });
      caps.push({ p: pos(h + 0.08), s: size(step, 0.16, 1.08), c: '#E3D3AE' });
      if (i % 4 === 2 && i < n - 2) {
        pillars.push({ p: pos(0.8), s: [0.62, 1.6, 0.62], c: '#BCA67E' });
        bands.push({ p: pos(1.3), s: [0.7, 0.14, 0.7], c: '#E8B931' });
        caps.push({ p: pos(1.66), s: size(0.78, 0.14, 0.78), c: '#E3D3AE' });
      }
    }
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  g.add(instanced(unit, toon('#FFFFFF'), blocks));
  g.add(instanced(unit, toon('#FFFFFF'), caps));
  g.add(instanced(new THREE.CylinderGeometry(0.5, 0.56, 1, 8), toon('#FFFFFF'), pillars));
  g.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), toon('#FFFFFF', { emissive: '#5A3B00' }), bands));

  // corner towers with fire bowls
  const flameMat = new THREE.MeshBasicMaterial({ color: '#FF8A1F' });
  const coreMat = new THREE.MeshBasicMaterial({ color: '#FFE066' });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#FFB347', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [x, z] of [
    [-WX, -WZ],
    [WX, -WZ],
    [-WX, WZ],
    [WX, WZ],
  ]) {
    const tower = new THREE.Group();
    tower.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 1.5), toon('#B9A37B'));
    base.position.y = 1.05;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.25, 1.75), toon('#E3D3AE'));
    top.position.y = 2.2;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.16, 1.56), toon('#E8B931', { emissive: '#5A3B00' }));
    band.position.y = 1.6;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.32, 0.4, 10), toon('#5B4636'));
    bowl.position.y = 2.5;
    const fire = new THREE.Group();
    fire.position.y = 2.7;
    const outerF = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8), flameMat);
    outerF.position.y = 0.45;
    const innerF = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 8), coreMat);
    innerF.position.y = 0.3;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), glowMat);
    glow.position.y = 0.4;
    fire.add(outerF, innerF, glow);
    tower.add(base, top, band, bowl, fire);
    g.add(tower);
    flames.push({ mesh: fire, phase: rnd() * 6 });
  }

  // --- jungle around the court: layered trees and big leafy shrubs hugging the wall
  const trunks: Parameters<typeof instanced>[2] = [];
  const crowns: Parameters<typeof instanced>[2] = [];
  const shrubs: Parameters<typeof instanced>[2] = [];
  for (let i = 0; i < 170; i++) {
    // a band of forest outside the walls, thicker further out
    const d = 2.2 + Math.pow(rnd(), 0.8) * 16;
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * (HX + d) * 1.15;
    const z = Math.sin(a) * (HZ + d);
    // nothing tall in front of the near wall, where it would stand between the camera and the fight
    if (z > HZ && Math.abs(x) < HX + 8) continue;
    const sc = 1.2 + rnd() * 1.3;
    trunks.push({ p: [x, sc * 0.9, z], s: [0.35 * sc, sc * 1.8, 0.35 * sc], c: rnd() < 0.5 ? '#6B4A2B' : '#7A5634' });
    const crownN = 2 + Math.floor(rnd() * 2);
    for (let j = 0; j < crownN; j++) {
      const cs = sc * (1.1 + rnd() * 0.5) * (1 - j * 0.18);
      crowns.push({ p: [x + (rnd() - 0.5) * sc * 0.8, sc * 1.8 + j * sc * 0.7, z + (rnd() - 0.5) * sc * 0.8], r: rnd() * 6, s: [cs, cs * 0.8, cs], c: LEAF[Math.floor(rnd() * LEAF.length)] });
    }
  }
  for (let i = 0; i < 80; i++) {
    const t = rnd() * 4;
    const off = 1.3 + rnd() * 1.4;
    const ax = (rnd() * 2 - 1) * (HX + 1.5);
    const az = (rnd() * 2 - 1) * (HZ + 1.5);
    const [x, z] = t < 1 ? [ax, -HZ - off] : t < 2 ? [ax, HZ + off] : t < 3 ? [-HX - off, az] : [HX + off, az];
    // low shrubs only along the near wall
    const s = (z > HZ ? 0.5 : 0.9) + rnd() * (z > HZ ? 0.3 : 0.9);
    shrubs.push({ p: [x, s * 0.45, z], r: rnd() * 6, s: [s * 1.2, s, s * 1.2], c: LEAF[Math.floor(rnd() * LEAF.length)] });
  }
  g.add(instanced(new THREE.CylinderGeometry(0.4, 0.55, 1, 7), toon('#FFFFFF'), trunks));
  g.add(instanced(facet(new THREE.IcosahedronGeometry(1, 1)), toon('#FFFFFF'), crowns));
  g.add(instanced(facet(new THREE.IcosahedronGeometry(1, 1)), toon('#FFFFFF'), shrubs));

  // --- the cover pieces
  let orb: THREE.Object3D = new THREE.Group();
  let halo: THREE.Object3D = new THREE.Group();
  for (const b of game.boxes) {
    const piece = coverPiece(b, rnd);
    g.add(piece.group);
    if (piece.orb) orb = piece.orb;
    if (piece.halo) halo = piece.halo;
  }
  return { group: g, flames, orb, halo };
}

function coverPiece(b: Box, rnd: () => number): { group: THREE.Group; orb?: THREE.Object3D; halo?: THREE.Object3D } {
  const grp = new THREE.Group();
  grp.position.set(b.x, 0, b.z);
  if (b.kind === 'crate') {
    // planked crate with a dark frame and iron corners
    const h = 1.15;
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.94, h * 0.94, b.d * 0.94), toon('#C98B4B'));
    body.position.y = h / 2;
    grp.add(body);
    const frameMat = toon('#7A4A22');
    const t = 0.13;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(t, h, t), frameMat);
      post.position.set((sx * (b.w - t)) / 2, h / 2, (sz * (b.d - t)) / 2);
      grp.add(post);
    }
    for (const y of [t / 2, h - t / 2]) {
      for (const sz of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(b.w, t, t), frameMat);
        rail.position.set(0, y, (sz * (b.d - t)) / 2);
        grp.add(rail);
      }
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(t, t, b.d), frameMat);
        rail.position.set((sx * (b.w - t)) / 2, y, 0);
        grp.add(rail);
      }
    }
    // plank seams on the lid and a diagonal brace on the long faces
    for (let i = 1; i < 4; i++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.9, 0.02, 0.03), frameMat);
      seam.position.set(0, h + 0.005, -b.d / 2 + (b.d * i) / 4);
      grp.add(seam);
    }
    for (const sz of [-1, 1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(b.w, h) * 0.85, t * 0.8, 0.04), frameMat);
      brace.position.set(0, h / 2, (sz * b.d) / 2);
      brace.rotation.z = Math.atan2(h, b.w) * sz;
      grp.add(brace);
    }
    const metal = toon('#D1D5DB');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), metal);
      cap.position.set((sx * b.w) / 2, h, (sz * b.d) / 2);
      grp.add(cap);
    }
  } else if (b.kind === 'rock') {
    const rockMat = toon('#8F9BB0');
    const rockMat2 = toon('#A9B3C6');
    const moss = toon('#5DAE4B');
    const parts: [number, number, number, number][] = [
      [0, 0.55, 0, 0.95],
      [0.55, 0.35, 0.4, 0.6],
      [-0.5, 0.3, 0.45, 0.5],
      [0.2, 0.25, -0.55, 0.5],
    ];
    parts.forEach(([x, y, z, r], i) => {
      const m = new THREE.Mesh(facet(new THREE.DodecahedronGeometry(r, 0)), i % 2 ? rockMat2 : rockMat);
      m.position.set(x, y, z);
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      m.scale.y = 0.8;
      grp.add(m);
    });
    const cap = new THREE.Mesh(facet(new THREE.SphereGeometry(0.6, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), moss);
    cap.position.set(-0.05, 0.98, 0.05);
    cap.scale.set(1.05, 0.35, 1);
    grp.add(cap);
  } else if (b.kind === 'wall') {
    // a broken temple wall: courses of blocks, the top course chipped, a vine down the face
    const long = b.w >= b.d;
    const len = long ? b.w : b.d;
    const n = Math.max(2, Math.round(len / 0.8));
    const bw = len / n;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < n; i++) {
        if (row === 2 && (i === 0 || rnd() < 0.35)) continue;
        const off = row % 2 ? bw * 0.25 : 0;
        const along = -len / 2 + bw * (i + 0.5) + (i === n - 1 ? 0 : off);
        const blk = new THREE.Mesh(new THREE.BoxGeometry(long ? bw * 0.96 : 0.86, 0.42, long ? 0.86 : bw * 0.96), toon(STONE[Math.floor(rnd() * STONE.length)]));
        blk.position.set(long ? along : 0, 0.21 + row * 0.43, long ? 0 : along);
        grp.add(blk);
      }
    }
    const vine = toon('#3E9B47');
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.22, 0)), vine);
      const along = -len / 3 + i * 0.12;
      leaf.position.set(long ? along : 0.46, 1.0 - i * 0.28, long ? 0.46 : along);
      grp.add(leaf);
    }
  } else if (b.kind === 'statue') {
    // the court's heart: a stepped pedestal holding a floating glass orb, like the one on the title screen
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.08, 0.35, 8), toon('#CDB88F'));
    s1.position.y = 0.175;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.5, 8), toon('#BDA67C'));
    s2.position.y = 0.6;
    const gold = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.1, 8), toon('#E8B931', { emissive: '#5A3B00' }));
    gold.position.y = 0.87;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.3, 8), toon('#D4C29C'));
    bowl.position.y = 1.05;
    grp.add(s1, s2, gold, bowl);
    const orb = new THREE.Group();
    orb.position.y = 1.75;
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 16), new THREE.MeshToonMaterial({ color: '#7FF5E6', emissive: '#1AA89A', gradientMap: toonRamp() }));
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
    shine.position.set(-0.17, 0.2, 0.3);
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshBasicMaterial({ color: '#5EEAD4', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    orb.add(glass, shine, aura);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 6, 32), new THREE.MeshBasicMaterial({ color: '#FDE68A' }));
    halo.position.y = 1.75;
    halo.rotation.x = Math.PI / 2.4;
    grp.add(orb, halo);
    return { group: grp, orb, halo };
  } else {
    // tall grass you can hide in: overlapping leafy mounds, lighter on top
    const n = Math.max(3, Math.round((b.w * b.d) / 0.9));
    for (let i = 0; i < n; i++) {
      const r = 0.55 + rnd() * 0.3;
      const m = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(r, 1)), toon(LEAF[Math.floor(rnd() * LEAF.length)]));
      m.position.set((rnd() - 0.5) * (b.w - r), 0.45 + rnd() * 0.35, (rnd() - 0.5) * (b.d - r));
      m.scale.y = 1.15;
      grp.add(m);
    }
    for (let i = 0; i < n * 2; i++) {
      const blade = new THREE.Mesh(facet(new THREE.ConeGeometry(0.09, 0.7 + rnd() * 0.4, 4)), toon('#8BD45B'));
      blade.position.set((rnd() - 0.5) * b.w, 1.0 + rnd() * 0.2, (rnd() - 0.5) * b.d);
      blade.rotation.set((rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6);
      grp.add(blade);
    }
  }
  return { group: grp };
}
