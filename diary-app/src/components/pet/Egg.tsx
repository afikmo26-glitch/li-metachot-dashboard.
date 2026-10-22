import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Platform, Pressable } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { EGG_TAPS } from '../../lib/pet';

/** The egg: rocks gently, wobbles hard when tapped, cracks a little more with every tap. */
const CRACKS = [
  'M70 120 L80 112 L88 122 L96 110',
  'M96 110 L104 120 L112 108 L120 118',
  'M120 118 L130 110 L136 120',
  'M64 132 L70 120',
  'M136 120 L142 134',
  'M88 122 L92 136 L100 128',
];

export function Egg({ size, taps, onTap }: { size: number; taps: number; onTap?: () => void }) {
  const rock = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    rock.set(withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: 900, easing: Easing.inOut(Easing.sin) })), -1));
    return () => cancelAnimation(rock);
  }, [rock]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rock.get() * 3 + shake.get() * 14}deg` }] }));

  const press = () => {
    shake.set(withSequence(withTiming(1, { duration: 60 }), withTiming(-1, { duration: 80 }), withTiming(0.6, { duration: 70 }), withTiming(0, { duration: 90 })));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onTap?.();
  };

  const shown = Math.round((taps / EGG_TAPS) * CRACKS.length);
  return (
    <Pressable onPress={press} hitSlop={20} accessibilityLabel="egg">
      <Animated.View style={[{ width: size, height: size, transformOrigin: '50% 95%' }, style]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id="eggShell" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFF7FB" />
              <Stop offset="1" stopColor="#E9DDFF" />
            </LinearGradient>
          </Defs>
          <Ellipse cx="100" cy="188" rx="44" ry="7" fill="#000" opacity={0.18} />
          <Path d="M100 24 C140 24 160 96 160 128 C160 162 134 186 100 186 C66 186 40 162 40 128 C40 96 60 24 100 24 Z" fill="url(#eggShell)" />
          <G fill="#C4B5FD" opacity={0.7}>
            <Ellipse cx="78" cy="80" rx="9" ry="12" />
            <Ellipse cx="124" cy="62" rx="7" ry="9" />
            <Ellipse cx="128" cy="150" rx="11" ry="9" />
            <Ellipse cx="70" cy="158" rx="7" ry="6" />
          </G>
          <G fill="#FDA4CF" opacity={0.7}>
            <Ellipse cx="108" cy="104" rx="8" ry="7" />
            <Ellipse cx="60" cy="118" rx="6" ry="7" />
          </G>
          {CRACKS.slice(0, shown).map((d) => (
            <Path key={d} d={d} stroke="#6D5BA8" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
      </Animated.View>
    </Pressable>
  );
}
