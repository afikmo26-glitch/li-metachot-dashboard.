// merge.mjs OUT IN1 IN2... : keeps IN1's mesh/skeleton, copies every animation from the others onto it by node name,
// then shrinks textures to 1024 and drops unused data.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
const [out, first, ...rest] = process.argv.slice(2);
const io = new NodeIO();
const doc = await io.read(first);
const root = doc.getRoot();
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const buf = root.listBuffers()[0];
for (const f of rest) {
  const src = await io.read(f);
  for (const a of src.getRoot().listAnimations()) {
    const na = doc.createAnimation(a.getName());
    for (const ch of a.listChannels()) {
      const target = byName.get(ch.getTargetNode()?.getName());
      if (!target) continue;
      const s = ch.getSampler();
      const inp = doc.createAccessor().setType(s.getInput().getType()).setArray(s.getInput().getArray().slice()).setBuffer(buf);
      const outp = doc.createAccessor().setType(s.getOutput().getType()).setArray(s.getOutput().getArray().slice()).setBuffer(buf);
      const ns = doc.createAnimationSampler().setInput(inp).setOutput(outp).setInterpolation(s.getInterpolation());
      na.addSampler(ns).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(ns));
    }
  }
}
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 85 }));
await io.write(out, doc);
console.log('anims', doc.getRoot().listAnimations().map((a) => a.getName()).join(','));
