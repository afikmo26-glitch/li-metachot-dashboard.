import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal as RNModal, ModalProps, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { colors } from '../lib/theme';

/**
 * React Native's Modal with its own safe-area provider: on iPhone, a full-screen modal otherwise lays out
 * under the status bar and its close button can't be reached.
 */
export default function Modal({ children, ...props }: ModalProps) {
  return (
    <RNModal {...props}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </RNModal>
  );
}

/** The one close button for sheets and full screens: a 40pt circle, easy to hit. */
export function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('סגור')}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.cardHi,
        borderWidth: 1,
        borderColor: colors.border,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Ionicons name="close" size={22} color={colors.text} />
    </Pressable>
  );
}
