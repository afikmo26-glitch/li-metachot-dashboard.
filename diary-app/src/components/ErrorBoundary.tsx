import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { t } from '../i18n';
import { reportCrash } from '../lib/cloud';

/** Sends unexpected errors to the server (message and stack only, never diary content). */
export function installCrashReporting() {
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: Error, fatal?: boolean) => void; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void } };
  if (g.ErrorUtils) {
    const prev = g.ErrorUtils.getGlobalHandler();
    g.ErrorUtils.setGlobalHandler((e, fatal) => {
      reportCrash(`${fatal ? 'fatal: ' : ''}${e?.message ?? String(e)}`, e?.stack);
      prev(e, fatal);
    });
  } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (ev) => reportCrash(ev.message, ev.error?.stack));
  }
}

/** If a screen crashes, show a calm message with a way back instead of a white screen. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    reportCrash(error.message, error.stack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#14102B' }}>
        <Text style={{ fontSize: 48 }}>🙈</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 12 }}>{t('אופס, משהו השתבש')}</Text>
        <Text style={{ color: '#C9C2E8', fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
          {t('היומן שלך שמור ובטוח. שלחנו דיווח כדי לתקן את זה.')}
        </Text>
        <Pressable onPress={() => this.setState({ failed: false })} style={{ marginTop: 22, backgroundColor: '#8B5CF6', borderRadius: 16, paddingHorizontal: 26, paddingVertical: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('נסה שוב')}</Text>
        </Pressable>
      </View>
    );
  }
}
