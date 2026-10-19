import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { colors, rtl } from '../lib/theme';

export function tap(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (Platform.OS === 'web') return;
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  Haptics.impactAsync(map[style]).catch(() => {});
}

export function notify(kind: 'success' | 'error') {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(
    kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
}

/** Right-to-left row: first child sits on the right. */
export function Row({ style, ...props }: ViewProps) {
  return <View style={[styles.row, style]} {...props} />;
}

export function T({ style, dim, bold, size, ...props }: TextProps & { dim?: boolean; bold?: boolean; size?: number }) {
  return (
    <Text
      style={[
        styles.text,
        dim && { color: colors.textDim },
        bold && { fontWeight: '700' },
        size ? { fontSize: size } : null,
        style,
      ]}
      {...props}
    />
  );
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
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
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      <LinearGradient
        colors={grad}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.gradBtn, small && { paddingVertical: 9, paddingHorizontal: 14 }]}
      >
        <T bold size={small ? 14 : 17} style={{ color: '#fff', textAlign: 'center' }}>
          {icon ? `${icon}  ` : ''}
          {title}
        </T>
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ title, onPress, style, color }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle>; color?: string }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.ghost, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      <T bold style={{ color: color ?? colors.primaryHi, textAlign: 'center' }}>
        {title}
      </T>
    </Pressable>
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
      style={[styles.chip, { borderColor: c }, active && { backgroundColor: c }]}
    >
      <T size={14} bold style={{ color: active ? '#fff' : c }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { style?: StyleProp<TextStyle> }) {
  return <TextInput placeholderTextColor={colors.textMute} {...props} style={[styles.input, props.style]} />;
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
      <Text style={{ fontSize: 56 }}>{emoji}</Text>
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

export const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse' },
  text: { color: colors.text, fontSize: 16, ...rtl },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gradBtn: { borderRadius: 16, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center' },
  ghost: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.bgDeep,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...rtl,
  },
});
