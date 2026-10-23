import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Image, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { play } from '../lib/sound';
import { FONTS } from '../lib/theme';
import { ITEM_ICONS } from './assets';
import { SIM_ITEMS } from './simArt';
import { itemDef, MoveId, RARITY } from './data';
import type { OwnedItem } from './progress';

/** Chunky game lettering: white with a dark outline-like drop shadow, like Clash Royale. */
export function GT({ children, size = 16, color = '#FFFFFF', style, numberOfLines }: { children: React.ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color,
          fontSize: size,
          fontFamily: FONTS.black,
          textAlign: 'center',
          textShadowColor: 'rgba(20,8,40,0.95)',
          textShadowOffset: { width: 0, height: Math.max(2, size / 9) },
          textShadowRadius: 1,
          writingDirection: 'rtl',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** A small plain label for secondary text in the game screens. */
export function GL({ children, size = 12, color = '#E9D5FF', style }: { children: React.ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color, fontSize: size, fontFamily: FONTS.bold, textAlign: 'center', writingDirection: 'rtl' }, style]}>{children}</Text>;
}

const PALETTES = {
  gold: ['#FDE047', '#F59E0B', '#B45309'],
  green: ['#86EFAC', '#22C55E', '#14532D'],
  blue: ['#93C5FD', '#3B82F6', '#1E3A8A'],
  purple: ['#D8B4FE', '#9333EA', '#4C1D95'],
  red: ['#FCA5A5', '#EF4444', '#7F1D1D'],
  gray: ['#E2E8F0', '#94A3B8', '#334155'],
} as const;
export type Tone = keyof typeof PALETTES;

/** A fat 3D game button: gradient face, darker "depth" underneath, springs down when pressed. */
export function GButton({ title, onPress, tone = 'gold', size = 18, style, disabled, children, height = 56 }: { title?: string; onPress: () => void; tone?: Tone; size?: number; style?: StyleProp<ViewStyle>; disabled?: boolean; children?: React.ReactNode; height?: number }) {
  const [top, mid, deep] = PALETTES[disabled ? 'gray' : tone];
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        play('pop', 0.45);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={style}
    >
      {({ pressed }) => (
        <View style={{ height: height + 6, opacity: disabled ? 0.6 : 1 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, borderRadius: 18, backgroundColor: deep }} />
          <LinearGradient
            colors={[top, mid]}
            style={{ height, borderRadius: 18, marginTop: pressed ? 6 : 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' }}
          >
            {children}
            {title ? <GT size={size}>{title}</GT> : null}
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

// Old icon names still used around the game, pointed at the new illustrations
const ALIAS: Record<string, string> = { Coin: 'ui_coin', Crystal1: 'ui_gem', Chalice: 'ui_trophy', Chest_Closed: 'ui_chest_wood', Chest_Open: 'ui_chest_gold', Chest_Ingots: 'ui_chest_mythic', Sword_Golden: 'it_flame_sword', Sword: 'it_ice_sword', Hammer_Double: 'it_rock_hammer', Hammer_Double_Golden: 'it_thunder_hammer', Bow_Wooden: 'it_vine_bow', Ring3: 'it_ice_ring', Ring1: 'it_speed_ring', Crown2: 'it_prince_crown', Armor_Leather: 'it_leather_armor' };

export function ItemIcon({ icon, size }: { icon: string; size: number }) {
  const src = SIM_ITEMS[ALIAS[icon] ?? icon] ?? ITEM_ICONS[icon];
  return src ? <Image source={src} style={{ width: size, height: size }} resizeMode="contain" fadeDuration={0} /> : <View style={{ width: size, height: size }} />;
}

/** Coins / gems / trophies counter pill. */
export function Pill({ icon, value, color = '#FACC15' }: { icon: string; value: number | string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 999, paddingRight: 2, paddingLeft: 10, height: 30, borderWidth: 1.5, borderColor: color }}>
      <ItemIcon icon={icon} size={26} />
      <GT size={13} style={{ marginRight: 4 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </GT>
    </View>
  );
}

/** A rounded bar (HP, XP, energy). */
export function Bar({ value, color, height = 10, back = 'rgba(0,0,0,0.45)', style }: { value: number; color: string | readonly [string, string]; height?: number; back?: string; style?: StyleProp<ViewStyle> }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: back, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(20,8,40,0.8)' }, style]}>
      {typeof color === 'string' ? (
        <View style={{ width: `${v * 100}%`, height: '100%', backgroundColor: color }} />
      ) : (
        <LinearGradient colors={color} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${v * 100}%`, height: '100%' }} />
      )}
    </View>
  );
}

/** An item tile framed in its rarity colour, with its level. */
export function ItemTile({ item, size = 76, onPress, selected }: { item: OwnedItem; size?: number; onPress?: () => void; selected?: boolean }) {
  const d = itemDef(item.id);
  if (!d) return null;
  const r = RARITY[d.rarity];
  return (
    <Pressable onPress={onPress} accessibilityLabel={`${d.name}, ${r.label}, רמה ${item.level}`} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <LinearGradient colors={[r.glow, 'rgba(15,8,35,0.85)']} style={{ width: size, height: size + 16, borderRadius: 14, borderWidth: selected ? 3 : 2, borderColor: selected ? '#FFFFFF' : r.color, alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}>
        <ItemIcon icon={d.icon} size={size * 0.72} />
        <View style={{ position: 'absolute', bottom: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 6 }}>
          <GT size={11}>{`רמה ${item.level}`}</GT>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Which 3D icon stands for each move on its card. */
export const MOVE_ICON: Record<MoveId, string> = {
  bite: 'Bone',
  fireBreath: 'Potion3_Filled',
  iceBlast: 'Snowflake1',
  vineWhip: 'Potion4_Filled',
  quake: 'Mineral',
  zap: 'Star',
  shadowClaw: 'Skull',
  thunder: 'Hammer_Double_Golden',
  slash: 'Sword',
  smash: 'Hammer_Double',
  arrows: 'Bow_Wooden',
  shield: 'Ring3',
  heal: 'Potion1_Filled_Red',
  rage: 'Potion9_Filled',
};

/** Slow spinning light rays behind a hero (selection screen, rewards). */
export function Rays({ size, color = 'rgba(255,255,255,0.08)' }: { size: number; color?: string }) {
  const reduced = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (!reduced) r.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1);
  }, [reduced, r]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 360}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }, st]}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={{ position: 'absolute', width: size * 0.09, height: size, backgroundColor: color, transform: [{ rotate: `${i * 15}deg` }], borderRadius: size }} />
      ))}
    </Animated.View>
  );
}

/** Gentle up-down float for heroes on pedestals. */
export function Float({ children, amount = 8, ms = 1400, style }: { children: React.ReactNode; amount?: number; ms?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!reduced) v.value = withRepeat(withSequence(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: ms, easing: Easing.inOut(Easing.sin) })), -1);
  }, [reduced, v, ms]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -v.value * amount }] }));
  return <Animated.View style={[st, style]}>{children}</Animated.View>;
}

/** Pulsing scale for "tap me" buttons. */
export function Pulse({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!reduced) v.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1);
  }, [reduced, v]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 + v.value * 0.04 }] }));
  return <Animated.View style={[st, style]}>{children}</Animated.View>;
}
