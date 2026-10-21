import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, I18nManager, KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EntryModal from './src/components/EntryModal';
import SettingsModal from './src/components/SettingsModal';
import { T, tap } from './src/components/ui';
import { t } from './src/i18n';
import { Account, loadAccount } from './src/lib/account';
import { scheduleBedtime, schedulePhotoReminder } from './src/lib/notifications';
import { PrefsProvider, usePrefs } from './src/lib/prefs';
import { StoreProvider, useStore } from './src/lib/store';
import { colors, gradients, layout } from './src/lib/theme';
import ArchiveScreen from './src/screens/ArchiveScreen';
import { Login, Onboarding } from './src/screens/AuthScreens';
import CalendarScreen from './src/screens/CalendarScreen';
import GameScreen from './src/screens/GameScreen';
import IntroScreen from './src/screens/IntroScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import TodayScreen from './src/screens/TodayScreen';
import VentScreen from './src/screens/VentScreen';

// The native layout is pinned LTR; screens lay themselves out through `layout`/`rtl`,
// so Hebrew and Arabic read right-to-left and English left-to-right, whatever the phone's language.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

type Tab = 'today' | 'archive' | 'calendar' | 'people' | 'vent' | 'game';
type IconName = keyof typeof Ionicons.glyphMap;
const TABS: { key: Tab; label: string; icon: IconName; active: IconName }[] = [
  { key: 'today', label: 'היום', icon: 'mic-outline', active: 'mic' },
  { key: 'archive', label: 'ארכיון', icon: 'library-outline', active: 'library' },
  { key: 'calendar', label: 'לוח שנה', icon: 'calendar-outline', active: 'calendar' },
  { key: 'people', label: 'אנשים', icon: 'people-outline', active: 'people' },
  { key: 'vent', label: 'לפרוק', icon: 'lock-closed-outline', active: 'lock-closed' },
  { key: 'game', label: 'משחק', icon: 'game-controller-outline', active: 'game-controller' },
];

/** Account and lock state live here, above the part that redraws when the theme or language changes. */
function Root() {
  const { ready, settings, clearAll } = useStore();
  const { version } = usePrefs();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    loadAccount().then(setAccount);
  }, []);

  // Make sure the nightly reminder is scheduled (in the current language) once settings are loaded
  useEffect(() => {
    if (ready) {
      scheduleBedtime(settings).catch(() => {});
      schedulePhotoReminder(settings).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, version]);

  let screen: React.ReactNode;
  if (!ready || account === undefined) {
    screen = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  } else if (!account) {
    screen = (
      <Onboarding
        key={version}
        onDone={(a) => {
          setAccount(a);
          setUnlocked(true);
        }}
      />
    );
  } else if (account.lockEnabled && !unlocked) {
    screen = (
      <Login
        key={version}
        account={account}
        onUnlock={(a) => {
          setAccount(a);
          setUnlocked(true);
        }}
        onReset={() => {
          clearAll();
          setAccount(null);
        }}
      />
    );
  } else {
    screen = <Main key={version} account={account} setAccount={setAccount} onLock={() => setUnlocked(false)} />;
  }

  return (
    <>
      <StatusBar style={colors.statusBar} />
      {screen}
    </>
  );
}

function Main({ account, setAccount, onLock }: { account: Account; setAccount: (a: Account) => void; onLock: () => void }) {
  const { profile } = useStore();
  const { takeReopenSettings } = usePrefs();
  const [tab, setTab] = useState<Tab>('today');
  const [entryId, setEntryId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(takeReopenSettings);
  const [introOpen, setIntroOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(1)).current;

  // Tapping a notification opens the right screen
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as { screen?: Tab | 'record'; entryId?: string } | undefined;
      if (!data?.screen) return;
      setTab(data.screen === 'record' ? 'today' : data.screen);
      if (data.entryId) setEntryId(data.entryId);
    };
    handle(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);

  const go = (next: Tab) => {
    if (next === tab) return;
    tap();
    setTab(next);
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const open = (id: string) => setEntryId(id);

  return (
    <LinearGradient colors={gradients.app} style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            style={{
              flex: 1,
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}
          >
            {tab === 'today' && (
              <TodayScreen
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenEntry={open}
                onOpenIntro={profile.done ? undefined : () => setIntroOpen(true)}
              />
            )}
            {tab === 'archive' && <ArchiveScreen onOpenEntry={open} />}
            {tab === 'calendar' && <CalendarScreen onOpenEntry={open} />}
            {tab === 'people' && <PeopleScreen onOpenEntry={open} />}
            {tab === 'vent' && <VentScreen />}
            {tab === 'game' && <GameScreen />}
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <View
        style={{
          flexDirection: layout.row,
          backgroundColor: colors.bgDeep,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        }}
      >
        {TABS.map((tb) => {
          const active = tb.key === tab;
          return (
            <Pressable key={tb.key} onPress={() => go(tb.key)} style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={t(tb.label)}>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: active ? colors.cardHi : 'transparent',
                }}
              >
                <Ionicons name={active ? tb.active : tb.icon} size={24} color={active ? colors.primaryHi : colors.textMute} />
              </View>
              <T size={11} bold={active} style={{ textAlign: 'center', marginTop: 2, color: active ? colors.text : colors.textMute }}>
                {t(tb.label)}
              </T>
            </Pressable>
          );
        })}
      </View>

      <EntryModal entryId={entryId} onClose={() => setEntryId(null)} />
      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        account={account}
        onAccountChange={setAccount}
        onOpenIntro={() => {
          setSettingsOpen(false);
          setIntroOpen(true);
        }}
        onLock={() => {
          setSettingsOpen(false);
          onLock();
        }}
      />
      <Modal visible={introOpen} animationType="slide" onRequestClose={() => setIntroOpen(false)}>
        <IntroScreen onDone={() => setIntroOpen(false)} />
      </Modal>
    </LinearGradient>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <StoreProvider>
          <Root />
        </StoreProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
