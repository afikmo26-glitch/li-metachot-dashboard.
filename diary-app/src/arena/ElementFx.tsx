import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';

/**
 * The duel's element effects, after the owner's effects clip (the same looks as the arena's supers, in 2D): a
 * stream of fire into a fireball, ice shards bursting up under the target, green rings and leaves, rocks
 * flying, extra lightning, a purple vortex. Each is a handful of particles, each on its own timer.
 */

type Pt = { x: number; y: number };

// everything a little larger than drawn, so it reads on a phone held at arm's length
const BIG = 1.35;

/**
 * One particle. 'line' flies from (x0, y0) to (x1, y1), lifted by `arc` at the middle; 'orbit' circles (cx, cy)
 * from radius r0 to r1, turning `spin` radians from angle a0, squashed by `flat` so it reads as lying on the floor.
 */
type P = {
  mode: 'line' | 'orbit';
  x0?: number; y0?: number; x1?: number; y1?: number; arc?: number;
  cx?: number; cy?: number; r0?: number; r1?: number; a0?: number; spin?: number; flat?: number;
  delay: number; dur: number; s0: number; s1: number; rot?: number;
  node: React.ReactNode;
};

function Particle({ p, onDone }: { p: P; onDone?: () => void }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: p.dur, easing: Easing.out(Easing.quad) }, (done) => done && onDone && runOnJS(onDone)()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // only plain numbers go to the UI thread, never the particle's React node
  const g = {
    orbit: p.mode === 'orbit',
    x0: p.x0 ?? 0, y0: p.y0 ?? 0, x1: p.x1 ?? 0, y1: p.y1 ?? 0, arc: p.arc ?? 0,
    cx: p.cx ?? 0, cy: p.cy ?? 0, r0: p.r0 ?? 0, r1: p.r1 ?? 0, a0: p.a0 ?? 0, spin: p.spin ?? 0, flat: p.flat ?? 1,
    s0: p.s0, s1: p.s1, rot: p.rot ?? 0,
  };
  const st = useAnimatedStyle(() => {
    const k = t.value;
    let x: number;
    let y: number;
    if (g.orbit) {
      const a = g.a0 + g.spin * k;
      const r = g.r0 + (g.r1 - g.r0) * k;
      x = g.cx + Math.cos(a) * r;
      y = g.cy + Math.sin(a) * r * g.flat;
    } else {
      x = g.x0 + (g.x1 - g.x0) * k;
      y = g.y0 + (g.y1 - g.y0) * k - g.arc * Math.sin(Math.PI * k);
    }
    return {
      opacity: k <= 0 ? 0 : k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88,
      transform: [{ translateX: x }, { translateY: y }, { scale: (g.s0 + (g.s1 - g.s0) * k) * BIG }, { rotate: `${g.rot * k}deg` }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, st]}>{p.node}</Animated.View>;
}

const dot = (size: number, color: string, glow?: string) => (
  <View style={{ marginLeft: -size / 2, marginTop: -size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color, shadowColor: glow ?? color, shadowOpacity: 0.9, shadowRadius: size / 3 }} />
);
const shard = (w: number, h: number, color: string) => (
  <Svg width={w} height={h} style={{ marginLeft: -w / 2, marginTop: -h }}>
    <Polygon points={`${w / 2},0 ${w},${h} 0,${h}`} fill={color} stroke="#E0F2FE" strokeWidth={1.5} />
  </Svg>
);
const rock = (s: number, color: string) => (
  <Svg width={s} height={s} style={{ marginLeft: -s / 2, marginTop: -s / 2 }}>
    <Polygon points={`${s * 0.2},${s * 0.1} ${s * 0.8},0 ${s},${s * 0.55} ${s * 0.65},${s} ${s * 0.1},${s * 0.85} 0,${s * 0.4}`} fill={color} stroke="#3B2416" strokeWidth={1.5} />
  </Svg>
);
const ring = (size: number, color: string) => (
  <View style={{ marginLeft: -size / 2, marginTop: -size / 2, width: size, height: size, borderRadius: size / 2, borderWidth: 5, borderColor: color }} />
);
const bolt = (h: number) => (
  <Svg width={70} height={h} style={{ marginLeft: -35, marginTop: -h }}>
    <Path d={`M40 0 L14 ${h * 0.45} L34 ${h * 0.45} L20 ${h} L60 ${h * 0.35} L40 ${h * 0.35} L56 0 Z`} fill="#FEF9C3" stroke="#FACC15" strokeWidth={3} />
  </Svg>
);

// repeatable pseudo-random numbers, so a move looks the same each time
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function particles(element: string, from: Pt, to: Pt, self: boolean): P[] {
  const out: P[] = [];
  const at = self ? from : to;
  const cy = at.y - 50; // the body's middle, above the feet
  if (element === 'fire') {
    const fireCols = ['#FEF08A', '#FDE047', '#FB923C', '#F97316', '#EF4444', '#B91C1C'];
    if (!self) {
      for (let i = 0; i < 24; i++) {
        const j = (rnd(i) - 0.5) * 50;
        out.push({ mode: 'line', x0: from.x + 20, y0: from.y - 60, x1: to.x + j, y1: to.y - 55 + j * 0.6, arc: 20 + rnd(i + 3) * 30, delay: i * 18, dur: 520, s0: 0.6, s1: 1.9, node: dot(38, fireCols[Math.floor((i / 24) * fireCols.length)], '#F97316') });
      }
      // the fireball that lands
      out.push({ mode: 'orbit', cx: to.x, cy: to.y - 55, r0: 0, r1: 0, delay: 360, dur: 560, s0: 0.6, s1: 2.6, node: dot(70, '#F97316', '#FDE047') });
      out.push({ mode: 'orbit', cx: to.x, cy: to.y - 55, r0: 0, r1: 0, delay: 380, dur: 480, s0: 0.4, s1: 1.8, node: dot(50, '#FEF08A', '#FFFFFF') });
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      out.push({ mode: 'line', x0: at.x, y0: cy, x1: at.x + Math.cos(a) * 110, y1: cy + Math.sin(a) * 75 - 20, arc: 30, delay: self ? 0 : 420, dur: 600, s0: 1.4, s1: 0.3, node: dot(32, fireCols[i % fireCols.length], '#EF4444') });
    }
  } else if (element === 'water') {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 40 + (i % 2) * 30;
      out.push({ mode: 'line', x0: at.x + Math.cos(a) * r * 0.6, y0: at.y + 10, x1: at.x + Math.cos(a) * r * 1.5, y1: at.y + Math.sin(a) * r * 0.35 - 10, arc: 50 + rnd(i) * 30, delay: (self ? 0 : 280) + (i % 3) * 40, dur: 620, s0: 0.4, s1: 1.2, node: shard(16, 44, i % 3 ? '#38BDF8' : '#BAE6FD') });
    }
    for (let i = 0; i < 8; i++) out.push({ mode: 'orbit', cx: at.x, cy: at.y, r0: 10, r1: 110, a0: i * 0.8, spin: 0.6, flat: 0.35, delay: self ? 0 : 280, dur: 500, s0: 1, s1: 0.4, node: dot(12, '#E0F2FE', '#7DD3FC') });
  } else if (element === 'nature') {
    for (let i = 0; i < 3; i++) out.push({ mode: 'orbit', cx: at.x, cy: cy - i * 25, r0: 0, r1: 0, delay: (self ? 0 : 250) + i * 90, dur: 800, s0: 0.6, s1: 1.8 + i * 0.4, rot: 360, node: <View style={{ transform: [{ scaleY: 0.35 }] }}>{ring(100, i === 1 ? '#84CC16' : '#16A34A')}</View> });
    for (let i = 0; i < 14; i++) out.push({ mode: 'orbit', cx: at.x, cy: cy - rnd(i) * 40, r0: 20, r1: 120, a0: i * 0.45, spin: 4, flat: 0.5, delay: (self ? 0 : 250) + i * 20, dur: 900, s0: 1, s1: 0.6, rot: 540, node: <View style={{ marginLeft: -8, marginTop: -5, width: 16, height: 10, borderRadius: 8, backgroundColor: i % 2 ? '#4ADE80' : '#15803D' }} /> });
  } else if (element === 'earth') {
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + (i / 13) * Math.PI; // up and outward
      const d = 70 + rnd(i) * 70;
      out.push({ mode: 'line', x0: at.x, y0: at.y - 10, x1: at.x + Math.cos(a) * d * 1.3, y1: at.y + 20 + rnd(i + 2) * 20, arc: 70 + rnd(i + 5) * 60, delay: self ? 0 : 280, dur: 700, s0: 0.8, s1: 1.2, rot: 300, node: rock(22 + rnd(i + 7) * 16, i % 3 ? '#7C4A2D' : '#A8754F') });
    }
    out.push({ mode: 'orbit', cx: at.x, cy: at.y + 5, r0: 0, r1: 0, delay: self ? 0 : 280, dur: 600, s0: 0.4, s1: 2.4, node: <View style={{ transform: [{ scaleY: 0.3 }] }}>{ring(100, '#D6A77A')}</View> });
  } else if (element === 'storm') {
    for (let i = 0; i < 2; i++) out.push({ mode: 'line', x0: at.x + (i ? 55 : -50), y0: at.y, x1: at.x + (i ? 55 : -50), y1: at.y, delay: (self ? 0 : 200) + i * 120, dur: 380, s0: 1, s1: 1, node: bolt(at.y * 0.9) });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      out.push({ mode: 'line', x0: at.x, y0: cy, x1: at.x + Math.cos(a) * 80, y1: cy + Math.sin(a) * 80, delay: self ? 0 : 300, dur: 360, s0: 1, s1: 0.2, node: dot(10, '#FEF08A', '#FACC15') });
    }
  } else if (element === 'shadow') {
    for (let i = 0; i < 24; i++) {
      const arm = i % 3;
      out.push({ mode: 'orbit', cx: at.x, cy: cy, r0: 130 - (i / 24) * 40, r1: 10, a0: arm * 2.09 + i * 0.12, spin: 5, flat: 0.55, delay: (self ? 0 : 200) + i * 12, dur: 750, s0: 1.3, s1: 0.4, node: dot(14, i % 4 ? '#A855F7' : '#E9D5FF', '#7C3AED') });
    }
    out.push({ mode: 'orbit', cx: at.x, cy: at.y, r0: 0, r1: 0, delay: self ? 0 : 200, dur: 800, s0: 2.2, s1: 0.6, rot: -360, node: <View style={{ transform: [{ scaleY: 0.35 }] }}>{ring(100, '#7C3AED')}</View> });
  }
  return out;
}

/** Plays one move's element effect over the duel, from the caster to its target, then calls onDone. */
export default function ElementFx({ element, from, to, self, onDone }: { element: string; from: Pt; to: Pt; self: boolean; onDone: () => void }) {
  const list = useMemo(() => particles(element, from, to, self), [element, from, to, self]);
  // the last to finish says when the whole effect is over
  const last = list.reduce((best, p, i) => (p.delay + p.dur > list[best].delay + list[best].dur ? i : best), 0);
  if (!list.length) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {list.map((p, i) => (
        <Particle key={i} p={p} onDone={i === last ? onDone : undefined} />
      ))}
    </View>
  );
}
