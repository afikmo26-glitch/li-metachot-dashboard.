import MaskedViewLib from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { LayoutChangeEvent, Platform, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { fontFor, gradients } from '../lib/theme';

// The package's class typings predate React 19's JSX types
const MaskedView = MaskedViewLib as unknown as React.ComponentType<{ maskElement: React.ReactElement; onLayout?: (e: LayoutChangeEvent) => void; children: React.ReactNode }>;

/** One soft light blob: a radial gradient that fades to nothing, so it reads as blurred light. */
function Blob({ color, size, opacity, style, dx, dy, ms }: { color: string; size: number; opacity: number; style: ViewStyle; dx: number; dy: number; ms: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, ms, t]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * dx }, { translateY: t.value * dy }, { scale: 1 + t.value * 0.15 }] }));
  const id = `b${color.slice(1)}`;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style, anim]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** Drifting violet / cyan / pink lights behind a screen. Sits absolutely; put it first. */
export function Aurora({ dim }: { dim?: boolean }) {
  const k = dim ? 0.55 : 1;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Blob color="#7C3AED" size={520} opacity={0.55 * k} style={{ top: -220, right: -220 }} dx={-60} dy={50} ms={9000} />
      <Blob color="#06B6D4" size={460} opacity={0.32 * k} style={{ bottom: -60, left: -230 }} dx={70} dy={-40} ms={11000} />
      <Blob color="#EC4899" size={360} opacity={0.3 * k} style={{ bottom: -160, right: -120 }} dx={-40} dy={-30} ms={13000} />
    </View>
  );
}

/** A spinning neon ring with two pulses going out, around `children` (the pet, an avatar). */
export function GlowRing({ size, children, style }: { size: number; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1);
  }, [reduced, spin, pulse]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const p1 = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - pulse.value), transform: [{ scale: 0.92 + pulse.value * 0.6 }] }));
  const p2 = useAnimatedStyle(() => {
    const v = (pulse.value + 0.5) % 1;
    return { opacity: 0.8 * (1 - v), transform: [{ scale: 0.92 + v * 0.6 }] };
  });
  const ring = size + 12;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: 'rgba(165,243,252,0.6)' }, p1]} />
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: 'rgba(240,171,252,0.5)' }, p2]} />
      <Animated.View style={[{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, overflow: 'hidden' }, spinStyle]}>
        <LinearGradient colors={['transparent', 'transparent', gradients.neon[0], gradients.neon[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </Animated.View>
      <View
        style={{
          width: size - 4,
          height: size - 4,
          borderRadius: size / 2,
          backgroundColor: '#140E36',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: '#7C3AED',
          shadowOpacity: 0.8,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** Rises in from blurred-small to full size after `delay` ms (titles, words of the logo). */
export function RiseIn({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) v.value = withDelay(delay, withTiming(1, { duration: 750, easing: Easing.bezier(0.2, 0.9, 0.2, 1.2) }));
  }, [reduced, delay, v]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, v.value * 1.6), transform: [{ translateY: (1 - v.value) * 28 }, { scale: 0.6 + v.value * 0.4 }] }));
  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

/** A light bar that sweeps across its parent every few seconds; the parent needs overflow hidden. */
export function Sheen({ width, delay = 1400 }: { width: number; delay?: number }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    x.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 2200 }), withTiming(0, { duration: 0 })), -1));
  }, [reduced, delay, x]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: -80 + x.value * (width + 160) }, { skewX: '-20deg' }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 60 }, anim]}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

/**
 * Text filled with the neon gradient, with a light sweeping across the letters.
 * Web has no masked view, so there it is plain text in the middle colour with a glow.
 */
export function NeonText({ children, size, weight = 900, sheen = true, style }: { children: string; size: number; weight?: number; sheen?: boolean; style?: StyleProp<TextStyle> }) {
  const [w, setW] = React.useState(0);
  const text: TextStyle = { fontSize: size, fontFamily: fontFor(weight), textAlign: 'center', lineHeight: size * 1.2 };
  if (Platform.OS === 'web')
    return <Text style={[text, { color: '#E9D5FF', textShadowColor: '#A78BFA', textShadowRadius: 18 }, style]}>{children}</Text>;
  return (
    <MaskedView maskElement={<Text style={[text, style]}>{children}</Text>} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View>
        <LinearGradient colors={['#FFFFFF', gradients.neon[0], gradients.neon[2], '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.3 }}>
          <Text style={[text, style, { opacity: 0 }]}>{children}</Text>
        </LinearGradient>
        {sheen && w > 0 ? <Sheen width={w} /> : null}
      </View>
    </MaskedView>
  );
}

/** A small glowing ring holding an emoji or icon, for the top of a screen (instead of a bare emoji). */
export function NeonBadge({ children, size = 96 }: { children: React.ReactNode; size?: number }) {
  return (
    <GlowRing size={size}>
      {typeof children === 'string' ? <Text style={{ fontSize: size * 0.38 }}>{children}</Text> : children}
    </GlowRing>
  );
}

/** Google's four-colour G. */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
      <Path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8C4 20.5 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.8 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.2C1.4 8.6 1 10.2 1 12s.4 3.4 1.2 4.9l3.6-2.8z" />
      <Path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.4 2.2 15 1 12 1 7.7 1 4 3.5 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </Svg>
  );
}
