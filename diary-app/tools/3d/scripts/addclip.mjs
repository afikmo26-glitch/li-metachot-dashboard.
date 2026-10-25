// addclip.mjs SRC.glb CLIP TARGET.glb : copies one clip from SRC (a retarget.mjs output for this same model) into
// TARGET by node name, replacing a clip of that name, and leaves TARGET's other clips untouched. For 'run' and
// 'dance' the hip gets a vertical bob of BOB (default 0.04) of its rest height, BOBS times per loop (default 2:
// low at each foot strike of the run).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { Matrix4, Quaternion, Vector3 } from 'three';
const [srcPath, clipName, targetPath] = process.argv.slice(2);
const BOB = +process.env.BOB || 0.04;
const BOBS = +process.env.BOBS || 2;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const src = await io.read(srcPath);
const doc = await io.read(targetPath);
const root = doc.getRoot();
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const buf = root.listBuffers()[0];
const clip = src.getRoot().listAnimations().find((a) => a.getName() === clipName);
if (!clip) throw new Error(`${srcPath} has no clip ${clipName}`);
for (const a of root.listAnimations()) if (a.getName() === clipName) a.dispose();

const anim = doc.createAnimation(clipName);
const hip = byName.get('Hip');
let times = null;
for (const ch of clip.listChannels()) {
  const target = byName.get(ch.getTargetNode()?.getName());
  // the donor's hip translation lives in another rig's frame; the bob below replaces it
  if (!target || (target === hip && ch.getTargetPath() === 'translation')) continue;
  const s = ch.getSampler();
  times = times || s.getInput().getArray().slice();
  const inp = doc.createAccessor().setType('SCALAR').setArray(s.getInput().getArray().slice()).setBuffer(buf);
  const outp = doc.createAccessor().setType(s.getOutput().getType()).setArray(s.getOutput().getArray().slice()).setBuffer(buf);
  const ns = doc.createAnimationSampler().setInput(inp).setOutput(outp).setInterpolation(s.getInterpolation());
  anim.addSampler(ns).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(ns));
}

if ((clipName === 'run' || clipName === 'dance') && hip) {
  // world up (+y) expressed in the hip's parent frame, from the rest pose
  const parents = []; for (let n = hip; ; ) { const p = root.listNodes().find((m) => m.listChildren().includes(n)); if (!p) break; parents.unshift(p); n = p; }
  const pw = new Matrix4(); for (const p of parents) pw.multiply(new Matrix4().compose(new Vector3(...p.getTranslation()), new Quaternion(...p.getRotation()), new Vector3(...p.getScale())));
  const restLocal = new Vector3(...hip.getTranslation());
  const height = restLocal.clone().applyMatrix4(pw).y;
  const up = new Vector3(0, 1, 0).applyQuaternion(new Quaternion().setFromRotationMatrix(pw).invert());
  const scale = new Vector3().setFromMatrixScale(pw).y || 1;
  const n = 8 * BOBS, dur = times[times.length - 1];
  const t = new Float32Array(n + 1), v = new Float32Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    t[i] = (i / n) * dur;
    const d = (BOB * height * Math.cos((2 * Math.PI * BOBS * i) / n)) / scale;
    v.set([restLocal.x + up.x * d, restLocal.y + up.y * d, restLocal.z + up.z * d], i * 3);
  }
  const smp = doc.createAnimationSampler().setInput(doc.createAccessor().setType('SCALAR').setArray(t).setBuffer(buf))
    .setOutput(doc.createAccessor().setType('VEC3').setArray(v).setBuffer(buf)).setInterpolation('LINEAR');
  anim.addSampler(smp).addChannel(doc.createAnimationChannel().setTargetNode(hip).setTargetPath('translation').setSampler(smp));
}
await io.write(targetPath, doc);
console.log(targetPath.split(/[\\/]/).pop(), root.listAnimations().map((a) => a.getName()).join(','));
