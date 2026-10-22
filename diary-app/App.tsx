import './src/lib/webAlert';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import { Rubik_900Black } from '@expo-google-fonts/rubik/900Black';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, I18nManager, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import Modal from './src/components/AppModal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EntryModal from './src/components/EntryModal';
import Splash from './src/components/Splash';
import SettingsModal, { SettingsSection } from './src/components/SettingsModal';
import SideDrawer from './src/components/SideDrawer';
import Pet from './src/components/pet/Pet';
import { stageOf } from './src/lib/pet';
import { useLevel } from './src/lib/useLevel';
import { Segmented, tap } from './src/components/ui';
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
const TAB_H = 64;
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
  const { ready, settings, clearAll, updateSettings, pet } = useStore();
  const { version, prefs, setPrefs } = usePrefs();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [splash, setSplash] = useState(true);
  const hideSplash = useCallback(() => setSplash(false), []);

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
      {splash && <Splash ready={ready && account !== undefined} pet={ready ? pet : undefined} onDone={hideSplash} />}
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
  const [settingsSection, setSettingsSection] = useState<SettingsSection | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [petTab, setPetTab] = useState<'shop' | undefined>();
  const { level } = useLevel();
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
    if (next !== 'pet') setPetTab(undefined);
    setTab(next);
  };

  const open = (id: string) => setEntryId(id);

  return (
    <LinearGradient colors={gradients.app} style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, paddingBottom: TAB_H + Math.max(insets.bottom, 10) + 4 }}>
            {tab === 'today' && (
              <TodayScreen
                onOpenPet={() => go('pet')}
                onOpenStudy={() => {
                  setWorkSection('study');
                  go('me');
                }}
                onOpenSettings={() => setDrawerOpen(true)}
                onOpenCalendar={() => {
                  setJournalView('calendar');
                  go('journal');
                }}
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
            {tab === 'pet' && <PetScreen key={petTab ?? 'pet'} initialTab={petTab} />}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Floating pill tab bar; the pet sits raised in the middle */}
      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 10),
          height: TAB_H,
          borderRadius: TAB_H / 2,
          backgroundColor: colors.statusBar === 'light' ? 'rgba(20,17,46,0.94)' : colors.card,
          borderWidth: 1,
          borderColor: colors.statusBar === 'light' ? 'rgba(255,255,255,0.12)' : colors.border,
          flexDirection: layout.row,
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 6,
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
          elevation: 16,
        }}
      >
        {TABS.map((tb) => {
          const active = tb.key === tab;
          const label = tb.key === 'pet' && pet.hatched && pet.name ? pet.name : t(tb.label);
          if (tb.key === 'pet')
            return (
              <Pressable key={tb.key} onPress={() => go(tb.key)} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} style={{ marginTop: -34 }}>
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 34,
                    borderWidth: 3,
                    borderColor: active ? colors.cyan : colors.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {pet.hatched ? <Pet pet={pet} stage={stageOf(pet, level)} size={58} interactive={false} /> : <Ionicons name="egg" size={28} color="#fff" />}
                </LinearGradient>
              </Pressable>
            );
          return (
            <Pressable
              key={tb.key}
              onPress={() => go(tb.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? `${colors.primaryHi}2E` : 'transparent' }}
            >
              <Ionicons name={active ? tb.active : tb.icon} size={23} color={active ? colors.primaryHi : colors.textMute} />
              {active ? <View style={{ position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.cyan }} /> : null}
            </Pressable>
          );
        })}
      </View>

      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        account={account}
        onOpenSettings={(section) => {
          setSettingsSection(section);
          setSettingsOpen(true);
        }}
        onOpenIntro={() => setIntroOpen(true)}
        onOpenShop={() => {
          setPetTab('shop');
          setTab('pet');
        }}
        onLock={onLock}
      />

      <EntryModal entryId={entryId} onClose={() => setEntryId(null)} />
      <SettingsModal
        visible={settingsOpen}
        section={settingsSection}
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
  const [fontsLoaded, fontError] = useFonts({ Rubik_400Regular, Rubik_500Medium, Rubik_700Bold, Rubik_900Black });
  // Until Rubik is in, show the splash's dark ground so there is no flash of system fonts
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: '#06051A' }} />;
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
