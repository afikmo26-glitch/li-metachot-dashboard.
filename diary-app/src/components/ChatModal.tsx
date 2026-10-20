import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, ScrollViewInstance, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { detectCrisis } from '../lib/vent';
import CrisisCard from './CrisisCard';
import { AiConfig, aiChat, aiReady, aiSummarize, buildProfile, EMPTY_AI, loadAiConfig } from '../lib/ai';
import { persistRecording } from '../lib/audio';
import {
  Answer,
  BotQuestion,
  composeEntryText,
  moodFromAnswer,
  namesQuestion,
  nextQuestion,
  openingQuestion,
  personNotes,
  reactTo,
  saidQuotes,
  shouldAskNames,
  tomorrowNote,
} from '../lib/interviewer';
import { extractQuotes, findKnownPeople, suggestNewNames } from '../lib/names';
import { scheduleMorningRecap, scheduleTomorrowReminder } from '../lib/notifications';
import { newId, useStore } from '../lib/store';
import { colors, gradients, layout, MOODS, rtl } from '../lib/theme';
import type { ChatMessage, Entry, Person } from '../lib/types';
import { Chip, GhostButton, GradientButton, notify, Row, T, tap } from './ui';
import { t } from '../i18n';

export type PendingRecording = { uri: string; durationMs: number; startedAt: Date };

type Props = {
  visible: boolean;
  recording: PendingRecording | null;
  onClose: () => void;
  onSaved: (entry: Entry) => void;
};

/** What will be saved, whichever mode wrote it. */
type Draft = {
  text: string;
  mood: number;
  notes: { name: string; note?: string }[];
  said: { name: string; text: string }[];
  tomorrow?: string;
};

export const BOT_NAME = t('יומי');

export default function ChatModal({ visible, recording, onClose, onSaved }: Props) {
  const { people, entries, settings, profile: me, addPerson, updatePerson, saveEntry } = useStore();
  const [ai, setAi] = useState<AiConfig>(EMPTY_AI);
  const [useAi, setUseAi] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [question, setQuestion] = useState<BotQuestion | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [input, setInput] = useState('');
  const [crisis, setCrisis] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profile = () => buildProfile(settings.userName, people, entries, me);
  const say = (text: string) => setMessages((m) => [...m, { from: 'bot', text }]);

  /** Offline mode: say an optional reaction, then the next scripted question (or finish). */
  const ask = (q: BotQuestion | null, reaction?: string, sofar: Answer[] = answers) => {
    setTyping(true);
    timer.current = setTimeout(() => {
      setTyping(false);
      if (reaction) say(reaction);
      if (q) {
        say(q.text);
        setQuestion(q);
      } else {
        setQuestion(null);
        setDraft(offlineDraft(sofar));
      }
    }, 700);
  };

  // Fresh conversation every time the chat opens
  useEffect(() => {
    if (!visible) return;
    setMessages(recording ? [{ from: 'bot', text: t('🎙️ ההקלטה שלך נשמרה. בוא נדבר עליה קצת.') }] : []);
    setAnswers([]);
    setDraft(null);
    setInput('');
    setQuestion(null);
    setCrisis(false);
    loadAiConfig().then((c) => {
      setAi(c);
      const on = aiReady(c, 'diary');
      setUseAi(on);
      const first = openingQuestion(settings.userName || undefined);
      if (on) {
        say(first.text);
      } else {
        ask(first, undefined, []);
      }
    });
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [messages, typing, draft]);

  const knownWith = (extra: { name: string }[]): Person[] => [
    ...people,
    ...extra.filter((n) => !people.some((p) => p.name === n.name)).map((n) => ({ id: `new:${n.name}`, name: n.name, firstSeen: '' })),
  ];

  const sendAi = async (history: ChatMessage[]) => {
    setTyping(true);
    try {
      say(await aiChat(ai, 'diary', history, profile()));
    } catch (e) {
      // Fall back to the offline interviewer, treating everything said so far as the opening answer
      say(t('⚠️ אין חיבור ל-AI ({err}). ממשיך במצב רגיל.', { err: (e as Error).message }));
      setUseAi(false);
      const opening: Answer = {
        question: openingQuestion(),
        text: history.filter((m) => m.from === 'me').map((m) => m.text).join('\n'),
      };
      setAnswers([opening]);
      ask(nextQuestion([opening], people), undefined, [opening]);
      return;
    } finally {
      setTyping(false);
    }
  };

  const send = (text: string) => {
    const msg = text.trim();
    if (!msg || typing || draft) return;
    tap();
    setInput('');
    const history = [...messages, { from: 'me' as const, text: msg }];
    setMessages(history);
    const danger = detectCrisis(msg);
    if (danger) setCrisis(true);

    if (useAi) {
      sendAi(history);
      return;
    }
    if (!question) return;
    if (danger) {
      // Pause the diary questions: take it seriously and point to real people
      setTyping(true);
      timer.current = setTimeout(() => {
        setTyping(false);
        say(t('אני ממש שמח שסיפרת לי, ואני לוקח את זה ברצינות 💗 כשעולות מחשבות כאלה מגיע לך שמישהו אמיתי יהיה איתך עכשיו. ער"ן זמינים 24/7 ב-1201. אתה בטוח כרגע? אני כאן, אפשר להמשיך לכתוב לי.'));
      }, 700);
      return;
    }
    const nextAnswers = [...answers, { question, text: msg }];
    setAnswers(nextAnswers);
    setQuestion(null);
    // People named in "who is X?" answers count as known from here on
    const known = knownWith(personNotes(nextAnswers));
    const newNames = question.kind === 'opening' || question.kind === 'topic' ? suggestNewNames(msg, people) : [];
    if (shouldAskNames(msg, newNames, nextAnswers.map((a) => a.question))) {
      ask(namesQuestion(), undefined, nextAnswers);
      return;
    }
    ask(nextQuestion(nextAnswers, known), reactTo(msg, question, newNames), nextAnswers);
  };

  const finishAi = async () => {
    if (typing) return;
    tap();
    setTyping(true);
    say(t('רגע, אני כותב את היומן… ✍️'));
    try {
      const s = await aiSummarize(ai, messages, profile());
      setDraft({
        text: s.entry,
        mood: Math.min(5, Math.max(1, Math.round(s.mood) || 3)),
        notes: s.people.map((p) => ({ name: p.name, note: p.note || undefined })),
        said: s.quotes,
        tomorrow: s.tomorrow || undefined,
      });
    } catch {
      const text = messages.filter((m) => m.from === 'me').map((m) => m.text).join('\n');
      setDraft({ text, mood: 3, notes: suggestNewNames(text, people).map((name) => ({ name })), said: [] });
    } finally {
      setTyping(false);
    }
  };

  const preview = useMemo(() => {
    if (!draft) return null;
    const list = knownWith([...draft.notes, ...draft.said]);
    const ids = [
      ...new Set([
        ...findKnownPeople(draft.text, list),
        ...[...draft.notes, ...draft.said].map((n) => list.find((p) => p.name === n.name)!.id),
      ]),
    ];
    return { list, ids };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, people]);

  const save = async () => {
    if (!draft || !preview) return;
    // Create people met during the chat, with their notes
    const all = [...people];
    for (const n of [...draft.notes, ...draft.said.map((q) => ({ name: q.name, note: undefined }))]) {
      if (!n.name.trim()) continue;
      const p = addPerson(n.name);
      if (n.note && !p.note) updatePerson({ ...p, note: n.note });
      if (!all.some((x) => x.id === p.id)) all.push(p);
    }
    const realId = (id: string) => (id.startsWith('new:') ? all.find((p) => p.name === id.slice(4))?.id : id);
    const ids = preview.ids.map(realId).filter((x): x is string => !!x);
    const quotes = [
      ...draft.said.map((q) => ({ personId: all.find((p) => p.name === q.name)?.id ?? '', text: q.text })).filter((q) => q.personId),
      ...extractQuotes(draft.text, all, ids),
    ];
    const id = newId();
    const entry: Entry = {
      id,
      createdAt: (recording?.startedAt ?? new Date()).toISOString(),
      text: draft.text,
      audioUri: recording ? await persistRecording(recording.uri, id) : undefined,
      durationMs: recording?.durationMs,
      mood: draft.mood,
      people: [...new Set([...ids, ...quotes.map((q) => q.personId)])],
      quotes,
      chat: messages,
    };
    saveEntry(entry);
    scheduleMorningRecap(settings, entry, all).catch(() => {});
    if (draft.tomorrow) scheduleTomorrowReminder(settings, draft.tomorrow).catch(() => {});
    notify('success');
    onSaved(entry);
  };

  const userTurns = messages.filter((m) => m.from === 'me').length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Row style={{ alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Row style={{ alignItems: 'center', gap: 10 }}>
              <BotAvatar />
              <View>
                <T bold size={18}>
                  {BOT_NAME}
                </T>
                <T dim size={12}>
                  {typing ? t('מקליד…') : useAi ? t('✨ AI · החבר שזוכר הכל') : t('החבר שזוכר הכל')}
                </T>
              </View>
            </Row>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>{t('סגור ✕')}</T>
            </Pressable>
          </Row>

          <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
            {messages.map((m, i) => (
              <Bubble key={i} msg={m} />
            ))}
            {typing && <Bubble msg={{ from: 'bot', text: '• • •' }} />}
            {crisis && <CrisisCard />}

            {draft && preview && (
              <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.primary, marginTop: 4 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <T bold>{t('📖 הרשומה של היום')}</T>
                  <Text style={{ fontSize: 24 }}>{MOODS[draft.mood - 1]}</Text>
                </Row>
                <T style={{ marginTop: 8, lineHeight: 22 }}>{draft.text || (recording ? t('🎙️ הקלטה קולית') : '—')}</T>
                {preview.ids.length > 0 && (
                  <Row style={{ flexWrap: 'wrap', marginTop: 10 }}>
                    {preview.ids.map((id) => (
                      <Chip key={id} active label={preview.list.find((p) => p.id === id)?.name ?? ''} />
                    ))}
                  </Row>
                )}
                {draft.tomorrow && (
                  <T dim size={13} style={{ marginTop: 6 }}>
                    {t('🔔 אזכיר לך מחר בבוקר: {note}', { note: draft.tomorrow })}
                  </T>
                )}
                <GradientButton title={t('שמור ביומן')} icon="💾" colors={gradients.primary} onPress={save} style={{ marginTop: 12 }} />
                <GhostButton title={useAi ? t('המשך לדבר') : t('ביטול')} onPress={() => (useAi ? setDraft(null) : onClose())} style={{ marginTop: 8 }} />
              </View>
            )}
          </ScrollView>

          {!draft && (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 10, backgroundColor: colors.bgDeep }}>
              {!useAi && question?.chips && !typing && (
                <Row style={{ flexWrap: 'wrap', marginBottom: 6 }}>
                  {question.chips.map((c) => (
                    <Chip key={c} label={c} onPress={() => send(c)} />
                  ))}
                </Row>
              )}
              {useAi && userTurns >= 2 && !typing && (
                <Row style={{ marginBottom: 8 }}>
                  <Chip label={t('✅ סיים וכתוב את היומן')} color={colors.green} onPress={finishAi} />
                </Row>
              )}
              <Row style={{ alignItems: 'flex-end', gap: 8 }}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder={t('כתוב או הכתב בקול עם 🎤 במקלדת…')}
                  placeholderTextColor={colors.textMute}
                  multiline
                  style={{
                    flex: 1,
                    minWidth: 0,
                    maxHeight: 120,
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
                  accessibilityLabel={t('שלח')}
                  onPress={() => send(input)}
                  disabled={!input.trim() || typing}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: input.trim() && !typing ? colors.primary : colors.cardHi,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="send" size={19} color="#fff" style={{ transform: [{ scaleX: layout.flip }] }} />
                </Pressable>
              </Row>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function offlineDraft(answers: Answer[]): Draft {
  return {
    text: composeEntryText(answers),
    mood: moodFromAnswer(answers.find((a) => a.question.kind === 'mood')?.text ?? ''),
    notes: personNotes(answers),
    said: saidQuotes(answers),
    tomorrow: tomorrowNote(answers),
  };
}

export function BotAvatar({ size = 40, emoji = '💜' }: { size?: number; emoji?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

export function Bubble({ msg }: { msg: ChatMessage }) {
  const mine = msg.from === 'me';
  // My messages sit at the reading end of the line: left in Hebrew/Arabic, right in English
  const left = mine === layout.isRTL;
  return (
    <View style={{ flexDirection: 'row', justifyContent: left ? 'flex-start' : 'flex-end' }}>
      <View
        style={{
          maxWidth: '82%',
          backgroundColor: mine ? colors.primary : colors.cardHi,
          borderRadius: 18,
          borderTopRightRadius: left ? 18 : 4,
          borderTopLeftRadius: left ? 4 : 18,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <T style={{ lineHeight: 22, color: mine ? colors.onPrimary : colors.text }}>{msg.text}</T>
      </View>
    </View>
  );
}
