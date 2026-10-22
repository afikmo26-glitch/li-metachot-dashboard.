import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { play } from '../lib/sound';
import { colors, layout, rtl } from '../lib/theme';

export function tap(style: 'light' | 'medium' | 'heavy' = 'light') {
  play(style === 'light' ? 'tap' : 'pop', style === 'heavy' ? 0.6 : 0.4);
  if (Platform.OS === 'web') return;
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  Haptics.impactAsync(map[style]).catch(() => {});
}

export function notify(kind: 'success' | 'error') {
  play(kind, 0.5);
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(
    kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
}

/** Row in reading order: first child sits on the right in Hebrew/Arabic, on the left in English. */
export function Row({ style, ...props }: ViewProps) {
  return <View style={[{ flexDirection: layout.row }, style]} {...props} />;
}

/**
 * Type scale: body 15, and big sizes pulled in so headings stay strong without filling a phone screen
 * (30 → 26, 26 → 23, 22 → 20). Small sizes are kept as they are.
 */
export const fontSize = (size = 15) => (size <= 15 ? size : Math.round((15 + (size - 15) * 0.72) * 2) / 2);

export function T({ style, dim, bold, size, ...props }: TextProps & { dim?: boolean; bold?: boolean; size?: number }) {
  return (
    <Text
      style={[
        { color: colors.text, fontSize: 15, ...rtl },
        dim && { color: colors.textDim },
        bold && { fontWeight: '700' },
        size ? { fontSize: fontSize(size) } : null,
        style,
      ]}
      {...props}
    />
  );
}

export const cardStyle = (): ViewStyle => ({
  backgroundColor: colors.card,
  borderRadius: 18,
  padding: 14,
  borderWidth: 1,
  borderColor: colors.border,
});

export function Card({ style, ...props }: ViewProps) {
  return <View style={[cardStyle(), style]} {...props} />;
}

/** Fades and slides its children in once, staggered by `delay`. Skipped when the OS asks for reduced motion. */
export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        if (reduce) v.setValue(1);
        else Animated.timing(v, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    return () => {
      alive = false;
    };
  }, [v, delay]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** Pressable that springs down slightly while pressed. */
export function Bouncy({
  children,
  onPress,
  style,
  disabled,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return (
    <Pressable
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => to(0.96)}
      onPressOut={() => to(1)}
      onPress={onPress}
    >
      <Animated.View style={[{ transform: [{ scale: s }], opacity: disabled ? 0.45 : 1 }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function GradientButton({
  title,
  onPress,
  colors: grad,
  icon,
  style,
  disabled,
  small,
}: {
  title: string;
  onPress: () => void;
  colors: readonly [string, string, ...string[]];
  icon?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <Bouncy
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={style}
    >
      <LinearGradient
        colors={grad}
        start={{ x: layout.isRTL ? 1 : 0, y: 0 }}
        end={{ x: layout.isRTL ? 0 : 1, y: 1 }}
        style={{ borderRadius: 14, paddingVertical: small ? 8 : 13, paddingHorizontal: small ? 14 : 18, minHeight: small ? 36 : 46, alignItems: 'center', justifyContent: 'center' }}
      >
        <T bold size={small ? 14 : 16} style={{ color: '#fff', textAlign: 'center' }}>
          {icon ? `${icon}  ` : ''}
          {title}
        </T>
      </LinearGradient>
    </Bouncy>
  );
}

export function GhostButton({ title, onPress, style, color }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle>; color?: string }) {
  return (
    <Bouncy
      onPress={() => {
        tap();
        onPress();
      }}
      style={[{ paddingVertical: 10, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border }, style]}
    >
      <T bold style={{ color: color ?? colors.primaryHi, textAlign: 'center' }}>
        {title}
      </T>
    </Bouncy>
  );
}

export function Chip({
  label,
  active,
  onPress,
  onLongPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  color?: string;
}) {
  const c = color ?? colors.primary;
  return (
    <Pressable
      onPress={
        onPress &&
        (() => {
          tap();
          onPress();
        })
      }
      onLongPress={onLongPress}
      hitSlop={4}
      style={({ pressed }) => [
        {
          borderWidth: 1.5,
          borderRadius: 999,
          paddingVertical: 7,
          paddingHorizontal: 12,
          marginBottom: 8,
          borderColor: c,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
        layout.isRTL ? { marginLeft: 8 } : { marginRight: 8 },
        active && { backgroundColor: c },
      ]}
    >
      <T size={14} bold style={{ color: active ? '#fff' : c }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { style?: StyleProp<TextStyle> }) {
  return (
    <TextInput
      placeholderTextColor={colors.textMute}
      {...props}
      style={[
        {
          backgroundColor: colors.bgDeep,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          fontSize: 15,
          paddingHorizontal: 14,
          paddingVertical: 11,
          ...rtl,
        },
        props.style,
      ]}
    />
  );
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <T bold size={18} style={[{ marginTop: 18, marginBottom: 10 }, style]}>
      {children}
    </T>
  );
}

export function ScreenTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <Row style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <View style={{ flex: 1 }}>
        <T bold size={28}>
          {title}
        </T>
        {subtitle ? (
          <T dim size={14} style={{ marginTop: 2 }}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </Row>
  );
}

export function Empty({ emoji, title, text }: { emoji: string; title: string; text?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 45 }}>{emoji}</Text>
      <T bold size={18} style={{ textAlign: 'center', marginTop: 12 }}>
        {title}
      </T>
      {text ? (
        <T dim style={{ textAlign: 'center', marginTop: 6, lineHeight: 21 }}>
          {text}
        </T>
      ) : null}
    </View>
  );
}

/** Two to four views of one screen, side by side (journal: list / calendar; me: work / savings / study / vent). */
export function Segmented<K extends string>({ options, value, onChange, style }: { options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: layout.row, gap: 6, backgroundColor: colors.bgDeep, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.border }, style]}>
      {options.map(([key, label]) => {
        const on = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => {
              if (on) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, backgroundColor: on ? colors.primary : 'transparent' }}
          >
            <T bold={on} size={13} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: on ? colors.onPrimary : colors.textDim, textAlign: 'center' }}>
              {label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
