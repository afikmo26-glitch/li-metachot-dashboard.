import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ANIM_FILES, HERO_MODELS, HeroId, LOADOUT, WEAPONS } from './assets';
import { useFrame, useLoader } from './r3f';
import { toonify } from './toon';

export type Pose = 'idle' | 'attack' | 'cast' | 'hit' | 'death' | 'win' | 'intro';

// Which KayKit clip plays each pose. One-shot poses fall back to idle when they finish (death holds).
const CLIP: Record<Pose, string[]> = {
  idle: ['Idle_A', 'Idle_B'],
  attack: ['Throw'],
  cast: ['Use_Item', 'Interact'],
  hit: ['Hit_A', 'Hit_B'],
  death: ['Death_A', 'Death_B'],
  win: ['Jump_Full_Short', 'Jump_Full_Long'],
  intro: ['Spawn_Ground'],
};
const ONCE: Pose[] = ['attack', 'cast', 'hit', 'death', 'intro'];

type Props = {
  hero: HeroId;
  pose: Pose;
  /** bump to replay the same pose (two attacks in a row) */
  poseId: number;
  position: [number, number, number];
  /** y rotation; 0 faces the camera */
  facing: number;
  /** bump to flash white (taking a hit) */
  flashId: number;
  /** where a lunge goes: the opponent's position */
  lungeTo?: [number, number, number];
  scale?: number;
  onPoseDone?: (p: Pose) => void;
};

/**
 * One KayKit hero, cel-shaded with a black outline, holding its weapons, animated by the shared rig clips
 * with short cross-fades so moves blend instead of snapping.
 */
export default function Hero3D({ hero, pose, poseId, position, facing, flashId, lungeTo, scale = 1, onPoseDone }: Props) {
  // bundled assets are module ids; r3f resolves them through expo-asset (native) or as URLs (web)
  const gltf = useLoader(GLTFLoader, HERO_MODELS[hero] as unknown as string);
  const animFiles = useLoader(GLTFLoader, ANIM_FILES as unknown as string[]);
  const loadout = LOADOUT[hero];
  const weaponFiles = useLoader(GLTFLoader, [loadout.r ? WEAPONS[loadout.r] : WEAPONS.dagger, loadout.l ? WEAPONS[loadout.l] : WEAPONS.dagger] as unknown as string[]);

  const { model, mats } = useMemo(() => {
    const m = cloneSkinned(gltf.scene);
    // weapons go into the hand slots so they follow the animation
    const slots: [string, boolean][] = [['handslotr', !!loadout.r], ['handslotl', !!loadout.l]];
    slots.forEach(([bone, has], i) => {
      if (!has) return;
      const slot = m.getObjectByName(bone);
      if (slot) slot.add(weaponFiles[i].scene.clone(true));
    });
    const mats = toonify(m, 0.022);
    return { model: m, mats };
  }, [gltf, weaponFiles, loadout.r, loadout.l]);

  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const clips = useMemo(() => animFiles.flatMap((f) => f.animations), [animFiles]);
  const current = useRef<THREE.AnimationAction | null>(null);
  const lunge = useRef(0);
  const currentPose = useRef<Pose>('idle');
  const doneRef = useRef(onPoseDone);
  useEffect(() => {
    doneRef.current = onPoseDone;
  });

  // play a pose: cross-fade from whatever is running
  useEffect(() => {
    const names = CLIP[pose];
    const clip = clips.find((c) => c.name === names[Math.floor(Math.random() * names.length)]) ?? clips.find((c) => names.includes(c.name));
    if (!clip) return;
    const next = mixer.clipAction(clip);
    const once = ONCE.includes(pose);
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.timeScale = pose === 'attack' ? 1.6 : pose === 'hit' ? 1.3 : 1;
    if (current.current && current.current !== next) current.current.crossFadeTo(next, pose === 'hit' ? 0.08 : 0.18, false);
    next.play();
    current.current = next;
    currentPose.current = pose;
    if (pose === 'attack') lunge.current = 1;
  }, [pose, poseId, clips, mixer]);

  useEffect(() => {
    const onFinished = () => {
      const p = currentPose.current;
      if (p !== 'death') doneRef.current?.(p);
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer]);

  // white flash on hit
  const flash = useRef(0);
  useEffect(() => {
    if (flashId) flash.current = 1;
  }, [flashId]);

  // a quick step toward the opponent on attacks
  const group = useRef<THREE.Group>(null);
  const base = useMemo(() => new THREE.Vector3(...position), [position]);
  const target = useMemo(() => (lungeTo ? new THREE.Vector3(...lungeTo) : null), [lungeTo]);

  useFrame((_, dt) => {
    mixer.update(Math.min(dt, 0.05));
    if (flash.current > 0) {
      flash.current = Math.max(0, flash.current - dt * 5);
      for (const m of mats) {
        m.emissive.setRGB(flash.current, flash.current, flash.current);
      }
    }
    const g = group.current;
    if (!g) return;
    let k = 0;
    if (lunge.current > 0) {
      lunge.current = Math.max(0, lunge.current - dt * 3.2);
      // out fast, back slower: sin over the remaining time
      k = Math.sin((1 - lunge.current) * Math.PI) * 0.35;
    }
    if (target) g.position.lerpVectors(base, target, k);
    else g.position.copy(base);
  });

  return (
    <group ref={group} position={position} rotation={[0, facing, 0]} scale={scale}>
      <primitive object={model} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.85, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}
