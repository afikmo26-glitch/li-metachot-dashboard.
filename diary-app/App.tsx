import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, I18nManager, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EntryModal from './src/components/EntryModal';
import SettingsModal from './src/components/SettingsModal';
import { T, tap } from './src/components/ui';
import { Account, loadAccount } from './src/lib/account';
import { scheduleBedtime } from './src/lib/notifications';
import { StoreProvider, useStore } from './src/lib/store';
import { colors, gradients } from './src/lib/theme';
import ArchiveScreen from './src/screens/ArchiveScreen';
import { Login, Onboarding } from './src/screens/AuthScreens';
import CalendarScreen from './src/screens/CalendarScreen';
import GameScreen from './src/screens/GameScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import TodayScreen from './src/screens/TodayScreen';
import VentScreen from './src/screens/VentScreen';

// Layout is pinned LTR and every screen lays itself out right-to-left explicitly,
// so it looks the same whatever the phone's language is.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

type Tab = 'today' | 'archive' | 'calendar' | 'people' | 'vent' | 'game';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'today', label: 'היום', icon: '🎙️' },
  { key: 'archive', label: 'ארכיון', icon: '📚' },
  { key: 'calendar', label: 'לוח שנה', icon: '🗓️' },
  { key: 'people', label: 'אנשים', icon: '👥' },
  { key: 'vent', label: 'לפרוק', icon: '🔐' },
  { key: 'game', label: 'משחק', icon: '🎮' },
];

function Main() {
  const { ready, settings, clearAll } = useStore();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [entryId, setEntryId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadAccount().then(setAccount);
  }, []);

  // Make sure the nightly reminder is scheduled once settings are loaded
  useEffect(() => {
    if (ready) scheduleBedtime(settings).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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

  if (!ready || account === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!account) {
    return (
      <Onboarding
        onDone={(a) => {
          setAccount(a);
          setUnlocked(true);
        }}
      />
    );
  }

  if (account.lockEnabled && !unlocked) {
    return (
      <Login
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
  }

  const open = (id: string) => setEntryId(id);

  return (
    <LinearGradient colors={gradients.app} style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {tab === 'today' && <TodayScreen onOpenSettings={() => setSettingsOpen(true)} onOpenEntry={open} />}
          {tab === 'archive' && <ArchiveScreen onOpenEntry={open} />}
          {tab === 'calendar' && <CalendarScreen onOpenEntry={open} />}
          {tab === 'people' && <PeopleScreen onOpenEntry={open} />}
          {tab === 'vent' && <VentScreen />}
          {tab === 'game' && <GameScreen />}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <View
        style={{
          flexDirection: 'row-reverse',
          backgroundColor: colors.bgDeep,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        }}
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                tap();
                setTab(t.key);
              }}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: active ? colors.cardHi : 'transparent',
                }}
              >
                <Text style={{ fontSize: active ? 24 : 21, opacity: active ? 1 : 0.6 }}>{t.icon}</Text>
              </View>
              <T size={11} bold={active} style={{ textAlign: 'center', marginTop: 2, color: active ? colors.text : colors.textMute }}>
                {t.label}
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
        onLock={() => {
          setSettingsOpen(false);
          setUnlocked(false);
        }}
      />
    </LinearGradient>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <Main />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
