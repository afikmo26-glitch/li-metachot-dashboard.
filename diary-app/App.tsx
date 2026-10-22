import './src/lib/webAlert';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, I18nManager, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import Modal from './src/components/AppModal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EntryModal from './src/components/EntryModal';
import SettingsModal from './src/components/SettingsModal';
import { Segmented, T, tap } from './src/components/ui';
import { t } from './src/i18n';
import { Account, ensurePreviewAccount } from './src/lib/account';
import { scheduleBedtime, schedulePhotoReminder, scheduleSavingsReminder } from './src/lib/notifications';
import { PrefsProvider, usePrefs } from './src/lib/prefs';
import { useCloudSync } from './src/lib/useCloudSync';
import { useWidgetSync } from './src/widget/widgetSync';
import ErrorBoundary, { installCrashReporting } from './src/components/ErrorBoundary';
import { StoreProvider, useStore } from './src/lib/store';
import { colors, gradients, layout } from './src/lib/theme';
import ArchiveScreen from './src/screens/ArchiveScreen';
import { Login, Onboarding } from './src/screens/AuthScreens';
import CalendarScreen from './src/screens/CalendarScreen';
import IntroScreen from './src/screens/IntroScreen';
import PetScreen from './src/screens/PetScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import TodayScreen from './src/screens/TodayScreen';
import WorkScreen, { MeSection } from './src/screens/WorkScreen';

// The native layout is pinned LTR; screens lay themselves out through `layout`/`rtl`,
// so Hebrew and Arabic read right-to-left and English left-to-right, whatever the phone's language.
installCrashReporting();
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

type Tab = 'today' | 'journal' | 'pet' | 'people' | 'me';
type IconName = keyof typeof Ionicons.glyphMap;
const TABS: { key: Tab; label: string; icon: IconName; active: IconName }[] = [
  { key: 'today', label: 'היום', icon: 'mic-outline', active: 'mic' },
  { key: 'journal', label: 'יומן', icon: 'book-outline', active: 'book' },
  { key: 'pet', label: 'החבר שלי', icon: 'paw-outline', active: 'paw' },
  { key: 'people', label: 'אנשים', icon: 'people-outline', active: 'people' },
  { key: 'me', label: 'אני', icon: 'person-circle-outline', active: 'person-circle' },
];

/** Where a notification's `screen` opens: a tab, plus the view inside it. */
const ROUTES: Record<string, { tab: Tab; journal?: 'archive' | 'calendar'; me?: MeSection }> = {
  record: { tab: 'today' },
  today: { tab: 'today' },
  archive: { tab: 'journal', journal: 'archive' },
  calendar: { tab: 'journal', journal: 'calendar' },
  work: { tab: 'me', me: 'hours' },
  vent: { tab: 'me', me: 'vent' },
  people: { tab: 'people' },
  pet: { tab: 'pet' },
};

/** Account and lock state live here, above the part that redraws when the theme or language changes. */
function Root() {
  const { ready, settings, clearAll, updateSettings } = useStore();
  const { version, prefs, setPrefs } = usePrefs();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    ensurePreviewAccount().then(setAccount);
  }, []);

  // The ready-made preview account skips sign-up, so fill in what sign-up would have set
  useEffect(() => {
    if (!ready || !account || !process.env.EXPO_PUBLIC_PREVIEW_ACCOUNT || Platform.OS !== 'web') return;
    if (!settings.userName) updateSettings({ userName: account.displayName });
    if (!prefs.genderAsked) setPrefs({ genderAsked: true }, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account]);

  // Make sure the nightly reminder is scheduled (in the current language) once settings are loaded
  useEffect(() => {
    if (ready) {
      scheduleBedtime(settings).catch(() => {});
      schedulePhotoReminder(settings).catch(() => {});
      scheduleSavingsReminder(settings).catch(() => {});
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
  const { profile, pet } = useStore();
  useCloudSync();
  useWidgetSync();
  const { takeReopenSettings } = usePrefs();
  const [tab, setTab] = useState<Tab>('today');
  const [workSection, setWorkSection] = useState<MeSection | undefined>();
  const [journalView, setJournalView] = useState<'archive' | 'calendar'>('archive');
  const [entryId, setEntryId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(takeReopenSettings);
  const [introOpen, setIntroOpen] = useState(false);
  const insets = useSafeAreaInsets();

  // Tapping a notification opens the right screen
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as { screen?: string; entryId?: string } | undefined;
      const route = data?.screen ? ROUTES[data.screen] : undefined;
      if (!route) return;
      setTab(route.tab);
      if (route.journal) setJournalView(route.journal);
      if (route.me) setWorkSection(route.me);
      if (data?.entryId) setEntryId(data.entryId);
    };
    handle(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);

  const go = (next: Tab) => {
    if (next === tab) return;
    tap();
    setTab(next);
  };

  const open = (id: string) => setEntryId(id);

  return (
    <LinearGradient colors={gradients.app} style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1 }}>
            {tab === 'today' && (
              <TodayScreen
                onOpenPet={() => go('pet')}
                onOpenStudy={() => {
                  setWorkSection('study');
                  go('me');
                }}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenEntry={open}
                onOpenIntro={profile.done ? undefined : () => setIntroOpen(true)}
              />
            )}
            {tab === 'journal' && (
              <View style={{ flex: 1 }}>
                <Segmented
                  value={journalView}
                  onChange={setJournalView}
                  options={[
                    ['archive', t('📖 ארכיון')],
                    ['calendar', t('📅 לוח שנה')],
                  ]}
                  style={{ marginHorizontal: 18, marginTop: 10 }}
                />
                <View style={{ flex: 1 }}>{journalView === 'archive' ? <ArchiveScreen onOpenEntry={open} /> : <CalendarScreen onOpenEntry={open} />}</View>
              </View>
            )}
            {tab === 'people' && <PeopleScreen onOpenEntry={open} />}
            {tab === 'me' && <WorkScreen initial={workSection} />}
            {tab === 'pet' && <PetScreen />}
          </View>
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
          const label = tb.key === 'pet' && pet.hatched && pet.name ? pet.name : t(tb.label);
          return (
            <Pressable key={tb.key} onPress={() => go(tb.key)} style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={label}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: active ? colors.cardHi : 'transparent',
                }}
              >
                <Ionicons name={active ? tb.active : tb.icon} size={23} color={active ? colors.primaryHi : colors.textMute} />
              </View>
              <T size={11} bold={active} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ textAlign: 'center', marginTop: 2, color: active ? colors.text : colors.textMute }}>
                {label}
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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <PrefsProvider>
        <StoreProvider>
          <ErrorBoundary>
            <Root />
          </ErrorBoundary>
        </StoreProvider>
      </PrefsProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
