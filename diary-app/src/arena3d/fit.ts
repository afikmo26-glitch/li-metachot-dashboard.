import * as THREE from 'three';

/** A few models were sculpted a little turned against their skeleton; this squares them up to the camera. */
const FACE_FIX: Record<string, number> = { dragon_gold: 0.32, wolf: 0.12 };

/** Bounds of the skinned mesh as actually posed (a sample of its vertices is plenty). */
function posedBox(root: THREE.Object3D) {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.outline) return;
    const pos = m.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 3000));
    for (let i = 0; i < pos.count; i += step) {
      m.getVertexPosition(i, v);
      box.expandByPoint(v.applyMatrix4(m.matrixWorld));
    }
  });
  return box;
}

/**
 * Stands a cloned fighter in its idle pose with its feet on y=0, `height` units tall, centred, and returns the
 * turn that makes it face +z (towards the camera). Tripo rigs face +x; the shoulders and hips tell by how much.
 */
export function fitFighter(scene: THREE.Object3D, clips: THREE.AnimationClip[], id: string, height: number) {
  const idle = clips.find((c) => c.name === 'idle');
  const mixer = new THREE.AnimationMixer(scene);
  if (idle) {
    mixer.clipAction(idle).play();
    mixer.update(0);
  }
  const box = posedBox(scene);
  const bone = (n: string) => {
    let b: THREE.Object3D | undefined;
    scene.traverse((o) => {
      if (o.name === n && (o as THREE.Bone).isBone) b = o;
    });
    return b ? b.getWorldPosition(new THREE.Vector3()) : null;
  };
  const la = bone('L_Upperarm'), ra = bone('R_Upperarm'), lt = bone('L_Thigh'), rt = bone('R_Thigh');
  let face = -Math.PI / 2;
  if (la && ra && lt && rt) {
    const side = la.sub(ra).add(lt.sub(rt));
    face = Math.atan2(side.z, side.x);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(scene);
  const h = box.max.y - box.min.y || 1;
  const k = height / h;
  scene.scale.setScalar(k);
  scene.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  return { face: face + (FACE_FIX[id] ?? 0), h };
}
