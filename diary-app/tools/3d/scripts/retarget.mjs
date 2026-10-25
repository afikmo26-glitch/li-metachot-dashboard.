// retarget.mjs DONOR TARGET OUT: moves the donor's clips onto another Tripo biped by world-space deltas, so
// each joint turns the same way in the world whatever its own bone axes are (copying local rotations bent the
// limbs of rigs whose bones point differently). The hip's movement is kept relative to its rest spot.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample } from '@gltf-transform/functions';
import { Matrix4, Quaternion, Vector3 } from 'three';
const [donorPath, targetPath, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const donor = await io.read(donorPath);
const doc = await io.read(targetPath);
const FPS = 30;
// raised arms swing out to the side by up to this much, so fists clear big chibi heads instead of sinking in
const SPREAD = (+process.env.SPREAD || 22) * (Math.PI / 180);

const parentMap = (d) => { const m = new Map(); for (const n of d.getRoot().listNodes()) for (const c of n.listChildren()) m.set(c, n); return m; };
const tNodes = doc.getRoot().listNodes(), dNodes = donor.getRoot().listNodes();
const tBy = new Map(tNodes.map((n) => [n.getName(), n])), dBy = new Map(dNodes.map((n) => [n.getName(), n]));
const tPar = parentMap(doc), dPar = parentMap(donor);
const q = (a) => new Quaternion(a[0], a[1], a[2], a[3]);
// nodes ordered parents first
const order = (nodes, par) => { const depth = (n) => (par.has(n) ? 1 + depth(par.get(n)) : 0); return [...nodes].sort((a, b) => depth(a) - depth(b)); };
const worldRest = (nodes, par) => { const w = new Map(); for (const n of order(nodes, par)) { const p = par.get(n); w.set(n, (p ? w.get(p).clone() : new Quaternion()).multiply(q(n.getRotation()))); } return w; };
const dRestW = worldRest(dNodes, dPar), tRestW = worldRest(tNodes, tPar);

const sample = (ch, t) => {
  const s = ch.getSampler(); const ti = s.getInput().getArray(); const o = s.getOutput(); const n = ti.length;
  const el = (i) => o.getElement(i, []);
  if (t <= ti[0] || n === 1) return el(0);
  if (t >= ti[n - 1]) return el(n - 1);
  let i = 0; while (ti[i + 1] < t) i++;
  const k = (t - ti[i]) / (ti[i + 1] - ti[i]); const a = el(i), b = el(i + 1);
  if (s.getInterpolation() === 'STEP') return a;
  if (a.length === 4) { const r = q(a).slerp(q(b), k); return [r.x, r.y, r.z, r.w]; }
  return a.map((v, j) => v + (b[j] - v) * k);
};

const dHip = dBy.get('Hip'), tHip = tBy.get('Hip');
const hipK = Math.abs(tHip.getTranslation()[2]) / Math.max(1e-6, Math.abs(dHip.getTranslation()[2]));
const buf = doc.getRoot().listBuffers()[0];
for (const a of doc.getRoot().listAnimations()) a.dispose();
const dOrder = order(dNodes, dPar), tOrder = order(tNodes, tPar);

for (const clip of donor.getRoot().listAnimations()) {
  const rot = new Map(), hipT = [];
  for (const ch of clip.listChannels()) if (ch.getTargetPath() === 'rotation') rot.set(ch.getTargetNode(), ch);
  const hipCh = clip.listChannels().find((c) => c.getTargetNode() === dHip && c.getTargetPath() === 'translation');
  let dur = 0; for (const ch of clip.listChannels()) { const ti = ch.getSampler().getInput().getArray(); dur = Math.max(dur, ti[ti.length - 1]); }
  const frames = Math.max(2, Math.round(dur * FPS) + 1);
  const times = new Float32Array(frames).map((_, i) => (i / (frames - 1)) * dur);
  const out = new Map(); // target node -> Float32Array of quats
  for (const n of tOrder) if (dBy.has(n.getName()) && rot.has(dBy.get(n.getName()))) out.set(n, new Float32Array(frames * 4));
  times.forEach((t, f) => {
    // donor world rotations at t
    const dW = new Map();
    for (const n of dOrder) { const p = dPar.get(n); const l = rot.has(n) ? q(sample(rot.get(n), t)) : q(n.getRotation()); dW.set(n, (p ? dW.get(p).clone() : new Quaternion()).multiply(l)); }
    // the donor's hand height against its shoulder says how raised each arm is
    const dM = new Map();
    for (const n of dOrder) {
      const p = dPar.get(n);
      const tr = n === dHip && hipCh ? sample(hipCh, t) : n.getTranslation();
      const l = new Matrix4().compose(new Vector3(...tr), rot.has(n) ? q(sample(rot.get(n), t)) : q(n.getRotation()), new Vector3(...n.getScale()));
      dM.set(n, p ? dM.get(p).clone().multiply(l) : l);
    }
    const pos = (name) => new Vector3().setFromMatrixPosition(dM.get(dBy.get(name)));
    const raise = (side) => {
      const sh = pos(side + '_Upperarm'), hand = pos(side + '_Hand');
      const len = sh.distanceTo(pos(side + '_Forearm')) + pos(side + '_Forearm').distanceTo(hand) || 1;
      return Math.min(1, Math.max(0, (hand.y - sh.y) / len + 0.6));
    };
    const tW = new Map();
    for (const n of tOrder) {
      const p = tPar.get(n); const pw = p ? tW.get(p) : new Quaternion();
      const dn = dBy.get(n.getName());
      if (out.has(n)) {
        const delta = dW.get(dn).clone().multiply(dRestW.get(dn).clone().invert()); // the donor's turn, in the world
        const w = delta.multiply(tRestW.get(n));
        const side = n.getName() === 'L_Upperarm' ? 'L' : n.getName() === 'R_Upperarm' ? 'R' : '';
        // bind poses face +x with the left side at -z: turning about x swings the arm out to its side
        if (side) w.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (side === 'L' ? 1 : -1) * SPREAD * raise(side)));
        const local = pw.clone().invert().multiply(w).normalize();
        out.get(n).set([local.x, local.y, local.z, local.w], f * 4);
        tW.set(n, w);
      } else tW.set(n, pw.clone().multiply(q(n.getRotation())));
    }
    if (hipCh) { const v = sample(hipCh, t); const r = tHip.getTranslation(); hipT.push(r[0] + v[0] * hipK, r[1] + v[1] * hipK, r[2] + v[2] * hipK); }
  });
  const anim = doc.createAnimation(clip.getName());
  const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buf);
  const add = (node, path, type, arr) => {
    const smp = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType(type).setArray(arr).setBuffer(buf)).setInterpolation('LINEAR');
    anim.addSampler(smp).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(smp));
  };
  for (const [n, arr] of out) add(n, 'rotation', 'VEC4', arr);
  if (hipT.length) add(tHip, 'translation', 'VEC3', new Float32Array(hipT));
}
await doc.transform(resample({ tolerance: 0.001 }));
await io.write(out, doc);
console.log(targetPath.split('/').pop(), 'clips', doc.getRoot().listAnimations().length, 'hipK', hipK.toFixed(2));
