import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Anim } from '../arena/assets';
import { MODELS3D } from './models';
import { Canvas, useFrame, useLoader } from './r3f';
import { toonify } from './toon';

export type Pose3 = Anim | 'special' | 'lobby';

// Every fighter shares one set of Tripo biped clips (see models.ts); each pose picks one of these.
const CLIPS: Record<Pose3, string[]> = {
  idle: ['idle'],
  lobby: ['warm_up', 'swagger', 'idle'],
  attack: ['box_01', 'box_02', 'front_kick_01'],
  special: ['cast_a_spell'],
  hit: ['hit_to_body_01', 'hit_to_head'],
  death: ['defeat_02'],
  win: ['victory_celebration'],
};
const LOOP: Pose3[] = ['idle', 'lobby', 'win'];
/** The special move's body language by element: breathing fire, casting, chopping down. */
export const SPECIAL_CLIP: Record<string, string> = { fire: 'fire', water: 'cast_a_spell', nature: 'cast_a_spell', earth: 'chop', storm: 'jump', shadow: 'cast_a_spell' };

type Props = { char: string; pose: Pose3; poseId?: number; special?: string; flip?: boolean; onDone?: (p: Pose3) => void };

function Model({ char, pose, poseId = 0, special, flip, onDone }: Props) {
  const gltf = useLoader(GLTFLoader, MODELS3D[char] as unknown as string);
  const { scene, mixer, mats } = useMemo(() => {
    const s = gltf.scene;
    const box = new THREE.Box3().setFromObject(s);
    const h = box.max.y - box.min.y || 1;
    const mats = toonify(s, h * 0.008, false);
    // feet on the floor, 1.6 units tall, whatever size Tripo exported it at
    const k = 1.6 / h;
    s.scale.setScalar(k);
    s.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
    return { scene: s, mixer: new THREE.AnimationMixer(s), mats };
  }, [gltf]);
  const current = useRef<THREE.AnimationAction | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const flash = useRef(0);

  useEffect(() => {
    const names = pose === 'special' && special ? [special] : CLIPS[pose];
    const name = names[Math.floor(Math.random() * names.length)];
    const clip = gltf.animations.find((c) => c.name === name) ?? gltf.animations.find((c) => c.name === 'idle');
    if (!clip) return;
    const next = mixer.clipAction(clip);
    const loop = LOOP.includes(pose);
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.timeScale = pose === 'attack' ? 1.7 : pose === 'hit' ? 1.4 : 1;
    if (current.current && current.current !== next) current.current.crossFadeTo(next, pose === 'hit' || pose === 'attack' ? 0.08 : 0.25, false);
    next.play();
    current.current = next;
    if (pose === 'hit') flash.current = 1;
    if (loop) return;
    const onFinish = (e: { action: THREE.AnimationAction }) => {
      if (e.action === next) done.current?.(pose);
    };
    mixer.addEventListener('finished', onFinish);
    return () => mixer.removeEventListener('finished', onFinish);
  }, [pose, poseId, special, gltf, mixer]);

  useFrame((_, dt) => {
    mixer.update(Math.min(dt, 0.05));
    if (flash.current > 0) {
      flash.current = Math.max(0, flash.current - dt * 4);
      for (const m of mats) m.emissive.setRGB(flash.current, flash.current, flash.current);
    }
  });

  return (
    <group rotation={[0, flip ? 0.55 : -0.55, 0]}>
      <primitive object={scene} />
    </group>
  );
}

/**
 * One live 3D fighter in a transparent square, drawn over whatever is behind it: cel-shaded with an outline,
 * playing the shared fight clips. `poseId` replays a pose (two punches in a row).
 */
export default function Fighter3D(props: Props & { size: number }) {
  return (
    <View style={{ width: props.size, height: props.size }} pointerEvents="none">
      <Canvas gl={{ antialias: true, alpha: true }} camera={{ position: [0, 1.25, 4.4], fov: 30, near: 0.1, far: 50 }} onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}>
        <hemisphereLight args={['#FFFFFF', '#8899BB', 1.7]} />
        <directionalLight position={[2, 6, 5]} intensity={2.2} />
        <Suspense fallback={null}>
          <Model {...props} />
        </Suspense>
      </Canvas>
    </View>
  );
}
