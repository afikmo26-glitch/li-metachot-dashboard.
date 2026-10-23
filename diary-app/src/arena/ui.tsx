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
          textShadowColor: '#0B0618',
          textShadowOffset: { width: 0, height: Math.max(2, size / 8) },
          textShadowRadius: 0.5,
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
/** The near-black outline every game button and panel wears. */
export const OUTLINE = '#120A24';

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
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, borderRadius: 16, backgroundColor: deep, borderWidth: 3, borderColor: OUTLINE }} />
          <LinearGradient
            colors={[top, mid]}
            style={{ height, borderRadius: 16, marginTop: pressed ? 6 : 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, borderWidth: 3, borderColor: OUTLINE }}
          >
            <View pointerEvents="none" style={{ position: 'absolute', top: 3, left: 8, right: 8, height: height * 0.32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.28)' }} />
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

/** A square side-menu button for the game's home: an icon popping out of a chunky tile, a label, a badge. */
export function SideButton({ icon, label, onPress, tone = 'blue', badge, ribbon }: { icon: string; label: string; onPress: () => void; tone?: Tone; badge?: number; ribbon?: string }) {
  const [top, mid, deep] = PALETTES[tone];
  return (
    <Pressable
      onPress={() => {
        play('pop', 0.4);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 82, transform: [{ scale: pressed ? 0.92 : 1 }] })}
    >
      <View style={{ height: 70, marginTop: 18 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 66, borderRadius: 14, backgroundColor: deep, borderWidth: 3, borderColor: OUTLINE }} />
        <LinearGradient colors={[top, mid]} style={{ height: 64, borderRadius: 14, borderWidth: 3, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 3, left: 6, right: 6, height: 18, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <GT size={13}>{label}</GT>
        </LinearGradient>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
        <ItemIcon icon={icon} size={54} />
      </View>
      {!!badge && (
        <View style={{ position: 'absolute', top: 10, left: -4, minWidth: 26, height: 26, borderRadius: 13, backgroundColor: '#EF4444', borderWidth: 3, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <GT size={12}>{badge}</GT>
        </View>
      )}
      {!!ribbon && (
        <View style={{ position: 'absolute', top: 12, right: -8, backgroundColor: '#22C55E', borderRadius: 6, borderWidth: 2, borderColor: OUTLINE, paddingHorizontal: 5, transform: [{ rotate: '8deg' }] }}>
          <GT size={10}>{ribbon}</GT>
        </View>
      )}
    </Pressable>
  );
}

/** A currency counter in the top bar: icon overlapping a dark outlined slot. */
export function Counter({ icon, value }: { icon: string; value: number }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
      <View style={{ height: 30, minWidth: 70, paddingRight: 24, paddingLeft: 10, borderRadius: 8, backgroundColor: 'rgba(8,4,20,0.75)', borderWidth: 2.5, borderColor: OUTLINE, justifyContent: 'center', marginRight: -18 }}>
        <GT size={15} style={{ textAlign: 'left' }}>{value.toLocaleString()}</GT>
      </View>
      <View style={{ zIndex: 1 }}>
        <ItemIcon icon={icon} size={36} />
      </View>
    </View>
  );
}
