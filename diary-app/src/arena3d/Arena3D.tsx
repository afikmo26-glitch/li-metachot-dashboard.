import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARENA, HeroId } from './assets';
import Hero3D, { Pose } from './Hero3D';
import { Canvas, useFrame, useLoader, useThree } from './r3f';
import { placeCamera, POS } from './camera';
import { toonify, toonRamp } from './toon';

export type Fx3D = { id: number; at: 0 | 1; color: string; big?: boolean };
export type Side3D = { hero: HeroId; pose: Pose; poseId: number; flashId: number; scale?: number };

function Ground() {
  const tiles = useLoader(GLTFLoader, [ARENA.tileForest, ARENA.tileBlue, ARENA.tileRed] as unknown as string[]);
  const props = useLoader(GLTFLoader, [ARENA.tree, ARENA.rocksA, ARENA.rocksB, ARENA.plantA, ARENA.plantB, ARENA.barrier, ARENA.flagBlue, ARENA.flagRed, ARENA.gateBlue, ARENA.gateRed, ARENA.detail] as unknown as string[]);
  const scene = useMemo(() => {
    const g = new THREE.Group();
    const put = (src: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1, outline = 0.025) => {
      const o = src.clone(true);
      toonify(o, outline);
      o.position.set(x, y, z);
      o.rotation.y = ry;
      o.scale.setScalar(s);
      g.add(o);
    };
    const [forest, blue, red] = tiles.map((t) => t.scene);
    const [tree, rocksA, rocksB, plantA, plantB, barrier, flagB, flagR, gateB, gateR, detail] = props.map((p) => p.scene);
    // 3 x 5 field of 6 x 6 tiles: blue base near you, red base across, forest between (tile tops at y = 0)
    for (let ix = -1; ix <= 1; ix++)
      for (let iz = -2; iz <= 2; iz++) put(iz === 2 ? blue : iz === -2 ? red : forest, ix * 6, -1, iz * 6, 0, 1, 0);
    // a ring of trees around the field
    const rnd = (() => {
      let s = 11;
      return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    })();
    for (let z = -15; z <= 15; z += 2.2)
      for (const side of [-1, 1]) {
        put(tree, side * (9.6 + rnd() * 1.4), 0, z + rnd(), rnd() * 6, 0.9 + rnd() * 0.5);
        if (rnd() < 0.5) put(rnd() < 0.5 ? plantA : plantB, side * (8.2 + rnd()), 0, z + 1, rnd() * 6, 1.4);
      }
    for (let x = -9; x <= 9; x += 2.4) put(tree, x + rnd(), 0, -16.5 - rnd() * 1.5, rnd() * 6, 1 + rnd() * 0.5);
    // team flags, gates and some cover
    put(flagB, -4.2, 0, 9.5, 0, 1.2);
    put(flagB, 4.2, 0, 9.5, 0, 1.2);
    put(flagR, -4.2, 0, -9.5, Math.PI, 1.2);
    put(flagR, 4.2, 0, -9.5, Math.PI, 1.2);
    put(gateB, 0, 0, 12.2, 0, 1.2);
    put(gateR, 0, 0, -12.2, Math.PI, 1.2);
    put(barrier, -6, 0, 0, Math.PI / 2, 1);
    put(barrier, 6, 0, 0, Math.PI / 2, 1);
    put(rocksA, -5, 0, -5.5, 0.4, 1.3);
    put(rocksB, 5.2, 0, 5, 1.2, 1.3);
    put(rocksB, -5.4, 0, 6, 2, 1.1);
    put(rocksA, 5.4, 0, -6.4, 2.6, 1.1);
    for (let i = 0; i < 14; i++) put(rnd() < 0.5 ? plantA : detail, (rnd() - 0.5) * 14, 0, (rnd() - 0.5) * 22, rnd() * 6, 1, 0.012);
    return g;
  }, [tiles, props]);
  return <primitive object={scene} />;
}

/** A burst of chunky sparks where a hit lands, in the move's colour. */
function Burst({ fx, onDone }: { fx: Fx3D; onDone: (id: number) => void }) {
  const N = fx.big ? 18 : 10;
  const group = useRef<THREE.Group>(null);
  const t = useRef(0);
  const parts = useMemo(
    () =>
      Array.from({ length: N }, () => {
        const a = Math.random() * Math.PI * 2;
        const up = 0.6 + Math.random() * 1.4;
        return new THREE.Vector3(Math.cos(a) * (1.2 + Math.random()), up * 2, Math.sin(a) * (1.2 + Math.random()));
      }),
    [N],
  );
  const mat = useMemo(() => new THREE.MeshToonMaterial({ color: fx.color, emissive: new THREE.Color(fx.color), emissiveIntensity: 0.6, gradientMap: toonRamp(), transparent: true }), [fx.color]);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(fx.big ? 0.16 : 0.12, 0), [fx.big]);
  const origin = POS[fx.at];
  useFrame((_, dt) => {
    t.current += dt;
    const k = t.current / 0.6;
    const g = group.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      const v = parts[i];
      if (!v) return; // the ground ring
      c.position.set(v.x * k, 1.3 + v.y * k - 4 * k * k, v.z * k);
      c.scale.setScalar(Math.max(0.01, 1 - k));
    });
    mat.opacity = Math.max(0, 1 - k);
    if (k >= 1) onDone(fx.id);
  });
  return (
    <group ref={group} position={origin}>
      {parts.map((_, i) => (
        <mesh key={i} geometry={geo} material={mat} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.6, 1.0, 24]} />
        <meshBasicMaterial color={fx.color} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/** Camera with a little shake on big hits. */
function CameraRig({ shake }: { shake: number }) {
  const { camera, size } = useThree();
  const kick = useRef(0);
  useEffect(() => {
    if (shake) kick.current = 1;
  }, [shake]);
  useEffect(() => {
    placeCamera(camera as THREE.PerspectiveCamera, size.width, size.height);
  }, [camera, size.width, size.height]);
  useFrame((_, dt) => {
    if (kick.current <= 0) return;
    kick.current = Math.max(0, kick.current - dt * 4);
    const a = kick.current * 0.18;
    camera.position.x = (Math.random() - 0.5) * a;
    if (kick.current === 0) camera.position.x = 0;
  });
  return null;
}

/**
 * The 3D duel: KayKit heroes on a bright toon arena, rendered live (expo-gl on phones, WebGL on the web).
 * The battle logic stays in battle.ts; this only draws it.
 */
export type Arena3DProps = { sides: [Side3D, Side3D]; fx: Fx3D[]; shake: number; onFxDone: (id: number) => void; onPoseDone: (side: 0 | 1, p: Pose) => void; onError?: () => void };

/**
 * The 3D duel: KayKit heroes on a bright toon arena, rendered live (expo-gl on phones, WebGL on the web).
 * The battle logic stays in battle.ts; this only draws it. Load it through Safe3D.
 */
export default function Scene({ sides, fx, shake, onFxDone, onPoseDone }: Arena3DProps) {
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#6EC6F5' }} pointerEvents="none">
      <Canvas shadows camera={{ position: [0, 13, 15], fov: 42, near: 0.5, far: 120 }} gl={{ antialias: true }}>
        <color attach="background" args={['#6EC6F5']} />
        <fog attach="fog" args={['#6EC6F5', 26, 48]} />
        <hemisphereLight args={['#FFFFFF', '#88A4C8', 1.5]} />
        <directionalLight position={[-6, 14, 8]} intensity={2.4} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={14} shadow-camera-bottom={-14} />
        <CameraRig shake={shake} />
        <Suspense fallback={null}>
          <Ground />
          {sides.map((s, i) => (
            <Hero3D
              key={i}
              hero={s.hero}
              pose={s.pose}
              poseId={s.poseId}
              flashId={s.flashId}
              position={POS[i]}
              facing={i === 0 ? Math.PI : 0}
              lungeTo={POS[i === 0 ? 1 : 0]}
              scale={(s.scale ?? 1) * 1.05}
              onPoseDone={(p) => onPoseDone(i as 0 | 1, p)}
            />
          ))}
          {fx.map((f) => (
            <Burst key={f.id} fx={f} onDone={onFxDone} />
          ))}
        </Suspense>
      </Canvas>
    </View>
  );
}
