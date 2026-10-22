import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Modal as RNModal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Account } from '../lib/account';
import { usePrefs } from '../lib/prefs';
import { useStore } from '../lib/store';
import { colors, gradients, layout, THEMES } from '../lib/theme';
import { useLevel } from '../lib/useLevel';
import { LANGS, t } from '../i18n';
import type { SettingsSection } from './SettingsModal';
import { Row, T, tap } from './ui';

type IconName = keyof typeof Ionicons.glyphMap;
const WIDTH = 318;

type Props = {
  visible: boolean;
  onClose: () => void;
  account: Account;
  /** Opens the full settings screen, scrolled to a part */
  onOpenSettings: (section?: SettingsSection) => void;
  onOpenIntro: () => void;
  onOpenShop: () => void;
  onLock: () => void;
};

/** The side menu (from the ☰ button): who you are, your level, and every setting one tap away. */
export default function SideDrawer({ visible, onClose, account, onOpenSettings, onOpenIntro, onOpenShop, onLock }: Props) {
  const insets = useSafeAreaInsets();
  const { settings, pet } = useStore();
  const { prefs, setPrefs } = usePrefs();
  const { level, xp } = useLevel();
  const [shown, setShown] = useState(visible);
  const v = useSharedValue(0);

  // Mount as soon as it is asked for; unmount only after the slide-out ends
  if (visible && !shown) setShown(true);
  useEffect(() => {
    if (visible) {
      v.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    } else if (shown) {
      v.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }, (done) => done && runOnJS(setShown)(false));
    }
  }, [visible, shown, v]);

  // Hebrew/Arabic: the menu comes in from the right; English from the left
  const side = layout.isRTL ? 1 : -1;
  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - v.value) * WIDTH * side }] }));
  const shade = useAnimatedStyle(() => ({ opacity: v.value }));

  const go = (fn: () => void) => () => {
    tap();
    onClose();
    setTimeout(fn, 240);
  };
  const name = settings.userName || account.displayName;
  const lang = LANGS.find((l) => l.code === prefs.lang)?.label ?? '';

  return (
    <RNModal visible={shown} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,2,12,0.62)' }, shade]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t('סגור תפריט')} />
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: WIDTH,
            maxWidth: '86%',
            backgroundColor: colors.bgDeep,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowRadius: 30,
            elevation: 20,
          },
          layout.isRTL ? { right: 0, borderLeftWidth: 1 } : { left: 0, borderRightWidth: 1 },
          panel,
        ]}
      >
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18, paddingHorizontal: 14 }}>
          <Row style={{ alignItems: 'center', gap: 12, paddingHorizontal: 4 }}>
            <LinearGradient colors={gradients.neon} style={{ width: 56, height: 56, borderRadius: 28, padding: 2 }}>
              <View style={{ flex: 1, borderRadius: 26, backgroundColor: colors.cardHi, alignItems: 'center', justifyContent: 'center' }}>
                <T bold size={22}>
                  {name.slice(0, 1)}
                </T>
              </View>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <T bold size={18} numberOfLines={1}>
                {name}
              </T>
              <T size={12} style={{ color: colors.textMute, marginTop: 2 }}>
                {t('רמה {n} · {xp} נקודות', { n: level, xp: xp.toLocaleString() })}
              </T>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t('סגור')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </Row>

          <Pressable onPress={go(onOpenShop)} accessibilityRole="button">
            <LinearGradient
              colors={['rgba(124,58,237,0.38)', 'rgba(219,39,119,0.26)']}
              start={{ x: layout.isRTL ? 1 : 0, y: 0 }}
              end={{ x: layout.isRTL ? 0 : 1, y: 0 }}
              style={{ marginTop: 18, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(240,171,252,0.3)', flexDirection: layout.row, alignItems: 'center', gap: 10 }}
            >
              <Ionicons name="diamond" size={20} color="#FDE68A" />
              <View style={{ flex: 1 }}>
                <T bold size={14}>
                  {t('חנות של {name}', { name: (pet.hatched && pet.name) || t('החבר שלי') })}
                </T>
                <T size={12} style={{ color: '#E9D5FF' }}>
                  {t('חבילות מיוחדות לחבר שלך')}
                </T>
              </View>
            </LinearGradient>
          </Pressable>

          <Group title={t('חשבון')} />
          <Item icon="cloud-outline" tint="#67E8F9" label={t('גיבוי וסנכרון')} onPress={go(() => onOpenSettings('cloud'))} />
          <Item icon="person-outline" tint="#A5B4FC" label={t('החשבון שלי')} onPress={go(() => onOpenSettings('account'))} />
          <Item icon="lock-closed-outline" tint="#C4B5FD" label={t('אבטחה ופרטיות')} onPress={go(() => onOpenSettings('security'))} />
          {account.lockEnabled && <Item icon="key-outline" tint="#C4B5FD" label={t('לנעול עכשיו')} onPress={go(onLock)} />}

          <Group title={t('חוויה')} />
          <ToggleItem icon="musical-notes-outline" tint="#F9A8D4" label={t('מוזיקת רקע')} value={!!prefs.music} onChange={(on) => setPrefs({ music: on }, false, false)} />
          <ToggleItem icon="volume-high-outline" tint="#F9A8D4" label={t('צלילים')} value={prefs.sounds} onChange={(on) => setPrefs({ sounds: on }, false, false)} />
          <Item icon="notifications-outline" tint="#FCD34D" label={t('תזכורות')} value={settings.bedtimeEnabled ? `${settings.bedtimeHour}:${String(settings.bedtimeMinute).padStart(2, '0')}` : undefined} onPress={go(() => onOpenSettings('reminders'))} />
          <Item icon="color-palette-outline" tint="#A5B4FC" label={t('ערכת נושא ושפה')} value={`${t(THEMES[prefs.theme]?.label ?? '')} · ${lang}`} onPress={go(() => onOpenSettings('display'))} />
          <Item icon="sparkles-outline" tint="#6EE7B7" label={t('צ\'אט חכם (AI)')} onPress={go(() => onOpenSettings('ai'))} />

          <Group title={t('עוד')} />
          <Item icon="book-outline" tint="#93C5FD" label={t('גיבוי וספר השנה')} onPress={go(() => onOpenSettings('backup'))} />
          <Item icon="heart-outline" tint="#F9A8D4" label={t('היכרות עם יומי')} onPress={go(onOpenIntro)} />
          <Item icon="settings-outline" tint={colors.textDim} label={t('כל ההגדרות')} onPress={go(() => onOpenSettings())} />
        </ScrollView>
      </Animated.View>
    </RNModal>
  );
}

function Group({ title }: { title: string }) {
  return (
    <T bold size={11} style={{ color: colors.textMute, letterSpacing: 0.6, marginTop: 18, marginBottom: 4, paddingHorizontal: 12 }}>
      {title}
    </T>
  );
}

function Icon({ icon, tint }: { icon: IconName; tint: string }) {
  return (
    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${tint}26`, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={18} color={tint} />
    </View>
  );
}

function Item({ icon, tint, label, value, onPress }: { icon: IconName; tint: string; label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: layout.row, alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 12, borderRadius: 14, backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent' })}
    >
      <Icon icon={icon} tint={tint} />
      <T style={{ flex: 1 }}>{label}</T>
      {value ? (
        <T size={12} style={{ color: colors.textMute }}>
          {value}
        </T>
      ) : null}
    </Pressable>
  );
}

function ToggleItem({ icon, tint, label, value, onChange }: { icon: IconName; tint: string; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: layout.row, alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 12 }}>
      <Icon icon={icon} tint={tint} />
      <T style={{ flex: 1 }}>{label}</T>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFFFFF" accessibilityLabel={label} />
    </View>
  );
}
