// share.mjs OUT TARGET_RIGGED DONOR_ANIM... : puts the donor's animations on another Tripo biped. Only joint
// rotations are copied (bone lengths stay the target's); the hip's movement is scaled to the target's hip height.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, resample, quantize } from '@gltf-transform/functions';
import sharp from 'sharp';
const [out, target, ...donors] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(target);
const root = doc.getRoot();
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const buf = root.listBuffers()[0];
for (const a of root.listAnimations()) a.dispose();
for (const f of donors) {
  const src = await io.read(f);
  const dHip = src.getRoot().listNodes().find((n) => n.getName() === 'Hip');
  const tHip = byName.get('Hip');
  const k = Math.abs(tHip.getTranslation()[1]) / Math.max(1e-6, Math.abs(dHip.getTranslation()[1]));
  for (const a of src.getRoot().listAnimations()) {
    const na = doc.createAnimation(a.getName());
    for (const ch of a.listChannels()) {
      const name = ch.getTargetNode()?.getName();
      const node = byName.get(name);
      const path = ch.getTargetPath();
      if (!node || path === 'scale' || (path === 'translation' && name !== 'Hip')) continue;
      const s = ch.getSampler();
      let arr = s.getOutput().getArray().slice();
      if (path === 'translation') arr = arr.map((v) => v * k);
      const inp = doc.createAccessor().setType(s.getInput().getType()).setArray(s.getInput().getArray().slice()).setBuffer(buf);
      const outp = doc.createAccessor().setType(s.getOutput().getType()).setArray(arr).setBuffer(buf);
      const ns = doc.createAnimationSampler().setInput(inp).setOutput(outp).setInterpolation(s.getInterpolation());
      na.addSampler(ns).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(ns));
    }
  }
}
await doc.transform(dedup(), resample({ tolerance: 0.002 }), prune(), quantize(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [768, 768], quality: 82 }));
await io.write(out, doc);
console.log('anims', root.listAnimations().length);
