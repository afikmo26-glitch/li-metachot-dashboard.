// hipfix.mjs IN OUT: Tripo's clips store the hip's movement relative to its rest spot; three.js treats it as the
// absolute position, so the whole body sank. Adds the rest offset back into every hip translation key.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [inp, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const hip = doc.getRoot().listNodes().find((n) => n.getName() === 'Hip');
const rest = hip.getTranslation();
let n = 0;
const done = new Set(); // clips can share one key accessor: shift each only once
for (const a of doc.getRoot().listAnimations()) for (const ch of a.listChannels()) {
  if (ch.getTargetNode() !== hip || ch.getTargetPath() !== 'translation') continue;
  const acc = ch.getSampler().getOutput();
  if (done.has(acc)) continue;
  done.add(acc);
  const el = [];
  for (let i = 0; i < acc.getCount(); i++) { acc.getElement(i, el); acc.setElement(i, [el[0] + rest[0], el[1] + rest[1], el[2] + rest[2]]); }
  n++;
}
await io.write(out, doc);
console.log(inp.split('/').pop(), 'rest', rest.map((x) => x.toFixed(3)).join(','), 'channels', n);
