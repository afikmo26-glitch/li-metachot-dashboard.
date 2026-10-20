import { Ionicons } from '@expo/vector-icons';
import * as ScreenCapture from 'expo-screen-capture';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, ScrollViewInstance, Text, TextInput, View } from 'react-native';
import { BotAvatar, Bubble } from '../components/ChatModal';
import CrisisCard from '../components/CrisisCard';
import { GhostButton, GradientButton, Input, Row, T, tap } from '../components/ui';
import { aiChat, aiReady, loadAiConfig } from '../lib/ai';
import { formatShortDate, formatTime } from '../lib/dates';
import { newId, useStore } from '../lib/store';
import { colors, rtl } from '../lib/theme';
import type { ChatMessage } from '../lib/types';
import {
  detectCrisis,
  hasVentPassword,
  loadVent,
  MIN_VENT_PASSWORD,
  offlineVentReply,
  saveVent,
  setupVent,
  unlockVent,
  VENT_GREETINGS,
  VentData,
  VentSession,
  wipeVent,
} from '../lib/vent';

const VENT_GRADIENT = ['#2A1B4E', '#1A1033', '#0C0920'] as const;

export default function VentScreen() {
  const [phase, setPhase] = useState<'loading' | 'setup' | 'locked' | 'open'>('loading');
  const [key, setKey] = useState<Uint8Array | null>(null);

  useEffect(() => {
    hasVentPassword().then((has) => setPhase(has ? 'locked' : 'setup'));
  }, []);

  // Lock as soon as the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        setKey(null);
        setPhase((p) => (p === 'open' ? 'locked' : p));
      }
    });
    return () => sub.remove();
  }, []);

  const unlocked = (k: Uint8Array) => {
    setKey(k);
    setPhase('open');
  };

  return (
    <LinearGradient colors={VENT_GRADIENT} style={{ flex: 1 }}>
      {phase === 'setup' && <Setup onDone={unlocked} />}
      {phase === 'locked' && <Unlock onUnlock={unlocked} onWiped={() => setPhase('setup')} />}
      {phase === 'open' && key && (
        <Room
          ventKey={key}
          onLock={() => {
            setKey(null);
            setPhase('locked');
          }}
          onWiped={() => {
            setKey(null);
            setPhase('setup');
          }}
        />
      )}
    </LinearGradient>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: 22 }}>
      <Text style={{ fontSize: 60 }}>🔐</Text>
      <T bold size={28} style={{ textAlign: 'center', marginTop: 10 }}>
        המקום לפרוק
      </T>
      <T dim size={15} style={{ textAlign: 'center', marginTop: 6, lineHeight: 22, maxWidth: 340 }}>
        {subtitle}
      </T>
    </View>
  );
}

function Setup({ onDone }: { onDone: (k: Uint8Array) => void }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (pw.length < MIN_VENT_PASSWORD) return setError(`לפחות ${MIN_VENT_PASSWORD} תווים`);
    if (pw !== confirm) return setError('הסיסמאות לא תואמות');
    setBusy(true);
    onDone(await setupVent(pw));
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 40, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Header subtitle="מקום אינטימי וסודי רק שלך. אפשר לשחרר כאן הכל, ומישהו יקשיב, יחזיר לך תשובה ויעזור לך להרים את הראש." />
      <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
        <T size={14}>🔒 השיחות מוצפנות בסיסמה נפרדת שרק אתה יודע</T>
        <T size={14}>🚫 אי אפשר לצלם את המסך כאן</T>
        <T size={14}>⏱️ ננעל אוטומטית כשיוצאים</T>
      </View>
      <View style={{ gap: 10, marginTop: 18 }}>
        <Input value={pw} onChangeText={setPw} placeholder="בחר סיסמה למקום הזה" secureTextEntry />
        <Input value={confirm} onChangeText={setConfirm} placeholder="שוב את אותה סיסמה" secureTextEntry onSubmitEditing={create} />
      </View>
      {error && (
        <T size={14} style={{ color: colors.red, marginTop: 10 }}>
          {error}
        </T>
      )}
      <T dim size={12} style={{ marginTop: 10, lineHeight: 18 }}>
        חשוב: אם תשכח את הסיסמה הזו, אי אפשר לשחזר את מה שנכתב כאן.
      </T>
      <GradientButton title={busy ? 'מכין…' : 'צור את המקום שלי'} colors={['#7C3AED', '#DB2777']} onPress={create} disabled={busy} style={{ marginTop: 16 }} />
    </ScrollView>
  );
}

function Unlock({ onUnlock, onWiped }: { onUnlock: (k: Uint8Array) => void; onWiped: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [forgot, setForgot] = useState(false);

  const go = async () => {
    const wait = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (wait > 0) return setError(`נסה שוב בעוד ${wait} שניות`);
    if (busy || !pw) return;
    setBusy(true);
    const k = await unlockVent(pw);
    setBusy(false);
    if (k) return onUnlock(k);
    const n = fails + 1;
    setFails(n);
    setPw('');
    if (n % 5 === 0) {
      setLockedUntil(Date.now() + 30_000);
      setError('יותר מדי ניסיונות. נחסם ל-30 שניות');
    } else {
      setError('סיסמה שגויה');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 60, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Header subtitle="הכנס את הסיסמה של המקום הסודי שלך" />
      <Input value={pw} onChangeText={setPw} placeholder="סיסמה" secureTextEntry onSubmitEditing={go} />
      {error && (
        <T size={14} style={{ color: colors.red, marginTop: 10 }}>
          {error}
        </T>
      )}
      <GradientButton title={busy ? 'פותח…' : 'פתח'} colors={['#7C3AED', '#DB2777']} onPress={go} disabled={busy} style={{ marginTop: 16 }} />
      {!forgot ? (
        <GhostButton title="שכחתי את הסיסמה" onPress={() => setForgot(true)} style={{ marginTop: 10, borderWidth: 0 }} />
      ) : (
        <View style={{ marginTop: 16, backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.red }}>
          <T dim size={14} style={{ lineHeight: 20 }}>
            השיחות כאן מוצפנות בסיסמה הזו בלבד. אפשר למחוק אותן ולהתחיל מחדש עם סיסמה חדשה. היומן הרגיל לא יימחק.
          </T>
          <Row style={{ gap: 10, marginTop: 12 }}>
            <GhostButton title="ביטול" onPress={() => setForgot(false)} style={{ flex: 1 }} />
            <GhostButton
              title="מחק והתחל מחדש"
              color={colors.red}
              style={{ flex: 1, borderColor: colors.red }}
              onPress={async () => {
                await wipeVent();
                onWiped();
              }}
            />
          </Row>
        </View>
      )}
    </ScrollView>
  );
}

function Room({ ventKey, onLock, onWiped }: { ventKey: Uint8Array; onLock: () => void; onWiped: () => void }) {
  const { settings } = useStore();
  const [data, setData] = useState<VentData>({ sessions: [] });
  const [session, setSession] = useState<VentSession | null>(null);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const aiRef = useRef<Awaited<ReturnType<typeof loadAiConfig>> | null>(null);

  // No screenshots or screen recording while the room is open; blur in the app switcher (iOS)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenCapture.preventScreenCaptureAsync('vent').catch(() => {});
    ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync('vent').catch(() => {});
      ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    loadVent(ventKey).then((d) => {
      setData(d);
      startSession(d);
    });
    loadAiConfig().then((c) => {
      aiRef.current = c;
      setUseAi(aiReady(c, 'vent'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [session, typing, crisis]);

  const startSession = (d: VentData) => {
    const greeting = VENT_GREETINGS[Math.floor(Math.random() * VENT_GREETINGS.length)];
    const name = settings.userName ? `${settings.userName}, ` : '';
    setSession({ id: newId(), startedAt: new Date().toISOString(), messages: [{ from: 'bot', text: name + greeting }] });
    setCrisis(false);
    setData(d);
  };

  const persist = (s: VentSession) => {
    setData((d) => {
      const next = { sessions: [s, ...d.sessions.filter((x) => x.id !== s.id)] };
      saveVent(ventKey, next).catch(() => {});
      return next;
    });
  };

  const send = async () => {
    const t = input.trim();
    if (!t || !session || typing) return;
    tap();
    setInput('');
    if (detectCrisis(t)) setCrisis(true);
    const withMe: VentSession = { ...session, messages: [...session.messages, { from: 'me', text: t }] };
    setSession(withMe);
    persist(withMe);
    setTyping(true);
    let reply: string;
    const mine = withMe.messages.filter((m) => m.from === 'me');
    const turns = mine.length - 1;
    const crisisCount = mine.slice(0, -1).filter((m) => detectCrisis(m.text)).length;
    if (useAi && aiRef.current) {
      try {
        reply = await aiChat(aiRef.current, 'vent', withMe.messages, { name: settings.userName || undefined });
      } catch {
        setUseAi(false);
        reply = offlineVentReply(t, turns, crisisCount);
      }
    } else {
      await new Promise((r) => setTimeout(r, 900));
      reply = offlineVentReply(t, turns, crisisCount);
    }
    setTyping(false);
    const withBot: VentSession = { ...withMe, messages: [...withMe.messages, { from: 'bot', text: reply } as ChatMessage] };
    setSession(withBot);
    persist(withBot);
  };

  const past = data.sessions.filter((s) => s.id !== session?.id && s.messages.some((m) => m.from === 'me'));

  return (
    <View style={{ flex: 1 }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Row style={{ alignItems: 'center', gap: 10 }}>
          <BotAvatar emoji="🫂" />
          <View>
            <T bold size={17}>
              המקום לפרוק
            </T>
            <T dim size={12}>
              {typing ? 'כותב…' : useAi ? '✨ AI · מוצפן ופרטי' : 'מוצפן ופרטי'}
            </T>
          </View>
        </Row>
        <Row style={{ gap: 14, alignItems: 'center' }}>
          <Pressable onPress={() => setShowHistory((v) => !v)} hitSlop={10} accessibilityLabel="שיחות קודמות">
            <Ionicons name="folder-open-outline" size={23} color={colors.textDim} />
          </Pressable>
          <Pressable onPress={() => startSession(data)} hitSlop={10} accessibilityLabel="שיחה חדשה">
            <Ionicons name="create-outline" size={23} color={colors.textDim} />
          </Pressable>
          <Pressable onPress={onLock} hitSlop={10} accessibilityLabel="נעל">
            <Ionicons name="lock-closed-outline" size={23} color={colors.textDim} />
          </Pressable>
        </Row>
      </Row>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {showHistory && (
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 6 }}>
            <T bold style={{ marginBottom: 8 }}>
              שיחות קודמות
            </T>
            {past.length === 0 && <T dim size={14}>עוד אין שיחות קודמות</T>}
            {past.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  setSession(s);
                  setCrisis(s.messages.some((m) => m.from === 'me' && detectCrisis(m.text)));
                  setShowHistory(false);
                }}
                style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}
              >
                <T size={14} bold>
                  {formatShortDate(s.startedAt)} · {formatTime(s.startedAt)}
                </T>
                <T dim size={13} numberOfLines={1}>
                  {s.messages.find((m) => m.from === 'me')?.text}
                </T>
              </Pressable>
            ))}
            {!confirmWipe ? (
              <GhostButton title="🗑️ מחק את כל השיחות" color={colors.red} onPress={() => setConfirmWipe(true)} style={{ marginTop: 10, borderColor: colors.red }} />
            ) : (
              <Row style={{ gap: 8, marginTop: 10 }}>
                <GhostButton title="ביטול" onPress={() => setConfirmWipe(false)} style={{ flex: 1 }} />
                <GhostButton
                  title="כן, למחוק הכל"
                  color={colors.red}
                  style={{ flex: 1, borderColor: colors.red }}
                  onPress={async () => {
                    await wipeVent();
                    onWiped();
                  }}
                />
              </Row>
            )}
          </View>
        )}

        {session?.messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}
        {typing && <Bubble msg={{ from: 'bot', text: '• • •' }} />}

        {crisis && <CrisisCard />}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 10, backgroundColor: colors.bgDeep }}>
        <Row style={{ alignItems: 'flex-end', gap: 8 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="כתוב כל מה שעל הלב…"
            placeholderTextColor={colors.textMute}
            multiline
            style={{
              flex: 1,
              minWidth: 0,
              maxHeight: 140,
              backgroundColor: colors.card,
              color: colors.text,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 16,
              ...rtl,
            }}
          />
          <Pressable
                  accessibilityLabel="שלח"
            onPress={send}
            disabled={!input.trim() || typing}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: input.trim() && !typing ? colors.pink : colors.cardHi,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="send" size={19} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
          </Pressable>
        </Row>
      </View>
    </View>
  );
}
