import * as THREE from 'three';

/** World positions of the two fighters: the player near the camera, the opponent across the field. */
export const POS: [[number, number, number], [number, number, number]] = [
  [0, 0, 3.3],
  [0, 0, -3.1],
];

/** The arena camera for a given viewport — shared by the scene and by screen-space overlays (HP tags). */
export function placeCamera(cam: THREE.PerspectiveCamera, w: number, h: number) {
  const portrait = h > w;
  cam.position.set(0, portrait ? 13 : 8.5, portrait ? 15 : 11.5);
  cam.fov = portrait ? 42 : 38;
  cam.aspect = w / h;
  cam.lookAt(0, 0.6, -0.6);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

/** Where a point above a fighter's feet lands on screen, in pixels. */
export function screenOf(side: 0 | 1, up: number, w: number, h: number) {
  const cam = new THREE.PerspectiveCamera(42, w / h, 0.5, 120);
  placeCamera(cam, w, h);
  const v = new THREE.Vector3(POS[side][0], POS[side][1] + up, POS[side][2]).project(cam);
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
}

