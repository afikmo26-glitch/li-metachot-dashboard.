import React, { useEffect } from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { CHAR_ART } from '../simArt';
import { GL, GT, OUTLINE } from '../ui';

/** The HUD of "זירת הכאוס": your fighter's card, the wave tracker, and the banners between waves. */

const GOLD = ['#FDE68A', '#F59E0B', '#92400E'] as const;

/** Your portrait, name and life. The bar drains with a pale trail behind it, and the card jolts when you're hit. */
export function PlayerCard({ name, art, hp, maxHp }: { name: string; art: string; hp: number; maxHp: number }) {
  const r = Math.max(0, Math.min(1, hp / maxHp));
  const fill = useSharedValue(r);
  const trail = useSharedValue(r);
  const jolt = useSharedValue(0);
  useEffect(() => {
    const hurt = r < fill.value - 0.001;
    fill.value = withTiming(r, { duration: 120 });
    trail.value = hurt ? withDelay(380, withTiming(r, { duration: 420, easing: Easing.out(Easing.quad) })) : withTiming(r, { duration: 120 });
    if (hurt) jolt.value = withSequence(withTiming(-5, { duration: 45 }), withTiming(4, { duration: 60 }), withTiming(0, { duration: 90 }));
  }, [r, fill, trail, jolt]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const trailStyle = useAnimatedStyle(() => ({ width: `${trail.value * 100}%` }));
  const joltStyle = useAnimatedStyle(() => ({ transform: [{ translateX: jolt.value }] }));
  const low = r < 0.3;
  return (
    <Animated.View style={[{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center' }, joltStyle]}>
      {/* portrait medallion */}
      <LinearGradient colors={['#7DD3FC', '#2563EB']} style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0B2447' }}>
          <Image source={CHAR_ART[art] ?? CHAR_ART.dragon} style={{ width: 62, height: 62, marginLeft: -7, marginTop: -2 }} resizeMode="cover" />
        </View>
      </LinearGradient>
      <View style={{ flex: 1, marginRight: -14, backgroundColor: 'rgba(12,6,30,0.82)', borderRadius: 14, borderWidth: 2.5, borderColor: OUTLINE, paddingRight: 20, paddingLeft: 8, paddingVertical: 5 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
          <GT size={14} numberOfLines={1}>{name}</GT>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <GT size={13} color={low ? '#FCA5A5' : '#FFFFFF'}>{Math.ceil(Math.max(0, hp)).toLocaleString('en-US')}</GT>
            <GT size={12}>❤️</GT>
          </View>
        </View>
        <View style={{ height: 14, marginTop: 3, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1.5, borderColor: '#05030C', overflow: 'hidden', flexDirection: 'row-reverse' }}>
          <Animated.View style={[{ position: 'absolute', right: 0, top: 0, bottom: 0, backgroundColor: '#FEF3C7' }, trailStyle]} />
          <Animated.View style={[{ height: '100%', overflow: 'hidden' }, fillStyle]}>
            <LinearGradient colors={low ? ['#FCA5A5', '#DC2626'] : ['#86EFAC', '#16A34A']} style={{ flex: 1 }} />
            <View style={{ position: 'absolute', left: 0, right: 0, top: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2 }} />
          </Animated.View>
          {/* segment ticks, like a game life bar */}
          {[0.25, 0.5, 0.75].map((t) => (
            <View key={t} style={{ position: 'absolute', top: 0, bottom: 0, right: `${t * 100}%`, width: 1.5, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

/** The wave plaque: which wave of how many (a gem per wave) and how many enemies still stand. */
export function WaveTracker({ wave, waves, alive }: { wave: number; waves: number; alive: number }) {
  const pop = useSharedValue(1);
  const gem = useSharedValue(1);
  useEffect(() => {
    pop.value = withSequence(withTiming(1.35, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 260 }));
  }, [alive, pop]);
  useEffect(() => {
    gem.value = withSequence(withTiming(0.4, { duration: 1 }), withSpring(1, { damping: 6, stiffness: 180 }));
  }, [wave, gem]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const gemStyle = useAnimatedStyle(() => ({ transform: [{ scale: gem.value }] }));
  return (
    <View style={{ alignItems: 'center' }}>
      <LinearGradient colors={GOLD} style={{ borderRadius: 14, padding: 2.5, borderWidth: 2, borderColor: OUTLINE }}>
        <View style={{ backgroundColor: '#24113F', borderRadius: 11, paddingHorizontal: 10, paddingTop: 3, paddingBottom: 5, alignItems: 'center', minWidth: 84 }}>
          <GL size={10} color="#FDE68A">גל</GL>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <GT size={22}>{`${Math.max(1, wave)}`}</GT>
            <GT size={13} color="#C4B5FD">{` / ${waves}`}</GT>
          </View>
          <View style={{ flexDirection: 'row-reverse', gap: 5, marginTop: 2 }}>
            {Array.from({ length: waves }, (_, i) => {
              const done = i < wave - 1;
              const now = i === wave - 1;
              const dot = <View style={{ width: 11, height: 11, borderRadius: 3, transform: [{ rotate: '45deg' }], borderWidth: 1.5, borderColor: OUTLINE, backgroundColor: done ? '#22C55E' : now ? '#FACC15' : 'rgba(255,255,255,0.18)' }} />;
              return now ? (
                <Animated.View key={i} style={gemStyle}>
                  {dot}
                </Animated.View>
              ) : (
                <View key={i}>{dot}</View>
              );
            })}
          </View>
        </View>
      </LinearGradient>
      <Animated.View style={[{ marginTop: -6, flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#B91C1C', borderRadius: 11, borderWidth: 2, borderColor: OUTLINE, paddingHorizontal: 9, paddingVertical: 1 }, popStyle]}>
        <GT size={12}>👾</GT>
        <GT size={14}>{`${alive}`}</GT>
      </Animated.View>
    </View>
  );
}

/** A big ribbon across the middle: "גל 2", "בוס!", or the result. Replays whenever `id` changes. */
export function Banner({ id, title, sub, tone }: { id: string; title: string; sub?: string; tone: 'gold' | 'red' | 'blue' }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    const enter = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) });
    // wave calls leave again; the result stays up until the screen moves on
    t.value = tone === 'blue' ? withSequence(enter, withDelay(900, withTiming(2, { duration: 320, easing: Easing.in(Easing.quad) }))) : enter;
  }, [id, t, tone]);
  const style = useAnimatedStyle(() => {
    const v = t.value;
    const inX = v <= 1 ? (1 - v) * 260 : -(v - 1) * 260;
    return { opacity: v <= 1 ? Math.min(1, v * 1.6) : 2 - v, transform: [{ translateX: inX }, { scale: v <= 1 ? 0.7 + v * 0.3 : 1 }] };
  });
  const colors = tone === 'gold' ? (['#FDE047', '#F59E0B'] as const) : tone === 'red' ? (['#F87171', '#991B1B'] as const) : (['#60A5FA', '#4338CA'] as const);
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: '34%', left: 0, right: 0, alignItems: 'center' }, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 34, paddingVertical: 8, borderRadius: 18, borderWidth: 3.5, borderColor: OUTLINE, transform: [{ skewX: '-8deg' }], alignItems: 'center' }}>
        <GT size={38}>{title}</GT>
        {sub ? <GT size={14} color="#FEF3C7">{sub}</GT> : null}
      </LinearGradient>
    </Animated.View>
  );
}

/** The super button fills up like a flask as your hits charge it, and glows when it's ready. */
export function SuperFill({ charge, color }: { charge: number; color: string }) {
  const h = useSharedValue(charge);
  useEffect(() => {
    h.value = withTiming(charge, { duration: 200 });
  }, [charge, h]);
  const style = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color, opacity: 0.75 }, style]} />;
}
