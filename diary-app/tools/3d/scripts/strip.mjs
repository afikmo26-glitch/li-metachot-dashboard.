// strip.mjs IN.glb OUT.glb OUT.jpg : moves the base colour texture out of a .glb into its own .jpg
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'fs';
const [inp, outGlb, outJpg] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const mats = doc.getRoot().listMaterials();
let done = false;
for (const m of mats) {
  const t = m.getBaseColorTexture();
  if (t && !done) {
    await sharp(Buffer.from(t.getImage())).resize(1024, 1024, { fit: 'fill' }).jpeg({ quality: 85 }).toFile(outJpg);
    done = true;
  }
  m.setBaseColorTexture(null);
}
await doc.transform(prune({ keepAttributes: true }));
await io.write(outGlb, doc);
console.log(inp.split('/').pop(), done ? 'tex' : 'NO TEX', fs.statSync(outGlb).size);
