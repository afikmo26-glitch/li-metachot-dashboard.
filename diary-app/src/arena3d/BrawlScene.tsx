import React, { Suspense, use, useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Actor, ActorAnim, Game, Input } from './brawlGame';
import { step } from './brawlGame';
import { SPECIAL_CLIP } from './Fighter3D';
import { loadModel, loadTexture } from './loadModel';
import { Canvas, useFrame, useThree } from './r3f';
import { fitFighter } from './fit';
import { buildArena } from './arenaField';
import { toonify } from './toon';
import { buildSuperFx } from './superFx';

const GROUND = require('../../assets/sim3d/ground_arena.jpg');

// which shared clip plays for each of the arena's poses
const CLIP: Record<ActorAnim, string[]> = {
  idle: ['idle'],
  run: ['run'],
  attack: ['box_01', 'front_kick_01'],
  special: ['fire'],
  hit: ['hit_to_body_01'],
  death: ['defeat_02'],
  win: ['victory_celebration'],
  jump: ['jump'],
};
const SPEED: Partial<Record<ActorAnim, number>> = { run: 1.15, attack: 2.4, hit: 1.6 };
const LOOPS: ActorAnim[] = ['idle', 'run', 'win'];

/** One fighter in the arena: its model, playing whatever pose the game gives it, with a life bar over it. */
function ActorView({ a, element, onReady }: { a: Actor; element?: string; onReady?: () => void }) {
  const { gltf, map } = use(loadModel(a.model));
  const { camera } = useThree();
  const { root, mixer, mats } = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshStandardMaterial).map = map;
    });
    const { face, h } = fitFighter(s, gltf.animations, a.model, a.boss ? 2.6 : 1.9);
    const mats = toonify(s, h * 0.009, false);
    // the inner turn squares the model to +z, so the game's facing angle means the same for every fighter
    const turn = new THREE.Group();
    turn.rotation.y = face;
    turn.add(s);
    const root = new THREE.Group();
    root.add(turn);
    return { root, mixer: new THREE.AnimationMixer(s), mats };
  }, [gltf, map, a.boss, a.model]);
  const shown = useRef({ anim: '' as ActorAnim | '', id: -1 });
  const current = useRef<THREE.AnimationAction | null>(null);
  const bar = useRef<THREE.Group>(null);
  const fill = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);

  const frames = useRef(0);
  useFrame((_, dt) => {
    if (++frames.current === 3) onReady?.();
    root.position.set(a.x, a.y, a.z);
    root.rotation.y += (((a.rot - root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 14);
    if (shown.current.anim !== a.anim || shown.current.id !== a.animId) {
      shown.current = { anim: a.anim, id: a.animId };
      const names = a.anim === 'special' && element ? [SPECIAL_CLIP[element] ?? 'cast_a_spell'] : CLIP[a.anim];
      const clip = gltf.animations.find((c) => c.name === names[a.animId % names.length]) ?? gltf.animations.find((c) => c.name === 'idle');
      if (clip) {
        const next = mixer.clipAction(clip);
        const loop = LOOPS.includes(a.anim);
        next.reset();
        next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        next.clampWhenFinished = !loop;
        next.timeScale = SPEED[a.anim] ?? 1;
        if (current.current && current.current !== next) current.current.crossFadeTo(next, a.anim === 'attack' || a.anim === 'hit' ? 0.06 : 0.18, false);
        next.play();
        current.current = next;
      }
    }
    mixer.update(Math.min(dt, 0.05));
    for (const m of mats) m.emissive.setRGB(a.flash, a.flash * 0.9, a.flash * 0.9);
    if (shadow.current) {
      shadow.current.position.set(a.x, 0.02, a.z);
      // the shadow shrinks while flying off a jump pad
      shadow.current.scale.setScalar(1 / (1 + a.y * 0.25));
    }
    if (bar.current && fill.current) {
      bar.current.position.set(a.x, (a.boss ? 3.2 : 2.4) + a.y, a.z);
      bar.current.visible = a.alive;
      bar.current.quaternion.copy(camera.quaternion);
      const r = Math.max(0.001, a.hp / a.maxHp);
      fill.current.scale.x = r;
      fill.current.position.x = -(1 - r) * 0.6;
    }
  });

  return (
    <group>
      <primitive object={root} />
      {/* soft round shadow */}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[a.boss ? 0.95 : 0.6, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <group ref={bar}>
        <mesh>
          <planeGeometry args={[1.32, 0.2]} />
          <meshBasicMaterial color="#120A24" />
        </mesh>
        <mesh ref={fill} position={[0, 0, 0.01]}>
          <planeGeometry args={[1.2, 0.12]} />
          <meshBasicMaterial color={a.team === 0 ? '#22D3EE' : '#F43F5E'} />
        </mesh>
      </group>
    </group>
  );
}

/** The crystal mine (see arenaField.ts): the gem turning over its mound, the jump pads pulsing. */
function Field({ game }: { game: Game }) {
  const tex = use(loadTexture(GROUND, 1));
  const field = useMemo(() => buildArena(game, tex), [game, tex]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    field.gem.position.y = 2.2 + Math.sin(t * 1.6) * 0.12;
    field.gem.rotation.y = t * 0.9;
    field.glow.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08);
    field.pads.forEach((pad, i) => {
      const ring = pad.getObjectByName('pulse');
      if (!ring) return;
      const k = (t * 0.9 + i * 0.25) % 1;
      ring.scale.setScalar(1 + k * 0.5);
      ((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
    });
  });
  return <primitive object={field.group} />;
}

const SPARK_DIRS = Array.from({ length: 7 }, (_, i) => [Math.cos((i / 7) * Math.PI * 2), Math.sin((i / 7) * Math.PI * 2)] as const);

/** Shots, sparks, shock rings and the super's nova, drawn from fixed pools so nothing is created mid-fight. */
function Effects({ game }: { game: Game }) {
  const shots = useRef<(THREE.Group | null)[]>([]);
  const fx = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    shots.current.forEach((g, i) => {
      const s = game.shots[i];
      if (!g) return;
      g.visible = !!s;
      if (!s) return;
      g.position.set(s.x, 0.9, s.z);
      g.rotation.y = Math.atan2(s.vx, s.vz);
      g.scale.setScalar(s.big ? 1.6 : 1);
      ((g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(s.color);
      ((g.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(s.color);
    });
    fx.current.forEach((g, i) => {
      const f = game.fx[i];
      if (!g) return;
      g.visible = !!f;
      if (!f) return;
      const k = f.t / f.life;
      g.position.set(f.x, 0.05, f.z);
      const [ring, disc, ...sparks] = g.children as THREE.Mesh[];
      ring.visible = f.kind !== 'spark';
      disc.visible = f.kind === 'nova';
      ring.scale.setScalar(0.2 + k * f.size);
      (ring.material as THREE.MeshBasicMaterial).color.set(f.color);
      (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      disc.scale.setScalar(0.2 + k * f.size);
      (disc.material as THREE.MeshBasicMaterial).color.set(f.color);
      (disc.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k);
      sparks.forEach((m, j) => {
        m.visible = f.kind === 'spark';
        const [dx, dz] = SPARK_DIRS[j];
        m.position.set(dx * k * 1.1 * f.size, 0.9 + k * 0.6 - k * k * 1.2, dz * k * 1.1 * f.size);
        m.scale.setScalar(Math.max(0.01, 1 - k));
        (m.material as THREE.MeshBasicMaterial).color.set(j % 2 ? '#FFFFFF' : f.color);
      });
    });
  });
  return (
    <group>
      {Array.from({ length: 30 }, (_, i) => (
        <group key={i} ref={(g) => { shots.current[i] = g; }} visible={false}>
          <mesh>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshBasicMaterial />
          </mesh>
          {/* glow and a short trail */}
          <mesh position={[0, 0, -0.35]} scale={[0.7, 0.7, 2.2]}>
            <sphereGeometry args={[0.24, 10, 8]} />
            <meshBasicMaterial transparent opacity={0.35} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 40 }, (_, i) => (
        <group key={i} ref={(g) => { fx.current[i] = g; }} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.8, 1, 32]} />
            <meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1, 32]} />
            <meshBasicMaterial transparent depthWrite={false} />
          </mesh>
          {SPARK_DIRS.map((_, j) => (
            <mesh key={j}>
              <tetrahedronGeometry args={[0.12]} />
              <meshBasicMaterial />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Supers in each element's look, the rune circle and the rock bursts (superFx.ts). */
function BigEffects({ game }: { game: Game }) {
  const fx = useMemo(() => buildSuperFx(), []);
  useFrame(() => fx.update(game));
  return <primitive object={fx.group} />;
}

/** Runs the game every frame and follows the player from above. */
function Director({ game, input, onTick, paused }: { game: Game; input: React.RefObject<Input>; onTick: () => void; paused?: boolean }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(game.player.x, 0, game.player.z));
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    // the fight waits until the fighters are actually on screen
    if (!paused) step(game, d, input.current);
    input.current.superFire = false;
    const p = game.player;
    // follow the player, but keep the court framed: the far wall and jungle fill the top, never the sky
    const tx = THREE.MathUtils.clamp(p.x, -3.2, 3.2);
    const tz = THREE.MathUtils.clamp(p.z, -8.5, 7);
    look.current.lerp(new THREE.Vector3(tx, 0, tz), Math.min(1, d * 5));
    const sh = game.shake * 0.35;
    camera.position.set(look.current.x + (Math.random() - 0.5) * sh, 17, look.current.z + 11.5 + (Math.random() - 0.5) * sh);
    camera.lookAt(look.current.x, 0, look.current.z - 0.5);
    onTick();
  });
  return null;
}

/** The arena in 3D. The screen owns the game and the joystick; this draws and runs it. */
export default function BrawlScene({ game, input, element, onTick, onReady, paused }: { game: Game; input: React.RefObject<Input>; element: string; onTick: () => void; onReady?: () => void; paused?: boolean }) {
  const actors = [game.player, ...game.enemies];
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Canvas gl={{ antialias: true }} camera={{ position: [0, 17, 18.5], fov: 58, near: 0.5, far: 120 }}>
        <color attach="background" args={['#E2A06C']} />
        <fog attach="fog" args={['#E2A06C', 28, 50]} />
        <hemisphereLight args={['#FFF6E0', '#8A5A48', 1.6]} />
        <directionalLight position={[-6, 12, 5]} intensity={2.2} color="#FFF1D6" />
        <Director game={game} input={input} onTick={onTick} paused={paused} />
        <Suspense fallback={null}>
          <Field game={game} />
        </Suspense>
        {actors.map((a) => (
          <Suspense key={a.id} fallback={null}>
            <ActorView a={a} element={a.team === 0 ? element : undefined} onReady={a.team === 0 ? onReady : undefined} />
          </Suspense>
        ))}
        <Effects game={game} />
        <BigEffects game={game} />
      </Canvas>
    </View>
  );
}
