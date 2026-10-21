import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Image, Text, View } from 'react-native';
import { colors } from '../lib/theme';

/** Moments that make the first minutes feel special: the animated logo, drifting emojis, confetti. All skip motion when the OS asks. */

const LOGO = require('../../assets/brand/icon-512.png');

function useReduceMotion() {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(setReduce);
  }, []);
  return reduce;
}

/** The app icon springing in, with a soft ring pulsing behind it. */
export function LogoBurst({ size = 132 }: { size?: number }) {
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce === null) return;
    if (reduce) {
      pop.setValue(1);
      return;
    }
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, pop, ring]);

  return (
    <View style={{ width: size * 1.6, height: size * 1.6, alignItems: 'center', justifyContent: 'center' }}>
      {!reduce && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size * 0.3,
            borderWidth: 3,
            borderColor: colors.primaryHi,
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
          }}
        />
      )}
      <Animated.View
        style={{
          transform: [{ scale: pop }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '0deg'] }) }],
          borderRadius: size * 0.24,
          shadowColor: colors.primary,
          shadowOpacity: 0.6,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }}
      >
        <Image source={LOGO} style={{ width: size, height: size, borderRadius: size * 0.24 }} accessibilityIgnoresInvertColors />
      </Animated.View>
    </View>
  );
}

const DRIFT = ['📔', '💜', '🎙️', '🫶', '🎂', '✨', '👨‍👩‍👧', '🧠', '🌙', '💬', '🎮', '⭐'];

/** Emojis drifting slowly up behind the content. */
export function FloatingEmojis({ count = 14 }: { count?: number }) {
  const reduce = useReduceMotion();
  const { width, height } = Dimensions.get('window');
  const items = useRef(
    Array.from({ length: count }, (_, i) => ({
      emoji: DRIFT[i % DRIFT.length],
      x: Math.random() * (width - 40),
      size: 18 + Math.random() * 18,
      duration: 9000 + Math.random() * 7000,
      delay: Math.random() * 6000,
      v: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    if (reduce !== false) return;
    const loops = items.map((it) =>
      Animated.loop(Animated.sequence([Animated.delay(it.delay), Animated.timing(it.v, { toValue: 1, duration: it.duration, easing: Easing.linear, useNativeDriver: true })])),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce, items]);

  if (reduce !== false) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            left: it.x,
            top: 0,
            fontSize: it.size,
            opacity: it.v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.55, 0.4, 0] }),
            transform: [
              { translateY: it.v.interpolate({ inputRange: [0, 1], outputRange: [height, -60] }) },
              { rotate: it.v.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '20deg'] }) },
            ],
          }}
        >
          {it.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

const CONFETTI_COLORS = ['#F472B6', '#A78BFA', '#FACC15', '#34D399', '#60A5FA', '#FB923C'];

/** One burst of confetti falling over the screen. Re-runs when `fire` changes. */
export function Confetti({ fire = 0, pieces = 60 }: { fire?: number; pieces?: number }) {
  const reduce = useReduceMotion();
  const { width, height } = Dimensions.get('window');
  const bits = useRef(
    Array.from({ length: pieces }, (_, i) => ({
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 160,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
      delay: Math.random() * 400,
      duration: 2200 + Math.random() * 1400,
      v: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    if (reduce !== false) return;
    bits.forEach((b) => b.v.setValue(0));
    Animated.parallel(
      bits.map((b) => Animated.timing(b.v, { toValue: 1, duration: b.duration, delay: b.delay, easing: Easing.in(Easing.quad), useNativeDriver: true })),
    ).start();
  }, [reduce, bits, fire]);

  if (reduce !== false) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {bits.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: b.x,
            top: -20,
            width: b.w,
            height: b.h,
            borderRadius: 2,
            backgroundColor: b.color,
            opacity: b.v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: b.v.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
              { translateX: b.v.interpolate({ inputRange: [0, 1], outputRange: [0, b.drift] }) },
              { rotate: b.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${b.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** A gentle, endless "breathing" scale for the main call to action. */
export function Pulse({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce !== false) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }}>{children}</Animated.View>;
}

/** A big emoji that pops in each time its `id` changes. */
export function PopEmoji({ emoji, id, size = 70 }: { emoji: string; id: string | number; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.spring(v, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
  }, [id, v]);
  return (
    <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}
