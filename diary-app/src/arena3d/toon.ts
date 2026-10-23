import * as THREE from 'three';

/** Three flat light bands — the cel-shaded look. */
let ramp: THREE.DataTexture | null = null;
export function toonRamp() {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}

const OUTLINE = new THREE.Color('#14081F');

/**
 * Makes a model cartoon-like: toon materials (keeping its texture) and a black outline drawn by an
 * "inverted hull" — a copy of each mesh pushed out along its normals, showing only its back faces.
 * Works for skinned meshes too, so the outline follows the animation.
 */
export function toonify(root: THREE.Object3D, outline = 0.02, castShadow = true) {
  const added: [THREE.Object3D, THREE.Object3D, THREE.Object3D][] = [];
  const mats: THREE.MeshToonMaterial[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.outline) return;
    m.castShadow = castShadow;
    m.receiveShadow = true;
    const old = m.material as THREE.MeshStandardMaterial;
    const tm = new THREE.MeshToonMaterial({ map: old.map ?? null, color: old.color ?? new THREE.Color('#ffffff'), gradientMap: toonRamp(), transparent: old.transparent, alphaTest: old.alphaTest });
    m.material = tm;
    mats.push(tm);
    if (outline <= 0) return;
    const om = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
    om.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normalize(normal) * ${outline.toFixed(4)};`);
    };
    const sm = m as THREE.SkinnedMesh;
    const hull = sm.isSkinnedMesh ? new THREE.SkinnedMesh(sm.geometry, om) : new THREE.Mesh(m.geometry, om);
    if (sm.isSkinnedMesh) (hull as unknown as THREE.SkinnedMesh).bind(sm.skeleton, sm.bindMatrix);
    hull.userData.outline = true;
    hull.frustumCulled = false;
    m.frustumCulled = false;
    added.push([m.parent!, hull, m]);
  });
  for (const [parent, hull, m] of added) {
    hull.position.copy(m.position);
    hull.quaternion.copy(m.quaternion);
    hull.scale.copy(m.scale);
    parent.add(hull);
  }
  return mats;
}
