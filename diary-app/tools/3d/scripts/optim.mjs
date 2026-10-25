import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { quantize, resample, dedup } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(3)) { const d = await io.read(f); await d.transform(resample({ tolerance: 0.003 }), dedup(), quantize()); await io.write(process.argv[2] + '/' + f.split('/').pop(), d); }
