import React, { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { reportCrash } from '../lib/cloud';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Anim } from '../arena/assets';
import { loadModel, loadStep } from './loadModel';
import { Canvas, useFrame } from './r3f';
import { fitFighter } from './fit';
import { toonify } from './toon';

export type Pose3 = Anim | 'special' | 'lobby';

// Every fighter shares one set of Tripo biped clips (see models.ts); each pose picks one of these.
const CLIPS: Record<Pose3, string[]> = {
  idle: ['idle'],
  lobby: ['idle'],
  attack: ['box_01', 'front_kick_01'],
  special: ['cast_a_spell'],
  hit: ['hit_to_body_01'],
  death: ['defeat_02'],
  win: ['victory_celebration'],
};
const LOOP: Pose3[] = ['idle', 'lobby', 'win'];
/** The special move's body language by element: breathing fire, casting, chopping down. */
export const SPECIAL_CLIP: Record<string, string> = { fire: 'fire', water: 'cast_a_spell', nature: 'cast_a_spell', earth: 'chop', storm: 'jump', shadow: 'cast_a_spell' };

let okSent = false;
let hangSent = false;
let startSent = false;
let glReady = false;

type Props = {
  char: string;
  pose: Pose3;
  poseId?: number;
  special?: string;
  flip?: boolean;
  once?: boolean;
  onDone?: (p: Pose3) => void;
  /** the fighter is really on screen (drawn, and on a phone checked to be visible) */
  onReady?: () => void;
  /** 3D came up empty on this device: show the illustration instead */
  onFail?: () => void;
};

function Model({ char, pose, poseId = 0, special, flip, once, onDone, onReady, onFail }: Props) {
  const { gltf, map } = use(loadModel(char));
  const { scene, mixer, mats, face } = useMemo(() => {
    // a copy per view, so the same fighter can stand on both sides of a battle
    const s = cloneSkinned(gltf.scene);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshStandardMaterial).map = map;
    });
    // feet on the floor, 1.6 units tall, facing the camera, whatever size and turn Tripo exported it at
    const { face, h } = fitFighter(s, gltf.animations, char, 1.6);
    const mats = toonify(s, h * 0.008, false);
    return { scene: s, mixer: new THREE.AnimationMixer(s), mats, face };
  }, [gltf, map, char]);
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
    const loop = LOOP.includes(pose) && !once;
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
  }, [pose, poseId, special, once, gltf, mixer]);

  // a couple of frames after the model is in, check it's really there (on a phone, by reading pixels back)
  const frames = useRef(0);
  const [probe, setProbe] = useState(false);
  const settled = useRef(false);
  const settle = (ok: boolean, why: string) => {
    if (settled.current) return;
    settled.current = true;
    setProbe(false);
    if (!okSent || !ok) {
      okSent = okSent || ok;
      reportCrash(`3d-${ok ? 'ok' : 'blank'}: ${char} ${Platform.OS} ${why}`).catch(() => {});
    }
    if (ok) onReady?.();
    else onFail?.();
  };
  useFrame((_, dt) => {
    frames.current++;
    // the same check everywhere, so the browser build exercises what the phones rely on
    if (frames.current === 3) setProbe(true);
    mixer.update(Math.min(dt, 0.05));
    if (flash.current > 0) {
      flash.current = Math.max(0, flash.current - dt * 4);
      for (const m of mats) m.emissive.setRGB(flash.current, flash.current, flash.current);
    }
  });

  return (
    <>
      {probe && <Probe onResult={settle} />}
      {/* straight at the camera; in a duel just a touch towards the opponent */}; in a duel just a touch towards the opponent
    <group rotation={[0, face + (flip === undefined ? 0 : flip ? -0.18 : 0.18), 0]}>
      <primitive object={scene} />
    </group>
    </>
  );
}

/**
 * Draws one frame itself and reads two lines of pixels back through the middle of the view. A transparent
 * result means the GPU drew nothing (seen on some phones), and the caller falls back to the illustration.
 */
function Probe({ onResult }: { onResult: (ok: boolean, why: string) => void }) {
  const done = useRef(false);
  useFrame(({ gl, scene, camera }) => {
    if (done.current) return;
    done.current = true;
    gl.render(scene, camera);
    const ctx = gl.getContext();
    const w = ctx.drawingBufferWidth;
    const h = ctx.drawingBufferHeight;
    const row = new Uint8Array(w * 4);
    const col = new Uint8Array(h * 4);
    let seen = 0;
    try {
      ctx.readPixels(0, Math.floor(h * 0.45), w, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, row);
      ctx.readPixels(Math.floor(w / 2), 0, 1, h, ctx.RGBA, ctx.UNSIGNED_BYTE, col);
      for (let i = 3; i < row.length; i += 4) if (row[i] > 0) seen++;
      for (let i = 3; i < col.length; i += 4) if (col[i] > 0) seen++;
    } catch (e) {
      // can't read back: trust it rather than hide a working fighter
      onResult(true, `noread ${(e as Error)?.message ?? e}`);
      return;
    }
    onResult(seen > 4, `px=${seen} ${w}x${h}`);
  }, 1);
  return null;
}

/**
 * One live 3D fighter in a transparent square, drawn over whatever is behind it: cel-shaded with an outline,
 * playing the shared fight clips. `poseId` replays a pose (two punches in a row).
 */
export default function Fighter3D(props: Props & { size: number }) {
  // if 3D hasn't shown up after a while, tell us how far it got (once per session)
  useEffect(() => {
    // on a phone, one note that 3D is starting: proves the reports get through at all
    if (!startSent && Platform.OS !== 'web') {
      startSent = true;
      reportCrash(`3d-start ${Platform.OS} ${props.char}`).catch(() => {});
    }
    const id = setTimeout(() => {
      if (okSent || hangSent) return;
      hangSent = true;
      reportCrash(`3d-hang@${loadStep.at} gl=${glReady} ${Platform.OS}`).catch(() => {});
    }, 12000);
    return () => clearTimeout(id);
  }, [props.char]);
  return (
    <View style={{ width: props.size, height: props.size }} pointerEvents="none">
      <Canvas gl={{ antialias: true, alpha: true }} camera={{ position: [0, 1.25, 4.4], fov: 30, near: 0.1, far: 50 }} onCreated={({ camera }) => {
          glReady = true;
          camera.lookAt(0, 0.8, 0);
        }}>
        <hemisphereLight args={['#FFFFFF', '#8899BB', 1.7]} />
        <directionalLight position={[2, 6, 5]} intensity={2.2} />
        <Suspense fallback={null}>
          <Model {...props} />
        </Suspense>
      </Canvas>
    </View>
  );
}
