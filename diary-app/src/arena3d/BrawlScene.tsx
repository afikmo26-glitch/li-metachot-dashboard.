import React, { Suspense, use, useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Actor, ActorAnim, Game, Input } from './brawlGame';
import { step } from './brawlGame';
import { SPECIAL_CLIP } from './Fighter3D';
import { loadModel, loadTexture } from './loadModel';
import { Canvas, useFrame, useThree } from './r3f';
import { toonify, toonRamp } from './toon';

const GROUND = require('../../assets/sim3d/ground_arena.jpg');

// which shared clip plays for each of the arena's poses
const CLIP: Record<ActorAnim, string[]> = {
  idle: ['idle'],
  run: ['swagger'],
  attack: ['box_01', 'box_02'],
  special: ['fire'],
  hit: ['hit_to_body_01', 'hit_to_head'],
  death: ['defeat_02'],
  win: ['victory_celebration'],
};
const SPEED: Partial<Record<ActorAnim, number>> = { run: 1.9, attack: 2.4, hit: 1.6 };
const LOOPS: ActorAnim[] = ['idle', 'run', 'win'];

/** One fighter in the arena: its model, playing whatever pose the game gives it, with a life bar over it. */
function ActorView({ a, element }: { a: Actor; element?: string }) {
  const { gltf, map } = use(loadModel(a.model));
  const { camera } = useThree();
  const { root, mixer, mats } = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshStandardMaterial).map = map;
    });
    const box = new THREE.Box3().setFromObject(s);
    const h = box.max.y - box.min.y || 1;
    const mats = toonify(s, h * 0.009, false);
    const k = (a.boss ? 2.3 : 1.6) / h;
    s.scale.setScalar(k);
    s.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
    const root = new THREE.Group();
    root.add(s);
    return { root, mixer: new THREE.AnimationMixer(s), mats };
  }, [gltf, map, a.boss]);
  const shown = useRef({ anim: '' as ActorAnim | '', id: -1 });
  const current = useRef<THREE.AnimationAction | null>(null);
  const bar = useRef<THREE.Group>(null);
  const fill = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    root.position.set(a.x, 0, a.z);
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
    if (bar.current && fill.current) {
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
      <mesh position={[a.x, 0.02, a.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[a.boss ? 0.95 : 0.6, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <group ref={bar} position={[a.x, a.boss ? 2.9 : 2.1, a.z]}>
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

/** The ground, the walls around it and the cover in the middle. */
function Field({ game }: { game: Game }) {
  const tex = use(loadTexture(GROUND, 6));
  const ramp = toonRamp();
  const size = game.half * 2;
  const wall = new THREE.Color('#8A7F74');
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size + 8, size + 8]} />
        <meshToonMaterial map={tex} gradientMap={ramp} />
      </mesh>
      {[
        [0, -game.half - 0.5, size + 2, 1],
        [0, game.half + 0.5, size + 2, 1],
        [-game.half - 0.5, 0, 1, size],
        [game.half + 0.5, 0, 1, size],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.5, z]}>
          <boxGeometry args={[w, 1, d]} />
          <meshToonMaterial color={wall} gradientMap={ramp} />
        </mesh>
      ))}
      {game.boxes.map((b, i) =>
        b.kind === 'bush' ? (
          <group key={i} position={[b.x, 0, b.z]}>
            {[-1, 0, 1].map((k) => (
              <mesh key={k} position={[0, 0.55, k * (b.d / 3)]}>
                <icosahedronGeometry args={[0.85, 1]} />
                <meshToonMaterial color="#2F9E44" gradientMap={ramp} />
              </mesh>
            ))}
          </group>
        ) : b.kind === 'rock' ? (
          <mesh key={i} position={[b.x, 0.55, b.z]} scale={[b.w / 1.6, 0.8, b.d / 1.6]}>
            <dodecahedronGeometry args={[0.9, 0]} />
            <meshToonMaterial color="#9CA3AF" gradientMap={ramp} />
          </mesh>
        ) : (
          <group key={i} position={[b.x, 0.6, b.z]}>
            <mesh>
              <boxGeometry args={[b.w, 1.2, b.d]} />
              <meshToonMaterial color="#B7793F" gradientMap={ramp} />
            </mesh>
            <mesh position={[0, 0.61, 0]}>
              <boxGeometry args={[b.w * 0.9, 0.04, b.d * 0.9]} />
              <meshToonMaterial color="#8B5A2B" gradientMap={ramp} />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
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

/** Runs the game every frame and follows the player from above. */
function Director({ game, input, onTick }: { game: Game; input: React.RefObject<Input>; onTick: () => void }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(game.player.x, 0, game.player.z));
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    step(game, d, input.current);
    input.current.superFire = false;
    const p = game.player;
    look.current.lerp(new THREE.Vector3(p.x, 0, p.z), Math.min(1, d * 5));
    const sh = game.shake * 0.35;
    camera.position.set(look.current.x + (Math.random() - 0.5) * sh, 13.5, look.current.z + 9.5 + (Math.random() - 0.5) * sh);
    camera.lookAt(look.current.x, 0, look.current.z - 0.5);
    onTick();
  });
  return null;
}

/** The arena in 3D. The screen owns the game and the joystick; this draws and runs it. */
export default function BrawlScene({ game, input, element, onTick }: { game: Game; input: React.RefObject<Input>; element: string; onTick: () => void }) {
  const actors = [game.player, ...game.enemies];
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Canvas gl={{ antialias: true }} camera={{ position: [0, 13.5, 17.5], fov: 45, near: 0.5, far: 120 }}>
        <color attach="background" args={['#5BB0F0']} />
        <hemisphereLight args={['#FFFFFF', '#7A8CB0', 1.6]} />
        <directionalLight position={[-5, 12, 6]} intensity={2.1} />
        <Director game={game} input={input} onTick={onTick} />
        <Suspense fallback={null}>
          <Field game={game} />
        </Suspense>
        {actors.map((a) => (
          <Suspense key={a.id} fallback={null}>
            <ActorView a={a} element={a.team === 0 ? element : undefined} />
          </Suspense>
        ))}
        <Effects game={game} />
      </Canvas>
    </View>
  );
}
